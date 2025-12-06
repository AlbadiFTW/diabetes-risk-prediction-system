import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get doctor dashboard data (alias for frontend compatibility)
export const getDoctorDashboardData = query({
  args: { doctorId: v.id("users") },
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
      throw new Error("Access denied: Only doctors can view dashboard data");
    }

    // Check if email is verified - return empty data instead of throwing error
    if (!(userProfile as any).isEmailVerified) {
      return {
        totalPatients: 0,
        highRiskPatientsCount: 0,
        recentAssessmentsCount: 0,
        riskDistribution: {
          low: 0,
          moderate: 0,
          high: 0,
          very_high: 0,
        },
        latestPredictions: [],
        recentRecords: [],
      };
    }

    // Get active assignments (only count "active" status, not "pending")
    const activeAssignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_doctor", (q) => q.eq("doctorId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const patientIds = activeAssignments.map(a => a.patientId);

    // Get recent predictions for assigned patients
    const recentPredictions = await ctx.db
      .query("riskPredictions")
      .withIndex("by_predicted_by", (q) => q.eq("predictedBy", userId))
      .order("desc")
      .take(50);

    // Calculate risk distribution
    const riskDistribution = {
      low: 0,
      moderate: 0,
      high: 0,
      very_high: 0,
    };

    const latestPredictions = new Map();
    
    // Get latest prediction for each patient
    for (const patientId of patientIds) {
      const latestPrediction = await ctx.db
        .query("riskPredictions")
        .withIndex("by_patient", (q) => q.eq("patientId", patientId))
        .order("desc")
        .first();
      
      if (latestPrediction) {
        latestPredictions.set(patientId, latestPrediction);
        riskDistribution[latestPrediction.riskCategory]++;
      }
    }

    // Get recent medical records
    const recentRecords = await ctx.db
      .query("medicalRecords")
      .withIndex("by_recorded_by", (q) => q.eq("recordedBy", userId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .take(10);

    // Calculate trends (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentHighRiskPredictions = recentPredictions.filter(
      p => p._creationTime > thirtyDaysAgo && (p.riskCategory === "high" || p.riskCategory === "very_high")
    );

    // Calculate recent assessments (last 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let recentAssessmentsCount = 0;
    
    for (const patientId of patientIds) {
      const recentPredsRaw = await ctx.db
        .query("riskPredictions")
        .withIndex("by_patient", (q) => q.eq("patientId", patientId))
        .collect();
      
      const recentPreds = recentPredsRaw.filter(
        (p) => p.isDeleted !== true && p._creationTime >= sevenDaysAgo
      );
      recentAssessmentsCount += recentPreds.length;
    }

    return {
      totalPatients: activeAssignments.length,
      riskDistribution,
      recentPredictionsCount: recentPredictions.length,
      highRiskPatientsCount: riskDistribution.high + riskDistribution.very_high,
      recentHighRiskAlerts: recentHighRiskPredictions.length,
      recentRecordsCount: recentRecords.length,
      recentAssessmentsCount, // Add this field
      latestPredictions: Array.from(latestPredictions.values()).slice(0, 5),
      recentRecords: recentRecords.slice(0, 5),
    };
  },
});

// Get patient dashboard data (alias for frontend compatibility)
export const getPatientDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is anonymous (guest) - they don't have profiles
    const authUser = await ctx.db.get(userId);
    const email = authUser ? (authUser as any).email ?? null : null;
    const isGuest = !email;

    // Verify user is a patient (or guest)
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    // Guest users don't have profiles, so allow them but return empty data
    if (isGuest) {
      return {
        profile: null,
        latestPrediction: null,
        recentPredictions: [],
        totalAssessments: 0,
        medicalRecordsCount: 0,
        testResultsCount: 0,
        documentsCount: 0,
        recentRecords: [],
        recentTestResults: [],
        recentDocuments: [],
        trends: {
          glucose: [],
          bmi: [],
          risk: [],
        },
        healthMetrics: {
          averageGlucose: null,
          averageBMI: null,
          averageBP: null,
        },
        riskTrend: 0,
      };
    }

    if (!userProfile || userProfile.role !== "patient") {
      throw new Error("Access denied: Only patients can view patient dashboard");
    }

    // Get patient's medical records
    const medicalRecordsRaw = await ctx.db
      .query("medicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .collect();
    
    const medicalRecords = medicalRecordsRaw
      .filter((r) => r.isDeleted !== true)
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 10);

    // Get patient's predictions
    const predictionsRaw = await ctx.db
      .query("riskPredictions")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .collect();
    
    // Filter out deleted predictions and get total count BEFORE slicing
    const allNonDeletedPredictions = predictionsRaw.filter((p) => p.isDeleted !== true);
    const totalAssessmentsCount = allNonDeletedPredictions.length;
    
    // Slice only for recent predictions display
    const predictions = allNonDeletedPredictions
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 10);

    // Get latest prediction
    const latestPrediction = predictions[0] || null;

    // Get test results
    const testResults = await ctx.db
      .query("testResults")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .take(10);

    // Get documents
    const documents = await ctx.db
      .query("patientDocuments")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .take(5);

    // Calculate health trends
    const glucoseTrend = medicalRecords.map(record => ({
      date: record._creationTime,
      value: record.glucoseLevel,
    })).reverse();

    const bmiTrend = medicalRecords.map(record => ({
      date: record._creationTime,
      value: record.bmi,
    })).reverse();

    const riskTrend = predictions.map(prediction => ({
      date: prediction._creationTime,
      value: prediction.riskScore,
      category: prediction.riskCategory,
    })).reverse();

    // Get recent predictions for display
    const recentPredictions = predictions.slice(0, 5);

    return {
      profile: userProfile,
      latestPrediction,
      recentPredictions,
      totalAssessments: totalAssessmentsCount, // Use total count of all non-deleted predictions
      medicalRecordsCount: medicalRecords.length,
      testResultsCount: testResults.length,
      documentsCount: documents.length,
      recentRecords: medicalRecords.slice(0, 3),
      recentTestResults: testResults.slice(0, 3),
      recentDocuments: documents,
      trends: {
        glucose: glucoseTrend,
        bmi: bmiTrend,
        risk: riskTrend,
      },
    };
  },
});

// Get dashboard statistics for doctors
export const getDoctorDashboardStats = query({
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
      throw new Error("Access denied: Only doctors can view dashboard statistics");
    }

    // Get active assignments (only count "active" status, not "pending")
    const activeAssignments = await ctx.db
      .query("patientAssignments")
      .withIndex("by_doctor", (q) => q.eq("doctorId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const patientIds = activeAssignments.map(a => a.patientId);

    // Get recent predictions for assigned patients
    const recentPredictions = await ctx.db
      .query("riskPredictions")
      .withIndex("by_predicted_by", (q) => q.eq("predictedBy", userId))
      .order("desc")
      .take(50);

    // Calculate risk distribution
    const riskDistribution = {
      low: 0,
      moderate: 0,
      high: 0,
      very_high: 0,
    };

    const latestPredictions = new Map();
    
    // Get latest prediction for each patient
    for (const patientId of patientIds) {
      const latestPrediction = await ctx.db
        .query("riskPredictions")
        .withIndex("by_patient", (q) => q.eq("patientId", patientId))
        .order("desc")
        .first();
      
      if (latestPrediction) {
        latestPredictions.set(patientId, latestPrediction);
        riskDistribution[latestPrediction.riskCategory]++;
      }
    }

    // Get recent medical records
    const recentRecords = await ctx.db
      .query("medicalRecords")
      .withIndex("by_recorded_by", (q) => q.eq("recordedBy", userId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .take(10);

    // Calculate trends (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentHighRiskPredictions = recentPredictions.filter(
      p => p._creationTime > thirtyDaysAgo && (p.riskCategory === "high" || p.riskCategory === "very_high")
    );

    return {
      totalPatients: activeAssignments.length,
      riskDistribution,
      recentPredictionsCount: recentPredictions.length,
      highRiskPatientsCount: riskDistribution.high + riskDistribution.very_high,
      recentHighRiskAlerts: recentHighRiskPredictions.length,
      recentRecordsCount: recentRecords.length,
      latestPredictions: Array.from(latestPredictions.values()).slice(0, 5),
      recentRecords: recentRecords.slice(0, 5),
    };
  },
});


// Get risk trend analysis for a patient
export const getPatientRiskTrend = query({
  args: {
    patientId: v.id("users"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check access permissions
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    // Patients can only view their own data
    if (userProfile.role === "patient" && userId !== args.patientId) {
      throw new Error("Access denied");
    }

    // Doctors can view their assigned patients' data
    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied");
      }
    }

    const days = args.days || 90;
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);

    // Get predictions within the time range
    const predictionsRaw = await ctx.db
      .query("riskPredictions")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();
    
    const predictions = predictionsRaw
      .filter((p) => p.isDeleted !== true && p._creationTime >= startDate)
      .sort((a, b) => a._creationTime - b._creationTime);

    // Get medical records within the time range
    const medicalRecords = await ctx.db
      .query("medicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.gte(q.field("_creationTime"), startDate))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("asc")
      .collect();

    return {
      predictions: predictions.map(p => ({
        date: p._creationTime,
        riskScore: p.riskScore,
        riskCategory: p.riskCategory,
        confidenceScore: p.confidenceScore,
      })),
      medicalData: medicalRecords.map(r => ({
        date: r._creationTime,
        glucoseLevel: r.glucoseLevel,
        bmi: r.bmi,
        systolicBP: r.systolicBP,
        diastolicBP: r.diastolicBP,
      })),
    };
  },
});

// Get high-risk patients for doctors
export const getHighRiskPatients = query({
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
      throw new Error("Access denied: Only doctors can view high-risk patients");
    }

    // Get assigned patients
    const assignedPatients = await ctx.db
      .query("userProfiles")
      .withIndex("by_assigned_doctor", (q) => q.eq("assignedDoctorId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const highRiskPatients = [];

    for (const patient of assignedPatients) {
      // Get latest prediction for each patient
      const latestPrediction = await ctx.db
        .query("riskPredictions")
        .withIndex("by_patient", (q) => q.eq("patientId", patient.userId))
        .order("desc")
        .first();

      if (latestPrediction && (latestPrediction.riskCategory === "high" || latestPrediction.riskCategory === "very_high")) {
        highRiskPatients.push({
          patient,
          latestPrediction,
        });
      }
    }

    // Sort by risk score (highest first)
    highRiskPatients.sort((a, b) => b.latestPrediction.riskScore - a.latestPrediction.riskScore);

    return highRiskPatients;
  },
});

// Get notifications for user
export const getUserNotifications = query({
  args: {
    limit: v.optional(v.number()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let query = ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId));

    if (args.unreadOnly) {
      query = query.filter((q) => q.eq(q.field("isRead"), false));
    }

    const notifications = await query
      .order("desc")
      .take(args.limit || 20);

    return notifications;
  },
});

// Create a notification (helper function)
export const createNotification = mutation({
  args: {
    recipientId: v.id("users"),
    type: v.union(
      v.literal("high_risk_alert"),
      v.literal("test_result_ready"),
      v.literal("appointment_reminder"),
      v.literal("system_update"),
      v.literal("security_alert"),
            v.literal("doctor_assignment_request"),
            v.literal("patient_assignment_request"),
            v.literal("support_message"),
            v.literal("assessment_reminder"),
            v.literal("medication_reminder")
    ),
    title: v.string(),
    message: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    relatedResourceId: v.optional(v.string()),
    actionUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      recipientId: args.recipientId,
      type: args.type,
      title: args.title,
      message: args.message,
      priority: args.priority,
      isRead: false,
      relatedResourceId: args.relatedResourceId,
      actionUrl: args.actionUrl,
    });
  },
});

// Mark notification as read
export const markNotificationAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.recipientId !== userId) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.notificationId, {
      isRead: true,
    });
  },
});

// Mark all notifications as read
export const markAllNotificationsAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .filter((q) => q.eq(q.field("isRead"), false))
      .collect();

    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
      });
    }

    return { count: unreadNotifications.length };
  },
});
