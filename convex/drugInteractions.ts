import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

/**
 * Normalize medication name for comparison (lowercase, remove common suffixes)
 */
function normalizeMedicationName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(hcl|hbr|sulfate|tablet|capsule|mg|ml|units?)\b/gi, "")
    .trim();
}

/**
 * Check for drug interactions between medications
 */
export const checkInteractions = query({
  args: {
    medicationNames: v.array(v.string()), // Array of medication names to check
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.medicationNames.length < 2) {
      return []; // Need at least 2 medications to check interactions
    }

    // Get all interactions from database
    const allInteractions = await ctx.db.query("drugInteractions").collect();

    const foundInteractions = [];

    // Check each pair of medications
    for (let i = 0; i < args.medicationNames.length; i++) {
      for (let j = i + 1; j < args.medicationNames.length; j++) {
        const med1 = normalizeMedicationName(args.medicationNames[i]);
        const med2 = normalizeMedicationName(args.medicationNames[j]);

        // Check both directions (med1-med2 and med2-med1)
        const interaction = allInteractions.find(
          (inter) =>
            (normalizeMedicationName(inter.medication1) === med1 &&
              normalizeMedicationName(inter.medication2) === med2) ||
            (normalizeMedicationName(inter.medication1) === med2 &&
              normalizeMedicationName(inter.medication2) === med1)
        );

        if (interaction) {
          foundInteractions.push({
            medication1: args.medicationNames[i],
            medication2: args.medicationNames[j],
            severity: interaction.severity,
            description: interaction.description,
            recommendation: interaction.recommendation,
          });
        }
      }
    }

    return foundInteractions;
  },
});

/**
 * Seed common drug interactions (admin only)
 */
export const seedInteractions = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    const commonInteractions = [
      {
        medication1: "metformin",
        medication2: "alcohol",
        severity: "moderate" as const,
        description:
          "Metformin and alcohol can both cause lactic acidosis, a serious condition.",
        recommendation:
          "Limit alcohol consumption and monitor for symptoms like nausea, vomiting, or muscle pain.",
      },
      {
        medication1: "metformin",
        medication2: "insulin",
        severity: "moderate" as const,
        description:
          "Combining metformin with insulin increases the risk of hypoglycemia (low blood sugar).",
        recommendation:
          "Monitor blood sugar levels closely and adjust insulin doses as needed under medical supervision.",
      },
      {
        medication1: "aspirin",
        medication2: "warfarin",
        severity: "severe" as const,
        description:
          "Aspirin can increase the anticoagulant effects of warfarin, leading to excessive bleeding.",
        recommendation:
          "Avoid taking aspirin with warfarin unless specifically prescribed by your doctor. Monitor for signs of bleeding.",
      },
      {
        medication1: "metformin",
        medication2: "furosemide",
        severity: "moderate" as const,
        description:
          "Furosemide (diuretic) can increase the risk of lactic acidosis when taken with metformin.",
        recommendation:
          "Monitor kidney function and electrolytes. Inform your doctor if you experience muscle pain or weakness.",
      },
      {
        medication1: "insulin",
        medication2: "beta blockers",
        severity: "moderate" as const,
        description:
          "Beta blockers can mask symptoms of hypoglycemia and may affect blood sugar control.",
        recommendation:
          "Monitor blood sugar levels more frequently. Be aware that symptoms of low blood sugar may be less noticeable.",
      },
      {
        medication1: "metformin",
        medication2: "cimetidine",
        severity: "moderate" as const,
        description:
          "Cimetidine can increase metformin levels in the blood, potentially increasing side effects.",
        recommendation:
          "Your doctor may need to adjust your metformin dose. Report any unusual side effects.",
      },
      {
        medication1: "aspirin",
        medication2: "ibuprofen",
        severity: "mild" as const,
        description:
          "Taking ibuprofen with aspirin may reduce aspirin's cardioprotective effects.",
        recommendation:
          "If you take low-dose aspirin for heart protection, consult your doctor before taking ibuprofen regularly.",
      },
      {
        medication1: "warfarin",
        medication2: "vitamin k",
        severity: "moderate" as const,
        description:
          "Vitamin K can reduce the effectiveness of warfarin, affecting blood clotting.",
        recommendation:
          "Maintain consistent vitamin K intake. Avoid sudden changes in foods rich in vitamin K (leafy greens).",
      },
    ];

    // Check if interactions already exist
    const existing = await ctx.db.query("drugInteractions").collect();
    if (existing.length > 0) {
      return { success: false, message: "Interactions already seeded" };
    }

    const createdIds = [];
    for (const interaction of commonInteractions) {
      const id = await ctx.db.insert("drugInteractions", interaction);
      createdIds.push(id);
    }

    return { success: true, count: createdIds.length };
  },
});








