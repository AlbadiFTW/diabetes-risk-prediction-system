import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Helper function to check if user can access patient data
async function canAccessPatientData(ctx: QueryCtx | MutationCtx, patientId: string): Promise<boolean> {
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
    return userId === patientId;
  }

  const userProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();

  if (!userProfile) {
    throw new Error("User profile not found");
  }

  // Patients can only access their own data
  if (userProfile.role === "patient") {
    return userId === patientId;
  }

  // Doctors can access their assigned patients' data
  if (userProfile.role === "doctor") {
    const patientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", patientId as any))
      .unique();

    return patientProfile?.assignedDoctorId === userId;
  }

  return false;
}

// Create a new medical record
export const createMedicalRecord = mutation({
  args: {
    patientId: v.id("users"),
    recordType: v.union(v.literal("baseline"), v.literal("followup"), v.literal("emergency")),
    age: v.number(),
    gender: v.union(v.literal("male"), v.literal("female")),
    height: v.number(),
    weight: v.number(),
    bmi: v.number(),
    systolicBP: v.number(),
    diastolicBP: v.number(),
    heartRate: v.optional(v.number()),
    glucoseLevel: v.number(),
    hba1c: v.optional(v.number()),
    insulinLevel: v.optional(v.number()),
    skinThickness: v.optional(v.number()),
    familyHistoryDiabetes: v.boolean(),
    pregnancies: v.optional(v.number()),
    gestationalDiabetes: v.optional(v.boolean()),
    smokingStatus: v.optional(v.union(
      v.literal("never"), 
      v.literal("former"), 
      v.literal("recent_quit"),
      v.literal("occasional"),
      v.literal("light"),
      v.literal("moderate"),
      v.literal("heavy"),
      v.literal("current")
    )),
    alcoholConsumption: v.optional(v.union(
      v.literal("none"), 
      v.literal("rare"),
      v.literal("occasional"),
      v.literal("moderate"), 
      v.literal("regular"),
      v.literal("heavy")
    )),
    exerciseFrequency: v.optional(v.union(
      v.literal("none"), 
      v.literal("light"), 
      v.literal("moderate"),
      v.literal("active"),
      v.literal("very_active"),
      v.literal("athlete"),
      v.literal("heavy") // Keep for backward compatibility
    )),
    additionalMetrics: v.optional(v.record(v.string(), v.union(v.number(), v.string(), v.boolean()))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check access permissions
    const hasAccess = await canAccessPatientData(ctx, args.patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot create medical record for this patient");
    }

    // Validate BMI calculation
    const calculatedBMI = args.weight / ((args.height / 100) ** 2);
    if (Math.abs(calculatedBMI - args.bmi) > 0.5) {
      throw new Error("BMI calculation error: Please verify height and weight");
    }

    // Validate blood pressure
    if (args.systolicBP <= args.diastolicBP) {
      throw new Error("Invalid blood pressure: Systolic must be higher than diastolic");
    }

    // Create the medical record
    const recordId = await ctx.db.insert("medicalRecords", {
      ...args,
      recordedBy: userId,
      isDeleted: false,
    });

    // Log the action
    await ctx.db.insert("auditLogs", {
      userId,
      action: "create_medical_record",
      resourceType: "medical_record",
      resourceId: recordId,
      targetPatientId: args.patientId,
      success: true,
    });

    return recordId;
  },
});

// Get medical records by patient (alias for frontend compatibility)
export const getMedicalRecordsByPatient = query({
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

    // Check access permissions
    const hasAccess = await canAccessPatientData(ctx, patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot view medical records for this patient");
    }

    const records = await ctx.db
      .query("medicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .take(50);

    return records;
  },
});

// Get medical records for a patient
export const getPatientMedicalRecords = query({
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
    const hasAccess = await canAccessPatientData(ctx, args.patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot view medical records for this patient");
    }

    const records = await ctx.db
      .query("medicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .take(args.limit || 50);

    return records;
  },
});

// Get latest medical record for a patient
export const getLatestMedicalRecord = query({
  args: {
    patientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check access permissions
    const hasAccess = await canAccessPatientData(ctx, args.patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot view medical records for this patient");
    }

    const latestRecord = await ctx.db
      .query("medicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .first();

    return latestRecord;
  },
});

// Update medical record
export const updateMedicalRecord = mutation({
  args: {
    recordId: v.id("medicalRecords"),
    updates: v.object({
      age: v.optional(v.number()),
      height: v.optional(v.number()),
      weight: v.optional(v.number()),
      bmi: v.optional(v.number()),
      systolicBP: v.optional(v.number()),
      diastolicBP: v.optional(v.number()),
      heartRate: v.optional(v.number()),
      glucoseLevel: v.optional(v.number()),
      hba1c: v.optional(v.number()),
      insulinLevel: v.optional(v.number()),
      skinThickness: v.optional(v.number()),
      familyHistoryDiabetes: v.optional(v.boolean()),
      pregnancies: v.optional(v.number()),
      gestationalDiabetes: v.optional(v.boolean()),
      smokingStatus: v.optional(v.union(v.literal("never"), v.literal("former"), v.literal("current"))),
      alcoholConsumption: v.optional(v.union(v.literal("none"), v.literal("moderate"), v.literal("heavy"))),
      exerciseFrequency: v.optional(v.union(v.literal("none"), v.literal("light"), v.literal("moderate"), v.literal("heavy"))),
      additionalMetrics: v.optional(v.record(v.string(), v.union(v.number(), v.string(), v.boolean()))),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the existing record
    const existingRecord = await ctx.db.get(args.recordId);
    if (!existingRecord) {
      throw new Error("Medical record not found");
    }

    // Check access permissions
    const hasAccess = await canAccessPatientData(ctx, existingRecord.patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot update this medical record");
    }

    // Validate BMI if height or weight is being updated
    if (args.updates.height || args.updates.weight || args.updates.bmi) {
      const height = args.updates.height || existingRecord.height;
      const weight = args.updates.weight || existingRecord.weight;
      const bmi = args.updates.bmi || existingRecord.bmi;
      
      const calculatedBMI = weight / ((height / 100) ** 2);
      if (Math.abs(calculatedBMI - bmi) > 0.5) {
        throw new Error("BMI calculation error: Please verify height and weight");
      }
    }

    // Update the record
    await ctx.db.patch(args.recordId, args.updates);

    // Log the action
    await ctx.db.insert("auditLogs", {
      userId,
      action: "update_medical_record",
      resourceType: "medical_record",
      resourceId: args.recordId,
      targetPatientId: existingRecord.patientId,
      success: true,
    });

    return args.recordId;
  },
});

// Soft delete medical record
export const deleteMedicalRecord = mutation({
  args: {
    recordId: v.id("medicalRecords"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the existing record
    const existingRecord = await ctx.db.get(args.recordId);
    if (!existingRecord) {
      throw new Error("Medical record not found");
    }

    // Check access permissions (only doctors can delete records)
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "doctor") {
      throw new Error("Access denied: Only doctors can delete medical records");
    }

    const hasAccess = await canAccessPatientData(ctx, existingRecord.patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot delete this medical record");
    }

    // Soft delete the record
    await ctx.db.patch(args.recordId, { isDeleted: true });

    // Log the action
    await ctx.db.insert("auditLogs", {
      userId,
      action: "delete_medical_record",
      resourceType: "medical_record",
      resourceId: args.recordId,
      targetPatientId: existingRecord.patientId,
      success: true,
    });

    return args.recordId;
  },
});
