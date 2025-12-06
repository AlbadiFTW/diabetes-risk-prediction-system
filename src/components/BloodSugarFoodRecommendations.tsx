import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Apple,
  UtensilsCrossed,
  Info
} from "lucide-react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

interface BloodSugarFoodRecommendationsProps {
  patientId: Id<"users">;
  diabetesStatus?: string;
}

interface GlucoseReading {
  date: number;
  glucoseLevel: number;
}

interface FoodRecommendation {
  food: string;
  reason: string;
  timing: string;
}

export function BloodSugarFoodRecommendations({ 
  patientId, 
  diabetesStatus 
}: BloodSugarFoodRecommendationsProps) {
  const glucoseData = useQuery(api.analytics.getGlucoseTrends, { patientId });

  if (!glucoseData || glucoseData.readings.length < 2) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-green-500 rounded-full"></div>
          <h3 className="font-semibold text-gray-900">Blood Sugar Food Recommendations</h3>
        </div>
        <div className="text-center py-6">
          <UtensilsCrossed className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">
            Complete at least 2 assessments to receive personalized food recommendations based on your blood sugar trends.
          </p>
        </div>
      </div>
    );
  }

  const { currentGlucose, trend, status, recommendations, patientData } = glucoseData;

  // Determine scenario and get appropriate recommendations based on patient factors
  const getFoodRecommendations = (): FoodRecommendation[] => {
    const foods: FoodRecommendation[] = [];
    const bmi = patientData?.bmi || 0;
    const age = patientData?.age || 0;
    const hasHighBP = patientData?.systolicBP && patientData.systolicBP >= 130;
    const isOverweight = bmi >= 25;
    const isObese = bmi >= 30;
    const isElderly = age >= 60;
    const isSmoker = patientData?.smokingStatus === "current" || patientData?.smokingStatus === "heavy";
    const lowExercise = patientData?.exerciseFrequency === "none" || patientData?.exerciseFrequency === "light";
    const hba1c = patientData?.hba1c || 0;

    if (status === "high") {
      // High blood sugar - personalized recommendations based on patient factors
      
      // Core recommendations for high glucose
      foods.push(
        {
          food: "Leafy greens (spinach, kale, lettuce)",
          reason: "High in fiber, low in carbs, helps stabilize blood sugar",
          timing: "Include in meals"
        },
        {
          food: "Non-starchy vegetables (broccoli, cauliflower, bell peppers)",
          reason: "Low glycemic index, rich in nutrients",
          timing: "Fill half your plate"
        },
        {
          food: "Lean proteins (chicken, fish, tofu)",
          reason: "Helps slow glucose absorption",
          timing: "With every meal"
        }
      );

      // Type-specific recommendations
      if (diabetesStatus === "type1") {
        foods.push(
          {
            food: "Consistent carb counting meals",
            reason: "Essential for Type 1 diabetes management and insulin dosing",
            timing: "All meals - count carbs carefully"
          },
          {
            food: "Low glycemic index foods (sweet potatoes, quinoa)",
            reason: "Prevents rapid glucose spikes, easier to manage with insulin",
            timing: "Replace high-GI carbs"
          }
        );
      } else if (diabetesStatus === "type2") {
        foods.push(
          {
            food: "Whole grains (quinoa, barley, oats)",
            reason: "High fiber content helps control blood sugar and improves insulin sensitivity",
            timing: "In moderation, replace refined grains"
          },
          {
            food: "Legumes (beans, lentils, chickpeas)",
            reason: "High fiber and protein, slow glucose release, beneficial for Type 2",
            timing: "2-3 times per week"
          }
        );
      } else {
        foods.push(
          {
            food: "Whole grains (quinoa, barley, oats)",
            reason: "High fiber content helps control blood sugar",
            timing: "In moderation, replace refined grains"
          }
        );
      }

      // Weight management recommendations
      if (isObese || isOverweight) {
        foods.push(
          {
            food: "Portion-controlled meals with protein focus",
            reason: "Weight loss improves insulin sensitivity and glucose control",
            timing: "All meals - reduce portions by 20-30%"
          },
          {
            food: "High-volume, low-calorie foods (cucumber, celery, tomatoes)",
            reason: "Helps with satiety while reducing calorie intake",
            timing: "As snacks or meal starters"
          }
        );
      }

      // Blood pressure considerations
      if (hasHighBP) {
        foods.push(
          {
            food: "Potassium-rich foods (bananas, avocados, sweet potatoes)",
            reason: "Helps lower blood pressure while managing glucose",
            timing: "Include in meals (watch portions for glucose)"
          },
          {
            food: "Low-sodium options",
            reason: "Reduces blood pressure, important for diabetes complications",
            timing: "All meals - avoid processed foods"
          }
        );
      }

      // Age-specific recommendations
      if (isElderly) {
        foods.push(
          {
            food: "Soft, easy-to-digest proteins (eggs, fish, yogurt)",
            reason: "Easier to digest, maintains muscle mass, helps glucose control",
            timing: "Breakfast and lunch"
          }
        );
      }

      // Lifestyle factors
      if (lowExercise) {
        foods.push(
          {
            food: "Foods that boost energy naturally (berries, green tea)",
            reason: "Helps with motivation for physical activity, which improves glucose control",
            timing: "Morning or before exercise"
          }
        );
      }

      // General additions
      foods.push(
        {
          food: "Nuts and seeds (almonds, walnuts, chia seeds)",
          reason: "Healthy fats and protein, minimal impact on blood sugar",
          timing: "As snacks between meals"
        },
        {
          food: "Cinnamon",
          reason: "May help improve insulin sensitivity",
          timing: "Add to foods or beverages"
        }
      );
    } else if (status === "low") {
      // Low blood sugar - personalized based on diabetes type and patient factors
      
      // Emergency treatment (same for all)
      foods.push(
        {
          food: "Fast-acting carbs (glucose tablets, fruit juice, honey)",
          reason: "Quickly raises blood sugar in emergencies",
          timing: "Immediate consumption if symptomatic"
        }
      );

      // Type 1 specific - more aggressive management needed
      if (diabetesStatus === "type1") {
        foods.push(
          {
            food: "15g fast carbs + recheck in 15 min",
            reason: "Type 1 requires precise carb counting and monitoring",
            timing: "Immediate, then recheck glucose"
          },
          {
            food: "Glucagon kit (if available)",
            reason: "Critical for severe hypoglycemia in Type 1",
            timing: "Emergency use only"
          },
          {
            food: "Complex carbs + protein (after initial treatment)",
            reason: "Prevents rebound hypoglycemia, essential for Type 1",
            timing: "15 minutes after fast-acting carbs"
          }
        );
      } else {
        foods.push(
          {
            food: "Complex carbs (whole grain bread, brown rice)",
            reason: "Sustained energy release after initial treatment",
            timing: "15 minutes after fast-acting carbs"
          },
          {
            food: "Protein + carb combo (peanut butter on toast, cheese and crackers)",
            reason: "Prevents blood sugar from dropping again",
            timing: "After treating low blood sugar"
          }
        );
      }

      // Age-specific considerations
      if (isElderly) {
        foods.push(
          {
            food: "Easy-to-consume options (juice boxes, glucose gel)",
            reason: "Easier to access and consume during hypoglycemia episodes",
            timing: "Keep readily available"
          }
        );
      }

      // Prevention strategies
      foods.push(
        {
          food: "Regular meals every 3-4 hours",
          reason: "Prevents hypoglycemia episodes",
          timing: "Throughout the day"
        },
        {
          food: "Small snacks before exercise",
          reason: "Prevents exercise-induced hypoglycemia",
          timing: "30 minutes before physical activity"
        }
      );

      // If patient is on medication that causes lows
      if (diabetesStatus === "type2" && hba1c < 7) {
        foods.push(
          {
            food: "Bedtime snack (if taking evening medication)",
            reason: "Prevents nocturnal hypoglycemia",
            timing: "Before bed"
          }
        );
      }
    } else if (status === "normal_high" || trend === "increasing") {
      // Normal but on the higher side or trending up - preventive personalized recommendations
      
      foods.push(
        {
          food: "High-fiber foods (beans, lentils, whole grains)",
          reason: "Slows glucose absorption, prevents spikes",
          timing: "Include in main meals"
        }
      );

      // Type-specific preventive strategies
      if (diabetesStatus === "type2" || diabetesStatus === "prediabetic") {
        foods.push(
          {
            food: "Vinegar (apple cider vinegar)",
            reason: "May help improve insulin sensitivity, especially beneficial for Type 2",
            timing: "Before meals (diluted, 1-2 tbsp)"
          },
          {
            food: "Legumes and beans",
            reason: "High fiber and resistant starch, improves insulin sensitivity",
            timing: "3-4 times per week"
          }
        );
      }

      // Weight management if needed
      if (isOverweight) {
        foods.push(
          {
            food: "Portion control with high-fiber foods",
            reason: "Weight loss of 5-10% can significantly improve glucose control",
            timing: "All meals - use smaller plates"
          }
        );
      }

      // Exercise-related
      if (lowExercise) {
        foods.push(
          {
            food: "Pre-workout snacks (apple with peanut butter)",
            reason: "Provides energy for exercise, which improves insulin sensitivity",
            timing: "30-60 minutes before exercise"
          }
        );
      }

      // General additions
      foods.push(
        {
          food: "Berries (blueberries, strawberries)",
          reason: "Low glycemic index, rich in antioxidants, anti-inflammatory",
          timing: "As snacks or dessert"
        },
        {
          food: "Fatty fish (salmon, mackerel)",
          reason: "Omega-3 fatty acids may improve insulin sensitivity and reduce inflammation",
          timing: "2-3 times per week"
        },
        {
          food: "Greek yogurt (unsweetened)",
          reason: "High protein, probiotics support gut health, low in carbs",
          timing: "Breakfast or snacks"
        }
      );

      // Smoking cessation support
      if (isSmoker) {
        foods.push(
          {
            food: "Crunchy vegetables (carrots, celery) as smoking replacement",
            reason: "Helps with oral fixation, improves overall health",
            timing: "When craving cigarettes"
          }
        );
      }
    } else {
      // Normal and stable - maintenance recommendations personalized to patient
      
      foods.push(
        {
          food: "Balanced meals (protein + complex carbs + vegetables)",
          reason: "Maintains stable blood sugar levels",
          timing: "All meals"
        }
      );

      // Type-specific maintenance
      if (diabetesStatus === "type1") {
        foods.push(
          {
            food: "Consistent carb counting",
            reason: "Essential for accurate insulin dosing and stable glucose",
            timing: "All meals - count every carb"
          },
          {
            food: "Regular meal timing",
            reason: "Works with insulin timing for optimal control",
            timing: "Same times daily"
          }
        );
      } else {
        foods.push(
          {
            food: "Regular meal timing",
            reason: "Prevents blood sugar fluctuations",
            timing: "Same times daily"
          }
        );
      }

      // Weight maintenance/improvement
      if (isOverweight) {
        foods.push(
          {
            food: "Portion control with measuring tools",
            reason: "Maintains current weight or supports gradual weight loss",
            timing: "All meals"
          }
        );
      } else {
        foods.push(
          {
            food: "Portion control",
            reason: "Prevents overeating and blood sugar spikes",
            timing: "All meals"
          }
        );
      }

      // Blood pressure maintenance
      if (hasHighBP) {
        foods.push(
          {
            food: "DASH diet principles (fruits, vegetables, low-fat dairy)",
            reason: "Maintains healthy blood pressure while keeping glucose stable",
            timing: "All meals"
          }
        );
      }

      // General maintenance
      foods.push(
        {
          food: "Stay hydrated with water",
          reason: "Helps kidneys flush excess glucose, maintains overall health",
          timing: "Throughout the day"
        }
      );

      // Exercise support
      if (lowExercise) {
        foods.push(
          {
            food: "Energy-sustaining snacks (nuts, seeds)",
            reason: "Supports physical activity which maintains glucose control",
            timing: "Before or after exercise"
          }
        );
      }
    }

    return foods;
  };

  const foodRecommendations = getFoodRecommendations();

  // Get status color and icon
  const getStatusDisplay = () => {
    if (status === "high") {
      return {
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        icon: AlertTriangle,
        label: "High Blood Sugar",
        description: "Your blood sugar is elevated. Focus on foods that help lower glucose levels."
      };
    } else if (status === "low") {
      return {
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
        icon: AlertTriangle,
        label: "Low Blood Sugar",
        description: "Your blood sugar is low. Consume fast-acting carbohydrates immediately if symptomatic."
      };
    } else if (trend === "increasing") {
      return {
        color: "text-amber-600",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-200",
        icon: TrendingUp,
        label: "Rising Trend",
        description: "Your blood sugar is trending upward. Consider preventive dietary changes."
      };
    } else {
      return {
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        icon: CheckCircle,
        label: "Stable",
        description: "Your blood sugar is within normal range. Maintain your current healthy eating habits."
      };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-6 bg-green-500 rounded-full"></div>
        <h3 className="font-semibold text-gray-900">Blood Sugar Food Recommendations</h3>
      </div>

      {/* Current Status */}
      <div className={`${statusDisplay.bgColor} ${statusDisplay.borderColor} border rounded-xl p-4 mb-6`}>
        <div className="flex items-start gap-3">
          <StatusIcon className={`w-6 h-6 ${statusDisplay.color} flex-shrink-0 mt-0.5`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-semibold ${statusDisplay.color}`}>
                {statusDisplay.label}
              </h4>
              <span className="text-sm text-gray-600">
                ({currentGlucose.toFixed(0)} {diabetesStatus === "type1" || diabetesStatus === "type2" ? "mg/dL" : "mg/dL"})
              </span>
            </div>
            <p className="text-sm text-gray-700">{statusDisplay.description}</p>
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {trend === "increasing" ? (
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                ) : trend === "decreasing" ? (
                  <TrendingDown className="w-4 h-4 text-green-600" />
                ) : null}
                <span className="text-xs text-gray-600">
                  Trend: {trend === "increasing" ? "Increasing" : trend === "decreasing" ? "Decreasing" : "Stable"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Food Recommendations */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Apple className="w-5 h-5 text-green-600" />
          Recommended Foods
        </h4>
        <div className="space-y-3">
          {foodRecommendations.map((food, index) => (
            <RadixTooltip.Provider key={index}>
              <RadixTooltip.Root>
                <RadixTooltip.Trigger asChild>
                  <div className="border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:bg-green-50/50 transition-colors cursor-help">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <UtensilsCrossed className="w-4 h-4 text-green-600" />
                          <h5 className="font-medium text-gray-900">{food.food}</h5>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{food.reason}</p>
                        <span className="inline-block text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {food.timing}
                        </span>
                      </div>
                      <Info className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                </RadixTooltip.Trigger>
                <RadixTooltip.Portal>
                  <RadixTooltip.Content
                    className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm max-w-xs z-50"
                    sideOffset={5}
                  >
                    <p className="font-medium mb-1">{food.food}</p>
                    <p className="text-gray-300 text-xs">{food.reason}</p>
                    <p className="text-gray-400 text-xs mt-1">Best time: {food.timing}</p>
                    <RadixTooltip.Arrow className="fill-gray-900" />
                  </RadixTooltip.Content>
                </RadixTooltip.Portal>
              </RadixTooltip.Root>
            </RadixTooltip.Provider>
          ))}
        </div>
      </div>

      {/* Important Note */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm text-blue-900">
          <strong>Important:</strong> These recommendations are general guidelines. Always consult with your healthcare provider or registered dietitian for personalized meal planning, especially if you're experiencing frequent high or low blood sugar episodes.
        </p>
      </div>
    </div>
  );
}

