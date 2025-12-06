import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// Helper function to calculate diabetes risk score (simplified ML model)
function calculateDiabetesRisk(medicalData: any): {
  riskScore: number;
  riskCategory: "low" | "moderate" | "high" | "very_high";
  confidenceScore: number;
  featureImportance: Record<string, number>;
  recommendations: string[];
} {
  let riskScore = 0;
  const featureImportance: Record<string, number> = {};
  const recommendations: string[] = [];

  // Age factor (0-20)
  const ageFactor = Math.min(medicalData.age || 0, 80) / 400;
  riskScore += ageFactor;
  featureImportance.age = ageFactor;

  // BMI factor (0-25)
  let bmiFactor = 0;
  if (medicalData.bmi >= 30) {
    bmiFactor = 0.25;
    recommendations.push("Consider weight management program.");
  } else if (medicalData.bmi >= 25) {
    bmiFactor = 0.18;
    recommendations.push("Maintain healthy weight through diet and exercise.");
  } else {
    bmiFactor = 0.05;
  }
  riskScore += bmiFactor;
  featureImportance.bmi = bmiFactor;

  // Glucose level factor (0-30)
  let glucoseFactor = 0;
  if (medicalData.glucoseLevel >= 126) {
    glucoseFactor = 0.3;
    recommendations.push("Immediate medical attention recommended for high glucose levels.");
  } else if (medicalData.glucoseLevel >= 100) {
    glucoseFactor = 0.18;
    recommendations.push("Monitor glucose levels regularly.");
  } else {
    glucoseFactor = 0.05;
  }
  riskScore += glucoseFactor;
  featureImportance.glucose = glucoseFactor;

  // Blood pressure factor (0-15)
  let bpFactor = 0;
  if (medicalData.systolicBP >= 140 || medicalData.diastolicBP >= 90) {
    bpFactor = 0.15;
    recommendations.push("Monitor and manage blood pressure.");
  } else if (medicalData.systolicBP >= 130 || medicalData.diastolicBP >= 80) {
    bpFactor = 0.1;
  } else {
    bpFactor = 0.02;
  }
  riskScore += bpFactor;
  featureImportance.bloodPressure = bpFactor;

  // Family history factor (0-10)
  const familyHistoryFactor = medicalData.familyHistoryDiabetes ? 0.1 : 0;
  riskScore += familyHistoryFactor;
  featureImportance.familyHistory = familyHistoryFactor;
  if (medicalData.familyHistoryDiabetes) {
    recommendations.push("Regular screening recommended due to family history.");
  }

  // Lifestyle factors
  if (medicalData.smokingStatus === "current") {
    riskScore += 0.05;
    recommendations.push("Consider a smoking cessation program.");
  }
  
  if (medicalData.exerciseFrequency === "none") {
    riskScore += 0.05;
    recommendations.push("Incorporate regular physical activity.");
  }

  const percentageRisk = Math.min(riskScore, 1) * 100;
  let riskCategory: "low" | "moderate" | "high" | "very_high";
  if (percentageRisk >= 75) {
    riskCategory = "very_high";
  } else if (percentageRisk >= 50) {
    riskCategory = "high";
  } else if (percentageRisk >= 20) {
    riskCategory = "moderate";
  } else {
    riskCategory = "low";
  }

  // Calculate confidence score based on data completeness
  const dataCompleteness = Object.values(medicalData).filter(v => v !== null && v !== undefined).length / 15;
  const confidenceScore = Math.min(100, Math.max(60, 70 + dataCompleteness * 30));

  if (riskCategory !== "low") {
    recommendations.push("Regular medical check-ups recommended.");
    recommendations.push("Maintain a balanced diet low in sugar and refined carbs.");
  }

  return {
    riskScore: Number(percentageRisk.toFixed(1)),
    riskCategory,
    confidenceScore: Number(confidenceScore.toFixed(1)),
    featureImportance,
    recommendations,
  };
}

// Generate diabetes risk prediction
const normalizeRiskCategory = (
  category: string
): "low" | "moderate" | "high" | "very_high" => {
  const normalized = category.toLowerCase().replace(" ", "_");
  if (normalized === "low" || normalized === "moderate" || normalized === "high" || normalized === "very_high") {
    return normalized;
  }
  return "moderate";
};

export const generateRiskPrediction = action({
  args: {
    medicalRecordId: v.id("medicalRecords"),
    override: v.optional(
      v.object({
        riskScore: v.number(),
        riskCategory: v.string(),
        confidenceScore: v.number(),
        featureImportance: v.record(v.string(), v.number()),
        recommendations: v.array(v.string()),
        modelVersion: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const medicalRecord: any = await ctx.runQuery(api.predictions.getMedicalRecordForPrediction, {
      recordId: args.medicalRecordId,
    });

    if (!medicalRecord) {
      throw new Error("Medical record not found");
    }

    let prediction: {
      riskScore: number;
      riskCategory: "low" | "moderate" | "high" | "very_high";
      confidenceScore: number;
      featureImportance: Record<string, number>;
      recommendations: string[];
      modelVersion?: string;
    };

    if (args.override) {
      prediction = {
        riskScore: Math.min(Math.max(args.override.riskScore, 0), 100),
        riskCategory: normalizeRiskCategory(args.override.riskCategory),
        confidenceScore: Math.min(Math.max(args.override.confidenceScore, 0), 100),
        featureImportance: args.override.featureImportance,
        recommendations: args.override.recommendations,
        modelVersion: args.override.modelVersion ?? "external-ml",
      };
    } else {
      prediction = calculateDiabetesRisk(medicalRecord);
    }

    const predictionId: string = await ctx.runMutation(api.predictions.storePrediction, {
      patientId: medicalRecord.patientId,
      medicalRecordId: args.medicalRecordId,
      riskScore: prediction.riskScore,
      riskCategory: prediction.riskCategory,
      confidenceScore: prediction.confidenceScore,
      featureImportance: prediction.featureImportance,
      recommendations: prediction.recommendations,
      modelVersion: prediction.modelVersion ?? "v1.0.0",
      predictedBy: userId,
    });

    return predictionId;
  },
});

// Helper query to get medical record for prediction (internal)
export const getMedicalRecordForPrediction = query({
  args: {
    recordId: v.id("medicalRecords"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const record = await ctx.db.get(args.recordId);
    if (!record) {
      return null;
    }

    // Check access permissions
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    // Patients can only access their own data
    if (userProfile.role === "patient" && userId !== record.patientId) {
      throw new Error("Access denied");
    }

    // Doctors can access their assigned patients' data
    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", record.patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied");
      }
    }

    return record;
  },
});

// Store prediction result (internal)
export const storePrediction = mutation({
  args: {
    patientId: v.id("users"),
    medicalRecordId: v.id("medicalRecords"),
    modelVersion: v.string(),
    riskScore: v.number(),
    riskCategory: v.union(v.literal("low"), v.literal("moderate"), v.literal("high"), v.literal("very_high")),
    confidenceScore: v.number(),
    featureImportance: v.record(v.string(), v.number()),
    recommendations: v.array(v.string()),
    predictedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const predictionId = await ctx.db.insert("riskPredictions", {
      ...args,
      isValidated: false,
      isDeleted: false,
    });

    // Log the prediction generation
    await ctx.db.insert("auditLogs", {
      userId: args.predictedBy,
      action: "generate_prediction",
      resourceType: "prediction",
      resourceId: predictionId,
      targetPatientId: args.patientId,
      success: true,
    });

    // Get patient profile for email
    const patientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
      .unique();

    // Get patient email
    const authUser = await ctx.db.get(args.patientId);
    const patientEmail = authUser ? (authUser as any).email : null;

    // Create notification for patient - assessment completed
    await ctx.runMutation(api.dashboard.createNotification, {
      recipientId: args.patientId,
      type: "test_result_ready",
      title: "Assessment Completed",
      message: `Your diabetes risk assessment is ready. Risk Score: ${args.riskScore.toFixed(1)}% (${args.riskCategory.replace("_", " ")} risk)`,
      priority: args.riskCategory === "very_high" ? "urgent" : args.riskCategory === "high" ? "high" : "medium",
      relatedResourceId: predictionId,
      actionUrl: "/dashboard?tab=overview",
    });

    // Create notification for high-risk patients (for doctor)
    if (args.riskCategory === "high" || args.riskCategory === "very_high") {
      await ctx.runMutation(api.dashboard.createNotification, {
        recipientId: args.predictedBy,
        type: "high_risk_alert",
        title: "High Risk Patient Alert",
        message: `Patient has been classified as ${args.riskCategory} risk for diabetes`,
        priority: args.riskCategory === "very_high" ? "urgent" : "high",
        relatedResourceId: predictionId,
      });

      // Send high-risk alert email to patient if email exists and notifications enabled
      if (patientEmail && patientProfile && (patientProfile.emailNotifications !== false)) {
        try {
          await ctx.scheduler.runAfter(0, api.emails.sendHighRiskAlertEmail, {
            email: patientEmail,
            patientName: `${patientProfile.firstName} ${patientProfile.lastName}`,
            riskScore: args.riskScore,
            riskCategory: args.riskCategory,
          });
        } catch (error) {
          console.error("Failed to schedule high-risk alert email:", error);
        }
      }
    }

    // Send assessment result email to patient if email exists and notifications enabled
    if (patientEmail && patientProfile && (patientProfile.emailNotifications !== false)) {
      try {
        await ctx.scheduler.runAfter(0, api.emails.sendAssessmentResultEmail, {
          email: patientEmail,
          patientName: `${patientProfile.firstName} ${patientProfile.lastName}`,
          riskScore: args.riskScore,
          riskCategory: args.riskCategory,
          recommendations: args.recommendations,
        });
      } catch (error) {
        console.error("Failed to schedule assessment result email:", error);
      }
    }

    // Update assessment reminder after new assessment
    try {
      await ctx.scheduler.runAfter(0, api.reminders.updateReminderAfterAssessment, {
        patientId: args.patientId,
      });
    } catch (error) {
      console.error("Failed to update reminder:", error);
    }

    return predictionId;
  },
});

// Get risk predictions by patient (alias for frontend compatibility)
export const getRiskPredictionsByPatient = query({
  args: { patientId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.patientId) {
      return [];
    }
    const patientId = args.patientId; // Store in const to narrow type
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is anonymous (guest) - they can access their own data
    const authUser = await ctx.db.get(userId);
    const email = authUser ? (authUser as any).email ?? null : null;
    const isGuest = !email;

    // Guest users can access their own data (same userId)
    if (isGuest) {
      if (userId !== patientId) {
        throw new Error("Access denied");
      }
      // Return empty array for guests (they don't have saved predictions)
      return [];
    }

    // Check access permissions
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    // Patients can only access their own data
    if (userProfile.role === "patient" && userId !== patientId) {
      throw new Error("Access denied");
    }

    // Doctors can access their assigned patients' data
    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied");
      }
    }

    const predictions = await ctx.db
      .query("riskPredictions")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();

    // Filter out deleted predictions (handle undefined as not deleted for backward compatibility)
    return predictions
      .filter((p) => p.isDeleted !== true)
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 20);
  },
});

// Delete a prediction (soft delete) - allows patients to delete their own assessments
export const deletePrediction = mutation({
  args: {
    predictionId: v.id("riskPredictions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the prediction
    const prediction = await ctx.db.get(args.predictionId);
    if (!prediction) {
      throw new Error("Prediction not found");
    }

    // Check access permissions
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    // Patients can only delete their own predictions
    if (userProfile.role === "patient" && userId !== prediction.patientId) {
      throw new Error("Access denied: You can only delete your own assessments");
    }

    // Doctors can delete predictions for their assigned patients
    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", prediction.patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied: You can only delete assessments for your assigned patients");
      }
    }

    // Soft delete the prediction
    await ctx.db.patch(args.predictionId, { isDeleted: true });

    // Log the action
    await ctx.db.insert("auditLogs", {
      userId,
      action: "delete_prediction",
      resourceType: "prediction",
      resourceId: args.predictionId,
      targetPatientId: prediction.patientId,
      success: true,
    });

    return { success: true };
  },
});

// Toggle favorite status for a prediction
export const toggleFavorite = mutation({
  args: {
    predictionId: v.id("riskPredictions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the prediction
    const prediction = await ctx.db.get(args.predictionId);
    if (!prediction) {
      throw new Error("Prediction not found");
    }

    // Check access permissions
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    // Patients can only favorite their own predictions
    if (userProfile.role === "patient" && userId !== prediction.patientId) {
      throw new Error("Access denied: You can only favorite your own assessments");
    }

    // Doctors can favorite predictions for their assigned patients
    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", prediction.patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied: You can only favorite assessments for your assigned patients");
      }
    }

    // Toggle favorite status
    const newFavoriteStatus = !(prediction.isFavorite === true);
    await ctx.db.patch(args.predictionId, { isFavorite: newFavoriteStatus });

    return { success: true, isFavorite: newFavoriteStatus };
  },
});

// Get high risk patients (alias for frontend compatibility)
export const getHighRiskPatients = query({
  args: { doctorId: v.id("users"), riskThreshold: v.optional(v.number()) },
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
      throw new Error("Access denied: Only doctors can view high-risk patients");
    }

    // Get assigned patients
    const assignedPatients = await ctx.db
      .query("userProfiles")
      .withIndex("by_assigned_doctor", (q) => q.eq("assignedDoctorId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const highRiskPatients = [];
    const threshold = args.riskThreshold || 50; // Default to 50% (risk scores are 0-100)

    for (const patient of assignedPatients) {
      // Get all predictions for this patient (for assessment count and trend)
      const allPredictionsRaw = await ctx.db
        .query("riskPredictions")
        .withIndex("by_patient", (q) => q.eq("patientId", patient.userId))
        .collect();
      
      // Filter out deleted predictions (handle undefined as not deleted for backward compatibility)
      const allPredictions = allPredictionsRaw
        .filter((p) => p.isDeleted !== true)
        .sort((a, b) => b._creationTime - a._creationTime);

      const latestPrediction = allPredictions[0];
      const previousPrediction = allPredictions[1];

      if (latestPrediction && latestPrediction.riskScore >= threshold) {
        // Calculate trend
        let trend = '→'; // stable
        if (allPredictions.length >= 2 && previousPrediction) {
          const latestScore = latestPrediction.riskScore || 0;
          const previousScore = previousPrediction.riskScore || 0;
          if (latestScore > previousScore + 5) {
            trend = '↗'; // increasing
          } else if (latestScore < previousScore - 5) {
            trend = '↘'; // decreasing
          }
        }

        highRiskPatients.push({
          patient,
          latestPrediction,
          assessmentCount: allPredictions.length,
          trend,
        });
      }
    }

    // Sort by risk score (highest first)
    highRiskPatients.sort((a, b) => b.latestPrediction.riskScore - a.latestPrediction.riskScore);

    return highRiskPatients;
  },
});

// Get patient details (alias for frontend compatibility)
export const getPatientDetails = query({
  args: { patientId: v.id("users") },
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

    // Patients can only access their own data
    if (userProfile.role === "patient" && userId !== args.patientId) {
      throw new Error("Access denied");
    }

    // Doctors can access their assigned patients' data
    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied");
      }
    }

    // Get patient profile
    const patientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
      .unique();

    if (!patientProfile) {
      throw new Error("Patient not found");
    }

    return patientProfile;
  },
});

// Get predictions for a patient
export const getPatientPredictions = query({
  args: {
    patientId: v.id("users"),
    limit: v.optional(v.number()),
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

    // Patients can only access their own data
    if (userProfile.role === "patient" && userId !== args.patientId) {
      throw new Error("Access denied");
    }

    // Doctors can access their assigned patients' data
    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied");
      }
    }

    const predictionsRaw = await ctx.db
      .query("riskPredictions")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();

    // Filter out deleted predictions (handle undefined as not deleted for backward compatibility)
    const predictions = predictionsRaw
      .filter((p) => p.isDeleted !== true)
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit || 20);

    return predictions;
  },
});

// Get latest prediction for a patient
export const getLatestPrediction = query({
  args: {
    patientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check access permissions (same as above)
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    if (userProfile.role === "patient" && userId !== args.patientId) {
      throw new Error("Access denied");
    }

    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied");
      }
    }

    const predictionsRaw = await ctx.db
      .query("riskPredictions")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();

    // Filter out deleted predictions (handle undefined as not deleted for backward compatibility)
    const predictions = predictionsRaw
      .filter((p) => p.isDeleted !== true)
      .sort((a, b) => b._creationTime - a._creationTime);

    return predictions[0] || null;
  },
});

// Validate a prediction (doctor only)
export const validatePrediction = mutation({
  args: {
    predictionId: v.id("riskPredictions"),
    isValid: v.boolean(),
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
      throw new Error("Access denied: Only doctors can validate predictions");
    }

    const prediction = await ctx.db.get(args.predictionId);
    if (!prediction) {
      throw new Error("Prediction not found");
    }

    // Update prediction validation status
    await ctx.db.patch(args.predictionId, {
      isValidated: args.isValid,
      validatedBy: userId,
    });

    // Log the validation
    await ctx.db.insert("auditLogs", {
      userId,
      action: "generate_prediction",
      resourceType: "prediction",
      resourceId: args.predictionId,
      targetPatientId: prediction.patientId,
      success: true,
      additionalData: {
        action_type: "validation",
        is_valid: args.isValid,
      },
    });

    return args.predictionId;
  },
});
