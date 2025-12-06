import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// Helper function to check if two users have an active assignment
async function hasActiveAssignment(
  ctx: QueryCtx | MutationCtx,
  userId1: Id<"users">,
  userId2: Id<"users">
): Promise<boolean> {
  // Check if userId1 is assigned to userId2 (or vice versa)
  const assignment1 = await ctx.db
    .query("patientAssignments")
    .withIndex("by_patient", (q) => q.eq("patientId", userId1))
    .filter((q) => q.eq(q.field("doctorId"), userId2))
    .filter((q) => q.eq(q.field("status"), "active"))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();

  if (assignment1) {
    return true;
  }

  // Check reverse direction
  const assignment2 = await ctx.db
    .query("patientAssignments")
    .withIndex("by_patient", (q) => q.eq("patientId", userId2))
    .filter((q) => q.eq(q.field("doctorId"), userId1))
    .filter((q) => q.eq(q.field("status"), "active"))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();

  return !!assignment2;
}

// Send a message
export const sendMessage = mutation({
  args: {
    recipientId: v.id("users"),
    content: v.string(),
    messageType: v.optional(v.union(v.literal("text"), v.literal("system"), v.literal("file"))),
    relatedResourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Validate content
    const trimmedContent = args.content.trim();
    if (!trimmedContent || trimmedContent.length === 0) {
      throw new Error("Message content cannot be empty");
    }

    if (trimmedContent.length > 5000) {
      throw new Error("Message content is too long (max 5000 characters)");
    }

    // Verify recipient exists
    const recipientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.recipientId))
      .unique();

    if (!recipientProfile) {
      throw new Error("Recipient not found");
    }

    // Get sender profile
    const senderProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!senderProfile) {
      throw new Error("Sender profile not found");
    }

    // Verify sender and recipient have different roles (patient <-> doctor)
    if (senderProfile.role === recipientProfile.role) {
      throw new Error("Messages can only be sent between patients and doctors");
    }

    // Verify they have an active assignment
    const hasAssignment = await hasActiveAssignment(ctx, userId, args.recipientId);
    if (!hasAssignment) {
      throw new Error("You can only message users you are assigned to");
    }

    // Create the message
    const messageId = await ctx.db.insert("messages", {
      senderId: userId,
      recipientId: args.recipientId,
      content: trimmedContent,
      isRead: false,
      messageType: args.messageType || "text",
      relatedResourceId: args.relatedResourceId,
    });

    // Create a notification for the recipient
    const senderName = `${senderProfile.firstName} ${senderProfile.lastName}`;
    await ctx.db.insert("notifications", {
      recipientId: args.recipientId,
      type: "system_update",
      title: "New Message",
      message: `You have a new message from ${senderName}`,
      priority: "medium",
      isRead: false,
      relatedResourceId: messageId.toString(),
    });

    // Send email notification if recipient has email notifications enabled
    if (recipientProfile && (recipientProfile.emailNotifications !== false)) {
      const authUser = await ctx.db.get(args.recipientId);
      const recipientEmail = authUser ? (authUser as any).email : null;
      if (recipientEmail) {
        try {
          await ctx.scheduler.runAfter(0, api.emails.sendNewMessageEmail, {
            email: recipientEmail,
            recipientName: `${recipientProfile.firstName} ${recipientProfile.lastName}`,
            senderName: senderName,
            messagePreview: trimmedContent.substring(0, 100) + (trimmedContent.length > 100 ? "..." : ""),
          });
        } catch (error) {
          console.error("Failed to schedule new message email:", error);
        }
      }
    }

    return messageId;
  },
});

// Get messages between current user and another user (conversation)
export const getConversation = query({
  args: {
    otherUserId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (!args.otherUserId) {
      return [];
    }

    // Verify they have an active assignment
    const hasAssignment = await hasActiveAssignment(ctx, userId, args.otherUserId);
    if (!hasAssignment) {
      throw new Error("You can only view messages with users you are assigned to");
    }

    // Get messages where current user is sender or recipient
    const otherUserId = args.otherUserId; // Store in const to narrow type
    const allMessages = await ctx.db
      .query("messages")
      .filter((q) =>
        q.or(
          q.and(q.eq(q.field("senderId"), userId), q.eq(q.field("recipientId"), otherUserId)),
          q.and(q.eq(q.field("senderId"), otherUserId), q.eq(q.field("recipientId"), userId))
        )
      )
      .order("desc")
      .take(args.limit || 50);

    // Reverse to show oldest first
    return allMessages.reverse();
  },
});

// Get all conversations for the current user
export const getConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is anonymous (guest) - they don't have profiles
    const authUser = await ctx.db.get(userId);
    const email = authUser ? (authUser as any).email ?? null : null;
    const isGuest = !email;

    // Guest users don't have profiles, return empty conversations
    if (isGuest) {
      return [];
    }

    // Get user profile to determine role
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    // Get all messages where user is sender or recipient
    const sentMessages = await ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .collect();

    const receivedMessages = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .collect();

    // Get unique conversation partners
    const conversationPartners = new Set<Id<"users">>();
    
    sentMessages.forEach((msg) => conversationPartners.add(msg.recipientId));
    receivedMessages.forEach((msg) => conversationPartners.add(msg.senderId));

    // Get conversation summaries
    const conversations = await Promise.all(
      Array.from(conversationPartners).map(async (partnerId) => {
        // Verify they have an active assignment
        const hasAssignment = await hasActiveAssignment(ctx, userId, partnerId);
        if (!hasAssignment) {
          return null;
        }

        // Get partner profile
        const partnerProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", partnerId))
          .unique();

        if (!partnerProfile) {
          return null;
        }

        // Get latest message
        const latestMessage = await ctx.db
          .query("messages")
          .filter((q) =>
            q.or(
              q.and(q.eq(q.field("senderId"), userId), q.eq(q.field("recipientId"), partnerId)),
              q.and(q.eq(q.field("senderId"), partnerId), q.eq(q.field("recipientId"), userId))
            )
          )
          .order("desc")
          .first();

        // Count unread messages
        const unreadCount = await ctx.db
          .query("messages")
          .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
          .filter((q) => q.eq(q.field("senderId"), partnerId))
          .filter((q) => q.eq(q.field("isRead"), false))
          .collect();

        return {
          partnerId,
          partner: {
            firstName: partnerProfile.firstName,
            lastName: partnerProfile.lastName,
            role: partnerProfile.role,
            profileImageUrl: partnerProfile.profileImageUrl,
          },
          latestMessage: latestMessage
            ? {
                content: latestMessage.content,
                sentAt: latestMessage._creationTime,
                isFromMe: latestMessage.senderId === userId,
              }
            : null,
          unreadCount: unreadCount.length,
        };
      })
    );

    // Filter out nulls and sort by latest message time
    return conversations
      .filter((conv) => conv !== null)
      .sort((a, b) => {
        if (!a || !b) return 0;
        const timeA = a.latestMessage?.sentAt || 0;
        const timeB = b.latestMessage?.sentAt || 0;
        return timeB - timeA;
      });
  },
});

// Mark messages as read
export const markMessagesAsRead = mutation({
  args: {
    senderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get all unread messages from this sender
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .filter((q) => q.eq(q.field("senderId"), args.senderId))
      .filter((q) => q.eq(q.field("isRead"), false))
      .collect();

    // Mark them as read
    const now = Date.now();
    for (const message of unreadMessages) {
      await ctx.db.patch(message._id, {
        isRead: true,
        readAt: now,
      });
    }

    return { markedCount: unreadMessages.length };
  },
});

// Get unread message count
export const getUnreadMessageCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .filter((q) => q.eq(q.field("isRead"), false))
      .collect();

    return unreadMessages.length;
  },
});

// Delete a message (only sender can delete their own messages)
export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify the user is the sender
    if (message.senderId !== userId) {
      throw new Error("You can only delete your own messages");
    }

    // Verify they have an active assignment with the recipient
    const hasAssignment = await hasActiveAssignment(ctx, userId, message.recipientId);
    if (!hasAssignment) {
      throw new Error("You can only delete messages from active conversations");
    }

    // Delete the message
    await ctx.db.delete(args.messageId);

    return { success: true };
  },
});

// Get assigned users for messaging (patients get their doctor, doctors get their patients)
export const getAssignedUsersForMessaging = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is anonymous (guest) - they don't have profiles
    const authUser = await ctx.db.get(userId);
    const email = authUser ? (authUser as any).email ?? null : null;
    const isGuest = !email;

    // Guest users don't have profiles, return empty conversations
    if (isGuest) {
      return [];
    }

    // Get user profile to determine role
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const assignedUsers: Array<{
      userId: Id<"users">;
      firstName: string;
      lastName: string;
      role: "patient" | "doctor";
      profileImageUrl?: string;
    }> = [];

    if (userProfile.role === "patient") {
      // Get the patient's assigned doctor
      const assignments = await ctx.db
        .query("patientAssignments")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      for (const assignment of assignments) {
        const doctorProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", assignment.doctorId))
          .unique();

        if (doctorProfile) {
          let profileImageUrl = doctorProfile.profileImageUrl;
          if (!profileImageUrl && doctorProfile.profileImageId) {
            profileImageUrl = (await ctx.storage.getUrl(doctorProfile.profileImageId)) ?? undefined;
          }

          assignedUsers.push({
            userId: assignment.doctorId,
            firstName: doctorProfile.firstName,
            lastName: doctorProfile.lastName,
            role: "doctor",
            profileImageUrl,
          });
        }
      }
    } else if (userProfile.role === "doctor") {
      // Get the doctor's assigned patients
      const assignments = await ctx.db
        .query("patientAssignments")
        .withIndex("by_doctor", (q) => q.eq("doctorId", userId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      for (const assignment of assignments) {
        const patientProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", assignment.patientId))
          .unique();

        if (patientProfile) {
          let profileImageUrl = patientProfile.profileImageUrl;
          if (!profileImageUrl && patientProfile.profileImageId) {
            profileImageUrl = (await ctx.storage.getUrl(patientProfile.profileImageId)) ?? undefined;
          }

          assignedUsers.push({
            userId: assignment.patientId,
            firstName: patientProfile.firstName,
            lastName: patientProfile.lastName,
            role: "patient",
            profileImageUrl,
          });
        }
      }
    }

    return assignedUsers;
  },
});

