/**
 * Two-Factor Authentication Actions (Node.js Runtime)
 * 
 * This file contains actions that require Node.js APIs (crypto, Buffer).
 * These actions run in the Node.js runtime as specified by "use node" directive.
 * 
 * TOTP (Time-based One-Time Password) Implementation:
 * - Uses RFC 6238 standard (TOTP)
 * - 30-second time windows
 * - HMAC-SHA1 algorithm
 * - 6-digit codes
 * - Base32 encoding for secrets
 * 
 * Security:
 * - Secrets are generated using cryptographically secure random bytes
 * - Clock skew tolerance: ±1 time window (30 seconds)
 * - Backup codes are 8-digit random numbers
 * 
 * @module convex/twoFactorAuthActions
 */

"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import base32Encode from "base32-encode";
import base32Decode from "base32-decode";
import twilio from "twilio";

/**
 * Generate a TOTP secret for authenticator app setup
 * 
 * Generates a cryptographically secure random secret and encodes it in base32.
 * Also generates 10 backup codes for account recovery.
 * 
 * The secret is returned to the client to generate a QR code for authenticator apps.
 * After the user verifies the setup, the secret is stored via enableTOTP2FA mutation.
 * 
 * @returns {
 *   secret: string - Base32-encoded TOTP secret
 *   backupCodes: string[] - Array of 10 backup codes (8 digits each)
 * }
 * @throws Error if user is not authenticated or profile not found
 */
export const generateTOTPSecret = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Use Node.js crypto in action
    const crypto = await import("crypto");
    
    // Generate a random secret (20 bytes)
    const randomBytes = crypto.randomBytes(20);
    // Encode to base32
    const secret = base32Encode(randomBytes, "RFC3548", { padding: false });

    // Get user profile
    const profile = await ctx.runQuery(api.users.getUserProfile, {
      userId,
    });

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    return {
      secret,
      backupCodes,
    };
  },
});

/**
 * Generate backup codes for 2FA
 * 
 * Generates 10 random 8-digit backup codes for account recovery.
 * These codes can be used if the user loses access to their authenticator app.
 * 
 * @returns Array of 10 backup codes (8 digits each)
 */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    // Generate 8-digit codes
    const code = Math.floor(10000000 + Math.random() * 90000000).toString();
    codes.push(code);
  }
  return codes;
}

/**
 * Verify TOTP code during setup
 * 
 * Verifies the TOTP code entered by the user during initial 2FA setup.
 * If valid, enables TOTP 2FA by storing the secret and backup codes.
 * 
 * @param secret - The base32-encoded TOTP secret
 * @param code - The 6-digit code from the user's authenticator app
 * @param backupCodes - Array of backup codes to store
 * @returns { success: true } on success
 * @throws Error if code is invalid or user/profile not found
 */
export const verifyTOTPSetup = action({
  args: {
    secret: v.string(),
    code: v.string(),
    backupCodes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify the TOTP code using helper function
    const isValid = await verifyTOTPCodeHelper(args.secret, args.code);
    if (!isValid) {
      throw new Error("Invalid verification code. Please try again.");
    }

    // Get user profile
    const profile = await ctx.runQuery(api.users.getUserProfile, {
      userId,
    });

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Enable 2FA and store the secret
    await ctx.runMutation(api.twoFactorAuth.enableTOTP2FA, {
      secret: args.secret,
      backupCodes: args.backupCodes,
    });

    return { success: true };
  },
});

/**
 * Verify TOTP code during sign-in
 * 
 * Verifies a TOTP code entered by the user during sign-in.
 * Also checks backup codes if the TOTP code is invalid.
 * 
 * @param userId - The user ID to verify the code for
 * @param code - The 6-digit code from authenticator app or a backup code
 * @returns {
 *   success: boolean - Whether verification was successful
 *   usedBackupCode?: boolean - Whether a backup code was used
 *   error?: string - Error message if verification failed
 * }
 */
export const verifyTOTPCode = action({
  args: {
    userId: v.id("users"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user profile
    const profile = await ctx.runQuery(api.users.getUserProfile, {
      userId: args.userId,
    });

    if (!profile || !profile.enable2FA || profile.twoFactorMethod !== "totp") {
      return { success: false, error: "2FA not enabled or invalid method" };
    }

    if (!profile.totpSecret) {
      return { success: false, error: "TOTP secret not found" };
    }

    // Verify the code
    const isValid = await verifyTOTPCodeHelper(profile.totpSecret, args.code);
    
    if (isValid) {
      return { success: true };
    }

    // Check backup codes
    if (profile.totpBackupCodes && profile.totpBackupCodes.includes(args.code)) {
      // Remove used backup code
      await ctx.runMutation(api.twoFactorAuth.removeBackupCode, {
        userId: args.userId,
        code: args.code,
      });
      return { success: true, usedBackupCode: true };
    }

    return { success: false, error: "Invalid code" };
  },
});

/**
 * Helper function to verify TOTP code (Node.js implementation)
 * 
 * Implements RFC 6238 TOTP algorithm with clock skew tolerance.
 * Checks the current time window and adjacent windows (±30 seconds) to handle clock differences.
 * 
 * @param secret - Base32-encoded TOTP secret
 * @param code - The 6-digit code to verify
 * @returns true if code is valid, false otherwise
 */
async function verifyTOTPCodeHelper(secret: string, code: string): Promise<boolean> {
  const crypto = await import("crypto");
  
  // TOTP algorithm implementation
  const timeStep = 30; // 30 seconds
  const currentTime = Math.floor(Date.now() / 1000);
  const timeCounter = Math.floor(currentTime / timeStep);

  // Check current time window and adjacent windows (for clock skew)
  for (let i = -1; i <= 1; i++) {
    const counter = timeCounter + i;
    const expectedCode = await generateTOTP(secret, counter, crypto);
    if (expectedCode === code) {
      return true;
    }
  }

  return false;
}

/**
 * Generate TOTP code for a given counter
 * 
 * Implements the TOTP algorithm:
 * 1. Decodes base32 secret to binary
 * 2. Creates HMAC-SHA1 hash with counter
 * 3. Performs dynamic truncation
 * 4. Returns 6-digit code
 * 
 * @param secret - Base32-encoded TOTP secret
 * @param counter - Time-based counter (seconds since epoch / 30)
 * @param crypto - Node.js crypto module
 * @returns 6-digit TOTP code as string
 */
async function generateTOTP(secret: string, counter: number, crypto: any): Promise<string> {
  // Decode base32 secret (base32-decode returns Uint8Array)
  const decoded = base32Decode(secret, "RFC3548");
  // Convert Uint8Array to Buffer
  const key = Buffer.from(decoded);

  // Create HMAC-SHA1
  const buffer = Buffer.allocUnsafe(8);
  buffer.writeUInt32BE(0, 0);
  buffer.writeUInt32BE(counter, 4);

  const hmac = crypto.createHmac("sha1", key);
  hmac.update(buffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Send SMS code for 2FA
 * 
 * Generates and sends a 6-digit SMS verification code to the user's phone number.
 * The code is stored in the database and expires after 10 minutes.
 * 
 * Currently logs the code to console for development. In production, integrate with
 * an SMS service like Twilio.
 * 
 * @param userId - The user ID to send the code to
 * @returns {
 *   success: boolean - Whether the code was sent successfully
 *   error?: string - Error message if sending failed
 *   message?: string - Success message (for development)
 * }
 */
export const sendSMSCode = action({
  args: {
    userId: v.id("users"),
    allowSetup: v.optional(v.boolean()), // Allow sending codes during setup even if not fully verified
  },
  handler: async (ctx, args) => {
    // Get user profile
    const profile = await ctx.runQuery(api.users.getUserProfile, {
      userId: args.userId,
    });

    if (!profile) {
      return { success: false, error: "User profile not found" };
    }

    // Allow sending codes during setup (when allowSetup is true) or when SMS 2FA is enabled
    const isSetupMode = args.allowSetup === true;
    const isEnabled = profile.enable2FA && profile.twoFactorMethod === "sms";
    
    // During setup, we don't require 2FA to be enabled yet - just need phone number
    if (!isSetupMode && !isEnabled) {
      return { success: false, error: "SMS 2FA not enabled" };
    }

    // In setup mode, we just need a phone number - 2FA will be enabled after verification

    if (!profile.phoneNumber) {
      return { success: false, error: "Phone number not set" };
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store verification code
    await ctx.runMutation(api.twoFactorAuth.storeSMSCode, {
      userId: args.userId,
      code,
    });

    // Send SMS via Twilio
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      try {
        const client = twilio(twilioAccountSid, twilioAuthToken);
        
        // Format phone number - ensure it has country code
        let phoneNumber = profile.phoneNumber;
        if (!phoneNumber.startsWith("+")) {
          // Try to detect country code from phone number format
          // Oman: 8 digits starting with 1-9
          // UAE: 9 digits starting with 2-9
          const digitsOnly = phoneNumber.replace(/\D/g, "");
          if (digitsOnly.length === 8 && /^[1-9]/.test(digitsOnly)) {
            phoneNumber = `+968${digitsOnly}`;
          } else if (digitsOnly.length === 9 && /^[2-9]/.test(digitsOnly)) {
            phoneNumber = `+971${digitsOnly}`;
          } else {
            // Default to Oman if format is unclear
            phoneNumber = `+968${digitsOnly}`;
          }
        }
        
        await client.messages.create({
          body: `Your Diabetes Risk Prediction System verification code is: ${code}. This code expires in 10 minutes.`,
          to: phoneNumber,
          from: twilioPhoneNumber,
        });

        return { 
          success: true, 
          message: "SMS code sent to your phone number" 
        };
      } catch (smsError: any) {
        console.error("Failed to send SMS via Twilio:", smsError);
        return { 
          success: false, 
          error: "Failed to send SMS. Please try again later or contact support."
        };
      }
    } else {
      // Twilio credentials not configured
      return { 
        success: false, 
        error: "SMS service not configured. Please contact support."
      };
    }
  },
});

