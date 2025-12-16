import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useAction, useQuery } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../convex/_generated/api';
import { Mail, X, AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface EmailVerificationModalProps {
  email: string;
  onClose: () => void;
  onVerified: () => void;
}

export default function EmailVerificationModal({ 
  email, 
  onClose, 
  onVerified 
}: EmailVerificationModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const setInputRef = (index: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[index] = el;
  };
  
  const verifyCode = useMutation(api.emailVerification.verifyCode);
  const sendEmail = useAction(api.emails.sendVerificationEmail);
  const canResendStatus = useQuery(
    api.emailVerification.canResendCode, 
    email && email.includes('@') ? { email } : undefined as any
  );
  
  // Send initial email on mount
  useEffect(() => {
    if (email && email.includes('@')) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        handleSendCode();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setError(t("emailVerification.noEmailAvailable") || "No email address available. Please contact support.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);
  
  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  
  // Update countdown from server
  useEffect(() => {
    if (canResendStatus && !canResendStatus.canResend) {
      setCountdown(canResendStatus.waitSeconds);
    }
  }, [canResendStatus]);
  
  const handleSendCode = async () => {
    if (countdown > 0) return;
    
    if (!email || !email.includes('@')) {
      setError(t("emailVerification.invalidEmail"));
      return;
    }
    
    setIsSending(true);
    setError('');
    
    try {
      const result = await sendEmail({ email: email.trim() });
      if (result.success) {
        setCountdown(60); // 60 second cooldown
        setError(''); // Clear any previous errors
      } else {
        const errorMessage = result.error || t("emailVerification.failedToSendEmail");
        setError(errorMessage);
        console.error("Failed to send verification email:", errorMessage);
      }
    } catch (err: any) {
      const errorMessage = err?.message || err?.toString() || t("emailVerification.failedToSendEmail");
      setError(errorMessage);
      console.error("Error sending verification email:", err);
    } finally {
      setIsSending(false);
    }
  };
  
  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');
    
    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all digits entered
    if (value && index === 5 && newCode.every(d => d !== '')) {
      handleVerify(newCode.join(''));
    }
  };
  
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
      setCode(newCode);
      if (pastedData.length === 6) {
        handleVerify(pastedData);
      }
    }
  };
  
  const handleVerify = async (codeString?: string) => {
    const verificationCode = codeString || code.join('');
    
    if (verificationCode.length !== 6) {
      setError(t("emailVerification.enterAllDigits"));
      return;
    }
    
    if (!email || !email.includes('@')) {
      setError(t("emailVerification.invalidEmail"));
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const result = await verifyCode({ email: email.trim(), code: verificationCode });
      
      if (result.success) {
        setSuccess(true);
        // Show success toast
        toast.success(t("emailVerification.emailVerifiedSuccess"), {
          description: t("emailVerification.fullAccess"),
          duration: 3000,
        });
        setTimeout(() => {
          onVerified();
        }, 1500);
      } else {
        setError(result.error || t("emailVerification.verificationFailed"));
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError(t("emailVerification.verificationFailedDesc"));
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-6 sm:py-8 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">{t("emailVerification.verifyYourEmail")}</h2>
          <p className="text-blue-100 mt-2 text-xs sm:text-sm">
            {t("emailVerification.codeSentTo")} <span className="font-medium">{email}</span>
          </p>
        </div>
        
        {/* Content */}
        <div className="p-4 sm:p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t("emailVerification.emailVerifiedSuccess")}</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4">{t("emailVerification.emailVerifiedDesc")}</p>
              <p className="text-sm text-gray-500">{t("emailVerification.fullAccess")}</p>
              <div className="mt-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">{t("emailVerification.verificationComplete")}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">{t("emailVerification.redirecting")}</p>
            </div>
          ) : (
            <>
              <p className="text-center text-gray-600 mb-6">
                {t("emailVerification.enter6DigitCode")}
              </p>
              
              {/* Code Input */}
              <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={setInputRef(index)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl transition-all
                      ${error ? 'border-red-300 bg-red-50' : 'border-gray-200'}
                      focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none`}
                    disabled={isLoading}
                  />
                ))}
              </div>
              
              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg mb-4">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
              
              {/* Verify Button */}
              <button
                onClick={() => handleVerify()}
                disabled={isLoading || code.some(d => d === '')}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t("emailVerification.verifying")}
                  </>
                ) : (
                  t("emailVerification.verifyEmailButton")
                )}
              </button>
              
              {/* Resend Code */}
              <div className="text-center mt-4">
                <p className="text-sm text-gray-500 mb-2">{t("emailVerification.didntReceiveCode")}</p>
                <button
                  onClick={handleSendCode}
                  disabled={isSending || countdown > 0}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1 mx-auto"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("emailVerification.sending")}
                    </>
                  ) : countdown > 0 ? (
                    t("emailVerification.resendCodeIn", { seconds: countdown })
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      {t("emailVerification.resendCode")}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

