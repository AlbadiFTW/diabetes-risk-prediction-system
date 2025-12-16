"use node";

import { Password } from "@convex-dev/auth/providers/Password";
import bcrypt from "bcryptjs";

// Password provider configuration with bcrypt
// This file uses Node.js runtime for bcrypt hashing
export const passwordProvider = Password({
  crypto: {
    async hashSecret(secret: string): Promise<string> {
      return await bcrypt.hash(secret, 10);
    },
    async verifySecret(secret: string, hash: string): Promise<boolean> {
      // Use bcrypt for all password verification
      try {
        return await bcrypt.compare(secret, hash);
      } catch {
        return false;
      }
    },
  },
});
