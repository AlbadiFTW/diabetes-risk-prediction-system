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

// Create a new medication
export const createMedication = mutation({
  args: {
    patientId: v.id("users"),
    name: v.string(),
    dosage: v.string(),
    frequency: v.union(
      v.literal("once_daily"),
      v.literal("twice_daily"),
      v.literal("thrice_daily"),
      v.literal("four_times_daily"),
      v.literal("as_needed"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("custom")
    ),
    times: v.optional(v.array(v.string())),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    prescribedBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check access permissions
    const hasAccess = await canAccessPatientData(ctx, args.patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot create medication for this patient");
    }

    // Validate start date is not in the future
    if (args.startDate > Date.now()) {
      throw new Error("Start date cannot be in the future");
    }

    // Validate end date is after start date if provided
    if (args.endDate && args.endDate < args.startDate) {
      throw new Error("End date must be after start date");
    }

    // Create the medication
    const medicationId = await ctx.db.insert("medications", {
      ...args,
      isDeleted: false,
    });

    // Log the action
    await ctx.db.insert("auditLogs", {
      userId,
      action: "create_medical_record", // Reusing existing action type
      resourceType: "medical_record",
      resourceId: medicationId,
      targetPatientId: args.patientId,
      success: true,
    });

    return medicationId;
  },
});

// Get medications by patient
export const getMedicationsByPatient = query({
  args: { patientId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check access permissions
    const hasAccess = await canAccessPatientData(ctx, args.patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot view medications for this patient");
    }

    const medications = await ctx.db
      .query("medications")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .collect();

    return medications;
  },
});

// Get active medications by patient
export const getActiveMedicationsByPatient = query({
  args: { patientId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check access permissions
    const hasAccess = await canAccessPatientData(ctx, args.patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot view medications for this patient");
    }

    const medications = await ctx.db
      .query("medications")
      .withIndex("by_patient_active", (q) => 
        q.eq("patientId", args.patientId).eq("isActive", true)
      )
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .collect();

    return medications;
  },
});

// Update medication
export const updateMedication = mutation({
  args: {
    medicationId: v.id("medications"),
    updates: v.object({
      name: v.optional(v.string()),
      dosage: v.optional(v.string()),
      frequency: v.optional(v.union(
        v.literal("once_daily"),
        v.literal("twice_daily"),
        v.literal("thrice_daily"),
        v.literal("four_times_daily"),
        v.literal("as_needed"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("custom")
      )),
      times: v.optional(v.array(v.string())),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      isActive: v.optional(v.boolean()),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the existing medication
    const existingMedication = await ctx.db.get(args.medicationId);
    if (!existingMedication) {
      throw new Error("Medication not found");
    }

    // Check access permissions
    const hasAccess = await canAccessPatientData(ctx, existingMedication.patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot update this medication");
    }

    // Validate dates if being updated
    if (args.updates.startDate || args.updates.endDate) {
      const startDate = args.updates.startDate ?? existingMedication.startDate;
      const endDate = args.updates.endDate ?? existingMedication.endDate;

      if (startDate > Date.now()) {
        throw new Error("Start date cannot be in the future");
      }

      if (endDate && endDate < startDate) {
        throw new Error("End date must be after start date");
      }
    }

    // Update the medication
    await ctx.db.patch(args.medicationId, args.updates);

    // Log the action
    await ctx.db.insert("auditLogs", {
      userId,
      action: "update_medical_record",
      resourceType: "medical_record",
      resourceId: args.medicationId,
      targetPatientId: existingMedication.patientId,
      success: true,
    });

    return args.medicationId;
  },
});

// Soft delete medication
export const deleteMedication = mutation({
  args: {
    medicationId: v.id("medications"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the existing medication
    const existingMedication = await ctx.db.get(args.medicationId);
    if (!existingMedication) {
      throw new Error("Medication not found");
    }

    // Check access permissions
    const hasAccess = await canAccessPatientData(ctx, existingMedication.patientId);
    if (!hasAccess) {
      throw new Error("Access denied: Cannot delete this medication");
    }

    // Soft delete the medication
    await ctx.db.patch(args.medicationId, { isDeleted: true });

    // Log the action
    await ctx.db.insert("auditLogs", {
      userId,
      action: "delete_medical_record",
      resourceType: "medical_record",
      resourceId: args.medicationId,
      targetPatientId: existingMedication.patientId,
      success: true,
    });

    return args.medicationId;
  },
});







