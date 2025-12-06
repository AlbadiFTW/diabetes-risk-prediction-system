import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Calculate complication risk for patients with diagnosed diabetes
 * Based on HbA1c, blood pressure, glucose levels, and other factors
 */
export function calculateComplicationRisk(medicalData: {
  hba1c?: number;
  glucoseLevel?: number;
  systolicBP?: number;
  diastolicBP?: number;
  bmi?: number;
  age?: number;
  smokingStatus?: string;
  diabetesStatus?: string;
}): {
  cardiovascularRisk: "low" | "moderate" | "high" | "very_high";
  nephropathyRisk: "low" | "moderate" | "high" | "very_high";
  retinopathyRisk: "low" | "moderate" | "high" | "very_high";
  neuropathyRisk: "low" | "moderate" | "high" | "very_high";
  overallComplicationRisk: "low" | "moderate" | "high" | "very_high";
  riskScore: number; // 0-100
  recommendations: string[];
} {
  const recommendations: string[] = [];
  let riskScore = 0;
  
  // Cardiovascular Risk Assessment
  let cardiovascularRisk: "low" | "moderate" | "high" | "very_high" = "low";
  let cvScore = 0;
  
  // HbA1c factor (0-30 points)
  if (medicalData.hba1c) {
    if (medicalData.hba1c >= 9.0) {
      cvScore += 30;
      recommendations.push("HbA1c is very high. Urgent action needed to reduce cardiovascular risk.");
    } else if (medicalData.hba1c >= 8.0) {
      cvScore += 20;
      recommendations.push("HbA1c is elevated. Work with your doctor to improve glucose control.");
    } else if (medicalData.hba1c >= 7.0) {
      cvScore += 10;
      recommendations.push("HbA1c is slightly above target. Consider lifestyle adjustments.");
    }
  }
  
  // Blood pressure factor (0-25 points)
  if (medicalData.systolicBP && medicalData.diastolicBP) {
    if (medicalData.systolicBP >= 140 || medicalData.diastolicBP >= 90) {
      cvScore += 25;
      recommendations.push("High blood pressure detected. Monitor and manage BP to reduce cardiovascular risk.");
    } else if (medicalData.systolicBP >= 130 || medicalData.diastolicBP >= 80) {
      cvScore += 15;
      recommendations.push("Blood pressure is elevated. Consider lifestyle changes and medication if needed.");
    }
  }
  
  // Smoking factor (0-20 points)
  if (medicalData.smokingStatus === "current") {
    cvScore += 20;
    recommendations.push("Smoking significantly increases cardiovascular risk. Consider cessation programs.");
  }
  
  // Age factor (0-15 points)
  if (medicalData.age && medicalData.age >= 60) {
    cvScore += 15;
  } else if (medicalData.age && medicalData.age >= 50) {
    cvScore += 8;
  }
  
  if (cvScore >= 60) {
    cardiovascularRisk = "very_high";
  } else if (cvScore >= 40) {
    cardiovascularRisk = "high";
  } else if (cvScore >= 20) {
    cardiovascularRisk = "moderate";
  }
  
  // Nephropathy (Kidney Disease) Risk Assessment
  let nephropathyRisk: "low" | "moderate" | "high" | "very_high" = "low";
  let nephScore = 0;
  
  // HbA1c factor (0-30 points)
  if (medicalData.hba1c) {
    if (medicalData.hba1c >= 9.0) {
      nephScore += 30;
    } else if (medicalData.hba1c >= 8.0) {
      nephScore += 20;
    } else if (medicalData.hba1c >= 7.0) {
      nephScore += 10;
    }
  }
  
  // Blood pressure factor (0-25 points)
  if (medicalData.systolicBP && medicalData.diastolicBP) {
    if (medicalData.systolicBP >= 140 || medicalData.diastolicBP >= 90) {
      nephScore += 25;
      recommendations.push("High blood pressure can damage kidneys. Regular kidney function tests recommended.");
    } else if (medicalData.systolicBP >= 130 || medicalData.diastolicBP >= 80) {
      nephScore += 15;
    }
  }
  
  // Duration factor (estimated from age and diabetes type)
  if (medicalData.age && medicalData.age >= 50) {
    nephScore += 10;
  }
  
  if (nephScore >= 50) {
    nephropathyRisk = "very_high";
  } else if (nephScore >= 35) {
    nephropathyRisk = "high";
  } else if (nephScore >= 20) {
    nephropathyRisk = "moderate";
  }
  
  // Retinopathy (Eye Disease) Risk Assessment
  let retinopathyRisk: "low" | "moderate" | "high" | "very_high" = "low";
  let retScore = 0;
  
  // HbA1c is the primary factor (0-40 points)
  if (medicalData.hba1c) {
    if (medicalData.hba1c >= 9.0) {
      retScore += 40;
      recommendations.push("High HbA1c increases retinopathy risk. Annual eye exams are essential.");
    } else if (medicalData.hba1c >= 8.0) {
      retScore += 25;
    } else if (medicalData.hba1c >= 7.0) {
      retScore += 15;
    }
  }
  
  // Blood pressure factor (0-20 points)
  if (medicalData.systolicBP && medicalData.systolicBP >= 140) {
    retScore += 20;
  } else if (medicalData.systolicBP && medicalData.systolicBP >= 130) {
    retScore += 10;
  }
  
  if (retScore >= 50) {
    retinopathyRisk = "very_high";
  } else if (retScore >= 35) {
    retinopathyRisk = "high";
  } else if (retScore >= 20) {
    retinopathyRisk = "moderate";
  }
  
  // Neuropathy (Nerve Damage) Risk Assessment
  let neuropathyRisk: "low" | "moderate" | "high" | "very_high" = "low";
  let neurScore = 0;
  
  // HbA1c factor (0-35 points)
  if (medicalData.hba1c) {
    if (medicalData.hba1c >= 9.0) {
      neurScore += 35;
      recommendations.push("Poor glucose control increases neuropathy risk. Regular foot exams recommended.");
    } else if (medicalData.hba1c >= 8.0) {
      neurScore += 22;
    } else if (medicalData.hba1c >= 7.0) {
      neurScore += 12;
    }
  }
  
  // Age factor (0-15 points)
  if (medicalData.age && medicalData.age >= 60) {
    neurScore += 15;
  } else if (medicalData.age && medicalData.age >= 50) {
    neurScore += 8;
  }
  
  if (neurScore >= 40) {
    neuropathyRisk = "very_high";
  } else if (neurScore >= 25) {
    neuropathyRisk = "high";
  } else if (neurScore >= 15) {
    neuropathyRisk = "moderate";
  }
  
  // Calculate overall complication risk score (0-100)
  riskScore = Math.min(100, Math.round(
    (cvScore * 0.3) + 
    (nephScore * 0.25) + 
    (retScore * 0.25) + 
    (neurScore * 0.2)
  ));
  
  // Determine overall risk category
  let overallComplicationRisk: "low" | "moderate" | "high" | "very_high";
  if (riskScore >= 70) {
    overallComplicationRisk = "very_high";
  } else if (riskScore >= 50) {
    overallComplicationRisk = "high";
  } else if (riskScore >= 30) {
    overallComplicationRisk = "moderate";
  } else {
    overallComplicationRisk = "low";
  }
  
  // Add general recommendations
  if (riskScore >= 50) {
    recommendations.push("High complication risk detected. Regular monitoring and medical follow-ups are crucial.");
    recommendations.push("Work closely with your healthcare team to manage all risk factors.");
  } else if (riskScore >= 30) {
    recommendations.push("Moderate complication risk. Continue monitoring and maintain good control.");
  } else {
    recommendations.push("Low complication risk. Continue maintaining good diabetes control.");
  }
  
  return {
    cardiovascularRisk,
    nephropathyRisk,
    retinopathyRisk,
    neuropathyRisk,
    overallComplicationRisk,
    riskScore,
    recommendations: [...new Set(recommendations)], // Remove duplicates
  };
}

// Query to get complication risk for a patient
export const getComplicationRisk = query({
  args: {
    patientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Check if user is anonymous (guest) - they don't have profiles
    const authUser = await ctx.db.get(userId);
    const email = authUser ? (authUser as any).email ?? null : null;
    const isGuest = !email;

    // Guest users don't have profiles, return null for complication risk
    if (isGuest) {
      if (userId !== args.patientId) {
        throw new Error("Access denied");
      }
      return null;
    }
    
    // Get patient profile
    const patientProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.patientId))
      .unique();
    
    if (!patientProfile) {
      throw new Error("Patient profile not found");
    }
    
    // Check access permissions
    if (patientProfile.role === "patient" && userId !== args.patientId) {
      throw new Error("Access denied");
    }
    
    if (patientProfile.role === "doctor") {
      // Doctors can view their assigned patients
      if (patientProfile.assignedDoctorId !== userId) {
        throw new Error("Access denied");
      }
    }
    
    // Get all non-deleted predictions for this patient
    const predictions = await ctx.db
      .query("riskPredictions")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .collect();
    
    // Get medical record IDs from non-deleted predictions
    const validMedicalRecordIds = new Set(
      predictions
        .filter((p) => p.medicalRecordId)
        .map((p) => p.medicalRecordId)
    );
    
    // Get latest medical record that's associated with a non-deleted prediction
    const allRecords = await ctx.db
      .query("medicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .collect();
    
    const latestRecord = allRecords.find((r) => validMedicalRecordIds.has(r._id));
    
    if (!latestRecord) {
      return {
        cardiovascularRisk: "low" as const,
        nephropathyRisk: "low" as const,
        retinopathyRisk: "low" as const,
        neuropathyRisk: "low" as const,
        overallComplicationRisk: "low" as const,
        riskScore: 0,
        recommendations: ["Complete an assessment to calculate complication risk."],
      };
    }
    
    // Calculate complication risk
    return calculateComplicationRisk({
      hba1c: latestRecord.hba1c,
      glucoseLevel: latestRecord.glucoseLevel,
      systolicBP: latestRecord.systolicBP,
      diastolicBP: latestRecord.diastolicBP,
      bmi: latestRecord.bmi,
      age: latestRecord.age,
      smokingStatus: latestRecord.smokingStatus,
      diabetesStatus: patientProfile.diabetesStatus,
    });
  },
});

