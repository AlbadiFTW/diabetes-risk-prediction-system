import { v } from "convex/values";
import { query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// Get comprehensive patient report data for doctor
export const getPatientReportData = query({
  args: {
    patientId: v.id("users"),
  },
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
      throw new Error("Access denied: Only doctors can generate reports");
    }

    // Verify patient is assigned to this doctor
    const patientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
      .unique();

    if (!patientProfile) {
      throw new Error("Patient not found");
    }

    if (patientProfile.assignedDoctorId !== userId) {
      throw new Error("Access denied: Patient is not assigned to you");
    }

    // Get patient email from users table
    const authUser = await ctx.db.get(args.patientId);
    const patientEmail = authUser ? (authUser as any).email ?? undefined : undefined;

    // Get all predictions for patient
    const allPredictions = await ctx.db
      .query("riskPredictions")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    const predictions = allPredictions
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((pred) => ({
        ...pred,
        date: (pred as any)._creationTime,
      }));

    // Get all medical records
    const medicalRecords = await ctx.db
      .query("medicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    const records = medicalRecords
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((rec) => ({
        ...rec,
        date: (rec as any)._creationTime,
      }));

    // Get medications
    const medications = await ctx.db
      .query("medications")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    // Calculate statistics
    const latestPrediction = predictions[0];
    const riskTrend = predictions.length >= 2
      ? latestPrediction.riskScore - predictions[1].riskScore
      : 0;

    const riskDistribution = {
      low: predictions.filter((p) => p.riskCategory === "low").length,
      moderate: predictions.filter((p) => p.riskCategory === "moderate").length,
      high: predictions.filter((p) => p.riskCategory === "high").length,
      veryHigh: predictions.filter((p) => p.riskCategory === "very_high").length,
    };

    // Get latest medical record for current metrics
    const latestRecord = records[0];

    return {
      patient: {
        name: `${patientProfile.firstName} ${patientProfile.lastName}`,
        dateOfBirth: patientProfile.dateOfBirth,
        gender: patientProfile.gender,
        phoneNumber: patientProfile.phoneNumber,
        email: patientEmail,
        diabetesStatus: patientProfile.diabetesStatus,
      },
      doctor: {
        name: `${doctorProfile.firstName} ${doctorProfile.lastName}`,
        specialization: doctorProfile.specialization || doctorProfile.specialty,
        clinicName: doctorProfile.clinicName,
      },
      summary: {
        totalAssessments: predictions.length,
        latestRiskScore: latestPrediction?.riskScore || 0,
        latestRiskCategory: latestPrediction?.riskCategory || "unknown",
        riskTrend,
        riskDistribution,
        lastAssessmentDate: latestPrediction?.date,
        firstAssessmentDate: predictions[predictions.length - 1]?.date,
      },
      assessments: predictions,
      medicalRecords: records,
      medications: medications.filter((m) => m.isActive),
      generatedAt: Date.now(),
    };
  },
});

// Generate PDF report (action that can use external libraries)
export const generatePatientReportPDF = action({
  args: {
    patientId: v.id("users"),
  },
  // Returning a rich object with all report fields
  returns: v.object({
    patient: v.object({
      name: v.string(),
      dateOfBirth: v.optional(v.string()),
      gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
      phoneNumber: v.optional(v.string()),
      email: v.optional(v.string()),
      diabetesStatus: v.optional(v.string()),
    }),
    doctor: v.object({
      name: v.string(),
      specialization: v.optional(v.string()),
      clinicName: v.optional(v.string()),
    }),
    summary: v.object({
      totalAssessments: v.number(),
      latestRiskScore: v.number(),
      latestRiskCategory: v.string(),
      riskTrend: v.number(),
      riskDistribution: v.object({
        low: v.number(),
        moderate: v.number(),
        high: v.number(),
        veryHigh: v.number(),
      }),
      lastAssessmentDate: v.optional(v.number()),
      firstAssessmentDate: v.optional(v.number()),
    }),
    assessments: v.array(v.any() as any),
    medicalRecords: v.array(v.any() as any),
    medications: v.array(v.any() as any),
    generatedAt: v.number(),
  }),
  handler: async (ctx, args): Promise<any> => {
    // Get report data. Explicit type breaks circularity for TypeScript.
    const reportData: any = await ctx.runQuery(
      api.reports.getPatientReportData,
      {
        patientId: args.patientId,
      }
    );

    // Return data for frontend PDF generation
    // Frontend will use browser APIs to render/print
    return reportData;
  },
});

