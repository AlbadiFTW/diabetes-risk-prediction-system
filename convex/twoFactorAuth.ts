/**
 * Two-Factor Authentication (2FA) Backend Functions
 * 
 * This file contains queries and mutations for managing two-factor authentication.
 * Actions that require Node.js APIs (like crypto) are in twoFactorAuthActions.ts
 * 
 * Features:
 * - TOTP (Time-based One-Time Password) via authenticator apps
 * - SMS-based verification codes
 * - Backup codes for account recovery
 * - Enable/disable 2FA
 * 
 * Security Notes:
 * - TOTP secrets should be encrypted in production
 * - SMS codes expire after 10 minutes
 * - Maximum 5 verification attempts per code
 * - Backup codes are single-use
 * 
 * @module convex/twoFactorAuth
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

/**
 * Enable TOTP 2FA (internal mutation)
 * 
 * Called by verifyTOTPSetup action after successful TOTP verification.
 * Stores the TOTP secret and backup codes in the user profile.
 * 
 * @param secret - Base32-encoded TOTP secret
 * @param backupCodes - Array of 10 backup codes for account recovery
 * @returns { success: true } on success
 * @throws Error if user is not authenticated or profile not found
 */
export const enableTOTP2FA = mutation({
  args: {
    secret: v.string(),
    backupCodes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    await ctx.db.patch(profile._id, {
      enable2FA: true,
      twoFactorMethod: "totp",
      totpSecret: args.secret, // In production, encrypt this
      totpBackupCodes: args.backupCodes,
    });

    return { success: true };
  },
});

/**
 * Store SMS verification code
 * 
 * Stores a 6-digit SMS verification code for 2FA.
 * Deletes any existing codes for the user before storing a new one.
 * Codes expire after 10 minutes.
 * 
 * @param userId - The user ID to store the code for
 * @param code - The 6-digit verification code
 * @returns { success: true } on success
 * @throws Error if user not found
 */
export const storeSMSCode = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user email
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    const email = (user as any).email;

    // Delete old codes for this user
    const oldCodes = await ctx.db
      .query("verificationCodes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("type"), "2fa_sms"))
      .collect();

    for (const oldCode of oldCodes) {
      await ctx.db.delete(oldCode._id);
    }

    // Store new code (expires in 10 minutes)
    await ctx.db.insert("verificationCodes", {
      email,
      code: args.code,
      type: "2fa_sms",
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      used: false,
      attempts: 0,
      createdAt: Date.now(),
      userId: args.userId,
    });

    return { success: true };
  },
});

/**
 * Verify SMS code during sign-in
 * 
 * Verifies a 6-digit SMS code entered by the user during sign-in.
 * Implements rate limiting (max 5 attempts) and expiration (10 minutes).
 * 
 * @param userId - The user ID to verify the code for
 * @param code - The 6-digit code entered by the user
 * @returns { success: boolean, error?: string }
 * 
 * Security features:
 * - Codes expire after 10 minutes
 * - Maximum 5 verification attempts
 * - Codes are single-use (marked as used after successful verification)
 */
export const verifySMSCode = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    // Get verification code
    const verificationRecord = await ctx.db
      .query("verificationCodes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "2fa_sms"),
          q.eq(q.field("used"), false)
        )
      )
      .order("desc")
      .first();

    if (!verificationRecord) {
      return { success: false, error: "No verification code found. Please request a new one." };
    }

    // Check if expired
    if (Date.now() > verificationRecord.expiresAt) {
      await ctx.db.delete(verificationRecord._id);
      return { success: false, error: "Code has expired. Please request a new one." };
    }

    // Check attempts (max 5)
    if (verificationRecord.attempts >= 5) {
      await ctx.db.delete(verificationRecord._id);
      return { success: false, error: "Too many attempts. Please request a new code." };
    }

    // Check if code matches
    if (verificationRecord.code !== args.code) {
      await ctx.db.patch(verificationRecord._id, {
        attempts: verificationRecord.attempts + 1,
      });
      const remaining = 5 - (verificationRecord.attempts + 1);
      return {
        success: false,
        error: `Invalid code. ${remaining} attempts remaining.`,
      };
    }

    // Code is valid - mark as used
    await ctx.db.patch(verificationRecord._id, { used: true });

    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) {
      return { success: false, error: "User profile not found" };
    }

    // Mark SMS as verified
    // Note: This doesn't enable 2FA - that happens separately after verification
    await ctx.db.patch(profile._id, {
      smsVerified: true,
    });

    return { success: true };
  },
});

/**
 * Disable 2FA
 * 
 * Disables two-factor authentication for the authenticated user.
 * Clears all 2FA-related data (TOTP secret, backup codes, SMS verification status).
 * 
 * @param password - User's password for confirmation (TODO: implement verification)
 * @returns { success: true } on success
 * @throws Error if user is not authenticated or profile not found
 * 
 * TODO: Add password verification before allowing 2FA disable
 */
export const disable2FA = mutation({
  args: {
    password: v.string(), // Require password confirmation
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // TODO: Verify password before disabling 2FA
    // For now, we'll just disable it

    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Disable 2FA
    await ctx.db.patch(profile._id, {
      enable2FA: false,
      twoFactorMethod: undefined,
      totpSecret: undefined,
      totpBackupCodes: undefined,
      smsVerified: false,
    });

    return { success: true };
  },
});

/**
 * Remove used backup code
 * 
 * Removes a backup code from the user's profile after it has been used.
 * Backup codes are single-use only.
 * 
 * @param userId - The user ID
 * @param code - The backup code that was used
 * @returns void
 */
export const removeBackupCode = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile || !profile.totpBackupCodes) {
      return;
    }

    const updatedCodes = profile.totpBackupCodes.filter((c) => c !== args.code);
    await ctx.db.patch(profile._id, {
      totpBackupCodes: updatedCodes,
    });
  },
});

/**
 * Get 2FA status
 * 
 * Returns the current 2FA status for the authenticated user.
 * Used by the UI to display whether 2FA is enabled and which method is active.
 * 
 * @returns {
 *   enabled: boolean - Whether 2FA is enabled
 *   method: "totp" | "sms" | undefined - The active 2FA method
 *   hasBackupCodes: boolean - Whether backup codes exist
 *   backupCodesCount: number - Number of remaining backup codes
 *   smsVerified: boolean - Whether SMS number is verified
 * }
 * @throws Error if user is not authenticated or profile not found
 */
export const get2FAStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    return {
      enabled: profile.enable2FA || false,
      method: profile.twoFactorMethod,
      hasBackupCodes: (profile.totpBackupCodes?.length || 0) > 0,
      backupCodesCount: profile.totpBackupCodes?.length || 0,
      smsVerified: profile.smsVerified || false,
    };
  },
});

/**
 * Enable SMS 2FA
 * 
 * Enables SMS-based two-factor authentication for the authenticated user.
 * Requires the user to have a phone number in their profile.
 * After enabling, the user must verify their phone number by entering a code.
 * 
 * @returns { success: true } on success
 * @throws Error if:
 *   - User is not authenticated
 *   - Profile not found
 *   - Phone number not set in profile
 */
export const enableSMS2FA = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    if (!profile.phoneNumber) {
      throw new Error("Phone number not set. Please add a phone number in your profile.");
    }

    // Enable SMS 2FA (user will need to verify phone number first)
    await ctx.db.patch(profile._id, {
      enable2FA: true,
      twoFactorMethod: "sms",
      smsVerified: false, // Will be set to true after verification
    });

    return { success: true };
  },
});

