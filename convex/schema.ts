import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Extended user profiles with role-based access
  userProfiles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("patient"), v.literal("doctor"), v.literal("admin")),
    firstName: v.string(),
    lastName: v.string(),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    phoneNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    // Profile image
    profileImageId: v.optional(v.id("_storage")),
    profileImageUrl: v.optional(v.string()),
    // Doctor-specific fields
    licenseNumber: v.optional(v.string()),
    specialization: v.optional(v.string()),
    specialty: v.optional(v.string()), // Alias for specialization, for compatibility
    clinicName: v.optional(v.string()),
    // Patient-specific fields
    assignedDoctorId: v.optional(v.id("users")),
    emergencyContact: v.optional(v.string()),
    // Diabetes status tracking
    diabetesStatus: v.optional(v.union(
      v.literal("none"),           // No diabetes (default for risk prediction)
      v.literal("prediabetic"),    // Pre-diabetes
      v.literal("type1"),          // Type 1 Diabetes
      v.literal("type2"),          // Type 2 Diabetes
      v.literal("gestational"),    // Gestational Diabetes
      v.literal("other")           // Other/unspecified
    )),
    diabetesDiagnosisDate: v.optional(v.number()), // Timestamp when diagnosed
    // Account settings
    emailNotifications: v.optional(v.boolean()),
    reminderFrequency: v.optional(v.string()),
    shareWithDoctor: v.optional(v.boolean()),
    tutorialCompleted: v.optional(v.boolean()), // Track if user has completed the tutorial
    // Email verification fields
    isEmailVerified: v.optional(v.boolean()),
    emailVerifiedAt: v.optional(v.number()),
    // Two-factor authentication (2FA) - Enhanced security feature
    // enable2FA: Whether 2FA is enabled for this user
    // twoFactorMethod: The active 2FA method ("totp" for authenticator apps, "sms" for text messages)
    // totpSecret: Base32-encoded TOTP secret for authenticator apps (should be encrypted in production)
    // totpBackupCodes: Array of single-use backup codes (8 digits each) for account recovery
    // smsVerified: Whether the phone number has been verified for SMS 2FA
    enable2FA: v.optional(v.boolean()),
    twoFactorMethod: v.optional(v.union(v.literal("totp"), v.literal("sms"))),
    totpSecret: v.optional(v.string()), // Base32-encoded TOTP secret (encrypt in production)
    totpBackupCodes: v.optional(v.array(v.string())), // Backup codes for account recovery
    smsVerified: v.optional(v.boolean()), // SMS number verification status
    // Account status (for admin management)
    isActive: v.boolean(),
    deactivatedAt: v.optional(v.number()),
    deactivatedBy: v.optional(v.id("userProfiles")),
  })
    .index("by_user_id", ["userId"])
    .index("by_role", ["role"])
    .index("by_assigned_doctor", ["assignedDoctorId"]),

  // Patient medical records with comprehensive health data
  medicalRecords: defineTable({
    patientId: v.id("users"),
    recordType: v.union(v.literal("baseline"), v.literal("followup"), v.literal("emergency")),
    // Basic demographics
    age: v.number(),
    gender: v.union(v.literal("male"), v.literal("female")),
    // Physical measurements
    height: v.number(), // in cm
    weight: v.number(), // in kg
    bmi: v.number(),
    // Vital signs
    systolicBP: v.number(),
    diastolicBP: v.number(),
    heartRate: v.optional(v.number()),
    // Diabetes-specific metrics
    glucoseLevel: v.number(), // mg/dL
    hba1c: v.optional(v.number()), // %
    insulinLevel: v.optional(v.number()), // μU/mL
    skinThickness: v.optional(v.number()), // mm
    // Medical history
    familyHistoryDiabetes: v.boolean(),
    pregnancies: v.optional(v.number()), // for females
    gestationalDiabetes: v.optional(v.boolean()),
    // Lifestyle factors
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
    // Additional health metrics (flexible for future expansion)
    additionalMetrics: v.optional(v.record(v.string(), v.union(v.number(), v.string(), v.boolean()))),
    // Metadata
    recordedBy: v.id("users"), // doctor who recorded this
    notes: v.optional(v.string()),
    isDeleted: v.boolean(),
  })
    .index("by_patient", ["patientId"])
    .index("by_recorded_by", ["recordedBy"])
    .index("by_record_type", ["recordType"]),

  // ML predictions and risk assessments
  riskPredictions: defineTable({
    patientId: v.id("users"),
    medicalRecordId: v.id("medicalRecords"),
    modelVersion: v.string(),
    riskScore: v.number(), // 0-1 probability
    riskCategory: v.union(v.literal("low"), v.literal("moderate"), v.literal("high"), v.literal("very_high")),
    confidenceScore: v.number(), // 0-1
    featureImportance: v.record(v.string(), v.number()),
    recommendations: v.array(v.string()),
    predictedBy: v.id("users"), // doctor who requested prediction
    modelParameters: v.optional(v.record(v.string(), v.union(v.number(), v.string()))),
    isValidated: v.boolean(),
    validatedBy: v.optional(v.id("users")),
    notes: v.optional(v.string()), // Additional notes for this assessment
    isDeleted: v.optional(v.boolean()), // Soft delete flag (optional for backward compatibility)
    isFavorite: v.optional(v.boolean()), // Favorite flag for easy access
  })
    .index("by_patient", ["patientId"])
    .index("by_medical_record", ["medicalRecordId"])
    .index("by_risk_category", ["riskCategory"])
    .index("by_predicted_by", ["predictedBy"]),

  // Test results history
  testResults: defineTable({
    patientId: v.id("users"),
    testType: v.union(
      v.literal("glucose_tolerance"),
      v.literal("hba1c"),
      v.literal("fasting_glucose"),
      v.literal("random_glucose"),
      v.literal("insulin_level"),
      v.literal("lipid_panel"),
      v.literal("other")
    ),
    testName: v.string(),
    result: v.number(),
    unit: v.string(),
    referenceRange: v.string(),
    status: v.union(v.literal("normal"), v.literal("abnormal"), v.literal("critical")),
    labName: v.optional(v.string()),
    orderedBy: v.id("users"), // doctor who ordered the test
    documentId: v.optional(v.id("_storage")), // PDF report
    notes: v.optional(v.string()),
    isDeleted: v.boolean(),
  })
    .index("by_patient", ["patientId"])
    .index("by_test_type", ["testType"])
    .index("by_ordered_by", ["orderedBy"]),

  // ML model storage and versioning
  mlModels: defineTable({
    modelName: v.string(),
    version: v.string(),
    modelType: v.union(v.literal("diabetes_risk"), v.literal("complication_risk")),
    parametersFileId: v.id("_storage"), // stored model parameters
    trainingDatasetId: v.optional(v.id("_storage")), // CSV dataset used for training
    accuracy: v.number(),
    precision: v.number(),
    recall: v.number(),
    f1Score: v.number(),
    trainingMetrics: v.record(v.string(), v.number()),
    featureList: v.array(v.string()),
    isActive: v.boolean(),
    trainedBy: v.id("users"),
    description: v.optional(v.string()),
  })
    .index("by_model_type", ["modelType"])
    .index("by_is_active", ["isActive"])
    .index("by_trained_by", ["trainedBy"]),

  // Audit logs for security and compliance
  auditLogs: defineTable({
    userId: v.id("users"),
    action: v.union(
      v.literal("view_patient_data"),
      v.literal("create_medical_record"),
      v.literal("update_medical_record"),
      v.literal("delete_medical_record"),
      v.literal("generate_prediction"),
      v.literal("delete_prediction"),
      v.literal("upload_document"),
      v.literal("access_dashboard"),
      v.literal("export_data")
    ),
    resourceType: v.union(
      v.literal("medical_record"),
      v.literal("test_result"),
      v.literal("prediction"),
      v.literal("patient_profile"),
      v.literal("ml_model")
    ),
    resourceId: v.optional(v.string()),
    targetPatientId: v.optional(v.id("users")), // patient whose data was accessed
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    additionalData: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))),
  })
    .index("by_user", ["userId"])
    .index("by_action", ["action"])
    .index("by_target_patient", ["targetPatientId"])
    .index("by_success", ["success"]),

  // Patient documents and file storage
  patientDocuments: defineTable({
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
    uploadedBy: v.id("users"),
    description: v.optional(v.string()),
    isConfidential: v.boolean(),
    tags: v.optional(v.array(v.string())),
    isDeleted: v.boolean(),
  })
    .index("by_patient", ["patientId"])
    .index("by_document_type", ["documentType"])
    .index("by_uploaded_by", ["uploadedBy"]),

  // Patient assignments to doctors
  patientAssignments: defineTable({
    doctorId: v.id("users"),
    patientId: v.id("users"),
    assignedAt: v.number(),
    assignedBy: v.id("users"), // who made the assignment
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("pending"), v.literal("rejected"), v.literal("removed")),
    notes: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_doctor", ["doctorId"])
    .index("by_patient", ["patientId"])
    .index("by_status", ["status"])
    .index("by_assigned_by", ["assignedBy"])
    .index("by_patient_status", ["patientId", "status"]),

  // System notifications and alerts
  notifications: defineTable({
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
    isRead: v.boolean(),
    relatedResourceId: v.optional(v.string()),
    actionUrl: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_recipient", ["recipientId"])
    .index("by_type", ["type"])
    .index("by_priority", ["priority"])
    .index("by_is_read", ["isRead"]),

  // Patient medications tracking
  medications: defineTable({
    patientId: v.id("users"),
    name: v.string(), // Medication name
    dosage: v.string(), // e.g., "500mg", "10 units"
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
    times: v.optional(v.array(v.string())), // Specific times like ["08:00", "20:00"]
    startDate: v.number(), // Timestamp when medication was started
    endDate: v.optional(v.number()), // Timestamp when medication should end (optional for ongoing)
    isActive: v.boolean(), // Whether currently taking this medication
    notes: v.optional(v.string()), // Additional notes or instructions
    prescribedBy: v.optional(v.id("users")), // Doctor who prescribed (optional)
    isDeleted: v.boolean(),
    // Reminder settings
    enableReminders: v.optional(v.boolean()), // Whether to send reminders for this medication
    reminderTimes: v.optional(v.array(v.string())), // Specific reminder times (can differ from times)
  })
    .index("by_patient", ["patientId"])
    .index("by_patient_active", ["patientId", "isActive"])
    .index("by_prescribed_by", ["prescribedBy"]),

  // Medication reminders (for scheduled notifications)
  medicationReminders: defineTable({
    medicationId: v.id("medications"),
    patientId: v.id("users"),
    reminderTime: v.string(), // Time in HH:MM format (e.g., "08:00")
    nextReminderDate: v.number(), // Next date/time to send reminder
    lastSent: v.optional(v.number()), // When reminder was last sent
    isActive: v.boolean(),
    isDeleted: v.boolean(),
  })
    .index("by_medication", ["medicationId"])
    .index("by_patient", ["patientId"])
    .index("by_next_reminder", ["nextReminderDate"])
    .index("by_patient_active", ["patientId", "isActive"]),

  // Drug interaction database (common interactions)
  drugInteractions: defineTable({
    medication1: v.string(), // Normalized medication name
    medication2: v.string(), // Normalized medication name
    severity: v.union(v.literal("mild"), v.literal("moderate"), v.literal("severe")),
    description: v.string(), // Description of the interaction
    recommendation: v.string(), // What to do about it
  })
    .index("by_medication1", ["medication1"])
    .index("by_medication2", ["medication2"]),

  // Email verification codes and 2FA SMS codes
  // Used for: email verification, password reset, and SMS-based 2FA
  // Codes expire after expiresAt timestamp
  // Maximum 5 attempts before code is invalidated
  verificationCodes: defineTable({
    email: v.string(),
    code: v.string(),
    type: v.union(
      v.literal("email_verification"), // Email verification during signup
      v.literal("password_reset"), // Password reset codes
      v.literal("2fa_sms") // SMS verification codes for 2FA
    ),
    expiresAt: v.number(), // Timestamp when code expires
    used: v.boolean(), // Whether code has been used
    attempts: v.number(), // Number of failed verification attempts (max 5)
    createdAt: v.number(), // When code was created
    userId: v.optional(v.id("users")), // User ID for 2FA SMS codes (indexed for quick lookup)
  })
    .index("by_email", ["email"])
    .index("by_code", ["code"])
    .index("by_user", ["userId"]),

  // Messages between patients and doctors
  messages: defineTable({
    senderId: v.id("users"),
    recipientId: v.id("users"),
    content: v.string(),
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
    // Optional: for future features like attachments, message types, etc.
    messageType: v.optional(v.union(v.literal("text"), v.literal("system"), v.literal("file"))),
    relatedResourceId: v.optional(v.string()), // Link to related records (e.g., prediction, record)
  })
    .index("by_sender", ["senderId"])
    .index("by_recipient", ["recipientId"])
    .index("by_recipient_read", ["recipientId", "isRead"])
    .index("by_conversation", ["senderId", "recipientId"]),

  // Assessment reminders for patients
  assessmentReminders: defineTable({
    patientId: v.id("users"),
    reminderDate: v.number(), // When to send the reminder
    frequency: v.union(
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("custom")
    ),
    lastAssessmentDate: v.optional(v.number()), // Date of last assessment
    isActive: v.boolean(),
    sentAt: v.optional(v.number()), // When reminder was last sent
    notes: v.optional(v.string()),
  })
    .index("by_patient", ["patientId"])
    .index("by_reminder_date", ["reminderDate"])
    .index("by_patient_active", ["patientId", "isActive"]),

  // Support messages from users to admins
  supportMessages: defineTable({
    email: v.string(), // User's email (can be from unauthenticated users)
    name: v.optional(v.string()), // User's name if provided
    subject: v.string(),
    message: v.string(),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    userId: v.optional(v.id("users")), // If user is authenticated
    adminResponse: v.optional(v.string()), // Admin's response
    respondedBy: v.optional(v.id("userProfiles")), // Admin who responded
    respondedAt: v.optional(v.number()),
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_priority", ["priority"])
    .index("by_user", ["userId"])
    .index("by_is_read", ["isRead"]),

  // Patient education resources (articles, videos, guides)
  educationResources: defineTable({
    title: v.string(),
    description: v.string(),
    content: v.string(), // Full article content or video description
    type: v.union(
      v.literal("article"),
      v.literal("video"),
      v.literal("tip"),
      v.literal("guide"),
      v.literal("link")
    ),
    category: v.union(
      v.literal("prevention"),
      v.literal("nutrition"),
      v.literal("exercise"),
      v.literal("medication"),
      v.literal("monitoring"),
      v.literal("complications"),
      v.literal("lifestyle"),
      v.literal("general")
    ),
    url: v.optional(v.string()), // For external links or video URLs
    thumbnailUrl: v.optional(v.string()), // For videos or featured images
    author: v.optional(v.string()),
    tags: v.optional(v.array(v.string())), // For search and filtering
    isPublished: v.boolean(),
    publishedAt: v.optional(v.number()),
    createdBy: v.id("userProfiles"), // Admin who created it
    viewCount: v.optional(v.number()), // Track popularity
    isDeleted: v.boolean(),
    order: v.optional(v.number()), // For custom ordering
  })
    .index("by_type", ["type"])
    .index("by_category", ["category"])
    .index("by_published", ["isPublished"])
    .index("by_created_by", ["createdBy"])
    .index("by_order", ["order"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
