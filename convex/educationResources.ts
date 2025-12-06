import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

/**
 * Get all published education resources for patients
 */
export const getPublishedResources = query({
  args: {
    category: v.optional(v.string()),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let resourcesQuery = ctx.db
      .query("educationResources")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .filter((q) => q.eq(q.field("isDeleted"), false));

    const resources = await resourcesQuery.collect();

    // Filter by category if provided
    let filtered = resources;
    if (args.category) {
      filtered = filtered.filter((r) => r.category === args.category);
    }

    // Filter by type if provided
    if (args.type) {
      filtered = filtered.filter((r) => r.type === args.type);
    }

    // Sort by order (if set) or creation time
    filtered.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return (b._creationTime || 0) - (a._creationTime || 0);
    });

    // Apply limit if provided
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

/**
 * Get a single education resource by ID
 */
export const getResourceById = query({
  args: {
    resourceId: v.id("educationResources"),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.isDeleted || !resource.isPublished) {
      return null;
    }

    return resource;
  },
});

/**
 * Increment view count for a resource (separate mutation)
 */
export const incrementViewCount = mutation({
  args: {
    resourceId: v.id("educationResources"),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.isDeleted) {
      return;
    }

    await ctx.db.patch(args.resourceId, {
      viewCount: (resource.viewCount || 0) + 1,
    });
  },
});

/**
 * Get all resources (admin only) - including unpublished
 */
export const getAllResources = query({
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

    const resources = await ctx.db
      .query("educationResources")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    // Sort by order or creation time
    resources.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return (b._creationTime || 0) - (a._creationTime || 0);
    });

    return resources;
  },
});

/**
 * Create a new education resource (admin only)
 */
export const createResource = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    content: v.string(),
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
    url: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    author: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPublished: v.boolean(),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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

    const resourceId = await ctx.db.insert("educationResources", {
      title: args.title,
      description: args.description,
      content: args.content,
      type: args.type,
      category: args.category,
      url: args.url,
      thumbnailUrl: args.thumbnailUrl,
      author: args.author,
      tags: args.tags,
      isPublished: args.isPublished,
      publishedAt: args.isPublished ? Date.now() : undefined,
      createdBy: profile._id,
      viewCount: 0,
      isDeleted: false,
      order: args.order,
    });

    return resourceId;
  },
});

/**
 * Update an education resource (admin only)
 */
export const updateResource = mutation({
  args: {
    resourceId: v.id("educationResources"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("article"),
        v.literal("video"),
        v.literal("tip"),
        v.literal("guide"),
        v.literal("link")
      )
    ),
    category: v.optional(
      v.union(
        v.literal("prevention"),
        v.literal("nutrition"),
        v.literal("exercise"),
        v.literal("medication"),
        v.literal("monitoring"),
        v.literal("complications"),
        v.literal("lifestyle"),
        v.literal("general")
      )
    ),
    url: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    author: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPublished: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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

    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.isDeleted) {
      throw new Error("Resource not found");
    }

    const updates: any = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.content !== undefined) updates.content = args.content;
    if (args.type !== undefined) updates.type = args.type;
    if (args.category !== undefined) updates.category = args.category;
    if (args.url !== undefined) updates.url = args.url;
    if (args.thumbnailUrl !== undefined) updates.thumbnailUrl = args.thumbnailUrl;
    if (args.author !== undefined) updates.author = args.author;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.order !== undefined) updates.order = args.order;
    if (args.isPublished !== undefined) {
      updates.isPublished = args.isPublished;
      if (args.isPublished && !resource.publishedAt) {
        updates.publishedAt = Date.now();
      }
    }

    await ctx.db.patch(args.resourceId, updates);
    return { success: true };
  },
});

/**
 * Delete an education resource (admin only) - soft delete
 */
export const deleteResource = mutation({
  args: {
    resourceId: v.id("educationResources"),
  },
  handler: async (ctx, args) => {
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

    await ctx.db.patch(args.resourceId, {
      isDeleted: true,
    });

    return { success: true };
  },
});

/**
 * Seed sample education resources (admin only)
 */
export const seedSampleResources = mutation({
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

    const sampleResources = [
      {
        title: "Understanding Diabetes: A Comprehensive Guide",
        description: "Learn about diabetes types, symptoms, risk factors, and how to manage the condition effectively.",
        content: `Diabetes is a chronic condition that affects how your body processes blood sugar (glucose). There are three main types:

Type 1 Diabetes: An autoimmune condition where the body doesn't produce insulin. Usually diagnosed in children and young adults.

Type 2 Diabetes: The most common form, where the body doesn't use insulin properly. Often related to lifestyle factors.

Gestational Diabetes: Develops during pregnancy and usually resolves after childbirth.

Key Risk Factors:
- Family history of diabetes
- Being overweight or obese
- Physical inactivity
- High blood pressure
- Age (risk increases with age)
- Ethnic background

Early detection and management are crucial for preventing complications. Regular monitoring, healthy eating, physical activity, and medication (if needed) can help manage diabetes effectively.`,
        type: "guide" as const,
        category: "prevention" as const,
        author: "Diabetes Care Team",
        tags: ["diabetes", "types", "risk factors", "management"],
        isPublished: true,
        order: 1,
      },
      {
        title: "Healthy Eating for Diabetes Prevention",
        description: "Discover the best foods and meal planning strategies to reduce your diabetes risk.",
        content: `A balanced diet is one of the most powerful tools in preventing and managing diabetes. Here's what you need to know:

Focus on Whole Foods:
- Choose whole grains over refined carbohydrates
- Include plenty of vegetables (especially leafy greens)
- Opt for lean proteins (fish, poultry, legumes)
- Limit processed foods and added sugars

The Plate Method:
- Fill half your plate with non-starchy vegetables
- Fill one-quarter with lean protein
- Fill one-quarter with whole grains or starchy vegetables
- Add a serving of fruit and a healthy fat

Foods to Emphasize:
✓ Leafy greens (spinach, kale, broccoli)
✓ Whole grains (brown rice, quinoa, oats)
✓ Lean proteins (chicken, fish, beans)
✓ Healthy fats (avocado, nuts, olive oil)
✓ Berries and other low-sugar fruits

Foods to Limit:
✗ Sugary drinks and desserts
✗ White bread and refined grains
✗ Processed meats
✗ High-sodium foods
✗ Trans fats

Remember: Portion control and consistency are key. Work with a registered dietitian to create a personalized meal plan.`,
        type: "article" as const,
        category: "nutrition" as const,
        author: "Nutrition Specialist",
        tags: ["nutrition", "diet", "meal planning", "prevention"],
        isPublished: true,
        order: 2,
      },
      {
        title: "Exercise and Physical Activity for Diabetes Prevention",
        description: "Learn how regular exercise can significantly reduce your diabetes risk and improve overall health.",
        content: `Regular physical activity is essential for diabetes prevention and management. Here's why and how:

Benefits of Exercise:
- Improves insulin sensitivity
- Helps maintain healthy weight
- Lowers blood sugar levels
- Reduces blood pressure
- Strengthens heart and muscles
- Boosts mood and energy

Recommended Activity:
- Aim for at least 150 minutes of moderate-intensity exercise per week
- Include both aerobic and strength training
- Break up long periods of sitting

Aerobic Activities:
• Brisk walking (30 minutes, 5 days/week)
• Swimming or water aerobics
• Cycling
• Dancing
• Jogging or running

Strength Training:
• Weight lifting (2-3 times/week)
• Resistance bands
• Bodyweight exercises (push-ups, squats)
• Yoga or Pilates

Getting Started:
1. Start slowly and gradually increase intensity
2. Choose activities you enjoy
3. Find an exercise buddy for motivation
4. Set realistic goals
5. Track your progress

Safety Tips:
- Check blood sugar before and after exercise
- Stay hydrated
- Wear proper footwear
- Listen to your body
- Consult your doctor before starting a new exercise program

Remember: Any movement is better than none. Start where you are and build from there!`,
        type: "guide" as const,
        category: "exercise" as const,
        author: "Fitness Expert",
        tags: ["exercise", "physical activity", "fitness", "prevention"],
        isPublished: true,
        order: 3,
      },
      {
        title: "5 Daily Tips to Lower Your Diabetes Risk",
        description: "Simple, actionable tips you can implement today to reduce your risk of developing diabetes.",
        content: `Here are five evidence-based tips you can start implementing today:

1. Stay Hydrated
Drink plenty of water throughout the day. Avoid sugary drinks like soda and fruit juices, which can spike blood sugar levels.

2. Get Quality Sleep
Aim for 7-9 hours of sleep per night. Poor sleep can affect insulin sensitivity and increase diabetes risk.

3. Manage Stress
Chronic stress can raise blood sugar levels. Practice relaxation techniques like deep breathing, meditation, or gentle yoga.

4. Monitor Your Health
Keep track of your blood pressure, cholesterol, and blood sugar levels. Regular check-ups help catch issues early.

5. Build Healthy Habits Gradually
Don't try to change everything at once. Pick one healthy habit, master it, then add another. Small, consistent changes lead to lasting results.

Remember: Prevention is always better than treatment. These small daily actions can make a significant difference in your long-term health.`,
        type: "tip" as const,
        category: "lifestyle" as const,
        author: "Health Coach",
        tags: ["tips", "daily habits", "prevention", "lifestyle"],
        isPublished: true,
        order: 4,
      },
      {
        title: "Understanding Blood Sugar Monitoring",
        description: "Learn how to monitor your blood sugar levels and what the numbers mean for your health.",
        content: `Regular blood sugar monitoring is crucial for diabetes prevention and management. Here's what you need to know:

Normal Blood Sugar Ranges:
- Fasting (before meals): 70-100 mg/dL
- Post-meal (2 hours after): Less than 140 mg/dL
- HbA1c (3-month average): Less than 5.7%

When to Check:
- First thing in the morning (fasting)
- Before meals
- 2 hours after meals
- Before and after exercise
- When you feel symptoms of high or low blood sugar

Understanding Your Numbers:
- High blood sugar (hyperglycemia): Above 180 mg/dL
  Symptoms: Increased thirst, frequent urination, fatigue
  Action: Drink water, take medication as prescribed, contact your doctor if consistently high

- Low blood sugar (hypoglycemia): Below 70 mg/dL
  Symptoms: Shakiness, sweating, confusion, dizziness
  Action: Consume 15g of fast-acting carbs, recheck in 15 minutes

Monitoring Tips:
✓ Keep a log of your readings
✓ Note what you ate and activities before readings
✓ Share results with your healthcare team
✓ Look for patterns and trends
✓ Use a reliable glucose meter

Remember: Your target ranges may vary based on your individual health situation. Always consult with your healthcare provider.`,
        type: "article" as const,
        category: "monitoring" as const,
        author: "Clinical Team",
        tags: ["monitoring", "blood sugar", "glucose", "health tracking"],
        isPublished: true,
        order: 5,
      },
      {
        title: "Diabetes Prevention: Your Action Plan",
        description: "A step-by-step guide to creating your personalized diabetes prevention plan.",
        content: `Creating a diabetes prevention plan doesn't have to be overwhelming. Follow these steps:

Step 1: Assess Your Risk
- Know your family history
- Understand your current health status
- Calculate your BMI
- Get baseline blood tests

Step 2: Set SMART Goals
Make goals that are:
- Specific: "I will walk 30 minutes daily"
- Measurable: Track your progress
- Achievable: Start with realistic targets
- Relevant: Focus on what matters to you
- Time-bound: Set deadlines

Step 3: Build Your Support Team
- Primary care physician
- Registered dietitian
- Certified diabetes educator
- Exercise specialist
- Family and friends

Step 4: Create Your Action Plan
Week 1-2: Start with one healthy change
Week 3-4: Add a second change
Month 2: Focus on consistency
Month 3+: Refine and optimize

Step 5: Track and Adjust
- Keep a health journal
- Monitor your progress
- Celebrate small wins
- Adjust as needed
- Stay committed

Remember: Progress, not perfection. Every healthy choice counts toward reducing your diabetes risk.`,
        type: "guide" as const,
        category: "prevention" as const,
        author: "Prevention Specialist",
        tags: ["prevention", "action plan", "goals", "planning"],
        isPublished: true,
        order: 6,
      },
      {
        title: "World Health Organization - Diabetes Fact Sheet",
        description: "Official WHO information about diabetes, its global impact, and prevention strategies.",
        content: "Visit the World Health Organization's comprehensive diabetes fact sheet for authoritative information about diabetes types, global statistics, prevention strategies, and treatment options.",
        type: "link" as const,
        category: "general" as const,
        url: "https://www.who.int/news-room/fact-sheets/detail/diabetes",
        author: "World Health Organization",
        tags: ["WHO", "official", "global health", "facts"],
        isPublished: true,
        order: 7,
      },
      {
        title: "American Diabetes Association - Prevention Resources",
        description: "Access comprehensive diabetes prevention resources from the leading diabetes organization.",
        content: "The American Diabetes Association provides extensive resources on diabetes prevention, including meal plans, exercise guides, risk assessment tools, and educational materials.",
        type: "link" as const,
        category: "prevention" as const,
        url: "https://www.diabetes.org/diabetes/prevention",
        author: "American Diabetes Association",
        tags: ["ADA", "prevention", "resources", "official"],
        isPublished: true,
        order: 8,
      },
    ];

    const createdIds = [];
    for (const resource of sampleResources) {
      const resourceId = await ctx.db.insert("educationResources", {
        title: resource.title,
        description: resource.description,
        content: resource.content,
        type: resource.type,
        category: resource.category,
        url: resource.url,
        thumbnailUrl: undefined,
        author: resource.author,
        tags: resource.tags,
        isPublished: resource.isPublished,
        publishedAt: resource.isPublished ? Date.now() : undefined,
        createdBy: profile._id,
        viewCount: 0,
        isDeleted: false,
        order: resource.order,
      });
      createdIds.push(resourceId);
    }

    return { success: true, count: createdIds.length };
  },
});

