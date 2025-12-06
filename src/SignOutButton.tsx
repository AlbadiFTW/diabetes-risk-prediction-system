"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profileStatus = useQuery(api.users.hasCompletedProfile);
  
  const handleSignOut = async () => {
    // Clear 2FA verification storage before signing out
    if (profileStatus?.profile?.userId) {
      const userId = profileStatus.profile.userId as Id<"users">;
      sessionStorage.removeItem(`2fa_verified_${userId}`);
      // Note: We don't clear device trust on sign out - user might want to keep it
    }
    await signOut();
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="px-4 py-2 rounded bg-white text-secondary border border-gray-200 font-semibold hover:bg-gray-50 hover:text-secondary-hover transition-colors shadow-sm hover:shadow"
      onClick={() => void handleSignOut()}
    >
      Sign out
    </button>
  );
}
