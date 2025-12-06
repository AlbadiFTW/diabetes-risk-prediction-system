import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// Get current patient's assigned doctor
export const getAssignedDoctor = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user profile
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    // If user is a doctor, return null (doctors don't have assigned doctors)
    if (userProfile.role === "doctor") {
      return null;
    }

    // Continue with patient logic
    const patientProfile = userProfile;

    if (!patientProfile.assignedDoctorId) {
      return null;
    }

    // Get active assignment
    const assignment = await ctx.db
      .query("patientAssignments")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("doctorId"), patientProfile.assignedDoctorId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!assignment) {
      return null;
    }

    // Get doctor profile
    const doctorProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", patientProfile.assignedDoctorId as Id<"users">))
      .unique();

    if (!doctorProfile) {
      return null;
    }

    // Get doctor's profile image URL
    let profileImageUrl = doctorProfile.profileImageUrl;
    if (!profileImageUrl && doctorProfile.profileImageId) {
      profileImageUrl = (await ctx.storage.getUrl(doctorProfile.profileImageId)) ?? undefined;
    }

    return {
      ...doctorProfile,
      profileImageUrl,
      assignment,
    };
  },
});

// Assign or change doctor for current patient
export const assignDoctor = mutation({
  args: {
    doctorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get patient profile
    const patientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!patientProfile || patientProfile.role !== "patient") {
      throw new Error("User is not a patient");
    }

    // Verify doctor exists and is a doctor
    const doctorProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.doctorId))
      .unique();

    if (!doctorProfile || doctorProfile.role !== "doctor") {
      throw new Error("Invalid doctor ID");
    }

    // Deactivate existing assignments
    const existingAssignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const assignment of existingAssignments) {
      await ctx.db.patch(assignment._id, {
        isActive: false,
        status: "removed",
        updatedAt: Date.now(),
      });
    }

    // Check if there's already a pending request for this doctor
    const existingPending = await ctx.db
      .query("patientAssignments")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("doctorId"), args.doctorId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingPending) {
      throw new Error("You already have a pending request with this doctor");
    }

    // Check if assignment already exists (inactive or rejected)
    const existingInactive = await ctx.db
      .query("patientAssignments")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("doctorId"), args.doctorId))
      .first();

    let assignmentId;
    if (existingInactive) {
      // Reactivate existing assignment as pending
      // IMPORTANT: Update assignedBy to reflect that the patient is initiating this request
      await ctx.db.patch(existingInactive._id, {
        isActive: true,
        status: "pending",
        assignedAt: Date.now(),
        assignedBy: userId, // Update to patient's ID since patient is initiating
        updatedAt: Date.now(),
      });
      assignmentId = existingInactive._id;
    } else {
      // Create new pending assignment
      assignmentId = await ctx.db.insert("patientAssignments", {
        doctorId: args.doctorId,
        patientId: userId,
        assignedAt: Date.now(),
        assignedBy: userId, // Patient assigns themselves
        status: "pending",
        isActive: true,
      });
    }

    // Create notification for doctor
    await ctx.db.insert("notifications", {
      recipientId: args.doctorId,
      type: "doctor_assignment_request",
      title: "New Patient Request",
      message: `${patientProfile.firstName} ${patientProfile.lastName} wants to add you as their healthcare provider`,
      priority: "medium",
      isRead: false,
      relatedResourceId: assignmentId.toString(), // Ensure it's a string
    });

    return { success: true, assignmentId, status: "pending" };
  },
});

// Remove assigned doctor (patient removes their doctor)
export const removeAssignedDoctor = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get patient profile
    const patientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!patientProfile || patientProfile.role !== "patient") {
      throw new Error("User is not a patient");
    }

    // Deactivate all active assignments
    const activeAssignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const assignment of activeAssignments) {
      await ctx.db.patch(assignment._id, {
        isActive: false,
        status: "removed",
        updatedAt: Date.now(),
      });
    }

    // Update patient profile
    await ctx.db.patch(patientProfile._id, {
      assignedDoctorId: undefined,
    });

    return { success: true };
  },
});

// Get all doctors (for selection modal)
export const getAllDoctorsForSelection = query({
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

    // Get profile image URLs for each doctor
    const doctorsWithImages = await Promise.all(
      doctors.map(async (doctor) => {
        let profileImageUrl = doctor.profileImageUrl;
        if (!profileImageUrl && doctor.profileImageId) {
          profileImageUrl = (await ctx.storage.getUrl(doctor.profileImageId)) ?? undefined;
        }
        return {
          ...doctor,
          profileImageUrl,
        };
      })
    );

    return doctorsWithImages;
  },
});

// Get pending assignment requests for a doctor
export const getPendingAssignmentRequests = query({
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
      throw new Error("User is not a doctor");
    }

    // Get all pending assignments for this doctor
    const pendingAssignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_doctor", (q) => q.eq("doctorId", userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Filter to only show patient-initiated requests (where assignedBy === patientId)
    // Doctor-initiated requests should NOT appear here - they appear on patient's dashboard
    const patientInitiated = pendingAssignments.filter(
      (assignment) => assignment.assignedBy === assignment.patientId
    );

    // Get patient info for each assignment
    const requestsWithPatientInfo = await Promise.all(
      patientInitiated.map(async (assignment) => {
        const patientProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", assignment.patientId))
          .unique();

        if (!patientProfile) {
          return null;
        }

        // Get patient's latest risk score if available
        const latestPrediction = await ctx.db
          .query("riskPredictions")
          .withIndex("by_patient", (q) => q.eq("patientId", assignment.patientId))
          .filter((q) => q.eq(q.field("isDeleted"), false))
          .order("desc")
          .first();

        return {
          assignment,
          patient: {
            _id: patientProfile._id,
            userId: patientProfile.userId,
            firstName: patientProfile.firstName,
            lastName: patientProfile.lastName,
            dateOfBirth: patientProfile.dateOfBirth,
            gender: patientProfile.gender,
            phoneNumber: patientProfile.phoneNumber,
          },
          latestRiskScore: latestPrediction ? latestPrediction.riskScore : null,
          latestRiskCategory: latestPrediction ? latestPrediction.riskCategory : null,
        };
      })
    );

    return requestsWithPatientInfo.filter(Boolean);
  },
});

// Accept a patient assignment request
export const acceptAssignment = mutation({
  args: {
    assignmentId: v.id("patientAssignments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user profile
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "doctor") {
      throw new Error("User is not a doctor");
    }

    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Verify this assignment is for this doctor
    if (assignment.doctorId !== userId) {
      throw new Error("Unauthorized: This assignment is not for you");
    }

    // Verify assignment is pending
    if (assignment.status !== "pending") {
      throw new Error("This assignment is not pending");
    }

    // Deactivate any other active assignments for this patient
    const otherAssignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_patient", (q) => q.eq("patientId", assignment.patientId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const otherAssignment of otherAssignments) {
      await ctx.db.patch(otherAssignment._id, {
        isActive: false,
        status: "removed",
        updatedAt: Date.now(),
      });
    }

    // Update assignment to active
    await ctx.db.patch(args.assignmentId, {
      status: "active",
      updatedAt: Date.now(),
    });

    // Update patient profile
    const patientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", assignment.patientId))
      .unique();

    if (patientProfile) {
      await ctx.db.patch(patientProfile._id, {
        assignedDoctorId: userId,
      });
    }

    // Create notification for patient
    await ctx.db.insert("notifications", {
      recipientId: assignment.patientId,
      type: "system_update",
      title: "Doctor Request Accepted",
      message: `Dr. ${userProfile.firstName} ${userProfile.lastName} has accepted your request to be your healthcare provider`,
      priority: "medium",
      isRead: false,
      relatedResourceId: args.assignmentId.toString(),
    });

    // Send email notification to patient
    if (patientProfile) {
      const authUser = await ctx.db.get(assignment.patientId);
      const patientEmail = authUser ? (authUser as any).email : null;
      if (patientEmail && (patientProfile.emailNotifications !== false)) {
        try {
          await ctx.scheduler.runAfter(0, api.emails.sendAssignmentNotificationEmail, {
            email: patientEmail,
            recipientName: `${patientProfile.firstName} ${patientProfile.lastName}`,
            doctorName: `${userProfile.firstName} ${userProfile.lastName}`,
            status: "accepted",
            isPatient: true,
          });
        } catch (error) {
          console.error("Failed to schedule assignment acceptance email:", error);
        }
      }
    }

    // Mark the original notification as read
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .filter((q) => q.eq(q.field("type"), "doctor_assignment_request"))
      .filter((q) => q.eq(q.field("relatedResourceId"), args.assignmentId.toString()))
      .collect();

    for (const notification of notifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
      });
    }

    return { success: true };
  },
});

// Reject a patient assignment request
export const rejectAssignment = mutation({
  args: {
    assignmentId: v.id("patientAssignments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user profile
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "doctor") {
      throw new Error("User is not a doctor");
    }

    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Verify this assignment is for this doctor
    if (assignment.doctorId !== userId) {
      throw new Error("Unauthorized: This assignment is not for you");
    }

    // Verify assignment is pending
    if (assignment.status !== "pending") {
      throw new Error("This assignment is not pending");
    }

    // Update assignment to rejected
    await ctx.db.patch(args.assignmentId, {
      status: "rejected",
      isActive: false,
      updatedAt: Date.now(),
    });

    // Get patient profile for email
    const patientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", assignment.patientId))
      .unique();

    // Create notification for patient
    await ctx.db.insert("notifications", {
      recipientId: assignment.patientId,
      type: "system_update",
      title: "Doctor Request Declined",
      message: `Dr. ${userProfile.firstName} ${userProfile.lastName} has declined your request to be your healthcare provider`,
      priority: "low",
      isRead: false,
      relatedResourceId: args.assignmentId.toString(),
    });

    // Send email notification to patient
    if (patientProfile) {
      const authUser = await ctx.db.get(assignment.patientId);
      const patientEmail = authUser ? (authUser as any).email : null;
      if (patientEmail && (patientProfile.emailNotifications !== false)) {
        try {
          await ctx.scheduler.runAfter(0, api.emails.sendAssignmentNotificationEmail, {
            email: patientEmail,
            recipientName: `${patientProfile.firstName} ${patientProfile.lastName}`,
            doctorName: `${userProfile.firstName} ${userProfile.lastName}`,
            status: "rejected",
            isPatient: true,
          });
        } catch (error) {
          console.error("Failed to schedule assignment rejection email:", error);
        }
      }
    }

    // Mark the original notification as read
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .filter((q) => q.eq(q.field("type"), "doctor_assignment_request"))
      .filter((q) => q.eq(q.field("relatedResourceId"), args.assignmentId.toString()))
      .collect();

    for (const notification of notifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
      });
    }

    return { success: true };
  },
});

// Get patient's assignment status (including pending)
export const getPatientAssignmentStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user profile
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "patient") {
      // Return safe default for non-patients instead of throwing
      return { status: "none", assignment: null, doctor: null };
    }

    // Get all active assignments (pending or active)
    const assignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get the latest assignment (pending or active)
    const latestAssignment = assignments.sort(
      (a, b) => (b.assignedAt || 0) - (a.assignedAt || 0)
    )[0];

    if (!latestAssignment) {
      return { status: "none", assignment: null, doctor: null };
    }

    // Get doctor profile
    const doctorProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", latestAssignment.doctorId))
      .unique();

    if (!doctorProfile) {
      return { status: latestAssignment.status, assignment: latestAssignment, doctor: null };
    }

    // Get doctor's profile image URL
    let profileImageUrl = doctorProfile.profileImageUrl;
    if (!profileImageUrl && doctorProfile.profileImageId) {
      profileImageUrl = (await ctx.storage.getUrl(doctorProfile.profileImageId)) ?? undefined;
    }

    return {
      status: latestAssignment.status,
      assignment: latestAssignment,
      doctor: {
        ...doctorProfile,
        profileImageUrl,
      },
    };
  },
});

// Get pending doctor assignment requests for a patient
export const getPendingDoctorRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify user is a patient
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "patient") {
      // Return empty array for non-patients instead of throwing
      return [];
    }

    // Get all pending assignments for this patient (where doctor initiated)
    const pendingAssignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Filter to only assignments where the doctor initiated (assignedBy !== patientId)
    const doctorInitiated = pendingAssignments.filter(
      (assignment) => assignment.assignedBy !== userId
    );

    // Get doctor info for each assignment
    const requestsWithDoctorInfo = await Promise.all(
      doctorInitiated.map(async (assignment) => {
        const doctorProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", assignment.doctorId))
          .unique();

        if (!doctorProfile) {
          return null;
        }

        // Get doctor's profile image URL
        let profileImageUrl = doctorProfile.profileImageUrl;
        if (!profileImageUrl && doctorProfile.profileImageId) {
          profileImageUrl = (await ctx.storage.getUrl(doctorProfile.profileImageId)) ?? undefined;
        }

        return {
          assignment,
          doctor: {
            ...doctorProfile,
            profileImageUrl,
          },
        };
      })
    );

    return requestsWithDoctorInfo.filter(Boolean);
  },
});

// Patient accepts a doctor assignment request
export const acceptDoctorRequest = mutation({
  args: {
    assignmentId: v.id("patientAssignments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user profile
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "patient") {
      throw new Error("User is not a patient");
    }

    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Verify this assignment is for this patient
    if (assignment.patientId !== userId) {
      throw new Error("Unauthorized: This assignment is not for you");
    }

    // Verify assignment is pending
    if (assignment.status !== "pending") {
      throw new Error("This assignment is not pending");
    }

    // Deactivate any other active assignments for this patient
    const otherAssignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const otherAssignment of otherAssignments) {
      await ctx.db.patch(otherAssignment._id, {
        isActive: false,
        status: "removed",
        updatedAt: Date.now(),
      });
    }

    // Update assignment to active
    await ctx.db.patch(args.assignmentId, {
      status: "active",
      updatedAt: Date.now(),
    });

    // Update patient profile
    await ctx.db.patch(userProfile._id, {
      assignedDoctorId: assignment.doctorId,
    });

    // Get doctor profile for notification
    const doctorProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", assignment.doctorId))
      .unique();

    // Create notification for doctor
    if (doctorProfile) {
      await ctx.db.insert("notifications", {
        recipientId: assignment.doctorId,
        type: "system_update",
        title: "Patient Request Accepted",
        message: `${userProfile.firstName} ${userProfile.lastName} has accepted your request to be their healthcare provider`,
        priority: "medium",
        isRead: false,
        relatedResourceId: args.assignmentId.toString(),
      });

      // Send email notification to doctor
      const authUser = await ctx.db.get(assignment.doctorId);
      const doctorEmail = authUser ? (authUser as any).email : null;
      if (doctorEmail && (doctorProfile.emailNotifications !== false)) {
        try {
          await ctx.scheduler.runAfter(0, api.emails.sendAssignmentNotificationEmail, {
            email: doctorEmail,
            recipientName: `${doctorProfile.firstName} ${doctorProfile.lastName}`,
            patientName: `${userProfile.firstName} ${userProfile.lastName}`,
            status: "accepted",
            isPatient: false,
          });
        } catch (error) {
          console.error("Failed to schedule assignment acceptance email:", error);
        }
      }
    }

    // Mark the original notification as read
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .filter((q) => q.eq(q.field("type"), "patient_assignment_request"))
      .filter((q) => q.eq(q.field("relatedResourceId"), args.assignmentId.toString()))
      .collect();

    for (const notification of notifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
      });
    }

    return { success: true };
  },
});

// Patient rejects a doctor assignment request
export const rejectDoctorRequest = mutation({
  args: {
    assignmentId: v.id("patientAssignments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user profile
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "patient") {
      throw new Error("User is not a patient");
    }

    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Verify this assignment is for this patient
    if (assignment.patientId !== userId) {
      throw new Error("Unauthorized: This assignment is not for you");
    }

    // Verify assignment is pending
    if (assignment.status !== "pending") {
      throw new Error("This assignment is not pending");
    }

    // Update assignment to rejected
    await ctx.db.patch(args.assignmentId, {
      status: "rejected",
      isActive: false,
      updatedAt: Date.now(),
    });

    // Get doctor profile for notification
    const doctorProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", assignment.doctorId))
      .unique();

    // Create notification for doctor
    if (doctorProfile) {
      await ctx.db.insert("notifications", {
        recipientId: assignment.doctorId,
        type: "system_update",
        title: "Patient Request Declined",
        message: `${userProfile.firstName} ${userProfile.lastName} has declined your request to be their healthcare provider`,
        priority: "low",
        isRead: false,
        relatedResourceId: args.assignmentId.toString(),
      });

      // Send email notification to doctor
      const authUser = await ctx.db.get(assignment.doctorId);
      const doctorEmail = authUser ? (authUser as any).email : null;
      if (doctorEmail && (doctorProfile.emailNotifications !== false)) {
        try {
          await ctx.scheduler.runAfter(0, api.emails.sendAssignmentNotificationEmail, {
            email: doctorEmail,
            recipientName: `${doctorProfile.firstName} ${doctorProfile.lastName}`,
            patientName: `${userProfile.firstName} ${userProfile.lastName}`,
            status: "rejected",
            isPatient: false,
          });
        } catch (error) {
          console.error("Failed to schedule assignment rejection email:", error);
        }
      }
    }

    // Mark the original notification as read
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .filter((q) => q.eq(q.field("type"), "patient_assignment_request"))
      .filter((q) => q.eq(q.field("relatedResourceId"), args.assignmentId.toString()))
      .collect();

    for (const notification of notifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
      });
    }

    return { success: true };
  },
});
