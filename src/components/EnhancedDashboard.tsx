import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { EnhancedPatientDashboard } from "./EnhancedPatientDashboard";
import { EnhancedDoctorDashboard } from "./EnhancedDoctorDashboard";
import { ProfilePage } from "./ProfilePage";
import { Loader2 } from "lucide-react";

interface EnhancedDashboardProps {
  userProfile: Doc<"userProfiles">;
}

const isPatientProfile = (
  profile: Doc<"userProfiles"> | null
): profile is Doc<"userProfiles"> & { role: "patient" } => profile?.role === "patient";

const isDoctorProfile = (
  profile: Doc<"userProfiles"> | null
): profile is Doc<"userProfiles"> & { role: "doctor" } => profile?.role === "doctor";

export function EnhancedDashboard({ userProfile }: EnhancedDashboardProps) {
  const [activeView, setActiveView] = useState<"dashboard" | "profile">("dashboard");
  // For guest users, skip profile fetch (they don't have profiles)
  const isGuest = (userProfile as any).isGuest === true;
  // Fetch user profile to ensure we have the latest data (skip for guests)
  const currentUserProfile = useQuery(
    api.users.getUserProfile,
    isGuest ? "skip" : { userId: userProfile.userId }
  );

  // For guest users, use the passed profile directly (they don't have a real profile)
  if (isGuest) {
    const profile = userProfile;
    if (isPatientProfile(profile)) {
      return (
        <EnhancedPatientDashboard
          userProfile={profile}
          onViewProfile={undefined} // Guest users can't view profile
        />
      );
    }
  }

  if (currentUserProfile === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Use the fetched profile or fall back to the passed profile
  const profile = currentUserProfile ?? userProfile;

  if (activeView === "profile") {
    // Guest users cannot access profile page
    if (isGuest || (profile as any).isGuest) {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Available</h2>
            <p className="text-gray-600 mb-4">
              Guest users don't have profiles. Register with an email to create a profile and save your data.
            </p>
            <button
              onClick={() => setActiveView("dashboard")}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProfilePage onBack={() => setActiveView("dashboard")} fallbackProfile={profile as any} />
      </div>
    );
  }

  if (isPatientProfile(profile)) {
    return (
      <EnhancedPatientDashboard
        userProfile={profile}
        onViewProfile={() => setActiveView("profile")}
      />
    );
  } else if (isDoctorProfile(profile)) {
    return (
      <EnhancedDoctorDashboard
        userProfile={profile}
        onViewProfile={() => setActiveView("profile")}
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to access this dashboard.</p>
      </div>
    </div>
  );
}
