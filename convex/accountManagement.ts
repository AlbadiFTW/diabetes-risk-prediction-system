"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import bcrypt from "bcryptjs";

// Change email address (requires verification of new email)
export const changeEmail = action({
  args: {
    newEmail: v.string(),
    verificationCode: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.newEmail)) {
      return { success: false, error: "Invalid email format" };
    }

    // Verify the code for the new email
    const verifyResult: { success: boolean; error?: string } = await ctx.runMutation(
      api.emailVerification.verifyCode,
      { email: args.newEmail, code: args.verificationCode }
    );

    if (!verifyResult.success) {
      return { success: false, error: verifyResult.error };
    }

    // Get current user
    const userIdResult = await ctx.runMutation(api.passwordResetHelpers.getCurrentUserId, {});
    if (!userIdResult || !userIdResult.userId) {
      return { success: false, error: "User not found" };
    }

    // Update email in users table
    const updateResult = await ctx.runMutation(api.accountManagementHelpers.updateUserEmail, {
      userId: userIdResult.userId,
      newEmail: args.newEmail,
    });

    return updateResult;
  },
});

// Change password (requires current password)
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Validate password strength
    if (args.newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long" };
    }

    // Get current user
    const userIdResult = await ctx.runMutation(api.passwordResetHelpers.getCurrentUserId, {});
    if (!userIdResult || !userIdResult.userId) {
      return { success: false, error: "User not found" };
    }

    // Get password hash
    const hashResult = await ctx.runMutation(api.accountManagementHelpers.getPasswordHash, {
      userId: userIdResult.userId,
    });

    if (!hashResult.passwordHash) {
      return { success: false, error: "Password account not found" };
    }

    // Verify current password using bcrypt
    const isPasswordValid = await bcrypt.compare(args.currentPassword, hashResult.passwordHash);
    if (!isPasswordValid) {
      return { success: false, error: "Current password is incorrect" };
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(args.newPassword, 10);

    // Update the password
    const updateResult = await ctx.runMutation(api.passwordResetHelpers.updatePasswordHash, {
      userId: userIdResult.userId,
      hashedPassword: hashedPassword,
    });

    return updateResult;
  },
});

