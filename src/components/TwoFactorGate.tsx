/**
 * Two-Factor Authentication Gate Component
 * 
 * Wrapper component that enforces 2FA verification before allowing access to protected content.
 * 
 * How it works:
 * 1. Checks if user has 2FA enabled
 * 2. If enabled, checks sessionStorage for previous verification in this session
 * 3. If not verified, shows TwoFactorVerificationModal
 * 4. Once verified, stores verification in sessionStorage and allows access
 * 5. If user cancels, signs them out
 * 
 * Session Management:
 * - Uses sessionStorage to remember verification for the current browser session
 * - Key format: `2fa_verified_{userId}`
 * - Cleared when user signs out or closes browser
 * 
 * Integration:
 * - Wraps the main Content component in App.tsx
 * - Automatically shows verification modal when needed
 * 
 * @component
 * @example
 * ```tsx
 * <TwoFactorGate userId={userId}>
 *   <Dashboard />
 * </TwoFactorGate>
 * ```
 */

"use client";
import { useState, useEffect } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { TwoFactorVerificationModal } from "./TwoFactorVerificationModal";
import { Loader2 } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

interface TwoFactorGateProps {
  /** The content to protect with 2FA verification */
  children: React.ReactNode;
  /** The user ID to check 2FA status for */
  userId: Id<"users">;
}

export function TwoFactorGate({ children, userId }: TwoFactorGateProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { signOut } = useAuthActions();

  const userProfile = useQuery(api.users.getUserProfile, { userId });
  const twoFactorStatus = useQuery(api.twoFactorAuth.get2FAStatus);

  // Reset verification state when userId changes (new login)
  useEffect(() => {
    setIsVerified(false);
    setShowModal(false);
  }, [userId]);

  useEffect(() => {
    // Don't check if still loading
    if (twoFactorStatus === undefined || userProfile === undefined) {
      return;
    }

    // Check if 2FA is enabled
    if (twoFactorStatus.enabled && !isVerified) {
      // Check for device trust (30 days)
      const deviceTrustKey = `2fa_device_trust_${userId}`;
      const deviceTrustData = localStorage.getItem(deviceTrustKey);
      
      if (deviceTrustData) {
        try {
          const { trustedUntil } = JSON.parse(deviceTrustData);
          if (Date.now() < trustedUntil) {
            // Device is trusted, skip 2FA
            setIsVerified(true);
            return;
          } else {
            // Trust expired, remove it
            localStorage.removeItem(deviceTrustKey);
          }
        } catch (e) {
          // Invalid data, remove it
          localStorage.removeItem(deviceTrustKey);
        }
      }
      
      // Check session storage (for current session only)
      const session2FA = sessionStorage.getItem(`2fa_verified_${userId}`);
      if (session2FA === "true") {
        setIsVerified(true);
        return;
      }

      // Show 2FA modal
      setShowModal(true);
    } else if (!twoFactorStatus.enabled) {
      setIsVerified(true);
    }
  }, [twoFactorStatus, userId, isVerified, userProfile]);

  const handleVerify = (trustDevice?: boolean) => {
    // Store verification in session
    sessionStorage.setItem(`2fa_verified_${userId}`, "true");
    
    // If user wants to trust device, store in localStorage for 30 days
    if (trustDevice) {
      const trustedUntil = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      localStorage.setItem(
        `2fa_device_trust_${userId}`,
        JSON.stringify({ trustedUntil })
      );
    }
    
    setIsVerified(true);
    setShowModal(false);
  };

  const handleCancel = async () => {
    // Clear all 2FA-related storage
    sessionStorage.removeItem(`2fa_verified_${userId}`);
    localStorage.removeItem(`2fa_device_trust_${userId}`);
    await signOut();
  };

  // Show loading while checking 2FA status
  if (twoFactorStatus === undefined || userProfile === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If 2FA is enabled but not verified, show modal
  if (twoFactorStatus.enabled && !isVerified && showModal) {
    return (
      <>
        <TwoFactorVerificationModal
          userId={userId}
          method={twoFactorStatus.method || "totp"}
          phoneNumber={userProfile.phoneNumber || undefined}
          onVerify={(trustDevice) => handleVerify(trustDevice)}
          onCancel={handleCancel}
        />
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Verifying your identity...</p>
          </div>
        </div>
      </>
    );
  }

  // If verified or 2FA not enabled, show children
  if (!twoFactorStatus.enabled || isVerified) {
    return <>{children}</>;
  }

  // Fallback loading state
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

