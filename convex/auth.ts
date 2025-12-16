"use node";

import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { query } from "./_generated/server";
import bcrypt from "bcryptjs";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Helper to verify Scrypt hash (for existing users)
async function verifyScrypt(secret: string, hash: string): Promise<boolean> {
  try {
    // Scrypt hash format: salt:hash (hex encoded)
    const [saltHex, hashHex] = hash.split(":");
    if (!saltHex || !hashHex) return false;
    
    const salt = Buffer.from(saltHex, "hex");
    const hashBuffer = Buffer.from(hashHex, "hex");
    
    const derivedKey = (await scryptAsync(secret, salt, 64)) as Buffer;
    
    // Compare using timing-safe comparison
    return hashBuffer.length === derivedKey.length && 
           timingSafeEqual(hashBuffer, derivedKey.slice(0, hashBuffer.length));
  } catch {
    return false;
  }
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      crypto: {
        async hashSecret(secret: string): Promise<string> {
          // Use bcrypt for new passwords
          return await bcrypt.hash(secret, 10);
        },
        async verifySecret(secret: string, hash: string): Promise<boolean> {
          // Support both bcrypt (new) and Scrypt (legacy) formats
          // Bcrypt hashes start with $2a$, $2b$, or $2y$
          if (hash.startsWith("$2")) {
            return await bcrypt.compare(secret, hash);
          }
          // Scrypt format (salt:hash)
          return await verifyScrypt(secret, hash);
        },
      },
    }),
    Anonymous,
  ],
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});
