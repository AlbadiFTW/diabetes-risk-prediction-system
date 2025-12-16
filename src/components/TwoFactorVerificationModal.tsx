/**
 * Two-Factor Authentication Verification Modal
 * 
 * Modal component for entering 2FA verification codes during sign-in.
 * Supports both TOTP (authenticator app) and SMS methods.
 * 
 * Features:
 * - 6-digit code input with auto-formatting
 * - Resend SMS code functionality
 * - Error handling with user-friendly messages
 * - Loading states during verification
 * 
 * Used by:
 * - TwoFactorGate component during sign-in flow
 * 
 * @component
 * @example
 * ```tsx
 * <TwoFactorVerificationModal
 *   userId={userId}
 *   method="totp"
 *   onVerify={() => {
 *     // Allow access to dashboard
 *     setIsVerified(true);
 *   }}
 *   onCancel={() => {
 *     // Sign out user
 *     signOut();
 *   }}
 * />
 * ```
 */

"use client";
import { useState, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Shield, Loader2, MessageSquare, Smartphone } from "lucide-react";

interface TwoFactorVerificationModalProps {
  /** The user ID to verify the code for */
  userId: Id<"users">;
  /** The 2FA method being used ("totp" or "sms") */
  method: "totp" | "sms";
  /** Phone number for SMS method (optional, for display) */
  phoneNumber?: string;
  /** Callback when verification succeeds */
  onVerify: (trustDevice?: boolean) => void;
  /** Callback when user cancels verification */
  onCancel: () => void;
}

export function TwoFactorVerificationModal({
  userId,
  method,
  phoneNumber,
  onVerify,
  onCancel,
}: TwoFactorVerificationModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  const verifyTOTPCode = useAction(api.twoFactorAuthActions.verifyTOTPCode);
  const sendSMSCode = useAction(api.twoFactorAuthActions.sendSMSCode);
  const verifySMSCode = useMutation(api.twoFactorAuth.verifySMSCode);

  // Send SMS code on mount if method is SMS
  useEffect(() => {
    if (method === "sms") {
      sendSMSCode({ userId })
        .then((result) => {
          if (result.success) {
            toast.success(t("twoFactor.smsCodeSentSuccess"));
          } else {
            toast.error(result.error || t("twoFactor.failedToResendSMS"));
          }
        })
        .catch((error) => {
          console.error("Failed to send SMS code:", error);
          toast.error(t("twoFactor.failedToResendSMS"));
        });
    }
  }, [method, userId, sendSMSCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError(t("twoFactor.enter6DigitCode"));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setAttemptsRemaining(null);
    
    try {
      if (method === "totp") {
        const result = await verifyTOTPCode({ userId, code });
        if (result.success) {
          if (result.usedBackupCode) {
            toast.info(t("twoFactor.backupCodeUsed"));
          }
          setCode("");
          onVerify(trustDevice);
        } else {
          // Extract attempts remaining from error message if present
          const errorMsg = result.error || t("twoFactor.invalidVerificationCode");
          const attemptsMatch = errorMsg.match(/(\d+)\s+attempts?/i);
          if (attemptsMatch) {
            setAttemptsRemaining(parseInt(attemptsMatch[1]));
          }
          setError(errorMsg);
          setCode("");
          toast.error(errorMsg);
        }
      } else if (method === "sms") {
        const result = await verifySMSCode({ userId, code });
        if (result.success) {
          setCode("");
          onVerify(trustDevice);
        } else {
          // Extract attempts remaining from error message if present
          const errorMsg = result.error || t("twoFactor.invalidVerificationCode");
          const attemptsMatch = errorMsg.match(/(\d+)\s+attempts?/i);
          if (attemptsMatch) {
            setAttemptsRemaining(parseInt(attemptsMatch[1]));
          }
          setError(errorMsg);
          setCode("");
          toast.error(errorMsg);
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || t("twoFactor.invalidVerificationCode");
      setError(errorMsg);
      setCode("");
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendSMS = async () => {
    try {
      await sendSMSCode({ userId });
      toast.success(t("twoFactor.smsCodeResent"));
      setCode("");
    } catch (error: any) {
      toast.error(error.message || t("twoFactor.failedToResendSMS"));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {method === "totp" ? (
              <Smartphone className="w-8 h-8 text-blue-600" />
            ) : (
              <MessageSquare className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t("twoFactor.twoFactorAuth")}
          </h2>
          <p className="text-gray-600">
            {method === "totp"
              ? t("twoFactor.enterCodeFromApp")
              : t("twoFactor.enterCodeSentToPhone", { phoneNumber: phoneNumber || t("common.info") })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null); // Clear error when user types
              }}
              placeholder="000000"
              maxLength={6}
              autoFocus
              className={`w-full px-4 py-3 border-2 rounded-xl text-center text-2xl font-mono tracking-widest focus:ring-4 transition-colors ${
                error
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-500/10"
              }`}
            />
                {error && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium">{error}</p>
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {t("twoFactor.attemptsRemaining", { 
                      count: attemptsRemaining, 
                      plural: attemptsRemaining === 1 ? t("twoFactor.attempt") : t("twoFactor.attempts")
                    })}
                  </p>
                )}
                {attemptsRemaining === 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {t("twoFactor.tooManyAttempts")}
                  </p>
                )}
              </div>
            )}
          </div>

          {method === "sms" && (
            <button
              type="button"
              onClick={handleResendSMS}
              className="text-sm text-blue-600 hover:text-blue-700 underline w-full"
            >
              {t("twoFactor.resendCode")}
            </button>
          )}

          {/* Trust Device Option */}
          <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="trustDevice"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
            />
            <label htmlFor="trustDevice" className="text-sm text-gray-700 cursor-pointer flex-1">
              <span className="font-medium">{t("twoFactor.trustDevice")}</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {t("twoFactor.trustDeviceDesc")}
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={code.length !== 6 || isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("twoFactor.verify")}
                </>
              ) : (
                t("twoFactor.verify")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

