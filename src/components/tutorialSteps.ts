import { TutorialStep } from "./InteractiveTutorial";

// Patient Dashboard Tutorial Steps
export const patientTutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your Health Dashboard! 👋",
    description:
      "Welcome! This is your personal health dashboard. Whether you're monitoring your diabetes risk, managing prediabetes, or tracking complications with Type 1 or Type 2 diabetes, this platform provides AI-powered assessments, medication management, secure doctor communication, and educational resources tailored to your needs. Let's explore together!",
    position: "center",
  },
  {
    id: "risk-score",
    title: "Your Current Risk Score 🎯",
    description:
      "This prominent card displays your latest health risk score (0-100%). The type of risk shown depends on your status: diabetes risk (for those without diabetes), progression risk (for prediabetics), or complication risk (for those with Type 1, Type 2, or other diabetes). The color changes based on your risk level: green (low), yellow (moderate), orange (high), or red (very high). This is your key health indicator - monitor it regularly!",
    targetSelector: '[data-tutorial="risk-score"]',
    position: "right",
  },
  {
    id: "health-metrics",
    title: "Health Metrics Overview 📊",
    description:
      "These cards show your total assessments, confidence level, and health trend. The health trend indicator (↗ ↘ →) shows if your risk is increasing, decreasing, or stable compared to your previous assessment. Track your progress over time!",
    targetSelector: '[data-tutorial="health-trend"]',
    position: "right",
  },
  {
    id: "recent-assessments",
    title: "Recent Assessments History 📋",
    description:
      "View all your past risk assessments here. Each assessment shows your risk score, confidence level, date, and risk category. You can favorite important assessments (⭐), print them (🖨️), or delete incorrect ones (🗑️). Click any assessment to see full details!",
    targetSelector: '[data-tutorial="recent-assessments"]',
    position: "right",
  },
  {
    id: "new-assessment",
    title: "Create New Assessment ✨",
    description:
      "Ready to check your health status? Click the 'New Assessment' tab to start. You'll fill out a comprehensive health form with your current metrics (glucose, blood pressure, BMI, etc.), and our AI will calculate your personalized risk score. The assessment type adapts to your status: diabetes risk for prevention, progression risk for prediabetics, or complication risk for those managing diabetes. Get detailed insights tailored to your health journey!",
    targetSelector: '[data-tutorial="new-assessment"]',
    position: "right",
  },
  {
    id: "history-tab",
    title: "Complete Assessment History 📅",
    description:
      "The History tab shows your complete assessment timeline. Filter by favorites, see all your past assessments in chronological order, and track your health journey over time. Perfect for seeing long-term trends and patterns!",
    targetSelector: '[data-tutorial="history-tab"]',
    position: "right",
  },
  {
    id: "medications-tab",
    title: "Medication Tracker 💊",
    description:
      "Manage all your medications in one place! Add medications with dosages, frequencies, and schedules. Set up reminders to never miss a dose. Track active and past medications. This helps you and your doctor monitor your treatment plan effectively.",
    targetSelector: '[data-tutorial="medications-tab"]',
    position: "right",
  },
  {
    id: "analytics-tab",
    title: "Advanced Analytics 📈",
    description:
      "Dive deep into your health data! The Analytics tab provides detailed visualizations: risk score trends over time (showing diabetes risk, progression risk, or complication risk based on your status), feature importance charts showing which factors most impact your risk, and individual metric charts (glucose, BMI, blood pressure). For prediabetics and those with diabetes, you'll also see personalized food recommendations based on your current blood sugar levels. Use this to understand what drives your risk and how to manage it effectively!",
    targetSelector: '[data-tutorial="analytics-tab"]',
    position: "right",
  },
  {
    id: "education-tab",
    title: "Health Education Resources 📚",
    description:
      "Access comprehensive educational content tailored to your health status! Whether you're preventing diabetes, managing prediabetes, or living with Type 1 or Type 2 diabetes, you'll find relevant articles, videos, and guides about risk factors, lifestyle changes, nutrition tips, medication management, and more. Knowledge is power when it comes to managing your health!",
    targetSelector: '[data-tutorial="education-tab"]',
    position: "right",
  },
  {
    id: "messages-tab",
    title: "Secure Messaging 💬",
    description:
      "Communicate securely with your assigned healthcare provider. Send messages, ask questions, share concerns, and receive medical guidance. All messages are encrypted and private. Check the notification badge (🔴) for unread messages!",
    targetSelector: '[data-tutorial="messages-tab"]',
    position: "right",
  },
  {
    id: "profile-tab",
    title: "Profile & Settings ⚙️",
    description:
      "Manage your account settings, update personal information, view your assigned doctor, enable two-factor authentication for security, and control your preferences. You can also restart this tutorial anytime from your profile!",
    targetSelector: '[data-tutorial="profile-tab"]',
    position: "right",
  },
  {
    id: "complete",
    title: "You're All Set! 🎉",
    description:
      "Congratulations! You now know how to navigate your dashboard. Whether you're preventing diabetes, managing prediabetes, or living with Type 1 or Type 2 diabetes, this platform is designed to support your health journey. Start by creating your first assessment to get your personalized risk score (diabetes risk, progression risk, or complication risk). Remember: you can restart this tutorial anytime from your Profile settings. Stay healthy! 💪",
    position: "center",
  },
];

// Doctor Dashboard Tutorial Steps
export const doctorTutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your Doctor Dashboard! 👨‍⚕️",
    description:
      "Welcome to your healthcare provider dashboard! Here you can monitor all your assigned patients, track their diabetes risk assessments, analyze health trends, communicate securely, and provide comprehensive care. Let's get you started!",
    position: "center",
  },
  {
    id: "overview-stats",
    title: "Dashboard Overview 📊",
    description:
      "These key metric cards give you a quick snapshot of your practice: total patients under your care, recent assessments completed, high-risk patients requiring attention, and average risk score across all patients. Monitor these daily to stay on top of patient care!",
    targetSelector: '[data-tutorial="overview-stats"]',
    position: "right",
  },
  {
    id: "high-risk-patients",
    title: "High-Risk Patient Alerts 🚨",
    description:
      "This critical section highlights patients who need immediate attention. Patients with risk scores ≥50% are automatically flagged here. Click 'View Details' to see their complete assessment history, trends, and medical records. Prioritize these patients for follow-up care.",
    targetSelector: '[data-tutorial="high-risk-patients"]',
    position: "right",
  },
  {
    id: "patients-tab",
    title: "Patient Management 👥",
    description:
      "The Patients tab is your central hub for managing all assigned patients. Search by name, filter by risk level (all/low/moderate/high), and view each patient's latest assessment at a glance. Click 'View Details' to access comprehensive patient information, full history, and analytics.",
    targetSelector: '[data-tutorial="patients-tab"]',
    position: "right",
    action: () => {
      // This will be handled by the parent component
    },
  },
  {
    id: "high-risk-tab",
    title: "High-Risk Patient Focus 🎯",
    description:
      "This dedicated tab shows all patients with elevated risk scores (≥50%). See their risk scores, confidence levels, number of assessments, and health trends. Use this to prioritize care, identify patients needing intervention, and track improvements over time.",
    targetSelector: '[data-tutorial="high-risk-tab"]',
    position: "right",
  },
  {
    id: "analytics-tab",
    title: "Advanced Patient Analytics 📈",
    description:
      "Access comprehensive analytics for individual patients. Select a patient to view detailed visualizations: risk score trends, key risk factors, health metric charts (glucose, BMI, blood pressure), and risk distribution. Perfect for in-depth analysis and treatment planning!",
    targetSelector: '[data-tutorial="analytics-tab"]',
    position: "right",
  },
  {
    id: "messages-tab",
    title: "Secure Patient Communication 💬",
    description:
      "Communicate securely with your patients through encrypted messaging. Answer questions, provide guidance, address concerns, and maintain ongoing care relationships. All messages are HIPAA-compliant and private. Check the notification badge (🔴) for unread messages!",
    targetSelector: '[data-tutorial="messages-tab"]',
    position: "right",
  },
  {
    id: "profile-tab",
    title: "Profile & Account Settings ⚙️",
    description:
      "Manage your professional profile, update your specialization and clinic information, configure account settings, enable two-factor authentication for security, and control your preferences. You can also restart this tutorial anytime from here!",
    targetSelector: '[data-tutorial="profile-tab"]',
    position: "right",
  },
  {
    id: "complete",
    title: "Ready to Help Your Patients! 🎉",
    description:
      "Perfect! You're now familiar with all dashboard features. Start by reviewing your assigned patients in the Patients tab, monitoring high-risk cases, and using analytics to provide data-driven care. Remember: you can restart this tutorial from your Profile anytime. Best of luck! 🌟",
    position: "center",
  },
];
