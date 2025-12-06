import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Generate a random 6-digit code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Check if user's email is verified
export const isEmailVerified = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { verified: false, email: null };

    // Get email from users table (auth)
    const authUser = await ctx.db.get(userId);
    const email = authUser ? (authUser as any).email ?? null : null;

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!user) return { verified: false, email };

    return {
      verified: (user as any).isEmailVerified === true,
      email,
      verifiedAt: (user as any).emailVerifiedAt,
    };
  },
});

// Create a new verification code
export const createVerificationCode = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Delete any existing unused codes for this email
    const existingCodes = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("used"), false))
      .collect();

    for (const code of existingCodes) {
      await ctx.db.delete(code._id);
    }

    // Generate new code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    await ctx.db.insert("verificationCodes", {
      email: args.email,
      code,
      type: "email_verification",
      expiresAt,
      used: false,
      attempts: 0,
      createdAt: Date.now(),
    });

    return { code, expiresAt };
  },
});

// Verify the code
export const verifyCode = mutation({
  args: { 
    email: v.string(), 
    code: v.string() 
  },
  handler: async (ctx, args) => {
    const verificationRecord = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => 
        q.and(
          q.eq(q.field("used"), false),
          q.eq(q.field("type"), "email_verification")
        )
      )
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
        error: `Invalid code. ${remaining} attempts remaining.` 
      };
    }

    // Code is valid - mark as used
    await ctx.db.patch(verificationRecord._id, { used: true });

    // Update user profile
    const userId = await getAuthUserId(ctx);
    if (userId) {
      const user = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .first();

      if (user) {
        await ctx.db.patch(user._id, {
          isEmailVerified: true,
          emailVerifiedAt: Date.now(),
        } as any);
      }
    }

    return { success: true };
  },
});

// Resend verification code (rate limited)
export const canResendCode = query({
  args: { email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.email) {
      return { canResend: true, waitSeconds: 0 };
    }
    const email = args.email; // Store in const to narrow type
    
    const recentCode = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .order("desc")
      .first();

    if (!recentCode) return { canResend: true, waitSeconds: 0 };

    const timeSinceCreated = Date.now() - recentCode.createdAt;
    const cooldownMs = 60 * 1000; // 1 minute cooldown

    if (timeSinceCreated < cooldownMs) {
      return {
        canResend: false,
        waitSeconds: Math.ceil((cooldownMs - timeSinceCreated) / 1000),
      };
    }

    return { canResend: true, waitSeconds: 0 };
  },
});

// ============ PASSWORD RESET ============

// Create a password reset code
export const createPasswordResetCode = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Check if user exists with this email
    const authUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (!authUser) {
      // Don't reveal if email exists for security
      return { success: true, message: "If an account exists with this email, a password reset code has been sent." };
    }

    // Delete any existing unused password reset codes for this email
    const existingCodes = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => 
        q.and(
          q.eq(q.field("used"), false),
          q.eq(q.field("type"), "password_reset")
        )
      )
      .collect();

    for (const code of existingCodes) {
      await ctx.db.delete(code._id);
    }

    // Generate new code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    await ctx.db.insert("verificationCodes", {
      email: args.email,
      code,
      type: "password_reset",
      expiresAt,
      used: false,
      attempts: 0,
      createdAt: Date.now(),
    });

    return { success: true, code, expiresAt };
  },
});

// Verify password reset code
export const verifyPasswordResetCode = mutation({
  args: { 
    email: v.string(), 
    code: v.string() 
  },
  handler: async (ctx, args) => {
    const verificationRecord = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => 
        q.and(
          q.eq(q.field("used"), false),
          q.eq(q.field("type"), "password_reset")
        )
      )
      .first();

    if (!verificationRecord) {
      return { success: false, error: "No password reset code found. Please request a new one." };
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
        error: `Invalid code. ${remaining} attempts remaining.` 
      };
    }

    // Code is valid - mark as used
    await ctx.db.patch(verificationRecord._id, { used: true });

    return { success: true };
  },
});

// Check if can resend password reset code (rate limited)
export const canResendPasswordResetCode = query({
  args: { email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.email) {
      return { canResend: true, waitSeconds: 0 };
    }
    const email = args.email; // Store in const to narrow type
    
    const recentCode = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("type"), "password_reset"))
      .order("desc")
      .first();

    if (!recentCode) return { canResend: true, waitSeconds: 0 };

    const timeSinceCreated = Date.now() - recentCode.createdAt;
    const cooldownMs = 60 * 1000; // 1 minute cooldown

    if (timeSinceCreated < cooldownMs) {
      return {
        canResend: false,
        waitSeconds: Math.ceil((cooldownMs - timeSinceCreated) / 1000),
      };
    }

    return { canResend: true, waitSeconds: 0 };
  },
});

