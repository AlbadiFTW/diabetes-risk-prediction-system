/**
 * Two-Factor Authentication Setup Component
 * 
 * Provides a multi-step wizard for setting up two-factor authentication.
 * Supports two methods:
 * 1. TOTP (Authenticator App) - Google Authenticator, Authy, Microsoft Authenticator
 * 2. SMS - Verification codes sent via text message
 * 
 * Features:
 * - QR code generation for TOTP setup
 * - Manual secret entry option
 * - Backup codes display and download
 * - SMS code verification
 * 
 * Flow:
 * 1. User selects method (TOTP or SMS)
 * 2. For TOTP: Generate secret, show QR code, verify code
 * 3. For SMS: Send code, verify code
 * 4. Show completion screen with backup codes (TOTP only)
 * 
 * @component
 * @example
 * ```tsx
 * <TwoFactorAuthSetup
 *   onClose={() => setShowSetup(false)}
 *   onComplete={() => {
 *     // Refresh 2FA status
 *     setShowSetup(false);
 *   }}
 * />
 * ```
 */

"use client";
import { useState, useEffect } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import {
  Shield,
  Smartphone,
  MessageSquare,
  CheckCircle,
  X,
  Copy,
  Download,
  AlertCircle,
  Loader2,
} from "lucide-react";
import QRCode from "qrcode";

interface TwoFactorAuthSetupProps {
  /** Callback when user closes the setup modal */
  onClose: () => void;
  /** Callback when 2FA setup is completed successfully */
  onComplete: () => void;
}

export function TwoFactorAuthSetup({ onClose, onComplete }: TwoFactorAuthSetupProps) {
  const { t } = useTranslation();
  const [method, setMethod] = useState<"totp" | "sms">("totp");
  const [step, setStep] = useState<"select" | "setup" | "verify" | "complete">("select");
  const [verificationCode, setVerificationCode] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const generateTOTPSecret = useAction(api.twoFactorAuthActions.generateTOTPSecret);
  const verifyTOTPSetup = useAction(api.twoFactorAuthActions.verifyTOTPSetup);
  const enableSMS2FA = useMutation(api.twoFactorAuth.enableSMS2FA);
  const sendSMSCode = useAction(api.twoFactorAuthActions.sendSMSCode);
  const verifySMSCode = useMutation(api.twoFactorAuth.verifySMSCode);
  const profileDetails = useQuery(api.users.getProfileDetails);
  
  // Extract profile and user data for easier access
  const userProfile = profileDetails?.profile;
  const userAccount = profileDetails?.user;

  // Generate QR code when TOTP secret is generated
  useEffect(() => {
    const generateQRCode = async () => {
      if (!secret || !userProfile || !userAccount || method !== "totp" || step !== "setup") return;

      try {
        // Get user email for the QR code
        const email = userAccount.email || "user@example.com";
        const issuer = "Diabetes Risk Prediction";
        const accountName = `${userProfile.firstName} ${userProfile.lastName}`;

        // TOTP URI format: otpauth://totp/Issuer:AccountName?secret=SECRET&issuer=Issuer
        const otpAuthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

        // Generate QR code as data URL
        const dataUrl = await QRCode.toDataURL(otpAuthUrl, { width: 256, margin: 2 });
        setQrCodeUrl(dataUrl);
      } catch (error) {
        console.error("Failed to generate QR code:", error);
        toast.error("Failed to generate QR code");
      }
    };

    if (method === "totp" && secret && step === "setup" && userProfile && userAccount) {
      generateQRCode();
    }
  }, [secret, method, step, userProfile, userAccount]);

  const handleSelectMethod = async (selectedMethod: "totp" | "sms") => {
    setMethod(selectedMethod);

    if (selectedMethod === "totp") {
      try {
        const result = await generateTOTPSecret({});
        setSecret(result.secret);
        setBackupCodes(result.backupCodes);
        setStep("setup");
      } catch (error: any) {
        toast.error(error.message || t("twoFactor.failedToGenerateSecret"));
      }
    } else if (selectedMethod === "sms") {
      if (!userProfile?.phoneNumber || !userAccount?._id) {
        toast.error(t("twoFactor.addPhoneFirst"));
        return;
      }
      try {
        // Don't enable 2FA yet - just send the code for verification
        // 2FA will be enabled only after successful code verification
        const result = await sendSMSCode({ userId: userAccount._id, allowSetup: true });
        if (result.success) {
          setStep("verify");
          toast.success(t("twoFactor.smsCodeSent"));
        } else {
          toast.error(result.error || t("twoFactor.failedToSendSMS"));
        }
      } catch (error: any) {
        toast.error(error.message || t("twoFactor.failedToSendSMS"));
      }
    }
  };

  const handleVerifyTOTP = async () => {
    if (!secret || !verificationCode) {
      toast.error(t("twoFactor.enterVerificationCode"));
      return;
    }

    try {
      await verifyTOTPSetup({
        secret,
        code: verificationCode,
        backupCodes,
      });
      setStep("complete");
      setShowBackupCodes(true);
      toast.success(t("twoFactor.twoFactorEnabledSuccess"));
    } catch (error: any) {
      toast.error(error.message || t("twoFactor.invalidVerificationCode"));
    }
  };

  const handleVerifySMS = async () => {
    if (!verificationCode || !userAccount?._id) {
      toast.error(t("twoFactor.enterVerificationCode"));
      return;
    }

    try {
      // First verify the code
      const result = await verifySMSCode({
        userId: userAccount._id,
        code: verificationCode,
      });

      if (result.success) {
        // Only enable SMS 2FA after successful verification
        await enableSMS2FA({});
        setStep("complete");
        toast.success(t("twoFactor.sms2FAEnabled"));
      } else {
        toast.error(result.error || t("twoFactor.invalidVerificationCode"));
      }
    } catch (error: any) {
      toast.error(error.message || t("twoFactor.failedToSendSMS"));
    }
  };

  const handleResendSMS = async () => {
    if (!userAccount?._id) return;
    try {
      await sendSMSCode({ userId: userAccount._id });
      toast.success(t("twoFactor.smsCodeResent"));
    } catch (error: any) {
      toast.error(error.message || t("twoFactor.failedToResendSMS"));
    }
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join("\n");
    navigator.clipboard.writeText(codesText);
    toast.success(t("twoFactor.backupCodesCopied"));
  };

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join("\n");
    const blob = new Blob([codesText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("twoFactor.backupCodesDownloaded"));
  };

  if (step === "select") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{t("twoFactor.enable2FA")}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            {t("twoFactor.chooseMethod")}
          </p>

          <div className="space-y-4">
            {/* TOTP Option */}
            <button
              onClick={() => handleSelectMethod("totp")}
              className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{t("twoFactor.authenticatorApp")}</h3>
                  <p className="text-sm text-gray-600">
                    {t("twoFactor.authenticatorAppDesc")}
                  </p>
                </div>
              </div>
            </button>

            {/* SMS Option */}
            <button
              onClick={() => handleSelectMethod("sms")}
              className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{t("twoFactor.sms")}</h3>
                  <p className="text-sm text-gray-600">
                    {t("twoFactor.smsDesc")}
                    {userProfile?.phoneNumber && (
                      <span className="block text-xs text-gray-500 mt-1">
                        {t("twoFactor.to")} {userProfile.phoneNumber}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {!userProfile?.phoneNumber && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-800">
                  {t("twoFactor.addPhoneFirst")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "setup" && method === "totp") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{t("twoFactor.setupAuthenticator")}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-gray-600 mb-4">
                {t("twoFactor.scanQRCode")}
              </p>
              {qrCodeUrl ? (
                <div className="flex justify-center p-4 bg-gray-50 rounded-xl">
                  <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                </div>
              ) : (
                <div className="flex justify-center p-4 bg-gray-50 rounded-xl">
                  <Loader2 className="w-16 h-16 text-gray-400 animate-spin" />
                </div>
              )}
            </div>

            <div>
              <p className="text-gray-600 mb-2">
                {t("twoFactor.enterManually")}
              </p>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <code className="flex-1 font-mono text-sm">{secret}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(secret || "");
                    toast.success(t("twoFactor.secretCopied"));
                  }}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-gray-600 mb-2">
                3. Enter the 6-digit code from your app:
              </p>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center text-2xl font-mono tracking-widest focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleVerifyTOTP}
                disabled={verificationCode.length !== 6}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t("twoFactor.verifyEnable")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "verify" && method === "sms") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{t("twoFactor.verifySMSCode")}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-gray-600 mb-2">
                {t("twoFactor.enterCodeSentTo", { phoneNumber: userProfile?.phoneNumber || "" })}:
              </p>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center text-2xl font-mono tracking-widest focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <button
              onClick={handleResendSMS}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              {t("twoFactor.resendCode")}
            </button>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleVerifySMS}
                disabled={verificationCode.length !== 6}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t("twoFactor.verifyEnable")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t("twoFactor.twoFactorEnabled")}
            </h2>
            <p className="text-gray-600">
              {t("twoFactor.accountProtected")}
            </p>
          </div>

          {method === "totp" && backupCodes.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-1">{t("twoFactor.saveBackupCodes")}</h3>
                  <p className="text-sm text-amber-800">
                    {t("twoFactor.backupCodesDesc")}
                  </p>
                </div>
              </div>

              {showBackupCodes ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {backupCodes.map((code, i) => (
                      <div
                        key={i}
                        className="p-2 bg-white border border-amber-200 rounded text-center"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyBackupCodes}
                      className="flex-1 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Copy className="w-4 h-4" />
                      {t("twoFactor.copy")}
                    </button>
                    <button
                      onClick={downloadBackupCodes}
                      className="flex-1 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      {t("twoFactor.download")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowBackupCodes(true)}
                  className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
                >
                  {t("twoFactor.showBackupCodes")}
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => {
              onComplete();
              onClose();
            }}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            {t("common.continue")}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

