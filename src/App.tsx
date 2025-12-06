/**
 * Main Application Component
 * 
 * Handles authentication state and routes users to appropriate dashboards.
 * 
 * Two-Factor Authentication (2FA) Integration:
 * - Wraps authenticated content with TwoFactorGate component
 * - TwoFactorGate enforces 2FA verification if user has it enabled
 * - Verification is session-based (stored in sessionStorage)
 * - Users must verify 2FA code before accessing dashboard
 * 
 * @module src/App
 */

import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./components/SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { EnhancedDashboard } from "./components/EnhancedDashboard";
import { ProfileSetup } from "./components/ProfileSetup";
import { Logo } from "./components/Logo";
import AdminDashboard from "./components/AdminDashboard";
import { useAuthActions } from "@convex-dev/auth/react";
import { UserX } from "lucide-react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TwoFactorGate } from "./components/TwoFactorGate";
import type { Id } from "../convex/_generated/dataModel";

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col">
        <Authenticated>
          <div className="bg-gray-50">
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
              <Logo size="sm" />
              <SignOutButton />
            </header>
            <main className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-6xl mx-auto">
                <ErrorBoundary>
                  <Content />
                </ErrorBoundary>
              </div>
            </main>
          </div>
        </Authenticated>
        <Unauthenticated>
          <ErrorBoundary>
            <AuthPage />
          </ErrorBoundary>
        </Unauthenticated>
        <Toaster />
      </div>
    </ErrorBoundary>
  );
}

function AuthPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1E1F22]">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
        
        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-indigo-400/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${10 + Math.random() * 10}s`,
            }}
          ></div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="px-6 py-4">
          <Logo size="md" />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
          <div className="w-full max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
              {/* Left Side - Hero Text */}
              <div className="text-center lg:text-left space-y-4 sm:space-y-6">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight">
                  <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Diabetes Risk
                  </span>
                  <br />
                  <span className="text-white">Prediction System</span>
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-[#B9BBBE] leading-relaxed">
                  Advanced AI-powered diabetes risk assessment for patients and healthcare providers. 
                  Take control of your health with intelligent insights.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                  <div className="flex items-center gap-2 text-[#B9BBBE]">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                    <span>AI-Powered Analysis</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#B9BBBE]">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <span>Real-time Insights</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#B9BBBE]">
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
                    <span>Secure & Private</span>
                  </div>
                </div>
              </div>

              {/* Right Side - Sign In Form */}
              <div className="flex justify-center lg:justify-end">
                <SignInForm />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Content() {
  const profileStatus = useQuery(api.users.hasCompletedProfile);
  const currentUser = useQuery(api.auth.loggedInUser); // Always call hooks unconditionally
  const { signOut } = useAuthActions();

  // Loading state
  if (profileStatus === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Check if user is deactivated
  if (profileStatus.profile && profileStatus.profile.isActive === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Deactivated</h2>
          <p className="text-gray-600 mb-6">
            Your account has been deactivated. Please contact support if you believe this is an error.
          </p>
          <button
            onClick={() => signOut()}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Guest users (anonymous) should not create profiles - show guest dashboard instead
  if (profileStatus.isGuest) {
    // Create a minimal guest profile object for the dashboard
    // Guest users don't have profiles, so we create a temporary one for the dashboard
    const guestProfile = {
      _id: null as any,
      userId: currentUser?._id || (null as any),
      role: "patient" as const,
      firstName: "Guest",
      lastName: "User",
      isGuest: true,
    };
    return (
      <EnhancedDashboard 
        userProfile={guestProfile as any} 
      />
    );
  }

  // User is authenticated but hasn't completed profile setup (non-guest users only)
  if (!profileStatus.hasProfile) {
    return <ProfileSetup />;
  }

  // User has completed profile - route based on role
  if (!profileStatus.profile) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">Profile not found. Please complete setup.</p>
        </div>
      </div>
    );
  }

  const userId = profileStatus.profile.userId as Id<"users">;

  // Wrap content with 2FA gate - enforces 2FA verification if enabled
  // TwoFactorGate checks if user has 2FA enabled and shows verification modal if needed
  const content = (
    <>
      {/* Route admins to AdminDashboard */}
      {profileStatus.profile.role === "admin" ? (
        <AdminDashboard />
      ) : (
        /* Patient or Doctor dashboard */
        <EnhancedDashboard userProfile={profileStatus.profile as any} />
      )}
    </>
  );

  // Wrap with 2FA gate if user has completed profile
  return <TwoFactorGate userId={userId}>{content}</TwoFactorGate>;
}
