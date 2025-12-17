import { useEffect, useMemo, useState, useRef } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Loader2, AlertCircle, CheckCircle, TrendingUp, Shield, Heart, Info, ClipboardList, Sparkles, Lightbulb, Calendar, Mail } from "lucide-react";
import { mlApiClient, MLPredictionRequest, MLPredictionResponse } from "../utils/mlApiClient";
import { useEmailVerification } from "../hooks/useEmailVerification";
import EmailVerificationModal from "./EmailVerificationModal";
import { toast } from "sonner";
import { NFCReader, convertNFCDataToForm } from "./NFCReader";

interface EnhancedMedicalRecordFormProps {
  patientId: string;
  onSuccess?: () => void;
}

const calculateAgeFromDob = (dob?: string | null) => {
  if (!dob) {
    return "";
  }
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const diff = Date.now() - parsed.getTime();
  const ageDate = new Date(diff);
  return Math.max(ageDate.getUTCFullYear() - 1970, 0).toString();
};

const normalizeRiskCategory = (category: string): "low" | "moderate" | "high" | "very_high" => {
  const normalized = category.toLowerCase().replace(" ", "_");
  if (normalized === "low" || normalized === "moderate" || normalized === "high" || normalized === "very_high") {
    return normalized;
  }
  return "moderate";
};


export function EnhancedMedicalRecordForm({ patientId, onSuccess }: EnhancedMedicalRecordFormProps) {
  const { isVerified, isLoading: isVerificationLoading, email } = useEmailVerification();
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  
  const [formData, setFormData] = useState({
    recordType: "baseline" as "baseline" | "followup" | "emergency",
    age: "",
    height: "",
    weight: "",
    systolicBP: "",
    diastolicBP: "",
    heartRate: "",
    glucoseLevel: "",
    hba1c: "",
    insulinLevel: "",
    skinThickness: "",
    familyHistoryDiabetes: false,
    pregnancies: "",
    gestationalDiabetes: false,
    smokingStatus: "never" as "never" | "former" | "recent_quit" | "occasional" | "light" | "moderate" | "heavy" | "current",
    alcoholConsumption: "none" as "none" | "rare" | "occasional" | "moderate" | "regular" | "heavy",
    exerciseFrequency: "none" as "none" | "light" | "moderate" | "active" | "very_active" | "athlete",
    notes: "",
  });

  // For guests, allow gender selection in the form
  const [selectedGender, setSelectedGender] = useState<"male" | "female" | "">("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mlPrediction, setMlPrediction] = useState<MLPredictionResponse | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const patientProfile = useQuery(api.users.getUserProfile, {
    userId: patientId as Id<"users">,
  });

  // Check if user is a guest (no email or isGuest flag)
  const isGuest = !email || patientProfile?.isGuest === true;
  
  // For guests, use selectedGender; for registered users, use profile gender
  const derivedGender = isGuest 
    ? (selectedGender || "male") 
    : (patientProfile?.gender || "male");
  const derivedAge = useMemo(() => calculateAgeFromDob(patientProfile?.dateOfBirth), [patientProfile?.dateOfBirth]);
  const shouldShowPregnancies = derivedGender === "female";
  
  // Initialize gender for guests from profile if available
  useEffect(() => {
    if (isGuest && patientProfile?.gender && !selectedGender) {
      setSelectedGender(patientProfile.gender as "male" | "female");
    }
  }, [isGuest, patientProfile?.gender, selectedGender]);

  useEffect(() => {
    if (derivedAge && formData.age !== derivedAge) {
      setFormData((prev) => ({ ...prev, age: derivedAge }));
    }
  }, [derivedAge, formData.age]);
  const topFeatureInsights = useMemo(() => {
    if (!mlPrediction?.featureImportance) {
      return [];
    }
    
    // Get user gender to filter out pregnancy factors for males
    const userGender = patientProfile?.gender?.toLowerCase() || 'male';
    const isMale = userGender === 'male';
    
    // Helper function to format feature names properly
    const formatFeatureName = (feature: string): string => {
      // Replace underscores with spaces
      let formatted = feature.replace(/_/g, ' ');
      // Add space before capital letters (camelCase)
      formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');
      // Capitalize first letter of each word
      formatted = formatted.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      // Handle special cases
      formatted = formatted.replace(/Bmi/gi, 'BMI');
      formatted = formatted.replace(/Bp/gi, 'BP');
      formatted = formatted.replace(/HbA1c/gi, 'HbA1c');
      formatted = formatted.replace(/Glucose/gi, 'Glucose');
      formatted = formatted.replace(/Insulin/gi, 'Insulin');
      return formatted.trim();
    };
    
    // Show ALL features, not just top 5
    return Object.entries(mlPrediction.featureImportance)
      .sort(([, a], [, b]) => b - a)
      .filter(([feature]) => {
        // Filter out pregnancy-related factors for males
        if (isMale) {
          const normalizedKey = feature.toLowerCase().replace(/[^a-z]/g, '');
          if (normalizedKey.includes('pregnancy') || normalizedKey.includes('pregnancies')) {
            return false;
          }
        }
        return true;
      })
      .map(([feature, importance]) => {
        const normalizedKey = feature.replace(/[^a-zA-Z]/g, "").toLowerCase();
        const insight = mlPrediction.metricInsights?.[normalizedKey];
        return {
          key: feature,
          label: insight?.label || formatFeatureName(feature),
          importance: importance * 100,
          insight,
        };
      });
  }, [mlPrediction, patientProfile]);

  const insightStatusStyles: Record<string, { color: string; icon: string }> = {
    good: { color: "text-green-600", icon: "✓" },
    warning: { color: "text-amber-600", icon: "⚠" },
    critical: { color: "text-red-600", icon: "✗" },
  };

  // Get diabetes status for context-aware tooltips
  const diabetesStatus = patientProfile?.diabetesStatus || "none";
  const hasDiagnosedDiabetes = diabetesStatus === "type1" || diabetesStatus === "type2" || 
                                diabetesStatus === "gestational" || diabetesStatus === "other";
  const isPrediabetic = diabetesStatus === "prediabetic";

  const tooltipCopy = useMemo(() => ({
    bmi: {
      title: "Body Mass Index (BMI)",
      description: "A measure of body fat based on your height and weight. It helps assess your weight-related health risks.",
      normalRange: "Healthy: 18.5-24.9 | Overweight: 25-29.9 | Obese: 30+",
      diabetesRisk: hasDiagnosedDiabetes
        ? "Weight management is crucial for diabetes control. Excess body fat increases insulin resistance and makes glucose control more difficult, increasing complication risk."
        : "Higher BMI increases diabetes risk. Excess body fat can lead to insulin resistance, making it harder for your body to use insulin effectively.",
    },
    glucose: {
      title: "Fasting Blood Glucose",
      description: hasDiagnosedDiabetes
        ? "Your blood sugar level after fasting (not eating) for at least 8 hours. This is a key indicator of diabetes control and complication risk."
        : "Your blood sugar level after fasting (not eating) for at least 8 hours. This is a key indicator of diabetes risk.",
      normalRange: hasDiagnosedDiabetes
        ? "Target: 80-130 mg/dL (before meals) | Good control: <140 mg/dL | Needs attention: 140+ mg/dL"
        : "Normal: 70-100 mg/dL | Prediabetes: 100-125 mg/dL | Diabetes: 126+ mg/dL",
      diabetesRisk: hasDiagnosedDiabetes
        ? "Maintaining glucose within target range is crucial for preventing complications. Elevated glucose increases risk of cardiovascular disease, kidney damage, and nerve problems."
        : "Elevated glucose levels indicate your body may not be processing sugar correctly. High fasting glucose is a primary diabetes risk factor.",
    },
    systolicBP: {
      title: "Systolic Blood Pressure",
      description: "The top number in your blood pressure reading. It measures the pressure in your arteries when your heart beats and pumps blood.",
      normalRange: hasDiagnosedDiabetes
        ? "Target: <130 mmHg | Elevated: 130-139 mmHg | High: 140+ mmHg"
        : "Normal: <120 mmHg | Elevated: 120-129 mmHg | High: 130+ mmHg",
      diabetesRisk: hasDiagnosedDiabetes
        ? "High blood pressure is a major risk factor for diabetes complications, especially cardiovascular disease and kidney damage. Controlling BP is essential."
        : "High blood pressure often occurs with diabetes. Both conditions share risk factors and can worsen each other, increasing cardiovascular complications.",
    },
    diastolicBP: {
      title: "Diastolic Blood Pressure",
      description: "The bottom number in your blood pressure reading. It measures the pressure in your arteries when your heart rests between beats.",
      normalRange: hasDiagnosedDiabetes
        ? "Target: <80 mmHg | Elevated: 80-89 mmHg | High: 90+ mmHg"
        : "Normal: <80 mmHg | Elevated: 80-89 mmHg | High: 90+ mmHg",
      diabetesRisk: hasDiagnosedDiabetes
        ? "Elevated diastolic pressure increases complication risk. Combined with high systolic, it significantly raises risk of heart disease, stroke, and kidney damage."
        : "Elevated diastolic pressure, combined with high systolic, indicates hypertension which significantly increases diabetes-related complications.",
    },
    insulin: {
      title: "Insulin Level",
      description: "The amount of insulin hormone in your blood. Insulin helps your body use glucose (sugar) for energy.",
      normalRange: "Fasting: 2-25 µU/mL (varies by lab)",
      diabetesRisk: hasDiagnosedDiabetes
        ? "High insulin levels indicate insulin resistance, making glucose control more difficult. Managing insulin resistance through medication and lifestyle is crucial for preventing complications."
        : "High insulin levels may indicate insulin resistance - your body needs more insulin to process glucose. This is a key early warning sign of type 2 diabetes.",
    },
    skinThickness: {
      title: "Skin Thickness (Triceps Skinfold)",
      description: "A measurement of subcutaneous fat at the triceps. It's an indicator of overall body fat percentage.",
      normalRange: "Varies by age, gender, and ethnicity",
      diabetesRisk: hasDiagnosedDiabetes
        ? "Higher body fat increases insulin resistance and makes diabetes management more challenging, increasing complication risk."
        : "Higher skin thickness measurements indicate more body fat, which is associated with increased diabetes risk and insulin resistance.",
    },
    hba1c: {
      title: "HbA1c (Hemoglobin A1c)",
      description: "A blood test that shows your average blood sugar levels over the past 2-3 months. It measures how much glucose is attached to your red blood cells.",
      normalRange: hasDiagnosedDiabetes
        ? "Target: <7.0% (most patients) | Well controlled: <6.5% | Needs improvement: 7.0-8.0% | Needs attention: 8.0%+"
        : "Normal: <5.7% | Prediabetes: 5.7-6.4% | Diabetes: 6.5%+",
      diabetesRisk: hasDiagnosedDiabetes
        ? "HbA1c is the gold standard for diabetes control. Higher levels indicate poor control and significantly increase risk of complications including heart disease, kidney damage, and nerve problems."
        : "HbA1c is one of the most reliable diabetes indicators. Higher levels mean your blood sugar has been elevated over time, increasing diabetes risk.",
    },
    pregnancies: {
      title: "Number of Pregnancies",
      description: "The total number of times you have been pregnant, regardless of outcome (live birth, miscarriage, etc.).",
      normalRange: "Varies by individual",
      diabetesRisk: hasDiagnosedDiabetes
        ? "For women with diabetes, pregnancy requires careful glucose management to prevent complications for both mother and baby. Preconception planning is essential."
        : "Multiple pregnancies can increase diabetes risk in women. Gestational diabetes during pregnancy also significantly increases future type 2 diabetes risk.",
    },
    heartRate: {
      title: "Resting Heart Rate",
      description: "The number of times your heart beats per minute when you're at rest. Measured in beats per minute (BPM).",
      normalRange: "Normal: 60-100 BPM | Athletes: 40-60 BPM",
      diabetesRisk: hasDiagnosedDiabetes
        ? "Elevated resting heart rate may indicate poor cardiovascular health, which increases complication risk in diabetes. Regular exercise can help lower resting heart rate."
        : "Elevated resting heart rate may indicate poor cardiovascular health, which is often linked with diabetes and metabolic syndrome.",
    },
    familyHistory: {
      title: "Family History of Diabetes",
      description: "Whether any of your close relatives (parents, siblings, grandparents) have or had diabetes.",
      normalRange: "Yes or No",
      diabetesRisk: hasDiagnosedDiabetes
        ? "Family history is a non-modifiable factor. Focus on managing your current diabetes through lifestyle and medication to prevent complications."
        : "Having a family history of diabetes significantly increases your risk. Genetics play a role, but lifestyle factors can help reduce this inherited risk.",
    },
    smoking: {
      title: "Smoking Status",
      description: "Your current or past tobacco smoking habits. Smoking affects your body's ability to process insulin and glucose.",
      normalRange: "Never, Former, Occasional, Light, Moderate, Heavy, Current",
      diabetesRisk: hasDiagnosedDiabetes
        ? "Smoking dramatically increases complication risk in diabetes, including heart disease, stroke, kidney damage, and nerve problems. Quitting is essential for diabetes management."
        : "Smoking increases diabetes risk by 30-40%. It causes inflammation, insulin resistance, and damages blood vessels, worsening diabetes complications.",
    },
    alcohol: {
      title: "Alcohol Consumption",
      description: "How often and how much alcohol you consume. Moderate alcohol may have some benefits, but excessive drinking increases health risks.",
      normalRange: "None, Rare, Occasional, Moderate, Regular, Heavy",
      diabetesRisk: hasDiagnosedDiabetes
        ? "Heavy alcohol consumption can cause dangerous blood sugar fluctuations and increase complication risk. If you drink, do so in moderation and monitor your glucose closely."
        : "Heavy alcohol consumption can lead to pancreatitis and insulin resistance. However, moderate consumption (1-2 drinks/day) may slightly reduce diabetes risk.",
    },
    exercise: {
      title: "Exercise Frequency",
      description: "How often and how intensely you engage in physical activity. Regular exercise is crucial for diabetes prevention and management.",
      normalRange: "None, Light, Moderate, Active, Very Active, Athlete",
      diabetesRisk: hasDiagnosedDiabetes
        ? "Regular physical activity is essential for diabetes management. It improves insulin sensitivity, helps control glucose, reduces complication risk, and supports weight management."
        : "Regular physical activity helps your body use insulin more effectively, improves glucose control, and reduces diabetes risk by up to 50%. Sedentary lifestyle is a major risk factor.",
    },
  }), [hasDiagnosedDiabetes, isPrediabetic]);

  type TooltipKey = "bmi" | "glucose" | "systolicBP" | "diastolicBP" | "insulin" | "skinThickness" | "hba1c" | "pregnancies" | "heartRate" | "familyHistory" | "smoking" | "alcohol" | "exercise";

  const renderLabelWithTooltip = (label: string, key: TooltipKey) => {
    const tooltip = tooltipCopy[key];
    const isSimpleString = typeof tooltip === 'string';
    
    return (
      <div className="flex items-center gap-2">
        <span>{label}</span>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              className="text-gray-400 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full transition-colors"
              aria-label={`Information about ${label}`}
            >
              <Info className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Info about {label}</span>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content
            sideOffset={8}
            className="rounded-lg bg-gray-900 text-white text-xs px-4 py-3 shadow-2xl max-w-sm leading-relaxed z-50 border border-gray-700"
          >
            {isSimpleString ? (
              <p>{tooltip}</p>
            ) : (
              <div className="space-y-2">
                <h4 className="font-semibold text-white text-sm mb-1.5">{tooltip.title}</h4>
                <p className="text-gray-200">{tooltip.description}</p>
                {tooltip.normalRange && (
                  <div className="pt-1.5 border-t border-gray-700">
                    <p className="text-blue-300 font-medium text-xs mb-1">
                      {hasDiagnosedDiabetes ? 'Target Range:' : 'Normal Range:'}
                    </p>
                    <p className="text-gray-300 text-xs">{tooltip.normalRange}</p>
                  </div>
                )}
                {tooltip.diabetesRisk && (
                  <div className="pt-1.5 border-t border-gray-700">
                    <p className="text-amber-300 font-medium text-xs mb-1">
                      {hasDiagnosedDiabetes 
                        ? 'Complication Risk:' 
                        : isPrediabetic 
                        ? 'Progression Risk:' 
                        : 'Diabetes Risk:'}
                    </p>
                    <p className="text-gray-300 text-xs">{tooltip.diabetesRisk}</p>
                  </div>
                )}
              </div>
            )}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Root>
      </div>
    );
  };

  const createRecord = useMutation(api.medicalRecords.createMedicalRecord);
  const generatePrediction = useAction(api.predictions.generateRiskPrediction);

  const calculateBMI = (height: number, weight: number) => {
    return weight / ((height / 100) ** 2);
  };

  // Helper function to scroll to the first error field
  const scrollToFirstError = (errorKeys: string[]) => {
    if (errorKeys.length === 0) return;
    
    // Priority order for scrolling (most important fields first)
    const priorityOrder = [
      'gender', 'systolicBP', 'diastolicBP', 'glucoseLevel', 'age', 
      'height', 'weight', 'insulinLevel', 'skinThickness', 'pregnancies'
    ];
    
    // Find the first error field in priority order
    const firstErrorKey = priorityOrder.find(key => errorKeys.includes(key)) || errorKeys[0];
    
    setTimeout(() => {
      // Try to find the input field by ID
      const errorField = document.getElementById(`field-${firstErrorKey}`);
      if (errorField) {
        errorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus the field for better UX
        errorField.focus();
      } else {
        // Fallback: scroll to the section containing the error
        const sectionMap: Record<string, string> = {
          'gender': 'personal-info',
          'systolicBP': 'vital-signs',
          'diastolicBP': 'vital-signs',
          'glucoseLevel': 'vital-signs',
          'age': 'personal-info',
          'height': 'personal-info',
          'weight': 'personal-info',
          'insulinLevel': 'additional-data',
          'skinThickness': 'additional-data',
          'pregnancies': 'additional-data',
        };
        
        const section = sectionMap[firstErrorKey];
        if (section) {
          const sectionElement = document.querySelector(`[data-section="${section}"]`);
          if (sectionElement) {
            sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }, 100);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // For guests, validate gender is selected
    if (isGuest && !selectedGender) {
      newErrors.gender = "Please select your gender";
    }

    if (!formData.age || parseInt(formData.age) < 1 || parseInt(formData.age) > 120) {
      newErrors.age = "Age must be between 1 and 120";
    }

    if (!formData.height || parseFloat(formData.height) < 50 || parseFloat(formData.height) > 250) {
      newErrors.height = "Height must be between 50 and 250 cm";
    }

    if (!formData.weight || parseFloat(formData.weight) < 20 || parseFloat(formData.weight) > 300) {
      newErrors.weight = "Weight must be between 20 and 300 kg";
    }

    if (!formData.glucoseLevel || parseFloat(formData.glucoseLevel) < 50 || parseFloat(formData.glucoseLevel) > 300) {
      newErrors.glucoseLevel = "Glucose level must be between 50 and 300 mg/dL";
    }

    if (!formData.systolicBP || parseFloat(formData.systolicBP) < 60 || parseFloat(formData.systolicBP) > 250) {
      newErrors.systolicBP = "Systolic BP must be between 60 and 250 mmHg";
    }

    if (!formData.diastolicBP || parseFloat(formData.diastolicBP) < 40 || parseFloat(formData.diastolicBP) > 150) {
      newErrors.diastolicBP = "Diastolic BP must be between 40 and 150 mmHg";
    }

    // Validate blood pressure relationship
    if (formData.systolicBP && formData.diastolicBP) {
      const systolic = parseFloat(formData.systolicBP);
      const diastolic = parseFloat(formData.diastolicBP);
      if (systolic <= diastolic) {
        newErrors.systolicBP = "Systolic BP must be higher than Diastolic BP";
        newErrors.diastolicBP = "Diastolic BP must be lower than Systolic BP";
      }
    }

    if (formData.insulinLevel && (parseFloat(formData.insulinLevel) < 0 || parseFloat(formData.insulinLevel) > 1000)) {
      newErrors.insulinLevel = "Insulin level must be between 0 and 1000 μU/mL";
    }

    if (formData.skinThickness && (parseFloat(formData.skinThickness) < 0 || parseFloat(formData.skinThickness) > 100)) {
      newErrors.skinThickness = "Skin thickness must be between 0 and 100 mm";
    }

    if (formData.pregnancies && (parseInt(formData.pregnancies) < 0 || parseInt(formData.pregnancies) > 20)) {
      newErrors.pregnancies = "Number of pregnancies must be between 0 and 20";
    }

    setErrors(newErrors);
    
    // Scroll to first error if validation fails
    if (Object.keys(newErrors).length > 0) {
      scrollToFirstError(Object.keys(newErrors));
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const callMLAPI = async (data: typeof formData & { bmi: number }): Promise<MLPredictionResponse> => {
    const parseNumber = (value?: string) => (value ? parseFloat(value) : undefined);
    const pregnanciesValue =
      shouldShowPregnancies && data.pregnancies ? parseInt(data.pregnancies, 10) : 0;

    const requestData: MLPredictionRequest = {
      age: parseInt(data.age, 10),
      bmi: data.bmi,
      glucose: parseFloat(data.glucoseLevel),
      bloodPressure: parseFloat(data.diastolicBP),
      insulin: parseNumber(data.insulinLevel) ?? 0,
      skinThickness: parseNumber(data.skinThickness) ?? 0,
      pregnancies: pregnanciesValue,
      familyHistory: data.familyHistoryDiabetes ? 0.8 : 0.2,
      gender: (derivedGender as "male" | "female") ?? "male",
      systolicBP: parseFloat(data.systolicBP),
      diastolicBP: parseFloat(data.diastolicBP),
      heartRate: parseNumber(data.heartRate),
      hba1c: parseNumber(data.hba1c),
      exerciseFrequency: data.exerciseFrequency,
      smokingStatus: data.smokingStatus,
      alcoholConsumption: data.alcoholConsumption,
      familyHistoryFlag: data.familyHistoryDiabetes,
      diabetesStatus: patientProfile?.diabetesStatus || "none",
    };

    return await mlApiClient.predictRisk(requestData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const bmi = calculateBMI(parseFloat(formData.height), parseFloat(formData.weight));
      
      // Create medical record
      const recordId = await createRecord({
        patientId: patientId as any,
        recordType: formData.recordType,
        age: parseInt(formData.age),
        gender: derivedGender,
        height: parseFloat(formData.height),
        weight: parseFloat(formData.weight),
        bmi: bmi,
        systolicBP: parseFloat(formData.systolicBP),
        diastolicBP: parseFloat(formData.diastolicBP),
        heartRate: formData.heartRate ? parseFloat(formData.heartRate) : undefined,
        glucoseLevel: parseFloat(formData.glucoseLevel),
        hba1c: formData.hba1c ? parseFloat(formData.hba1c) : undefined,
        insulinLevel: formData.insulinLevel ? parseFloat(formData.insulinLevel) : undefined,
        skinThickness: formData.skinThickness ? parseFloat(formData.skinThickness) : undefined,
        familyHistoryDiabetes: formData.familyHistoryDiabetes,
        pregnancies: shouldShowPregnancies && formData.pregnancies ? parseInt(formData.pregnancies, 10) : undefined,
        gestationalDiabetes: formData.gestationalDiabetes,
        smokingStatus: formData.smokingStatus,
        alcoholConsumption: formData.alcoholConsumption,
        exerciseFrequency: formData.exerciseFrequency,
        notes: formData.notes,
      });

      // For diagnosed patients, calculate complication risk instead of diabetes risk
      // For pre-diabetic, show progression risk
      // For none, show standard diabetes risk
      let mlResponse: MLPredictionResponse;
      
      if (hasDiagnosedDiabetes) {
        // For diagnosed patients: Calculate complication risk
        // We'll use the ML API but interpret it as complication risk
        mlResponse = await callMLAPI({
          ...formData,
          bmi,
        });
        
        // Adjust the risk score interpretation for complications
        // Higher glucose/HbA1c = higher complication risk
        // Scale the risk score to reflect complication risk (typically higher than diabetes risk)
        const complicationRiskScore = Math.min(100, mlResponse.riskScore * 1.15);
        mlResponse = {
          ...mlResponse,
          riskScore: Math.min(100, complicationRiskScore),
          riskCategory: complicationRiskScore >= 70 ? "very_high" : 
                        complicationRiskScore >= 50 ? "high" : 
                        complicationRiskScore >= 30 ? "moderate" : "low",
        };
      } else {
        // For pre-diabetic and none: Calculate diabetes risk (or progression risk for pre-diabetic)
        mlResponse = await callMLAPI({
          ...formData,
          bmi,
        });
      }

      setMlPrediction(mlResponse);
      setShowResults(true);
      
      // Auto-scroll to results section after a brief delay
      setTimeout(() => {
        const resultsSection = document.getElementById('key-risk-factors');
        if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Fallback: scroll to top of results
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 300);

      await generatePrediction({
        medicalRecordId: recordId,
        override: {
          riskScore: mlResponse.riskScore,
          riskCategory: normalizeRiskCategory(mlResponse.riskCategory),
          confidenceScore: mlResponse.confidenceScore,
          featureImportance: mlResponse.featureImportance,
          recommendations: mlResponse.recommendations ?? [],
          modelVersion: mlResponse.model_info?.version ?? "external-ml",
        },
      });

    } catch (error) {
      console.error('Error:', error);
      
      // Parse error message to identify the field
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      const newErrors: Record<string, string> = {};
      
      // Map backend validation errors to form fields
      if (errorMessage.includes('blood pressure') || errorMessage.includes('Systolic') || errorMessage.includes('Diastolic')) {
        if (errorMessage.includes('Systolic must be higher')) {
          newErrors.systolicBP = "Systolic BP must be higher than Diastolic BP. Please check your values.";
          newErrors.diastolicBP = "Diastolic BP must be lower than Systolic BP. Please check your values.";
        }
      } else if (errorMessage.includes('BMI calculation')) {
        newErrors.height = "BMI calculation error. Please verify your height and weight values.";
        newErrors.weight = "BMI calculation error. Please verify your height and weight values.";
        // Scroll to height/weight section
        scrollToFirstError(['height', 'weight']);
      } else {
        // Generic error - show in toast and form
        newErrors.submit = errorMessage;
      }
      
      setErrors(newErrors);
      
      // Scroll to first error field
      if (Object.keys(newErrors).length > 0 && !newErrors.submit) {
        scrollToFirstError(Object.keys(newErrors));
      }
      
      // Show user-friendly toast notification
      if (errorMessage.includes('blood pressure') || errorMessage.includes('Systolic')) {
        toast.error("Blood Pressure Error", {
          description: "Systolic BP must be higher than Diastolic BP. Please check your values and try again.",
          duration: 5000,
        });
      } else if (errorMessage.includes('BMI')) {
        toast.error("BMI Calculation Error", {
          description: "There's a mismatch in your height and weight values. Please verify and try again.",
          duration: 5000,
        });
      } else {
        toast.error("Validation Error", {
          description: errorMessage,
          duration: 5000,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRiskColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "low": return "text-green-600 bg-green-50 border-green-200";
      case "moderate": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "high": return "text-orange-600 bg-orange-50 border-orange-200";
      case "very high": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getRiskIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "low": return <Shield className="w-5 h-5" />;
      case "moderate": return <TrendingUp className="w-5 h-5" />;
      case "high": return <AlertCircle className="w-5 h-5" />;
      case "very high": return <Heart className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  if (patientProfile === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Guest users (no profile or no email) can use the assessment feature without email verification
  // since their data isn't saved permanently
  // Anonymous users who "continue as guest" don't have emails or profiles
  // Only require email verification if:
  // 1. User has a profile (not a guest)
  // 2. User has an email (not anonymous)
  // 3. Verification status is loaded
  // 4. Email is not verified
  const hasProfile = patientProfile !== null && patientProfile !== undefined;
  const hasEmail = email !== null && email !== undefined && email !== "";
  const shouldRequireVerification = hasProfile && hasEmail && !isVerificationLoading;
  
  // Show email verification overlay only if verification is required and not verified
  if (shouldRequireVerification && !isVerified) {
    return (
      <div className="relative">
        {/* Blurred form background */}
        <div className="filter blur-sm pointer-events-none opacity-50">
          <div className="max-w-4xl mx-auto p-4 sm:p-6">
            <div className="bg-white rounded-3xl shadow-premium p-4 sm:p-8">
              <div className="h-64"></div>
            </div>
          </div>
        </div>
        
        {/* Verification required overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Email Verification Required
            </h3>
            <p className="text-gray-600 mb-6">
              Please verify your email address to access health assessments and get personalized diabetes risk predictions.
            </p>
            <button
              onClick={() => setShowVerificationModal(true)}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition"
            >
              Verify Email Now
            </button>
          </div>
        </div>
        
        {showVerificationModal && email && (
          <EmailVerificationModal
            email={email}
            onClose={() => setShowVerificationModal(false)}
            onVerified={() => setShowVerificationModal(false)}
          />
        )}
      </div>
    );
  }

  if (showResults && mlPrediction) {
    return (
      <Tooltip.Provider delayDuration={150}>
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-6">
            <button
              onClick={() => setShowResults(false)}
              className="text-primary-600 hover:text-primary-800 flex items-center gap-2 font-medium transition-colors"
            >
              ← Back to Form
            </button>
          </div>

          {/* Dramatic Results Reveal */}
          <div className="mt-8 animate-fade-in-up">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-4 sm:p-8 text-white overflow-hidden relative">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-500/20 to-transparent rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-green-500/20 to-transparent rounded-full blur-3xl" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4 sm:mb-6">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400" />
                  <span className="text-xs sm:text-sm font-medium text-gray-400">AI Analysis Complete</span>
            </div>

                {/* Main result */}
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 mb-6 sm:mb-8">
                  {/* Animated ring gauge */}
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40">
                    <svg className="w-32 h-32 sm:w-40 sm:h-40 -rotate-90" viewBox="0 0 120 120">
                      <circle
                        cx="60" cy="60" r="50"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="12"
                      />
                      <circle
                        cx="60" cy="60" r="50"
                        fill="none"
                        stroke={mlPrediction.riskScore < 20 ? '#22C55E' : 
                               mlPrediction.riskScore < 50 ? '#F59E0B' : 
                               mlPrediction.riskScore < 75 ? '#F97316' : '#EF4444'}
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${mlPrediction.riskScore * 3.14} 314`}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl sm:text-4xl font-bold">{mlPrediction.riskScore.toFixed(1)}</span>
                      <span className="text-xs sm:text-sm text-gray-400">Risk %</span>
                    </div>
                  </div>
                  
                  <div className="text-center sm:text-left">
                    <h3 className="text-2xl sm:text-3xl font-bold mb-2 capitalize">
                      {hasDiagnosedDiabetes 
                        ? `${mlPrediction.riskCategory} Complication Risk`
                        : isPrediabetic
                        ? `${mlPrediction.riskCategory} Progression Risk`
                        : `${mlPrediction.riskCategory} Diabetes Risk`}
                    </h3>
                    <p className="text-gray-400 mb-4">
                      {hasDiagnosedDiabetes
                        ? "Risk of diabetes-related complications (cardiovascular, kidney, eye, nerve damage)"
                        : isPrediabetic
                        ? "Risk of progressing from pre-diabetes to type 2 diabetes"
                        : "Risk of developing diabetes"}
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="px-4 py-2 bg-white/10 rounded-xl">
                        <span className="text-sm text-gray-400">Confidence</span>
                        <p className="text-xl font-bold">
                      {typeof mlPrediction.confidenceScore === 'number' ? 
                        mlPrediction.confidenceScore.toFixed(1) : 
                        mlPrediction.confidenceScore}%
                        </p>
                  </div>
                      {!hasDiagnosedDiabetes && (
                        <div className="px-4 py-2 bg-white/10 rounded-xl">
                          <span className="text-sm text-gray-400">
                            {isPrediabetic ? "Progression" : "Diabetes"}
                          </span>
                          <p className="text-xl font-bold">{mlPrediction.prediction === 1 ? 'Possible' : 'Unlikely'}</p>
                        </div>
                      )}
                      {hasDiagnosedDiabetes && (
                        <div className="px-4 py-2 bg-white/10 rounded-xl">
                          <span className="text-sm text-gray-400">Status</span>
                          <p className="text-xl font-bold capitalize">
                            {diabetesStatus === "type1" ? "Type 1" : 
                             diabetesStatus === "type2" ? "Type 2" : 
                             diabetesStatus === "gestational" ? "Gestational" : "Diabetes"}
                          </p>
                        </div>
                      )}
                </div>
              </div>
            </div>

            {/* Recommendations */}
                <div className="border-t border-white/10 pt-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-400" />
                    Personalized Recommendations
                  </h4>
                  {mlPrediction.recommendations && mlPrediction.recommendations.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-3">
                      {mlPrediction.recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                          <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-300">{recommendation}</p>
                      </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Recommendations will appear once the model analyzes your inputs.
                    </p>
                  )}
                      </div>

                {/* Key Risk Factors */}
                {topFeatureInsights.length > 0 && (
                  <div id="key-risk-factors" className="border-t border-white/10 pt-6 mt-6">
                    <h4 className="font-semibold mb-4">
                      {hasDiagnosedDiabetes 
                        ? "Key Complication Risk Factors" 
                        : isPrediabetic
                        ? "Key Progression Risk Factors"
                        : "Key Diabetes Risk Factors"}
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {topFeatureInsights.map((factor) => {
                        const statusMeta = factor.insight ? insightStatusStyles[factor.insight.status] ?? insightStatusStyles.good : null;
                        const status = factor.insight?.status || 'good';
                        
                        // Determine border and background colors based on status
                        let borderColor = 'border-gray-500/30';
                        let bgColor = 'bg-white/5';
                        let statusIndicator = '';
                        
                        if (status === 'good') {
                          borderColor = 'border-green-500/50';
                          bgColor = 'bg-green-500/10';
                          statusIndicator = '✓';
                        } else if (status === 'warning') {
                          borderColor = 'border-yellow-500/50';
                          bgColor = 'bg-yellow-500/10';
                          statusIndicator = '⚠';
                        } else if (status === 'critical') {
                          borderColor = 'border-red-500/50';
                          bgColor = 'bg-red-500/10';
                          statusIndicator = '✗';
                        }
                        
                        return (
                          <div key={factor.key} className={`flex items-center justify-between p-3 ${bgColor} ${borderColor} border rounded-xl gap-4`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${statusMeta?.color ?? "text-white"}`}>
                                  {statusIndicator}
                                </span>
                                <p className="text-sm font-medium text-white truncate">{factor.label}</p>
                              </div>
                              {factor.insight && (
                                <p className={`text-xs mt-1 ${statusMeta?.color ?? "text-gray-400"}`}>
                                  {factor.insight.valueLabel} • {factor.insight.message}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-white">{factor.importance.toFixed(1)}%</p>
                              <p className="text-xs text-gray-400">Importance</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-4">
              <button
                onClick={() => setShowResults(false)}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Back to Form
              </button>
              <button
                onClick={() => {
                  setShowResults(false);
                  onSuccess?.();
                }}
                className="px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-300 transform hover:scale-[1.02] shadow-lg shadow-primary-500/25"
              >
                Complete Assessment
              </button>
            </div>
          </div>
        </div>
      </Tooltip.Provider>
    );
  }

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-3xl shadow-premium p-8 animate-fade-in-up">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary-100 rounded-2xl">
            <ClipboardList className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">New Health Assessment</h2>
            <p className="text-sm sm:text-base text-gray-500">Enter your latest health metrics below</p>
          </div>
        </div>

        {errors.submit && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-800 font-medium">{errors.submit}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Info Section */}
          <div className="relative" data-section="personal-info">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-1 bg-primary-500 rounded-full" />
              <h3 className="text-lg font-semibold text-gray-800">Personal Information</h3>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Record Type *
              </label>
              <select
                value={formData.recordType}
                onChange={(e) => setFormData({ ...formData, recordType: e.target.value as any })}
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200"
              >
                <option value="baseline">Baseline</option>
                <option value="followup">Follow-up</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

              <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age
                  <span className="ml-1 text-gray-400 font-normal">(auto-calculated)</span>
              </label>
                <div className="relative">
              <input
                    type="text"
                    id="field-age"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className={`
                      w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl
                      text-gray-900 font-medium
                      focus:outline-none focus:border-primary-300 focus:bg-white
                      transition-all duration-200
                      ${errors.age ? 'border-red-300' : ''}
                      ${derivedAge ? 'cursor-not-allowed' : ''}
                    `}
                placeholder="Enter age"
                min="1"
                max="120"
                    readOnly={Boolean(derivedAge)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                {errors.age && <p className="mt-1.5 text-sm text-red-600">{errors.age}</p>}
                {derivedAge && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Auto-calculated from your date of birth. Update your profile to change.
                  </p>
                )}
            </div>

              <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender * <span className="text-red-500">*</span>
              </label>
              {isGuest ? (
                <>
                  <select
                    id="field-gender"
                    value={selectedGender}
                    onChange={(e) => {
                      setSelectedGender(e.target.value as "male" | "female");
                      // Clear error when user selects
                      if (errors.gender) {
                        const { gender, ...rest } = errors;
                        setErrors(rest);
                      }
                    }}
                    className={`w-full px-4 py-3.5 bg-white border-2 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all duration-200 ${
                      errors.gender ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-primary-500'
                    }`}
                    required
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                  {errors.gender && (
                    <p className="mt-1.5 text-sm text-red-600">{errors.gender}</p>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={patientProfile?.gender ? `${patientProfile.gender.charAt(0).toUpperCase()}${patientProfile.gender.slice(1)}` : "Not set"}
                    readOnly
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl text-gray-700 cursor-not-allowed"
                  />
                  {!patientProfile?.gender && (
                    <p className="mt-1.5 text-sm text-amber-600">
                      Update your profile to store gender. We will assume Male until it is provided.
                    </p>
                  )}
                </>
              )}
              {isGuest && !selectedGender && (
                <p className="mt-1.5 text-sm text-amber-600">
                  Please select your gender for accurate health assessments.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Height (cm) *
              </label>
              <input
                type="number"
                id="field-height"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.height ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter height in cm"
                min="50"
                max="250"
              />
              {errors.height && <p className="mt-1 text-sm text-red-600">{errors.height}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight (kg) *
              </label>
              <input
                type="number"
                id="field-weight"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.weight ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter weight in kg"
                min="20"
                max="300"
              />
              {errors.weight && <p className="mt-1 text-sm text-red-600">{errors.weight}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {renderLabelWithTooltip("BMI", "bmi")}
              </label>
              <input
                type="text"
                value={formData.height && formData.weight ? 
                  calculateBMI(parseFloat(formData.height), parseFloat(formData.weight)).toFixed(1) : ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                readOnly
              />
            </div>
            </div>
          </div>

        {/* Vital Signs Section */}
        <div className="relative" data-section="vital-signs">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-1 bg-red-500 rounded-full" />
              <h3 className="text-lg font-semibold text-gray-800">Vital Signs</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  {renderLabelWithTooltip("Glucose Level (mg/dL) *", "glucose")}
                </label>
                <div className="relative">
                <input
                  type="number"
                  id="field-glucoseLevel"
                  value={formData.glucoseLevel}
                  onChange={(e) => setFormData({ ...formData, glucoseLevel: e.target.value })}
                    className={`
                      w-full px-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl
                      text-gray-900 placeholder:text-gray-400
                      focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10
                      transition-all duration-200
                      ${errors.glucoseLevel ? 'border-red-300' : ''}
                    `}
                    placeholder="e.g., 92"
                  min="50"
                  max="300"
                />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    mg/dL
                  </span>
                </div>
                {errors.glucoseLevel && <p className="mt-1.5 text-sm text-red-600">{errors.glucoseLevel}</p>}
                <p className="mt-1.5 text-xs text-gray-500">Normal range: 70-100 mg/dL</p>
                
                {/* NFC Reader for Glucose Devices */}
                <div className="mt-3">
                  <NFCReader
                    onDataRead={(data) => {
                      const converted = convertNFCDataToForm(data);
                      if (converted.glucoseLevel) {
                        setFormData((prev) => ({
                          ...prev,
                          glucoseLevel: converted.glucoseLevel || prev.glucoseLevel,
                          hba1c: converted.hba1c || prev.hba1c,
                          insulinLevel: converted.insulinLevel || prev.insulinLevel,
                        }));
                        // Clear glucose error if it exists
                        if (errors.glucoseLevel) {
                          const { glucoseLevel, ...rest } = errors;
                          setErrors(rest);
                        }
                      }
                    }}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  {renderLabelWithTooltip("Systolic BP (mmHg) *", "systolicBP")}
                </label>
                <div className="relative">
                <input
                  type="number"
                  id="field-systolicBP"
                  value={formData.systolicBP}
                  onChange={(e) => {
                    setFormData({ ...formData, systolicBP: e.target.value });
                    // Clear error when user starts typing
                    if (errors.systolicBP) {
                      const { systolicBP, ...rest } = errors;
                      setErrors(rest);
                    }
                  }}
                    className={`
                      w-full px-4 py-3.5 bg-white border-2 rounded-xl
                      text-gray-900 placeholder:text-gray-400
                      focus:outline-none focus:ring-4 focus:ring-primary-500/10
                      transition-all duration-200
                      ${errors.systolicBP ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-primary-500'}
                    `}
                  placeholder="Enter systolic BP"
                  min="60"
                  max="250"
                />
                </div>
                {errors.systolicBP && (
                  <div className="mt-1.5 flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700 font-medium">{errors.systolicBP}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {renderLabelWithTooltip("Diastolic BP (mmHg) *", "diastolicBP")}
                </label>
                <input
                  type="number"
                  id="field-diastolicBP"
                  value={formData.diastolicBP}
                  onChange={(e) => {
                    setFormData({ ...formData, diastolicBP: e.target.value });
                    // Clear error when user starts typing
                    if (errors.diastolicBP) {
                      const newErrors = { ...errors };
                      delete newErrors.diastolicBP;
                      setErrors(newErrors);
                    }
                  }}
                  className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.diastolicBP ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-blue-500'
                  }`}
                  placeholder="Enter diastolic BP"
                  min="40"
                  max="150"
                />
                {errors.diastolicBP && (
                  <div className="mt-1.5 flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700 font-medium">{errors.diastolicBP}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  {renderLabelWithTooltip("Heart Rate (bpm)", "heartRate")}
                </label>
                <input
                  type="number"
                  value={formData.heartRate}
                  onChange={(e) => setFormData({ ...formData, heartRate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter heart rate"
                  min="40"
                  max="200"
                />
              </div>
            </div>
          </div>

          {/* Additional Medical Data */}
          <div className="border-t pt-6" data-section="additional-data">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-8 bg-purple-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900">Additional Medical Data</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {renderLabelWithTooltip("Insulin Level (μU/mL)", "insulin")}
                </label>
                <input
                  type="number"
                  id="field-insulinLevel"
                  value={formData.insulinLevel}
                  onChange={(e) => setFormData({ ...formData, insulinLevel: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.insulinLevel ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter insulin level"
                  min="0"
                  max="1000"
                />
                {errors.insulinLevel && <p className="mt-1 text-sm text-red-600">{errors.insulinLevel}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {renderLabelWithTooltip("Skin Thickness (mm)", "skinThickness")}
                </label>
                <input
                  type="number"
                  id="field-skinThickness"
                  value={formData.skinThickness}
                  onChange={(e) => setFormData({ ...formData, skinThickness: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.skinThickness ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter skin thickness"
                  min="0"
                  max="100"
                />
                {errors.skinThickness && <p className="mt-1 text-sm text-red-600">{errors.skinThickness}</p>}
              </div>

              {shouldShowPregnancies && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {renderLabelWithTooltip("Number of Pregnancies", "pregnancies")}
                </label>
                <input
                  type="number"
                  id="field-pregnancies"
                  value={formData.pregnancies}
                  onChange={(e) => setFormData({ ...formData, pregnancies: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.pregnancies ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter number of pregnancies"
                  min="0"
                  max="20"
                />
                {errors.pregnancies && <p className="mt-1 text-sm text-red-600">{errors.pregnancies}</p>}
              </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {renderLabelWithTooltip("HbA1c (%)", "hba1c")}
                </label>
                <input
                  type="number"
                  value={formData.hba1c}
                  onChange={(e) => setFormData({ ...formData, hba1c: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter HbA1c percentage"
                  min="3"
                  max="15"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          {/* Family History and Lifestyle */}
          <div className="border-t pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-8 bg-amber-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900">Family History & Lifestyle</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="familyHistory"
                  checked={formData.familyHistoryDiabetes}
                  onChange={(e) => setFormData({ ...formData, familyHistoryDiabetes: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="familyHistory" className="text-sm text-gray-700 flex items-center gap-2">
                  {renderLabelWithTooltip("Family history of diabetes", "familyHistory")}
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Smoking Status */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    {renderLabelWithTooltip("Smoking Status", "smoking")}
                  </label>
                  <select
                    value={formData.smokingStatus}
                    onChange={(e) => setFormData({ ...formData, smokingStatus: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="never">Never smoked</option>
                    <option value="former">Former smoker (quit 1+ years ago)</option>
                    <option value="recent_quit">Recently quit (less than 1 year)</option>
                    <option value="occasional">Occasional smoker</option>
                    <option value="light">Light smoker (1-10 cigarettes/day)</option>
                    <option value="moderate">Moderate smoker (10-20/day)</option>
                    <option value="heavy">Heavy smoker (20+ per day)</option>
                    <option value="current">Current smoker</option>
                  </select>
                </div>

                {/* Alcohol Consumption */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    {renderLabelWithTooltip("Alcohol Consumption", "alcohol")}
                  </label>
                  <select
                    value={formData.alcoholConsumption}
                    onChange={(e) => setFormData({ ...formData, alcoholConsumption: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="none">None</option>
                    <option value="rare">Rare (few times a year)</option>
                    <option value="occasional">Occasional (1-2 times per month)</option>
                    <option value="moderate">Moderate (1-2 drinks per week)</option>
                    <option value="regular">Regular (3-7 drinks per week)</option>
                    <option value="heavy">Heavy (8+ drinks per week)</option>
                  </select>
                </div>

                {/* Exercise Frequency */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    {renderLabelWithTooltip("Exercise Frequency", "exercise")}
                  </label>
                  <select
                    value={formData.exerciseFrequency}
                    onChange={(e) => setFormData({ ...formData, exerciseFrequency: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="none">None / Sedentary</option>
                    <option value="light">Light (1-2 times per week)</option>
                    <option value="moderate">Moderate (3-4 times per week)</option>
                    <option value="active">Active (5-6 times per week)</option>
                    <option value="very_active">Very Active (daily exercise)</option>
                    <option value="athlete">Athlete level training</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Enter any additional notes or comments"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6">
            <button
              type="button"
              onClick={() => onSuccess?.()}
              className="px-6 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="
                relative px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600
                text-white font-semibold rounded-xl
                hover:from-blue-600 hover:to-blue-700
                focus:outline-none focus:ring-4 focus:ring-blue-500/30
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-300 transform hover:scale-[1.02]
                shadow-lg shadow-blue-500/25
                flex items-center justify-center gap-2
                w-full
              "
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Get AI Assessment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      </div>
    </Tooltip.Provider>
  );
}
