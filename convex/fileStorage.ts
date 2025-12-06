import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Generate upload URL for patient documents
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

// Store patient document metadata
export const storePatientDocument = mutation({
  args: {
    patientId: v.id("users"),
    documentType: v.union(
      v.literal("lab_report"),
      v.literal("medical_history"),
      v.literal("prescription"),
      v.literal("imaging"),
      v.literal("consent_form"),
      v.literal("other")
    ),
    fileName: v.string(),
    fileId: v.id("_storage"),
    description: v.optional(v.string()),
    isConfidential: v.boolean(),
    tags: v.optional(v.array(v.string())),
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

    // Patients can only upload their own documents
    if (userProfile.role === "patient" && userId !== args.patientId) {
      throw new Error("Access denied: Cannot upload documents for other patients");
    }

    // Doctors can upload documents for their assigned patients
    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied: Cannot upload documents for this patient");
      }
    }

    const documentId = await ctx.db.insert("patientDocuments", {
      ...args,
      uploadedBy: userId,
      isDeleted: false,
    });

    // Log the upload
    await ctx.db.insert("auditLogs", {
      userId,
      action: "upload_document",
      resourceType: "patient_profile",
      resourceId: documentId,
      targetPatientId: args.patientId,
      success: true,
      additionalData: {
        document_type: args.documentType,
        file_name: args.fileName,
      },
    });

    return documentId;
  },
});

// Get patient documents
export const getPatientDocuments = query({
  args: {
    patientId: v.id("users"),
    documentType: v.optional(v.union(
      v.literal("lab_report"),
      v.literal("medical_history"),
      v.literal("prescription"),
      v.literal("imaging"),
      v.literal("consent_form"),
      v.literal("other")
    )),
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

    // Patients can only view their own documents
    if (userProfile.role === "patient" && userId !== args.patientId) {
      throw new Error("Access denied");
    }

    // Doctors can view their assigned patients' documents
    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied");
      }
    }

    let query = ctx.db
      .query("patientDocuments")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("isDeleted"), false));

    if (args.documentType) {
      query = query.filter((q) => q.eq(q.field("documentType"), args.documentType));
    }

    const documents = await query.collect();

    // Get file URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.fileId),
      }))
    );

    return documentsWithUrls;
  },
});

// Get document URL
export const getDocumentUrl = query({
  args: {
    documentId: v.id("patientDocuments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document || document.isDeleted) {
      throw new Error("Document not found");
    }

    // Check access permissions
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    // Patients can only view their own documents
    if (userProfile.role === "patient" && userId !== document.patientId) {
      throw new Error("Access denied");
    }

    // Doctors can view their assigned patients' documents
    if (userProfile.role === "doctor") {
      const patientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", document.patientId))
        .unique();

      if (patientProfile?.assignedDoctorId !== userId) {
        throw new Error("Access denied");
      }
    }

    const url = await ctx.storage.getUrl(document.fileId);
    return { url, document };
  },
});

// Store ML model
export const storeMLModel = mutation({
  args: {
    modelName: v.string(),
    version: v.string(),
    modelType: v.union(v.literal("diabetes_risk"), v.literal("complication_risk")),
    parametersFileId: v.id("_storage"),
    trainingDatasetId: v.optional(v.id("_storage")),
    accuracy: v.number(),
    precision: v.number(),
    recall: v.number(),
    f1Score: v.number(),
    trainingMetrics: v.record(v.string(), v.number()),
    featureList: v.array(v.string()),
    description: v.optional(v.string()),
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
      throw new Error("Access denied: Only doctors can store ML models");
    }

    // Deactivate previous models of the same type
    const existingModels = await ctx.db
      .query("mlModels")
      .withIndex("by_model_type", (q) => q.eq("modelType", args.modelType))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const model of existingModels) {
      await ctx.db.patch(model._id, { isActive: false });
    }

    // Store the new model
    const modelId = await ctx.db.insert("mlModels", {
      ...args,
      trainedBy: userId,
      isActive: true,
    });

    return modelId;
  },
});

// Get active ML models
export const getActiveMLModels = query({
  args: {
    modelType: v.optional(v.union(v.literal("diabetes_risk"), v.literal("complication_risk"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let query = ctx.db
      .query("mlModels")
      .withIndex("by_is_active", (q) => q.eq("isActive", true));

    if (args.modelType) {
      query = query.filter((q) => q.eq(q.field("modelType"), args.modelType));
    }

    const models = await query.collect();
    return models;
  },
});

// Update user profile image
export const updateProfileImage = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Get the image URL
    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) {
      throw new Error("Failed to generate image URL");
    }

    // Delete old image if exists
    if (profile.profileImageId) {
      try {
        await ctx.storage.delete(profile.profileImageId);
      } catch (error) {
        // Ignore errors if file doesn't exist
        console.warn("Failed to delete old profile image:", error);
      }
    }

    // Update profile with new image
    await ctx.db.patch(profile._id, {
      profileImageId: args.storageId,
      profileImageUrl: imageUrl,
    });

    return { storageId: args.storageId, url: imageUrl };
  },
});

// Remove user profile image
export const removeProfileImage = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Delete image from storage if exists
    if (profile.profileImageId) {
      try {
        await ctx.storage.delete(profile.profileImageId);
      } catch (error) {
        // Ignore errors if file doesn't exist
        console.warn("Failed to delete profile image:", error);
      }
    }

    // Update profile to remove image
    await ctx.db.patch(profile._id, {
      profileImageId: undefined,
      profileImageUrl: undefined,
    });

    return { success: true };
  },
});

// Get profile image URL
export const getProfileImageUrl = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const targetUserId = args.userId || currentUserId;

    // Get the profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", targetUserId))
      .unique();

    if (!profile) {
      return null;
    }

    // If profile has a stored URL, return it
    if (profile.profileImageUrl) {
      return profile.profileImageUrl;
    }

    // Otherwise, generate URL from storage ID if exists
    if (profile.profileImageId) {
      const url = await ctx.storage.getUrl(profile.profileImageId);
      if (url) {
        // Return the URL (queries are read-only, so we can't patch here)
        // The URL will be generated on-the-fly each time
        return url;
      }
    }

    return null;
  },
});
