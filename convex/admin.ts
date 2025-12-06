import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Helper to check if current user is admin
async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user_id", (q: any) => q.eq("userId", userId))
    .unique();

  if (!profile || profile.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }

  return profile;
}

// ============ STATISTICS ============

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Get all user profiles
    const allUsers = await ctx.db.query("userProfiles").collect();

    const patients = allUsers.filter((u) => u.role === "patient");
    const doctors = allUsers.filter((u) => u.role === "doctor");
    const admins = allUsers.filter((u) => u.role === "admin");

    const activeUsers = allUsers.filter((u) => u.isActive !== false);
    const verifiedUsers = allUsers.filter((u) => (u as any).isEmailVerified === true);

    // Get all predictions (non-deleted)
    const allPredictions = await ctx.db
      .query("riskPredictions")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    // High risk patients (risk >= 50% or category high/very_high)
    const latestPredictionsByUser = new Map<string, any>();
    for (const pred of allPredictions) {
      const userId = pred.patientId.toString();
      const existing = latestPredictionsByUser.get(userId);
      const predTime = (pred as any)._creationTime || 0;
      const existingTime = existing?._creationTime || 0;

      if (!existing || predTime > existingTime) {
        latestPredictionsByUser.set(userId, pred);
      }
    }

    const highRiskCount = Array.from(latestPredictionsByUser.values()).filter(
      (p) => (p.riskScore || 0) >= 0.5 || p.riskCategory === "high" || p.riskCategory === "very_high"
    ).length;

    // Risk distribution
    const riskDistribution = {
      low: 0,
      moderate: 0,
      high: 0,
      veryHigh: 0,
    };

    for (const pred of latestPredictionsByUser.values()) {
      const category = pred.riskCategory;
      if (category === "low") riskDistribution.low++;
      else if (category === "moderate") riskDistribution.moderate++;
      else if (category === "high") riskDistribution.high++;
      else if (category === "very_high") riskDistribution.veryHigh++;
    }

    // Registrations in last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentRegistrations = allUsers.filter(
      (u) => (u as any)._creationTime && (u as any)._creationTime > thirtyDaysAgo
    ).length;

    // Assessments in last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentAssessments = allPredictions.filter(
      (p) => (p as any)._creationTime && (p as any)._creationTime > sevenDaysAgo
    ).length;

    return {
      totalUsers: allUsers.length,
      patients: patients.length,
      doctors: doctors.length,
      admins: admins.length,
      activeUsers: activeUsers.length,
      verifiedUsers: verifiedUsers.length,
      verificationRate:
        allUsers.length > 0 ? Math.round((verifiedUsers.length / allUsers.length) * 100) : 0,
      totalAssessments: allPredictions.length,
      highRiskPatients: highRiskCount,
      riskDistribution,
      recentRegistrations,
      recentAssessments,
    };
  },
});

export const getRegistrationTrend = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const days = args.days || 30;
    const allUsers = await ctx.db.query("userProfiles").collect();

    // Group by day
    const trend: { date: string; count: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = allUsers.filter(
        (u) =>
          (u as any)._creationTime &&
          (u as any)._creationTime >= date.getTime() &&
          (u as any)._creationTime < nextDate.getTime()
      ).length;

      trend.push({
        date: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        count,
      });
    }

    return trend;
  },
});

export const getAssessmentTrend = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const days = args.days || 30;
    const allPredictions = await ctx.db
      .query("riskPredictions")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    const trend: { date: string; count: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = allPredictions.filter(
        (p) =>
          (p as any)._creationTime &&
          (p as any)._creationTime >= date.getTime() &&
          (p as any)._creationTime < nextDate.getTime()
      ).length;

      trend.push({
        date: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        count,
      });
    }

    return trend;
  },
});

// ============ USER MANAGEMENT ============

export const getAllUsers = query({
  args: {
    role: v.optional(v.union(v.literal("patient"), v.literal("doctor"), v.literal("admin"), v.literal("all"))),
    search: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let users = await ctx.db.query("userProfiles").collect();

    // Filter by role
    if (args.role && args.role !== "all") {
      users = users.filter((u) => u.role === args.role);
    }

    // Filter by status
    if (args.status === "active") {
      users = users.filter((u) => u.isActive !== false);
    } else if (args.status === "inactive") {
      users = users.filter((u) => u.isActive === false);
    }

    // Search by name or email
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      users = users.filter((u) => {
        const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
        // Get email from users table
        return fullName.includes(searchLower);
      });
    }

    // Get assessment counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        let assessmentCount = 0;
        let latestRiskScore: number | null = null;

        // Get predictions for this patient
        const predictions = await ctx.db
          .query("riskPredictions")
          .withIndex("by_patient", (q) => q.eq("patientId", user.userId))
          .filter((q) => q.eq(q.field("isDeleted"), false))
          .collect();

        assessmentCount = predictions.length;

        if (predictions.length > 0) {
          const sorted = predictions.sort(
            (a, b) => ((b as any)._creationTime || 0) - ((a as any)._creationTime || 0)
          );
          latestRiskScore = sorted[0].riskScore * 100; // Convert to percentage
        }

        // Get email from users table
        const authUser = await ctx.db.get(user.userId);
        const email = authUser ? (authUser as any).email : null;

        return {
          ...user,
          email,
          name: `${user.firstName} ${user.lastName}`,
          assessmentCount,
          latestRiskScore,
          isActive: user.isActive !== false,
        };
      })
    );

    // Sort by creation time (newest first)
    return usersWithStats.sort((a, b) => ((b as any)._creationTime || 0) - ((a as any)._creationTime || 0));
  },
});

export const getUserDetails = query({
  args: { userId: v.optional(v.id("userProfiles")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (!args.userId) {
      return null;
    }
    const userId = args.userId; // Store in const to narrow type

    const user = await ctx.db.get(userId);
    if (!user) {
      // Return null instead of throwing - user may have been deleted
      return null;
    }

    // Get email from users table
    const authUser = await ctx.db.get(user.userId);
    const email = authUser ? (authUser as any).email : null;

    // Get predictions if patient
    let predictions: any[] = [];
    let medicalRecords: any[] = [];

    if (user.role === "patient") {
      predictions = await ctx.db
        .query("riskPredictions")
        .withIndex("by_patient", (q) => q.eq("patientId", user.userId))
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .collect();

      predictions = predictions.sort(
        (a, b) => ((b as any)._creationTime || 0) - ((a as any)._creationTime || 0)
      );

      medicalRecords = await ctx.db
        .query("medicalRecords")
        .withIndex("by_patient", (q) => q.eq("patientId", user.userId))
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .collect();
    }

    // Get assigned doctor if patient
    let assignedDoctor = null;
    if (user.role === "patient" && user.assignedDoctorId) {
      const doctorProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", user.assignedDoctorId as Id<"users">))
        .unique();
      assignedDoctor = doctorProfile;
    }

    // Get patients if doctor
    let patients: any[] = [];
    if (user.role === "doctor") {
      const assignments = await ctx.db
        .query("patientAssignments")
        .withIndex("by_doctor", (q) => q.eq("doctorId", user.userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();

      patients = await Promise.all(
        assignments.map(async (a) => {
          const patientProfile = await ctx.db
            .query("userProfiles")
            .withIndex("by_user_id", (q) => q.eq("userId", a.patientId))
            .unique();
          return patientProfile;
        })
      );
    }

    return {
      ...user,
      email,
      name: `${user.firstName} ${user.lastName}`,
      phone: user.phoneNumber,
      predictions,
      medicalRecords,
      assignedDoctor,
      patients: patients.filter(Boolean),
      patientCount: patients.filter(Boolean).length,
      isActive: user.isActive !== false,
    };
  },
});

export const toggleUserStatus = mutation({
  args: {
    userId: v.id("userProfiles"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Prevent deactivating yourself
    if (user._id === admin._id) {
      throw new Error("Cannot deactivate your own account");
    }

    // Prevent deactivating other admins (optional safety)
    if (user.role === "admin") {
      throw new Error("Cannot deactivate admin accounts");
    }

    await ctx.db.patch(args.userId, {
      isActive: args.isActive,
      deactivatedAt: args.isActive ? undefined : Date.now(),
      deactivatedBy: args.isActive ? undefined : admin._id,
    });

    return { success: true };
  },
});

export const verifyUserEmail = mutation({
  args: { userId: v.id("userProfiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.userId, {
      isEmailVerified: true,
      emailVerifiedAt: Date.now(),
    } as any);

    return { success: true };
  },
});

export const deleteUserByAdmin = mutation({
  args: { userId: v.id("userProfiles") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Prevent deleting yourself
    if (user._id === admin._id) {
      throw new Error("Cannot delete your own account");
    }

    // Prevent deleting other admins
    if (user.role === "admin") {
      throw new Error("Cannot delete admin accounts");
    }

    // Get email for verification codes deletion
    const authUser = await ctx.db.get(user.userId);
    const userEmail = authUser ? (authUser as any).email : null;

    // Delete all related data
    // Delete predictions
    const predictions = await ctx.db
      .query("riskPredictions")
      .withIndex("by_patient", (q) => q.eq("patientId", user.userId))
      .collect();
    for (const p of predictions) {
      await ctx.db.delete(p._id);
    }

    // Delete medical records
    const records = await ctx.db
      .query("medicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", user.userId))
      .collect();
    for (const r of records) {
      await ctx.db.delete(r._id);
    }

    // Delete test results
    const testResults = await ctx.db
      .query("testResults")
      .withIndex("by_patient", (q) => q.eq("patientId", user.userId))
      .collect();
    for (const tr of testResults) {
      await ctx.db.delete(tr._id);
    }

    // Delete documents
    const documents = await ctx.db
      .query("patientDocuments")
      .withIndex("by_patient", (q) => q.eq("patientId", user.userId))
      .collect();
    for (const doc of documents) {
      try {
        await ctx.storage.delete(doc.fileId);
      } catch (e) {}
      await ctx.db.delete(doc._id);
    }

    // Delete medications
    const medications = await ctx.db
      .query("medications")
      .withIndex("by_patient", (q) => q.eq("patientId", user.userId))
      .collect();
    for (const med of medications) {
      await ctx.db.delete(med._id);
    }

    // Delete assignments
    const patientAssignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_patient", (q) => q.eq("patientId", user.userId))
      .collect();
    for (const a of patientAssignments) {
      await ctx.db.delete(a._id);
    }

    if (user.role === "doctor") {
      const doctorAssignments = await ctx.db
        .query("patientAssignments")
        .withIndex("by_doctor", (q) => q.eq("doctorId", user.userId))
        .collect();
      for (const a of doctorAssignments) {
        await ctx.db.delete(a._id);
      }
    }

    // Delete verification codes
    if (userEmail) {
      const codes = await ctx.db
        .query("verificationCodes")
        .withIndex("by_email", (q) => q.eq("email", userEmail))
        .collect();
      for (const c of codes) {
        await ctx.db.delete(c._id);
      }
    }

    // Delete notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", user.userId))
      .collect();
    for (const n of notifications) {
      await ctx.db.delete(n._id);
    }

    // Delete audit logs
    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .collect();
    for (const log of auditLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete profile image
    if (user.profileImageId) {
      try {
        await ctx.storage.delete(user.profileImageId);
      } catch (e) {}
    }

    // Delete auth accounts
    try {
      const authAccounts = await ctx.db
        .query("authAccounts")
        .filter((q) => q.eq(q.field("userId"), user.userId))
        .collect();

      for (const account of authAccounts) {
        await ctx.db.delete(account._id);
      }
    } catch (e) {
      console.log("Note: Could not delete auth accounts:", e);
    }

    // Delete user profile
    await ctx.db.delete(user._id);

    // Delete auth user
    try {
      await ctx.db.delete(user.userId);
    } catch (e) {
      console.log("Note: Could not delete auth user:", e);
    }

    return { success: true };
  },
});

// ============ DOCTOR-PATIENT OVERVIEW ============

export const getDoctorPatientOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const doctors = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "doctor"))
      .collect();

    const doctorsWithPatients = await Promise.all(
      doctors.map(async (doctor) => {
        const assignments = await ctx.db
          .query("patientAssignments")
          .withIndex("by_doctor", (q) => q.eq("doctorId", doctor.userId))
          .filter((q) => q.eq(q.field("isActive"), true))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect();

        return {
          ...doctor,
          name: `${doctor.firstName} ${doctor.lastName}`,
          specialty: doctor.specialization || doctor.specialty,
          patientCount: assignments.length,
          isActive: doctor.isActive !== false,
        };
      })
    );

    // Get unassigned patients
    const allPatients = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "patient"))
      .collect();

    const assignedPatientIds = new Set<string>();
    const allAssignments = await ctx.db.query("patientAssignments").collect();

    for (const a of allAssignments) {
      if (a.isActive && a.status === "active") {
        assignedPatientIds.add(a.patientId.toString());
      }
    }

    const unassignedPatients = allPatients
      .filter((p) => !assignedPatientIds.has(p.userId.toString()))
      .map((p) => ({
        ...p,
        name: `${p.firstName} ${p.lastName}`,
      }));

    return {
      doctors: doctorsWithPatients,
      unassignedPatients,
      unassignedCount: unassignedPatients.length,
    };
  },
});

// ONE-TIME USE - Create initial admin (delete after use)
export const createInitialAdmin = mutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if any admin exists
    const existingAdmin = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();

    if (existingAdmin) {
      throw new Error("Admin already exists");
    }

    // Get user from users table by email
    const authUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (!authUser) {
      throw new Error("User with this email not found. Please sign up first, then run this function.");
    }

    // Check if profile already exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", authUser._id))
      .unique();

    if (existingProfile) {
      // Update existing profile to admin
      await ctx.db.patch(existingProfile._id, { role: "admin" } as any);
      return existingProfile._id;
    }

    // Create new admin profile
    return await ctx.db.insert("userProfiles", {
      userId: authUser._id,
      role: "admin",
      firstName: args.firstName,
      lastName: args.lastName,
      gender: "male",
      dateOfBirth: "1990-01-01",
      isEmailVerified: true,
      isActive: true,
    });
  },
});

// ============ AUDIT LOGS ============

export const getAuditLogs = query({
  args: {
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    success: v.optional(v.boolean()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Build base query (no reassign between different query types)
    const limit = args.limit || 100;
    const baseQuery = args.userId
      ? ctx.db
          .query("auditLogs")
          .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      : ctx.db.query("auditLogs");

    // Always order by most recent first
    let logs = await baseQuery.order("desc").take(limit);

    // Apply additional filters
    if (args.action) {
      logs = logs.filter((log) => log.action === args.action);
    }
    if (args.success !== undefined) {
      logs = logs.filter((log) => log.success === args.success);
    }
    if (args.startDate !== undefined) {
      const start = args.startDate;
      logs = logs.filter(
        (log) => (log as any)._creationTime >= start
      );
    }
    if (args.endDate !== undefined) {
      const end = args.endDate;
      logs = logs.filter(
        (log) => (log as any)._creationTime <= end
      );
    }

    // Get user profiles for each log
    const logsWithUsers = await Promise.all(
      logs.map(async (log) => {
        const userProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q: any) => q.eq("userId", log.userId))
          .unique();

        const targetPatientProfile = log.targetPatientId
          ? await ctx.db
              .query("userProfiles")
              .withIndex("by_user_id", (q: any) => q.eq("userId", log.targetPatientId))
              .unique()
          : null;

        return {
          ...log,
          userName: userProfile
            ? `${userProfile.firstName} ${userProfile.lastName}`
            : "Unknown User",
          userRole: userProfile?.role || "unknown",
          targetPatientName: targetPatientProfile
            ? `${targetPatientProfile.firstName} ${targetPatientProfile.lastName}`
            : null,
        };
      })
    );

    return logsWithUsers;
  },
});

export const getAuditLogStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allLogs = await ctx.db.query("auditLogs").order("desc").take(1000);

    // Count by action
    const actionCounts: Record<string, number> = {};
    const successCount = allLogs.filter((log) => log.success).length;
    const failureCount = allLogs.filter((log) => !log.success).length;

    for (const log of allLogs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    }

    // Recent activity (last 24 hours)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentActivity = allLogs.filter(
      (log) => (log as any)._creationTime && (log as any)._creationTime > twentyFourHoursAgo
    ).length;

    return {
      totalLogs: allLogs.length,
      successCount,
      failureCount,
      actionCounts,
      recentActivity,
    };
  },
});

