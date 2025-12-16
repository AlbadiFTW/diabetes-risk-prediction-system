"use node";

import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { query } from "./_generated/server";
import bcrypt from "bcryptjs";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      crypto: {
        async hashSecret(secret: string): Promise<string> {
          return await bcrypt.hash(secret, 10);
        },
        async verifySecret(secret: string, hash: string): Promise<boolean> {
          // Use bcrypt for all password verification
          // Bcrypt hashes start with $2a$, $2b$, or $2y$
          // If it's not a bcrypt hash, try bcrypt anyway (will fail safely)
          try {
            return await bcrypt.compare(secret, hash);
          } catch {
            return false;
          }
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
