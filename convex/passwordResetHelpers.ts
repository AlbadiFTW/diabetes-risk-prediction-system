import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Internal mutation to update password hash (called by action)
export const updatePasswordHash = mutation({
  args: {
    userId: v.id("users"),
    hashedPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Find the password account
    const passwordAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .filter((q) => q.eq(q.field("provider"), "password"))
      .first();

    if (!passwordAccount) {
      return { success: false, error: "Password account not found" };
    }

    // Update the password hash in the auth account
    await ctx.db.patch(passwordAccount._id, {
      passwordHash: args.hashedPassword,
    } as any);

    return { success: true };
  },
});

// Helper mutation to get user by email
export const getUserByEmail = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args): Promise<{ userId: Id<"users"> | null }> => {
    const authUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (!authUser) {
      return { userId: null };
    }

    return { userId: authUser._id };
  },
});

// Helper mutation to get current user ID
export const getCurrentUserId = mutation({
  args: {},
  handler: async (ctx): Promise<{ userId: Id<"users"> | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { userId: null };
    }
    return { userId };
  },
});



