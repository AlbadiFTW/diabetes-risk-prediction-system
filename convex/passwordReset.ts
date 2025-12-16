"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import bcrypt from "bcryptjs";

// Reset password using verification code (action that uses Node.js for bcrypt)
export const resetPassword = action({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Validate password strength
    if (args.newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long" };
    }

    // First verify the code (without marking as used)
    const verifyResult: { success: boolean; error?: string } = await ctx.runMutation(
      api.emailVerification.verifyPasswordResetCode,
      { email: args.email, code: args.code }
    );

    if (!verifyResult.success) {
      return { success: false, error: verifyResult.error };
    }

    // Get user by email
    const userResult = await ctx.runMutation(api.passwordResetHelpers.getUserByEmail, {
      email: args.email,
    });

    if (!userResult || !userResult.userId) {
      return { success: false, error: "User not found" };
    }

    // Hash the new password (using Node.js bcrypt)
    const hashedPassword = await bcrypt.hash(args.newPassword, 10);

    // Update the password hash using mutation
    const updateResult = await ctx.runMutation(api.passwordResetHelpers.updatePasswordHash, {
      userId: userResult.userId,
      hashedPassword: hashedPassword,
    });

    // Only mark code as used after password is successfully updated
    if (updateResult.success) {
      await ctx.runMutation(api.passwordResetHelpers.markPasswordResetCodeAsUsed, {
        email: args.email,
        code: args.code,
      });
    }

    return updateResult;
  },
});
