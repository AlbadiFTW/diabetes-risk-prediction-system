import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";

/**
 * Get reminders for a medication
 */
export const getRemindersForMedication = query({
  args: {
    medicationId: v.id("medications"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const reminders = await ctx.db
      .query("medicationReminders")
      .withIndex("by_medication", (q) => q.eq("medicationId", args.medicationId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return reminders;
  },
});

/**
 * Get all upcoming reminders for a patient
 */
export const getUpcomingReminders = query({
  args: {
    patientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify access
    if (userId !== args.patientId) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .unique();

      if (!profile || profile.role !== "doctor") {
        throw new Error("Access denied");
      }
    }

    const now = Date.now();
    const reminders = await ctx.db
      .query("medicationReminders")
      .withIndex("by_patient_active", (q) =>
        q.eq("patientId", args.patientId).eq("isActive", true)
      )
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .filter((q) => q.gte(q.field("nextReminderDate"), now))
      .collect();

    // Get medication details for each reminder
    const remindersWithMedications = await Promise.all(
      reminders.map(async (reminder) => {
        const medication = await ctx.db.get(reminder.medicationId);
        return {
          ...reminder,
          medication: medication
            ? {
                name: medication.name,
                dosage: medication.dosage,
              }
            : null,
        };
      })
    );

    return remindersWithMedications.sort(
      (a, b) => a.nextReminderDate - b.nextReminderDate
    );
  },
});

/**
 * Create or update medication reminders
 */
export const updateMedicationReminders = mutation({
  args: {
    medicationId: v.id("medications"),
    reminderTimes: v.array(v.string()), // Array of times in HH:MM format
    enableReminders: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const medication = await ctx.db.get(args.medicationId);
    if (!medication) {
      throw new Error("Medication not found");
    }

    // Verify access
    if (userId !== medication.patientId) {
      throw new Error("Access denied");
    }

    // Update medication reminder settings
    await ctx.db.patch(args.medicationId, {
      enableReminders: args.enableReminders,
      reminderTimes: args.enableReminders ? args.reminderTimes : undefined,
    });

    // Delete existing reminders for this medication
    const existingReminders = await ctx.db
      .query("medicationReminders")
      .withIndex("by_medication", (q) => q.eq("medicationId", args.medicationId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    for (const reminder of existingReminders) {
      await ctx.db.patch(reminder._id, { isDeleted: true });
    }

    // Create new reminders if enabled
    if (args.enableReminders && args.reminderTimes.length > 0) {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      for (const timeStr of args.reminderTimes) {
        const [hours, minutes] = timeStr.split(":").map(Number);
        const reminderDate = new Date(today);
        reminderDate.setHours(hours, minutes, 0, 0);

        // If time has passed today, set for tomorrow
        if (reminderDate.getTime() < now) {
          reminderDate.setDate(reminderDate.getDate() + 1);
        }

        await ctx.db.insert("medicationReminders", {
          medicationId: args.medicationId,
          patientId: medication.patientId,
          reminderTime: timeStr,
          nextReminderDate: reminderDate.getTime(),
          isActive: true,
          isDeleted: false,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Mark reminder as sent and schedule next one
 */
export const markReminderSent = internalMutation({
  args: {
    reminderId: v.id("medicationReminders"),
  },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || !reminder.isActive) {
      return;
    }

    const medication = await ctx.db.get(reminder.medicationId);
    if (!medication || !medication.isActive) {
      // Medication is no longer active, deactivate reminder
      await ctx.db.patch(args.reminderId, { isActive: false });
      return;
    }

    // Calculate next reminder date (tomorrow at same time)
    const nextDate = new Date(reminder.nextReminderDate);
    nextDate.setDate(nextDate.getDate() + 1);

    await ctx.db.patch(args.reminderId, {
      lastSent: Date.now(),
      nextReminderDate: nextDate.getTime(),
    });
  },
});

/**
 * Delete a medication reminder
 */
export const deleteReminder = mutation({
  args: {
    reminderId: v.id("medicationReminders"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) {
      throw new Error("Reminder not found");
    }

    // Verify access
    if (userId !== reminder.patientId) {
      throw new Error("Access denied");
    }

    // Soft delete the reminder
    await ctx.db.patch(args.reminderId, { isDeleted: true, isActive: false });

    return { success: true };
  },
});

/**
 * Update a medication reminder time
 */
export const updateReminderTime = mutation({
  args: {
    reminderId: v.id("medicationReminders"),
    newTime: v.string(), // New time in HH:MM format
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || reminder.isDeleted) {
      throw new Error("Reminder not found");
    }

    // Verify access
    if (userId !== reminder.patientId) {
      throw new Error("Access denied");
    }

    // Validate time format
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(args.newTime)) {
      throw new Error("Invalid time format. Use HH:MM (e.g., 08:00)");
    }

    // Calculate next reminder date with new time
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const [hours, minutes] = args.newTime.split(":").map(Number);
    const reminderDate = new Date(today);
    reminderDate.setHours(hours, minutes, 0, 0);

    // If time has passed today, set for tomorrow
    if (reminderDate.getTime() < now) {
      reminderDate.setDate(reminderDate.getDate() + 1);
    }

    // Update reminder
    await ctx.db.patch(args.reminderId, {
      reminderTime: args.newTime,
      nextReminderDate: reminderDate.getTime(),
    });

    return { success: true };
  },
});

/**
 * Send medication reminder notification
 */
export const sendMedicationReminderNotification = mutation({
  args: {
    reminderId: v.id("medicationReminders"),
  },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || !reminder.isActive || reminder.isDeleted) {
      return { success: false, error: "Reminder not found or inactive" };
    }

    const medication = await ctx.db.get(reminder.medicationId);
    if (!medication || !medication.isActive) {
      // Medication is no longer active, deactivate reminder
      await ctx.db.patch(args.reminderId, { isActive: false });
      return { success: false, error: "Medication is no longer active" };
    }

    // Create in-app notification
    await ctx.runMutation(api.dashboard.createNotification, {
      recipientId: reminder.patientId,
      type: "medication_reminder",
      title: "Medication Reminder",
      message: `Time to take your medication: ${medication.name} (${medication.dosage})`,
      priority: "high",
      actionUrl: "/dashboard?tab=medications",
    });

    // Get patient profile to check email preferences
    const profile = await ctx.runQuery(api.users.getUserProfile, {
      userId: reminder.patientId,
    });

    // Send email if notifications are enabled
    if (profile?.emailNotifications) {
      const authUser = await ctx.runQuery(api.users.getUserEmail, {
        userId: reminder.patientId,
      });

      if (authUser?.email) {
        await ctx.scheduler.runAfter(0, api.emails.sendMedicationReminderEmail, {
          email: authUser.email,
          patientName: `${profile.firstName} ${profile.lastName}`,
          medicationName: medication.name,
          dosage: medication.dosage,
          reminderTime: reminder.reminderTime,
        });
      }
    }

    // Mark as sent and schedule next reminder
    await ctx.runMutation(internal.medicationReminders.markReminderSent, {
      reminderId: args.reminderId,
    });

    return { success: true };
  },
});

/**
 * Get due reminders (for cron job) - Internal query
 */
export const getDueReminders = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const reminders = await ctx.db
      .query("medicationReminders")
      .withIndex("by_next_reminder", (q) => q.lte("nextReminderDate", now))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return reminders;
  },
});

/**
 * Send medication reminder notifications (for cron job) - Internal action
 */
export const sendMedicationReminderNotifications = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all due reminders
    const dueReminders = await ctx.runQuery(internal.medicationReminders.getDueReminders, {});

    let sentCount = 0;

    for (const reminder of dueReminders) {
      try {
        // Get medication details - need to query medications table
        // Since we can't directly query in an action, we'll get the medication via the reminder's medicationId
        // We'll need to create a helper query or get it differently
        // For now, let's use the existing mutation that handles this
        await ctx.runMutation(api.medicationReminders.sendMedicationReminderNotification, {
          reminderId: reminder._id,
        });

        sentCount++;
      } catch (error: any) {
        console.error(`Failed to send reminder ${reminder._id}:`, error);
      }
    }

    return { sent: sentCount };
  },
});

/**
 * Test medication reminder (for manual testing) - Patient only
 */
export const testMedicationReminder = mutation({
  args: {
    reminderId: v.id("medicationReminders"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) {
      throw new Error("Reminder not found");
    }

    // Verify access - only the patient can test their own reminders
    if (userId !== reminder.patientId) {
      throw new Error("Access denied: Can only test your own reminders");
    }

    // Temporarily set nextReminderDate to past to make it due
    const originalDate = reminder.nextReminderDate;
    await ctx.db.patch(args.reminderId, {
      nextReminderDate: Date.now() - 1000, // Set to 1 second ago
    });

    try {
      // Call the notification mutation
      await ctx.runMutation(api.medicationReminders.sendMedicationReminderNotification, {
        reminderId: args.reminderId,
      });

      return { success: true, message: "Test reminder sent successfully" };
    } catch (error: any) {
      // Restore original date on error
      await ctx.db.patch(args.reminderId, {
        nextReminderDate: originalDate,
      });
      throw error;
    }
  },
});

