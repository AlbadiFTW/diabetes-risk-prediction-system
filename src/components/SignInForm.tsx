"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Logo } from "./Logo";
import { Mail, Lock, Sparkles, ArrowRight, UserPlus, FileText, HelpCircle, Eye, EyeOff } from "lucide-react";
import { TermsModal } from "./TermsModal";
import { SupportModal } from "./SupportModal";
import { PasswordResetModal } from "./PasswordResetModal";
import { TwoFactorVerificationModal } from "./TwoFactorVerificationModal";
import type { Id } from "../../convex/_generated/dataModel";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<Id<"users"> | null>(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState<"totp" | "sms">("totp");
  const [showPassword, setShowPassword] = useState(false);

  // Check if user has 2FA enabled after sign-in
  const userProfile = useQuery(
    api.users.getUserProfile,
    pendingUserId ? { userId: pendingUserId } : ("skip" as const)
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Check terms acceptance for signup
    if (flow === "signUp" && !acceptedTerms) {
      toast.error("Please accept the Terms of Service and Privacy Policy to continue");
      return;
    }
    
    setSubmitting(true);
    const formData = new FormData(e.target as HTMLFormElement);
    formData.set("flow", flow);
    
    try {
      await signIn("password", formData);
      // After successful sign-in, check if 2FA is required
      // We'll handle this in a useEffect that watches for authentication
    } catch (error: any) {
      const errorMessage = error.message || error.toString() || "";
      let toastTitle = "";
      let toastDescription = "";
      
      // Parse error messages from Convex Auth
      const lowerError = errorMessage.toLowerCase();
      
      if (flow === "signIn") {
        // Sign in errors
        if (lowerError.includes("invalid password") || lowerError.includes("incorrect password")) {
          toastTitle = "Incorrect password";
          toastDescription = "The password you entered is incorrect. Please try again.";
        } else if (lowerError.includes("user not found") || lowerError.includes("account not found") || lowerError.includes("no account")) {
          toastTitle = "Account not found";
          toastDescription = "No account exists with this email address. Did you mean to sign up?";
        } else if (lowerError.includes("email") && (lowerError.includes("not found") || lowerError.includes("does not exist"))) {
          toastTitle = "Email not found";
          toastDescription = "This email address is not registered. Please sign up to create an account.";
        } else if (lowerError.includes("already exists") || lowerError.includes("already registered")) {
          toastTitle = "Account already exists";
          toastDescription = "An account with this email already exists. Please sign in instead.";
        } else {
          toastTitle = "Sign in failed";
          toastDescription = "Unable to sign in. Please check your email and password, or sign up if you don't have an account.";
        }
      } else {
        // Sign up errors
        if (lowerError.includes("already exists") || lowerError.includes("already registered") || lowerError.includes("user already")) {
          toastTitle = "Account already exists";
          toastDescription = "An account with this email already exists. Please sign in instead.";
        } else if (lowerError.includes("password") && (lowerError.includes("weak") || lowerError.includes("invalid") || lowerError.includes("too short"))) {
          toastTitle = "Password too weak";
          toastDescription = "Please choose a stronger password (at least 8 characters).";
        } else if (lowerError.includes("email") && (lowerError.includes("invalid") || lowerError.includes("format"))) {
          toastTitle = "Invalid email";
          toastDescription = "Please enter a valid email address.";
        } else {
          toastTitle = "Sign up failed";
          toastDescription = "Unable to create your account. Please try again or contact support if the problem persists.";
        }
      }
      
      toast.error(toastTitle, {
        description: toastDescription,
        duration: 5000,
      });
      setSubmitting(false);
    }
  };

  // Reset terms acceptance when switching flows
  const handleFlowChange = () => {
    setFlow(flow === "signIn" ? "signUp" : "signIn");
    setAcceptedTerms(false);
    setEmail("");
    setPassword("");
    setSubmitting(false);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Main Card */}
      <div className="relative bg-[#2F3136] rounded-2xl shadow-2xl overflow-hidden border border-[#202225]">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20 animate-gradient-shift"></div>
        
        {/* Glowing Orbs */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        <div className="relative p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo size="lg" showText={false} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {flow === "signIn" ? "Welcome back!" : "Create your account"}
            </h2>
            <p className="text-[#B9BBBE] text-sm">
              {flow === "signIn"
                ? "We're so excited to see you again!"
                : "Join us to start your health journey"}
            </p>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Email Input */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B9BBBE]">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full pl-12 pr-4 py-3 bg-[#202225] border border-[#202225] rounded-lg text-white placeholder-[#72767D] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B9BBBE]">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full pl-12 pr-20 py-3 bg-[#202225] border border-[#202225] rounded-lg text-white placeholder-[#72767D] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#B9BBBE] hover:text-white transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
                {flow === "signIn" && (
                  <button
                    type="button"
                    onClick={() => setShowPasswordResetModal(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap"
                  >
                    Forgot?
                  </button>
                )}
              </div>
            </div>

            {/* Terms Agreement (only for signup) */}
            {flow === "signUp" && (
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-[#202225] bg-[#202225] text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-offset-[#2F3136] cursor-pointer"
                  />
                  <span className="text-sm text-[#B9BBBE] group-hover:text-white transition-colors">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsModal(true);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-medium underline inline-flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      Terms of Service and Privacy Policy
                    </button>
                  </span>
                </label>
                {!acceptedTerms && (
                  <p className="text-xs text-amber-400 ml-7">
                    You must accept the terms to create an account
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || (flow === "signUp" && !acceptedTerms)}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-lg text-white font-semibold hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 transition-all duration-300 shadow-lg hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <span>{flow === "signIn" ? "Sign in" : "Sign up"}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Toggle Flow */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleFlowChange}
                className="text-sm text-[#B9BBBE] hover:text-white transition-colors inline-flex items-center gap-1 group"
              >
                {flow === "signIn" ? (
                  <>
                    <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>
                      Need an account?{" "}
                      <span className="text-indigo-400 hover:text-indigo-300 font-medium">
                        Register
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      Already have an account?{" "}
                      <span className="text-indigo-400 hover:text-indigo-300 font-medium">
                        Sign in
                      </span>
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#202225]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#2F3136] text-[#72767D]">or</span>
            </div>
          </div>

          {/* Anonymous Sign In */}
          <button
            onClick={() => void signIn("anonymous")}
            className="w-full py-3 bg-[#202225] hover:bg-[#2A2D31] border border-[#202225] hover:border-[#3A3D42] rounded-lg text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <Sparkles className="w-5 h-5 text-indigo-400 group-hover:rotate-12 transition-transform" />
            <span>Continue as Guest</span>
          </button>

          {/* Support Button */}
          <button
            type="button"
            onClick={() => setShowSupportModal(true)}
            className="w-full mt-3 py-2.5 text-sm text-[#B9BBBE] hover:text-white transition-colors flex items-center justify-center gap-2 group"
          >
            <HelpCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Need help? Contact Support</span>
          </button>
        </div>
      </div>

      {/* Footer Text */}
      {flow === "signIn" && (
        <p className="text-center mt-6 text-[#72767D] text-sm">
          By continuing, you agree to our{" "}
          <button
            type="button"
            onClick={() => setShowTermsModal(true)}
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            Terms of Service and Privacy Policy
          </button>
        </p>
      )}
      
      {/* Terms Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setAcceptedTerms(true);
          setShowTermsModal(false);
        }}
      />

      {/* Support Modal */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Password Reset Modal */}
      <PasswordResetModal
        isOpen={showPasswordResetModal}
        onClose={() => setShowPasswordResetModal(false)}
        initialEmail={email}
      />
    </div>
  );
}


