import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

const OMAN_PHONE_REGEX = /^[1-9][0-9]{7}$/;
const UAE_PHONE_REGEX = /^[2-9][0-9]{8}$/;

type CountryCode = "OM" | "AE";

const sanitizePhoneNumber = (
  value?: string | null,
  countryCode: CountryCode = "OM"
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const digitsOnly = value.replace(/\D/g, "");
  
  if (countryCode === "OM") {
    if (!OMAN_PHONE_REGEX.test(digitsOnly)) {
      throw new Error("Phone numbers must be exactly 8 digits for Oman");
    }
  } else if (countryCode === "AE") {
    if (!UAE_PHONE_REGEX.test(digitsOnly)) {
      throw new Error("Phone numbers must be exactly 9 digits for UAE");
    }
  }

  return digitsOnly;
};

// Legacy function for backward compatibility
const sanitizeOmanPhone = (value?: string | null): string | undefined => {
  return sanitizePhoneNumber(value, "OM");
};

// Check if user has completed their profile
export const hasCompletedProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { hasProfile: false, isAuthenticated: false, profile: null, isGuest: false };
    }

    // Check if user is anonymous (no email = guest user)
    const authUser = await ctx.db.get(userId);
    const email = authUser ? (authUser as any).email ?? null : null;
    const isGuest = !email; // Anonymous users don't have emails

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    // Guest users should not have profiles - if they do, something went wrong
    if (isGuest) {
      return { hasProfile: false, isAuthenticated: true, profile: null, isGuest: true };
    }

    if (!profile) {
      return { hasProfile: false, isAuthenticated: true, profile: null, isGuest: false };
    }

    // Check if profile has all required fields
    const hasRequiredFields = !!(
      profile.firstName &&
      profile.lastName &&
      profile.role &&
      profile.isActive !== false
    );

    return {
      hasProfile: hasRequiredFields,
      isAuthenticated: true,
      profile: profile,
      isGuest: false,
    };
  },
});

// Get current user's profile with role information
export const getCurrentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    return profile;
  },
});

// Get user profile by user ID (for frontend compatibility)
// Get user email (helper for actions)
export const getUserEmail = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const authUser = await ctx.db.get(args.userId);
    return {
      email: authUser ? (authUser as any).email : null,
    };
  },
});

export const getUserProfile = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return null;
    }
    const userId = args.userId; // Store in const to narrow type
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check if current user is a guest (no email)
    const currentAuthUser = await ctx.db.get(currentUserId);
    const currentEmail = currentAuthUser ? (currentAuthUser as any).email ?? null : null;
    const isCurrentUserGuest = !currentEmail;

    // If current user is a guest and requesting their own profile, return null (they don't have a profile)
    if (isCurrentUserGuest && userId === currentUserId) {
      return null;
    }

    // Get the current user's profile to check permissions
    const currentUserProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", currentUserId))
      .unique();

    // If current user is a guest, they can't access other profiles
    if (isCurrentUserGuest) {
      throw new Error("User profile not found");
    }

    if (!currentUserProfile) {
      throw new Error("User profile not found");
    }

    // If requesting own profile, allow it
    if (userId === currentUserId) {
      return currentUserProfile;
    }

    // If current user is a doctor and requesting a patient's profile
    if (currentUserProfile.role === "doctor") {
      const targetProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .unique();

      if (!targetProfile) {
        throw new Error("Target user profile not found");
      }

      // Check if the target patient is assigned to this doctor
      if (targetProfile.role === "patient" && targetProfile.assignedDoctorId === currentUserId) {
        return targetProfile;
      }

      // If target is also a doctor, allow access (doctor-to-doctor)
      if (targetProfile.role === "doctor") {
        return targetProfile;
      }
    }

    throw new Error("Access denied: Insufficient permissions to view this profile");
  },
});

// Get full profile details for profile page
export const getProfileDetails = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const [authUser, profile] = await Promise.all([
      ctx.db.get(userId),
      ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .unique(),
    ]);

    if (!profile) {
      return null;
    }

    const account = authUser
      ? {
          _id: authUser._id,
          email: (authUser as any).email ?? null,
          name: (authUser as any).name ?? null,
          _creationTime: authUser._creationTime,
        }
      : null;

    let assignedDoctorProfile = null;
    if (profile.role === "patient" && profile.assignedDoctorId) {
      assignedDoctorProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", profile.assignedDoctorId as Id<"users">))
        .unique();
    }

    let latestPrediction = null;
    if (profile.role === "patient") {
      latestPrediction = await ctx.db
        .query("riskPredictions")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .order("desc")
        .first();
    }

    const response: Record<string, any> = {
      user: account,
      profile,
      assignedDoctor: assignedDoctorProfile,
      latestPrediction,
    };

    if (profile.role === "doctor") {
      const activeAssignments = await ctx.db
        .query("patientAssignments")
        .withIndex("by_doctor", (q) => q.eq("doctorId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      const patientIds = activeAssignments.map((assignment) => assignment.patientId);
      let highRiskPatients = 0;

      for (const patientId of patientIds) {
        const prediction = await ctx.db
          .query("riskPredictions")
          .withIndex("by_patient", (q) => q.eq("patientId", patientId))
          .filter((q) => q.eq(q.field("isDeleted"), false))
          .order("desc")
          .first();

        if (prediction && (prediction.riskCategory === "high" || prediction.riskCategory === "very_high")) {
          highRiskPatients += 1;
        }
      }

      response.doctorStats = {
        activePatients: patientIds.length,
        highRiskPatients,
      };
    }

    return response;
  },
});

// Create or update user profile
export const createUserProfile = mutation({
  args: {
    role: v.union(v.literal("patient"), v.literal("doctor")),
    firstName: v.string(),
    lastName: v.string(),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    phoneNumber: v.optional(v.string()),
    phoneCountryCode: v.optional(v.union(v.literal("OM"), v.literal("AE"))),
    address: v.optional(v.string()),
    licenseNumber: v.optional(v.string()),
    specialization: v.optional(v.string()),
    assignedDoctorId: v.optional(v.id("users")),
    emergencyContact: v.optional(v.string()),
    emergencyContactCountryCode: v.optional(v.union(v.literal("OM"), v.literal("AE"))),
    diabetesStatus: v.optional(v.union(
      v.literal("none"),
      v.literal("prediabetic"),
      v.literal("type1"),
      v.literal("type2"),
      v.literal("gestational"),
      v.literal("other")
    )),
    diabetesDiagnosisDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is anonymous (guest) - they should not create profiles
    const authUser = await ctx.db.get(userId);
    const email = authUser ? (authUser as any).email ?? null : null;
    if (!email) {
      throw new Error("Guest users cannot create profiles. Please register with an email to save your data.");
    }

    const phoneCountryCode = (args.phoneCountryCode || "OM") as CountryCode;
    const sanitizedPhone = sanitizePhoneNumber(args.phoneNumber, phoneCountryCode);
    
    const emergencyCountryCode = (args.emergencyContactCountryCode || "OM") as CountryCode;
    const sanitizedEmergencyContact =
      args.role === "patient" ? sanitizePhoneNumber(args.emergencyContact, emergencyCountryCode) : undefined;

    // Store phone number with country code prefix for easy retrieval
    const phoneNumberWithCode = sanitizedPhone ? `${phoneCountryCode === "OM" ? "+968" : "+971"}${sanitizedPhone}` : undefined;
    const emergencyContactWithCode = sanitizedEmergencyContact ? `${emergencyCountryCode === "OM" ? "+968" : "+971"}${sanitizedEmergencyContact}` : undefined;

    // Create profile payload - exclude phone-related fields from args to avoid duplicates
    const { phoneNumber: _, emergencyContact: __, phoneCountryCode: ___, emergencyContactCountryCode: ____, ...restArgs } = args;
    
    const profilePayload = {
      ...restArgs,
      phoneNumber: phoneNumberWithCode,
      emergencyContact: emergencyContactWithCode,
    };

    // Check if profile already exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        ...profilePayload,
        isActive: true,
      });
      return existingProfile._id;
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        ...profilePayload,
        isActive: true,
      });
      return profileId;
    }
  },
});

// Get all doctors (for patient assignment)
export const getAllDoctors = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const doctors = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "doctor"))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return doctors;
  },
});

// Get all exportable data for current user
export const getExportData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("Profile not found");
    }

    // Both patients and doctors can export their data
    if (profile.role === "patient") {
      // PATIENT EXPORT DATA
      // Get all medical records (non-deleted)
      const medicalRecords = await ctx.db
        .query("medicalRecords")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .order("desc")
        .collect();

      // Get all predictions (non-deleted)
      const predictions = await ctx.db
        .query("riskPredictions")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .order("desc")
        .collect();

      // Get all test results (non-deleted)
      const testResults = await ctx.db
        .query("testResults")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .order("desc")
        .collect();

      return {
        profile,
        medicalRecords,
        predictions,
        testResults,
      };
    } else {
      // DOCTOR EXPORT DATA
      // Get all predictions created by this doctor
      const predictions = await ctx.db
        .query("riskPredictions")
        .withIndex("by_predicted_by", (q) => q.eq("predictedBy", userId))
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .order("desc")
        .collect();

      // Get all patient assignments
      const assignments = await ctx.db
        .query("patientAssignments")
        .withIndex("by_doctor", (q) => q.eq("doctorId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .order("desc")
        .collect();

      return {
        profile,
        medicalRecords: [], // Doctors don't have medical records
        predictions,
        testResults: [], // Doctors don't have test results
        assignments, // Include assignments for doctors
      };
    }
  },
});

// Log export action
export const logExportAction = mutation({
  args: {
    exportType: v.union(v.literal("pdf"), v.literal("csv")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Log the export action
    await ctx.db.insert("auditLogs", {
      userId,
      action: "export_data",
      resourceType: "patient_profile",
      targetPatientId: userId,
      success: true,
      additionalData: {
        export_type: args.exportType,
      },
    });

    return { success: true };
  },
});

// Get all patients (for doctor assignment)
export const getAllPatients = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify user is a doctor
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "doctor") {
      throw new Error("Access denied: Only doctors can view all patients");
    }

    const patients = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "patient"))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return patients;
  },
});

// Get patients assigned to a doctor
export const getAssignedPatients = query({
  args: { doctorId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify user is a doctor
    const doctorProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!doctorProfile || doctorProfile.role !== "doctor") {
      throw new Error("Access denied: Only doctors can view assigned patients");
    }

    // Check if email is verified - return empty array instead of throwing error
    if (!(doctorProfile as any).isEmailVerified) {
      return [];
    }

    // Get active assignments for this doctor
    const assignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_doctor", (q) => q.eq("doctorId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get patient profiles for assigned patients
    const patients = [];
    for (const assignment of assignments) {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", assignment.patientId))
        .unique();

      if (patientProfile && patientProfile.isActive) {
        // Get all predictions for this patient (filter deleted ones)
        const allPredictionsRaw = await ctx.db
          .query("riskPredictions")
          .withIndex("by_patient", (q) => q.eq("patientId", assignment.patientId))
          .collect();
        
        // Filter out deleted predictions (handle undefined as not deleted for backward compatibility)
        const allPredictions = allPredictionsRaw
          .filter((p) => p.isDeleted !== true);
        
        // Get latest prediction (sorted by creation time, newest first)
        const latestPrediction = allPredictions
          .sort((a, b) => b._creationTime - a._creationTime)[0];
        
        // Assessment count is the number of non-deleted predictions
        const assessmentCount = allPredictions.length;

        patients.push({
          ...patientProfile,
          latestRiskScore: latestPrediction?.riskScore ?? 0,
          riskCategory: latestPrediction?.riskCategory || "low",
          confidenceScore: latestPrediction?.confidenceScore,
          latestAssessmentDate: latestPrediction?._creationTime,
          assessmentCount: assessmentCount,
          assignmentId: assignment._id,
          assignedAt: assignment.assignedAt,
        });
      }
    }

    return patients;
  },
});

// Assign patient to doctor
export const assignPatientToDoctor = mutation({
  args: {
    patientId: v.id("users"),
    doctorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify user is a doctor or admin
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "doctor") {
      throw new Error("Access denied: Only doctors can assign patients");
    }

    // Check if email is verified
    if (!(userProfile as any).isEmailVerified) {
      throw new Error("Email verification required: Please verify your email address before assigning patients");
    }

    // Get patient profile
    const patientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
      .unique();

    if (!patientProfile || patientProfile.role !== "patient") {
      throw new Error("Invalid patient ID");
    }

    // Check if there's already a pending request for this patient
    const existingPending = await ctx.db
      .query("patientAssignments")
      .withIndex("by_doctor", (q) => q.eq("doctorId", args.doctorId))
      .filter((q) => q.eq(q.field("patientId"), args.patientId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingPending) {
      throw new Error("You already have a pending request with this patient");
    }

    // Check if assignment already exists (active)
    const existingActive = await ctx.db
      .query("patientAssignments")
      .withIndex("by_doctor", (q) => q.eq("doctorId", args.doctorId))
      .filter((q) => q.eq(q.field("patientId"), args.patientId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (existingActive) {
      throw new Error("Patient is already assigned to this doctor");
    }

    // Check if assignment already exists (inactive or rejected)
    const existingInactive = await ctx.db
      .query("patientAssignments")
      .withIndex("by_doctor", (q) => q.eq("doctorId", args.doctorId))
      .filter((q) => q.eq(q.field("patientId"), args.patientId))
      .first();

    let assignmentId;
    if (existingInactive) {
      // Reactivate existing assignment as pending
      // IMPORTANT: Update assignedBy to reflect that the doctor is initiating this request
      await ctx.db.patch(existingInactive._id, {
        isActive: true,
        status: "pending",
        assignedAt: Date.now(),
        assignedBy: userId, // Update to doctor's ID since doctor is initiating
        updatedAt: Date.now(),
      });
      assignmentId = existingInactive._id;
    } else {
      // Create new pending assignment
      assignmentId = await ctx.db.insert("patientAssignments", {
        doctorId: args.doctorId,
        patientId: args.patientId,
        assignedAt: Date.now(),
        assignedBy: userId,
        status: "pending",
        isActive: true,
      });
    }

    // Create notification for patient
    await ctx.db.insert("notifications", {
      recipientId: args.patientId,
      type: "patient_assignment_request",
      title: "New Healthcare Provider Request",
      message: `Dr. ${userProfile.firstName} ${userProfile.lastName} wants to be your healthcare provider`,
      priority: "medium",
      isRead: false,
      relatedResourceId: assignmentId.toString(),
    });

    // Send email notification to patient
    const authUser = await ctx.db.get(args.patientId);
    const patientEmail = authUser ? (authUser as any).email : null;
    if (patientEmail && (patientProfile.emailNotifications !== false)) {
      try {
        await ctx.scheduler.runAfter(0, api.emails.sendAssignmentNotificationEmail, {
          email: patientEmail,
          recipientName: `${patientProfile.firstName} ${patientProfile.lastName}`,
          doctorName: `${userProfile.firstName} ${userProfile.lastName}`,
          status: "requested",
          isPatient: true,
        });
      } catch (error) {
        console.error("Failed to schedule assignment request email:", error);
      }
    }

    // Log the assignment
    await ctx.db.insert("auditLogs", {
      userId,
      action: "view_patient_data",
      resourceType: "patient_profile",
      resourceId: patientProfile._id,
      targetPatientId: args.patientId,
      success: true,
      additionalData: {
        action_type: "patient_assignment",
        assigned_doctor: args.doctorId,
        assignment_id: assignmentId,
      },
    });

    return assignmentId;
  },
});

// Assign patient by email
export const assignPatientByEmail = mutation({
  args: {
    patientEmail: v.string(),
    doctorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify user is a doctor
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "doctor") {
      throw new Error("Access denied: Only doctors can assign patients");
    }

    // Find patient by email (this would need to be implemented with user lookup)
    // For now, we'll assume the patientId is provided
    throw new Error("Patient lookup by email not implemented yet");
  },
});

// Remove patient assignment
export const removePatientAssignment = mutation({
  args: {
    assignmentId: v.id("patientAssignments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify user is a doctor
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "doctor") {
      throw new Error("Access denied: Only doctors can remove patient assignments");
    }

    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Verify the doctor owns this assignment
    if (assignment.doctorId !== userId) {
      throw new Error("Access denied: Cannot remove assignment you don't own");
    }

    // Deactivate the assignment
    await ctx.db.patch(args.assignmentId, {
      isActive: false,
      status: "inactive",
    });

    // Log the removal
    await ctx.db.insert("auditLogs", {
      userId,
      action: "view_patient_data",
      resourceType: "patient_profile",
      resourceId: assignment.patientId,
      targetPatientId: assignment.patientId,
      success: true,
      additionalData: {
        action_type: "patient_assignment_removal",
        assignment_id: args.assignmentId,
      },
    });

    return args.assignmentId;
  },
});

// Update tutorial completion status
export const updateTutorialStatus = mutation({
  args: {
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is a guest (no email)
    const authUser = await ctx.db.get(userId);
    const email = authUser ? (authUser as any).email ?? null : null;
    const isGuest = !email;

    // Guest users don't have profiles, so we can't update tutorial status
    // Just return success silently for guests
    if (isGuest) {
      return { success: true };
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    await ctx.db.patch(profile._id, {
      tutorialCompleted: args.completed,
    });

    return { success: true };
  },
});

// Reset tutorial (mark as not completed)
export const resetTutorial = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    await ctx.db.patch(profile._id, {
      tutorialCompleted: false,
    });

    return { success: true };
  },
});

// Update account settings (email notifications, share with doctor, etc.)
export const updateAccountSettings = mutation({
  args: {
    emailNotifications: v.optional(v.boolean()),
    shareWithDoctor: v.optional(v.boolean()),
    reminderFrequency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Build update object with only provided fields
    const updates: Record<string, any> = {};
    if (args.emailNotifications !== undefined) {
      updates.emailNotifications = args.emailNotifications;
    }
    if (args.shareWithDoctor !== undefined) {
      updates.shareWithDoctor = args.shareWithDoctor;
    }
    if (args.reminderFrequency !== undefined) {
      updates.reminderFrequency = args.reminderFrequency;
    }

    await ctx.db.patch(profile._id, updates);

    return { success: true };
  },
});

// Cancel account creation (delete account when user cancels profile setup)
// This is simpler than deleteAccount since no profile exists yet
export const cancelAccountCreation = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user email for verification codes deletion
    const authUser = await ctx.db.get(userId);
    const userEmail = authUser ? (authUser as any).email : null;

    // Delete verification codes if any
    if (userEmail) {
      try {
        const verificationCodes = await ctx.db
          .query("verificationCodes")
          .withIndex("by_email", (q) => q.eq("email", userEmail))
          .collect();

        for (const code of verificationCodes) {
          await ctx.db.delete(code._id);
        }
      } catch (e) {
        console.log("Note: Could not delete verification codes:", e);
      }
    }

    // Delete auth accounts (Convex Auth stores account info here)
    try {
      const authAccounts = await ctx.db
        .query("authAccounts")
        .filter((q) => q.eq(q.field("userId"), userId))
        .collect();
      
      for (const account of authAccounts) {
        await ctx.db.delete(account._id);
      }
      console.log(`Deleted ${authAccounts.length} auth account(s) for user:`, userId);
    } catch (e: any) {
      console.log("Note: Could not delete auth accounts:", e?.message);
    }

    // Delete the auth user record
    try {
      await ctx.db.delete(userId);
      console.log("Successfully deleted auth user during cancellation:", userId);
    } catch (e: any) {
      console.error("Failed to delete auth user during cancellation:", e);
      throw new Error(`Failed to cancel account creation: ${e?.message || "Unknown error"}`);
    }

    return { success: true, message: "Account creation cancelled successfully" };
  },
});

// Delete user account (hard delete - permanently removes all data)
export const deleteAccount = mutation({
  args: {
    confirmEmail: v.string(), // User must type their email to confirm
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user email from users table (auth) - this is the reliable source
    const authUser = await ctx.db.get(userId);
    if (!authUser) {
      throw new Error("User not found");
    }

    const userEmail = (authUser as any).email;
    if (!userEmail) {
      throw new Error("User email not found. Please contact support.");
    }

    // Trim whitespace and compare case-insensitively
    const inputEmail = args.confirmEmail.trim().toLowerCase();
    const actualEmail = userEmail.trim().toLowerCase();

    if (inputEmail !== actualEmail) {
      throw new Error(`Email confirmation does not match. Please enter: ${userEmail}`);
    }

    // Get the user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Delete all related data

    if (profile.role === "patient") {
      // PATIENT-SPECIFIC DELETIONS
      
      // Hard delete all predictions for this patient
      const predictions = await ctx.db
        .query("riskPredictions")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .collect();

      for (const prediction of predictions) {
        await ctx.db.delete(prediction._id);
      }

      // Hard delete all medical records
      const medicalRecords = await ctx.db
        .query("medicalRecords")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .collect();

      for (const record of medicalRecords) {
        await ctx.db.delete(record._id);
      }

      // Hard delete all test results
      const testResults = await ctx.db
        .query("testResults")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .collect();

      for (const testResult of testResults) {
        await ctx.db.delete(testResult._id);
      }

      // Hard delete all documents and their storage files
      const documents = await ctx.db
        .query("patientDocuments")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .collect();

      for (const document of documents) {
        // Delete file from storage
        try {
          await ctx.storage.delete(document.fileId);
        } catch (e) {
          // File might not exist, continue anyway
          console.log("Could not delete document file:", e);
        }
        await ctx.db.delete(document._id);
      }

      // Hard delete all medications
      const medications = await ctx.db
        .query("medications")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .collect();

      for (const medication of medications) {
        await ctx.db.delete(medication._id);
      }

      // Hard delete patient assignments
      const assignments = await ctx.db
        .query("patientAssignments")
        .withIndex("by_patient", (q) => q.eq("patientId", userId))
        .collect();

      for (const assignment of assignments) {
        await ctx.db.delete(assignment._id);
      }
    } else if (profile.role === "doctor") {
      // DOCTOR-SPECIFIC DELETIONS
      
      // Hard delete all predictions created by this doctor
      const predictionsCreated = await ctx.db
        .query("riskPredictions")
        .withIndex("by_predicted_by", (q) => q.eq("predictedBy", userId))
        .collect();

      for (const prediction of predictionsCreated) {
        await ctx.db.delete(prediction._id);
      }

      // Hard delete all patient assignments for this doctor
      const assignments = await ctx.db
        .query("patientAssignments")
        .withIndex("by_doctor", (q) => q.eq("doctorId", userId))
        .collect();

      for (const assignment of assignments) {
        await ctx.db.delete(assignment._id);
      }
    }

    // Delete notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .collect();

    for (const notification of notifications) {
      await ctx.db.delete(notification._id);
    }

    // Delete verification codes
    if (userEmail) {
      const verificationCodes = await ctx.db
        .query("verificationCodes")
        .withIndex("by_email", (q) => q.eq("email", userEmail))
        .collect();

      for (const code of verificationCodes) {
        await ctx.db.delete(code._id);
      }
    }

    // Delete audit logs (optional - keeping for compliance, but user requested full deletion)
    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const log of auditLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete profile image from storage if exists
    if (profile.profileImageId) {
      try {
        await ctx.storage.delete(profile.profileImageId);
      } catch (e) {
        // Image might not exist, continue anyway
        console.log("Could not delete profile image:", e);
      }
    }

    // IMPORTANT: Delete order matters
    // 1. First delete the user profile (this removes all app data)
    await ctx.db.delete(profile._id);

    // 2. Delete auth accounts (Convex Auth stores account info here)
    try {
      const authAccounts = await ctx.db
        .query("authAccounts")
        .filter((q) => q.eq(q.field("userId"), userId))
        .collect();
      
      for (const account of authAccounts) {
        await ctx.db.delete(account._id);
      }
      console.log(`Deleted ${authAccounts.length} auth account(s) for user:`, userId);
    } catch (e: any) {
      // If authAccounts table doesn't exist or query fails, log and continue
      console.log("Note: Could not delete auth accounts (may not exist or different structure):", e?.message);
    }

    // 3. Delete the auth user record (this prevents sign-in)
    // This MUST succeed - if it fails, the user can still sign in
    try {
      // Verify the user still exists before deletion
      const userToDelete = await ctx.db.get(userId);
      if (!userToDelete) {
        console.warn("User record not found - may have already been deleted");
        return { success: true, message: "Account deleted successfully" };
      }

      // Attempt deletion
      await ctx.db.delete(userId);
      
      // Verify deletion succeeded by trying to get the user again
      const verifyDeleted = await ctx.db.get(userId);
      if (verifyDeleted) {
        console.error("CRITICAL: User still exists after deletion attempt");
        throw new Error("User deletion verification failed - user record still exists");
      }
      
      console.log("Successfully deleted auth user:", userId);
    } catch (e: any) {
      // If deletion fails, log detailed error and throw
      console.error("CRITICAL ERROR: Failed to delete auth user record");
      console.error("UserId:", userId);
      console.error("User email:", userEmail);
      console.error("Error type:", typeof e);
      console.error("Error:", e);
      console.error("Error message:", e?.message);
      console.error("Error name:", e?.name);
      if (e?.stack) {
        console.error("Error stack:", e.stack);
      }
      
      // Re-throw with a clear message
      throw new Error(
        `Failed to delete authentication record. The account may still be accessible. ` +
        `Error: ${e?.message || e?.toString() || "Unknown error"}. ` +
        `Please check the Convex dashboard logs and contact support if this persists.`
      );
    }

    return { success: true, message: "Account deleted successfully" };
  },
});
