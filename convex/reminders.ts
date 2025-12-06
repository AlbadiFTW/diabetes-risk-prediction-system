import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// Get patient's active reminder
export const getPatientReminder = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const reminder = await ctx.db
      .query("assessmentReminders")
      .withIndex("by_patient_active", (q) => q.eq("patientId", userId).eq("isActive", true))
      .first();

    return reminder;
  },
});

// Create or update assessment reminder
export const setAssessmentReminder = mutation({
  args: {
    frequency: v.union(
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("custom")
    ),
    customDays: v.optional(v.number()), // For custom frequency
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get last assessment date
    const lastPrediction = await ctx.db
      .query("riskPredictions")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .first();

    const lastAssessmentDate = lastPrediction ? (lastPrediction as any)._creationTime : Date.now();

    // Calculate reminder date based on frequency
    let reminderDate = Date.now();
    const daysToAdd: Record<string, number> = {
      weekly: 7,
      biweekly: 14,
      monthly: 30,
      quarterly: 90,
      custom: args.customDays || 30,
    };

    reminderDate = lastAssessmentDate + (daysToAdd[args.frequency] * 24 * 60 * 60 * 1000);

    // Deactivate existing reminders
    const existingReminders = await ctx.db
      .query("assessmentReminders")
      .withIndex("by_patient_active", (q) => q.eq("patientId", userId).eq("isActive", true))
      .collect();

    for (const reminder of existingReminders) {
      await ctx.db.patch(reminder._id, { isActive: false });
    }

    // Create new reminder
    const reminderId = await ctx.db.insert("assessmentReminders", {
      patientId: userId,
      reminderDate,
      frequency: args.frequency,
      lastAssessmentDate,
      isActive: true,
    });

    return reminderId;
  },
});

// Get patients who need reminders (for scheduled job)
export const getPatientsNeedingReminders = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const reminders = await ctx.db
      .query("assessmentReminders")
      .withIndex("by_reminder_date", (q) => q.lte("reminderDate", now))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get patient profiles
    const patientsWithReminders = await Promise.all(
      reminders.map(async (reminder) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", reminder.patientId))
          .unique();

        const authUser = await ctx.db.get(reminder.patientId);
        const email = authUser ? (authUser as any).email : null;

        return {
          ...reminder,
          patientName: profile ? `${profile.firstName} ${profile.lastName}` : "Unknown",
          email,
          emailNotifications: profile?.emailNotifications ?? true,
        };
      })
    );

    return patientsWithReminders;
  },
});

// Mark reminder as sent
export const markReminderSent = mutation({
  args: {
    reminderId: v.id("assessmentReminders"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reminderId, {
      sentAt: Date.now(),
    });
  },
});

// Send reminder notification
// Note: This is a mutation (not an action) so it can access the database directly.
export const sendReminderNotification = mutation({
  args: {
    patientId: v.id("users"),
    reminderId: v.id("assessmentReminders"),
  },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || !reminder.isActive) {
      return { success: false, error: "Reminder not found or inactive" };
    }

    // Create notification
    await ctx.runMutation(api.dashboard.createNotification, {
      recipientId: args.patientId,
      type: "assessment_reminder",
      title: "Time for Your Next Health Assessment",
      message: "It's time to complete your next diabetes risk assessment. Regular monitoring helps track your health progress.",
      priority: "medium",
      actionUrl: "/dashboard?tab=assessment",
    });

    // Mark as sent
    await ctx.db.patch(args.reminderId, {
      sentAt: Date.now(),
    });

    // Get patient email if notifications enabled
    const profile = await ctx.runQuery(api.users.getUserProfile, {
      userId: args.patientId,
    });

    if (profile?.emailNotifications) {
      const authUser = await ctx.runQuery(api.users.getUserEmail, {
        userId: args.patientId,
      });

      if (authUser?.email) {
        // Schedule email (you can implement email sending here)
        // await ctx.scheduler.runAfter(0, api.emails.sendAssessmentReminderEmail, {
        //   email: authUser.email,
        //   patientName: `${profile.firstName} ${profile.lastName}`,
        // });
      }
    }

    return { success: true };
  },
});

// Update reminder after new assessment
export const updateReminderAfterAssessment = mutation({
  args: {
    patientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const reminder = await ctx.db
      .query("assessmentReminders")
      .withIndex("by_patient_active", (q) => q.eq("patientId", args.patientId).eq("isActive", true))
      .first();

    if (reminder) {
      const now = Date.now();
      const daysToAdd: Record<string, number> = {
        weekly: 7,
        biweekly: 14,
        monthly: 30,
        quarterly: 90,
        custom: 30,
      };

      const newReminderDate = now + (daysToAdd[reminder.frequency] * 24 * 60 * 60 * 1000);

      await ctx.db.patch(reminder._id, {
        reminderDate: newReminderDate,
        lastAssessmentDate: now,
        sentAt: undefined, // Reset sent status
      });
    }
  },
});

