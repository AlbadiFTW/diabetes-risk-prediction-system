import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper mutation to update user email
export const updateUserEmail = mutation({
  args: {
    userId: v.id("users"),
    newEmail: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Check if email is already in use
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.newEmail))
      .first();

    if (existingUser && existingUser._id !== args.userId) {
      return { success: false, error: "This email is already in use by another account" };
    }

    // Update email in users table (this is what Convex Auth uses for authentication)
    await ctx.db.patch(args.userId, {
      email: args.newEmail,
    } as any);

    // Also update providerAccountId in authAccounts table if it exists
    // Convex Auth uses providerAccountId to store the email for password accounts
    const passwordAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .filter((q) => q.eq(q.field("provider"), "password"))
      .first();

    if (passwordAccount) {
      await ctx.db.patch(passwordAccount._id, {
        providerAccountId: args.newEmail,
      } as any);
    }

    // Reset email verification status in user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        isEmailVerified: false,
        emailVerifiedAt: undefined,
      } as any);
    }

    return { success: true };
  },
});

// Helper mutation to get password hash for verification
export const getPasswordHash = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ passwordHash: string | null }> => {
    // Find the password account
    const passwordAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .filter((q) => q.eq(q.field("provider"), "password"))
      .first();

    if (!passwordAccount) {
      return { passwordHash: null };
    }

    return { passwordHash: (passwordAccount as any).passwordHash || null };
  },
});

