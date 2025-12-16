"use client";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { X, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export function PasswordResetModal({ isOpen, onClose, initialEmail = "" }: PasswordResetModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const sendPasswordResetEmail = useAction(api.emails.sendPasswordResetEmail);
  const verifyCode = useMutation(api.emailVerification.verifyPasswordResetCode);
  const resetPassword = useAction(api.passwordReset.resetPassword);
  const canResend = useQuery(
    api.emailVerification.canResendPasswordResetCode,
    email && email.includes('@') ? { email } : undefined
  );

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Update countdown from server
  useEffect(() => {
    if (canResend && !canResend.canResend) {
      setCountdown(canResend.waitSeconds);
    }
  }, [canResend]);

  const setInputRef = (index: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[index] = el;
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSendCode = async () => {
    if (countdown > 0) return;
    if (!email || !email.includes('@')) {
      setError(t("passwordReset.enterValidEmail"));
      return;
    }

    setIsSending(true);
    setError("");
    try {
      const result = await sendPasswordResetEmail({ email });
      if (result.success) {
        toast.success(t("passwordReset.passwordResetCodeSent"));
        setStep("code");
        setCountdown(60); // 1 minute cooldown
      } else {
        setError(result.error || t("passwordReset.failedToSendCode"));
      }
    } catch (error: any) {
      setError(error.message || t("passwordReset.failedToSendCode"));
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    const codeString = code.join('');
    if (codeString.length !== 6) {
      setError(t("passwordReset.enterCompleteCode"));
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await verifyCode({ email, code: codeString });
      if (result.success) {
        setStep("password");
        setError("");
      } else {
        setError(result.error || t("passwordReset.invalidCode"));
      }
    } catch (error: any) {
      setError(error.message || t("passwordReset.invalidCode"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      setError(t("passwordReset.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("passwordReset.passwordsDoNotMatch"));
      return;
    }

    const codeString = code.join('');
    setIsLoading(true);
    setError("");
    try {
      const result = await resetPassword({ 
        email, 
        code: codeString, 
        newPassword 
      });
      if (result.success) {
        toast.success(t("passwordReset.passwordResetSuccess"));
        handleClose();
      } else {
        setError(result.error || t("passwordReset.failedToReset"));
      }
    } catch (error: any) {
      setError(error.message || t("passwordReset.failedToReset"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep("email");
    setEmail(initialEmail);
    setCode(['', '', '', '', '', '']);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setCountdown(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#2F3136] rounded-2xl shadow-2xl max-w-md w-full border border-[#202225]">
        {/* Header */}
        <div className="sticky top-0 bg-[#2F3136] border-b border-[#202225] p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <Lock className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t("passwordReset.resetPassword")}</h2>
              <p className="text-sm text-[#B9BBBE]">
                {step === "email" && t("passwordReset.enterEmail")}
                {step === "code" && t("passwordReset.enterCode")}
                {step === "password" && t("passwordReset.enterNewPassword")}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-[#B9BBBE] hover:text-white transition-colors p-2 hover:bg-[#202225] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Step 1: Email */}
          {step === "email" && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#B9BBBE] mb-2">
                  {t("passwordReset.emailAddress")}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B9BBBE]">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("passwordReset.emailAddress")}
                    className="w-full pl-12 pr-4 py-3 bg-[#202225] border border-[#202225] rounded-lg text-white placeholder-[#72767D] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSendCode();
                      }
                    }}
                  />
                </div>
              </div>
              <button
                onClick={handleSendCode}
                disabled={isSending || countdown > 0}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-lg text-white font-semibold hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 transition-all duration-300 shadow-lg hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t("passwordReset.sending")}</span>
                  </>
                ) : countdown > 0 ? (
                  <span>{t("passwordReset.resendIn", { seconds: countdown })}</span>
                ) : (
                  <>
                    <span>{t("passwordReset.sendResetCode")}</span>
                    <ArrowRight className="w-5 h-5" data-flip-on-rtl="true" />
                  </>
                )}
              </button>
            </>
          )}

          {/* Step 2: Code */}
          {step === "code" && (
            <>
              <div>
                <p className="text-sm text-[#B9BBBE] mb-4 text-center">
                  {t("passwordReset.codeSentTo")} <strong className="text-white">{email}</strong>
                </p>
                <div className="flex gap-2 justify-center">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={setInputRef(index)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      className="w-12 h-14 text-center text-2xl font-bold bg-[#202225] border border-[#202225] rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleVerifyCode}
                disabled={isLoading || code.join('').length !== 6}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-lg text-white font-semibold hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 transition-all duration-300 shadow-lg hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t("passwordReset.verifying")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("passwordReset.verifyCode")}</span>
                    <ArrowRight className="w-5 h-5" data-flip-on-rtl="true" />
                  </>
                )}
              </button>
              <button
                onClick={handleSendCode}
                disabled={countdown > 0}
                className="w-full py-2 text-sm text-[#B9BBBE] hover:text-white transition-colors"
              >
                {countdown > 0 ? t("passwordReset.resendCodeIn", { seconds: countdown }) : t("passwordReset.resendCode")}
              </button>
            </>
          )}

          {/* Step 3: New Password */}
          {step === "password" && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#B9BBBE] mb-2">
                  {t("passwordReset.newPassword")}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B9BBBE]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("passwordReset.enterNewPasswordPlaceholder")}
                    className="w-full pl-12 pr-4 py-3 bg-[#202225] border border-[#202225] rounded-lg text-white placeholder-[#72767D] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#B9BBBE] mb-2">
                  {t("passwordReset.confirmPassword")}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B9BBBE]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("passwordReset.confirmNewPassword")}
                    className="w-full pl-12 pr-4 py-3 bg-[#202225] border border-[#202225] rounded-lg text-white placeholder-[#72767D] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleResetPassword();
                      }
                    }}
                  />
                </div>
              </div>
              <button
                onClick={handleResetPassword}
                disabled={isLoading || !newPassword || !confirmPassword}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-lg text-white font-semibold hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 transition-all duration-300 shadow-lg hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t("passwordReset.resetting")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("passwordReset.resetPasswordButton")}</span>
                    <ArrowRight className="w-5 h-5" data-flip-on-rtl="true" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

