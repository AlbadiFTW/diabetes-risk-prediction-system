import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// Submit a support message (can be from unauthenticated users)
export const submitSupportMessage = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    subject: v.string(),
    message: v.string(),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
  },
  handler: async (ctx, args) => {
    // Get user ID if authenticated (optional)
    const userId = await getAuthUserId(ctx);

    // Determine priority if not provided
    const priority = args.priority || "medium";

    // Create support message
    const supportMessageId = await ctx.db.insert("supportMessages", {
      email: args.email,
      name: args.name,
      subject: args.subject,
      message: args.message,
      status: "open",
      priority: priority,
      userId: userId || undefined, // Convert null to undefined
      isRead: false,
    });

    // Notify all admins about the new support message
    const admins = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    for (const admin of admins) {
      await ctx.db.insert("notifications", {
        recipientId: admin.userId,
        type: "support_message",
        title: "New Support Message",
        message: `New support request: ${args.subject}`,
        priority: priority === "urgent" ? "urgent" : priority === "high" ? "high" : "medium",
        isRead: false,
        relatedResourceId: supportMessageId.toString(),
      });
    }

    return { success: true, supportMessageId };
  },
});

// Get all support messages (admin only)
export const getAllSupportMessages = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed"), v.literal("all"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    let messages = await ctx.db.query("supportMessages").collect();

    // Filter by status
    if (args.status && args.status !== "all") {
      messages = messages.filter((m) => m.status === args.status);
    }

    // Filter by priority
    if (args.priority && args.priority !== "all") {
      messages = messages.filter((m) => m.priority === args.priority);
    }

    // Sort by creation time (newest first)
    messages.sort((a, b) => ((b as any)._creationTime || 0) - ((a as any)._creationTime || 0));

    return messages;
  },
});

// Get unread support message count (admin only)
export const getUnreadSupportCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.role !== "admin") {
      return 0;
    }

    const unreadMessages = await ctx.db
      .query("supportMessages")
      .withIndex("by_is_read", (q) => q.eq("isRead", false))
      .collect();

    return unreadMessages.length;
  },
});

// Mark support message as read (admin only)
export const markSupportMessageAsRead = mutation({
  args: {
    supportMessageId: v.id("supportMessages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    await ctx.db.patch(args.supportMessageId, {
      isRead: true,
      readAt: Date.now(),
    });

    return { success: true };
  },
});

// Update support message status (admin only)
export const updateSupportMessageStatus = mutation({
  args: {
    supportMessageId: v.id("supportMessages"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    await ctx.db.patch(args.supportMessageId, {
      status: args.status,
    });

    return { success: true };
  },
});

// Delete a support message (admin only)
export const deleteSupportMessage = mutation({
  args: {
    supportMessageId: v.id("supportMessages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    await ctx.db.delete(args.supportMessageId);
    return { success: true };
  },
});

// Respond to support message (admin only)
export const respondToSupportMessage = mutation({
  args: {
    supportMessageId: v.id("supportMessages"),
    response: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    // Get the support message to get the user's email
    const supportMessage = await ctx.db.get(args.supportMessageId);
    if (!supportMessage) {
      throw new Error("Support message not found");
    }

    // Update the support message
    await ctx.db.patch(args.supportMessageId, {
      adminResponse: args.response,
      respondedBy: profile._id,
      respondedAt: Date.now(),
      status: "resolved",
      isRead: true,
      readAt: Date.now(),
    });

    // Schedule email to be sent (fire and forget)
    try {
      await ctx.scheduler.runAfter(0, api.emails.sendSupportResponseEmail, {
        email: supportMessage.email,
        name: supportMessage.name,
        subject: supportMessage.subject,
        response: args.response,
      });
    } catch (error) {
      console.error("Failed to schedule support response email:", error);
      // Don't throw - email sending failure shouldn't prevent the response from being saved
    }

    return { success: true };
  },
});

