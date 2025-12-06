import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { generatePatientReportPDFFile } from "../utils/reportUtils";
import { printAssessment } from "../utils/printUtils";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
// EnhancedRiskChart removed - using full implementation instead
import { ProfilePage } from "./ProfilePage";
import { Messaging } from "./Messaging";
import { InteractiveTutorial } from "./InteractiveTutorial";
import { doctorTutorialSteps } from "./tutorialSteps";
import EmailVerificationBanner from "./EmailVerificationBanner";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { 
  Users, 
  AlertTriangle, 
  Shield, 
  TrendingUp, 
  TrendingDown,
  Activity,
  FileText,
  BarChart3,
  Search,
  Filter,
  Eye,
  Calendar,
  Heart,
  Plus,
  UserPlus,
  X,
  UserCircle,
  Phone,
  Stethoscope,
  Clock,
  CheckCircle,
  ChevronDown,
  Target,
  Minus,
  Check,
  MessageSquare,
  Printer,
  Info,
  ZoomIn,
  X as XIcon,
  Loader2
} from "lucide-react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Legend,
} from 'recharts';

interface EnhancedDoctorDashboardProps {
  userProfile: Doc<"userProfiles"> & { role: "doctor" };
  onViewProfile?: () => void;
}

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  action?: () => void;
};

export function EnhancedDoctorDashboard({ userProfile, onViewProfile }: EnhancedDoctorDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPatientId, setSelectedPatientId] = useState<Id<"users"> | null>(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [selectedPatientForAssignment, setSelectedPatientForAssignment] = useState<string | null>(null);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedPatientForAnalytics, setSelectedPatientForAnalytics] = useState<Id<"users"> | null>(null);
  const [zoomedChart, setZoomedChart] = useState<"glucose" | "bmi" | "bloodpressure" | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // Check email verification status
  const emailVerificationStatus = useQuery(api.emailVerification.isEmailVerified);
  const isEmailVerified = emailVerificationStatus?.verified ?? false;

  // Fetch dashboard data - only if email is verified
  const dashboardData = useQuery(
    api.dashboard.getDoctorDashboardData,
    isEmailVerified ? { doctorId: userProfile.userId } : ("skip" as const)
  );

  const assignedPatients = useQuery(
    api.users.getAssignedPatients,
    isEmailVerified ? { doctorId: userProfile.userId } : ("skip" as const)
  );

  const highRiskPatients = useQuery(
    api.predictions.getHighRiskPatients,
    isEmailVerified ? { doctorId: userProfile.userId, riskThreshold: 50 } : ("skip" as const)
  );

  // Get pending assignment requests
  const pendingRequests = useQuery(api.patientAssignments.getPendingAssignmentRequests);
  const acceptAssignment = useMutation(api.patientAssignments.acceptAssignment);
  const rejectAssignment = useMutation(api.patientAssignments.rejectAssignment);
  const generatePatientReportPDF = useAction(api.reports.generatePatientReportPDF);

  // Always call hooks - pass "skip" to skip queries (Convex pattern)
  const patientDetails = useQuery(
    api.users.getUserProfile,
    selectedPatient?.userId ? { userId: selectedPatient.userId as Id<"users"> } : ("skip" as const)
  );

  const patientPredictions = useQuery(
    api.predictions.getRiskPredictionsByPatient,
    selectedPatient?.userId ? { patientId: selectedPatient.userId as Id<"users"> } : ("skip" as const)
  );

  const patientMedicalRecords = useQuery(
    api.medicalRecords.getMedicalRecordsByPatient,
    selectedPatient?.userId ? { patientId: selectedPatient.userId as Id<"users"> } : ("skip" as const)
  );

  // Analytics data for selected patient - always call hooks
  const analyticsPatientPredictions = useQuery(
    api.predictions.getRiskPredictionsByPatient,
    selectedPatientForAnalytics ? { patientId: selectedPatientForAnalytics } : ("skip" as const)
  );

  const analyticsMedicalRecords = useQuery(
    api.medicalRecords.getMedicalRecordsByPatient,
    selectedPatientForAnalytics ? { patientId: selectedPatientForAnalytics } : ("skip" as const)
  );

  // Get patient profile for analytics to determine diabetes status
  const analyticsPatientProfile = useQuery(
    api.users.getUserProfile,
    selectedPatientForAnalytics ? { userId: selectedPatientForAnalytics } : ("skip" as const)
  );

  // Patient assignment functionality - only if email is verified
  const allPatients = useQuery(
    api.users.getAllPatients,
    isEmailVerified ? {} : ("skip" as const)
  );
  const assignPatient = useMutation(api.users.assignPatientToDoctor);
  const removeAssignment = useMutation(api.users.removePatientAssignment);

  const getRiskColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "low": return "text-green-600 bg-green-50 border-green-200";
      case "moderate": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "high": return "text-orange-600 bg-orange-50 border-orange-200";
      case "very_high": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getRiskIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "low": return <Shield className="w-4 h-4" />;
      case "moderate": return <TrendingUp className="w-4 h-4" />;
      case "high": return <AlertTriangle className="w-4 h-4" />;
      case "very_high": return <Heart className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTimeAgo = (timestamp: number | undefined) => {
    if (!timestamp || isNaN(timestamp)) return 'Unknown';
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const formatRiskCategory = (category: string | undefined): string => {
    if (!category) return 'Unknown';
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getRiskBadgeColor = (category: string | undefined) => {
    const formatted = formatRiskCategory(category);
    switch (formatted) {
      case 'Low': return 'bg-green-100 text-green-700';
      case 'Moderate': return 'bg-yellow-100 text-yellow-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Very High': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Filter patients based on search and risk filter
  const filteredPatients = assignedPatients?.filter(patient => {
    const matchesSearch = patient.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.lastName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRisk = riskFilter === "all" || 
                       (riskFilter === "high" && patient.latestRiskScore >= 70) ||
                       (riskFilter === "moderate" && patient.latestRiskScore >= 50 && patient.latestRiskScore < 70) ||
                       (riskFilter === "low" && patient.latestRiskScore < 50);
    
    return matchesSearch && matchesRisk;
  });

  // Handle patient assignment
  const handleAssignPatient = async (patientProfileId: string) => {
    if (!isEmailVerified) {
      toast.error("Please verify your email address before assigning patients");
      return;
    }

    try {
      // Find the patient profile to get the userId
      const patient = allPatients?.find((p: any) => p._id === patientProfileId);
      if (!patient || !patient.userId) {
        toast.error("Invalid patient selected");
        return;
      }
      
      const result = await assignPatient({
        patientId: patient.userId as any,
        doctorId: userProfile.userId as any,
      });
      
      if (result) {
        toast.success("Request sent! The patient will be notified and can accept or reject your request.");
      } else {
        toast.success("Request sent successfully");
      }
      setShowAddPatient(false);
      setSelectedPatientForAssignment(null);
    } catch (error: any) {
      console.error('Error assigning patient:', error);
      const errorMessage = error.message || "Failed to assign patient";
      if (errorMessage.includes("already have a pending request")) {
        toast.error("You already have a pending request with this patient. Please wait for their response.");
      } else if (errorMessage.includes("already assigned")) {
        toast.error("This patient is already assigned to you.");
      } else if (errorMessage.includes("email") && errorMessage.includes("verified")) {
        toast.error("Please verify your email address before assigning patients");
      } else {
        toast.error(errorMessage);
      }
    }
  };

  // Handle patient removal
  const handleRemovePatient = async (assignmentId: string) => {
    try {
      await removeAssignment({
        assignmentId: assignmentId as any,
      });
    } catch (error) {
      console.error('Error removing patient:', error);
    }
  };

  // Messaging state and query - must be before any early returns
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const unreadCountResult = useQuery(api.messages.getUnreadMessageCount);
  const unreadCount = typeof unreadCountResult === 'number' ? unreadCountResult : 0;

  // Check if tutorial should be shown (only once, not on every refresh)
  useEffect(() => {
    if (userProfile && (userProfile.tutorialCompleted === undefined || userProfile.tutorialCompleted === false)) {
      // Show tutorial only if not completed
      setShowTutorial(true);
    } else {
      // Hide tutorial if already completed
      setShowTutorial(false);
    }
  }, [userProfile]);

  // Auto-scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  // Show loading only while checking email verification status
  if (emailVerificationStatus === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  // If email is verified but dashboard data is still loading, show loading
  if (isEmailVerified && dashboardData === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const baseNavItems: NavItem[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "patients", label: "Patients", icon: Users },
    { id: "high-risk", label: "High Risk", icon: AlertTriangle },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "profile", label: "Profile", icon: UserCircle },
    { id: "messages", label: "Messages", icon: MessageSquare, action: () => setIsMessagingOpen(true) },
  ];

  const navItems = baseNavItems;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Email Verification Banner */}
      {!isEmailVerified && <EmailVerificationBanner />}
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                Dr. {userProfile.lastName}'s Dashboard
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                {userProfile.specialization && `${userProfile.specialization} • `}
                Monitor your patients' diabetes risk
              </p>
            </div>
            <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right">
                <p className="text-xs sm:text-sm text-gray-500">Total Patients</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {isEmailVerified ? (dashboardData?.totalPatients || 0) : '—'}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Navigation Tabs */}
        <div className="mb-6 sm:mb-8">
          <nav className="overflow-x-auto scrollbar-hide">
            <div className="flex space-x-2 sm:space-x-8 min-w-max">
              {navItems.map(({ id, label, icon: Icon, action }) => {
                const isActive = !action && activeTab === id;
                const isMessages = id === "messages";
                return (
                <button
                  key={id}
                  data-tutorial={
                    id === "analytics" ? "analytics-tab" : 
                    id === "profile" ? "profile-tab" :
                    id === "patients" ? "patients-tab" :
                    id === "high-risk" ? "high-risk-tab" :
                    id === "messages" ? "messages-tab" : undefined
                  }
                    onClick={() => {
                      if (action) {
                        action();
                        return;
                      }
                      setActiveTab(id);
                    }}
                  className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors min-h-[44px] touch-manipulation whitespace-nowrap ${
                      isActive
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200"
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>{label}</span>
                  {isMessages && typeof unreadCount === 'number' && unreadCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] flex items-center justify-center flex-shrink-0">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4 sm:space-y-8">
            {/* Key Metrics Cards */}
            <div data-tutorial="overview-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Patients</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {isEmailVerified ? (dashboardData?.totalPatients || 0) : '—'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Under your care
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">High Risk Patients</p>
                    <p className="text-2xl font-bold text-red-600">
                      {isEmailVerified ? (dashboardData?.highRiskPatientsCount || 0) : '—'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Require immediate attention
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Recent Assessments</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {isEmailVerified ? (dashboardData?.recentAssessmentsCount || 0) : '—'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Last 7 days
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Average Risk</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {isEmailVerified && dashboardData?.latestPredictions?.length > 0 
                        ? (dashboardData.latestPredictions.reduce((sum: number, p: any) => sum + (p.riskScore || 0), 0) / dashboardData.latestPredictions.length).toFixed(1)
                        : '—'}
                      {isEmailVerified && dashboardData?.latestPredictions?.length > 0 ? '%' : ''}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Activity className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Across all patients
                </p>
              </div>
            </div>

            {/* Pending Assignment Requests */}
            {pendingRequests && pendingRequests.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-600" />
                      Pending Patient Requests
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                        {pendingRequests.length}
                      </span>
                    </h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {pendingRequests.map((request: any) => {
                      const patient = request.patient;
                      const assignment = request.assignment;
                      const patientName = `${patient.firstName} ${patient.lastName}`;
                      
                      return (
                        <div key={assignment._id} className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center space-x-4 flex-1">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                              <UserPlus className="w-6 h-6 text-amber-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{patientName}</p>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                {patient.dateOfBirth && (
                                  <span>DOB: {patient.dateOfBirth}</span>
                                )}
                                {patient.gender && (
                                  <span className="capitalize">Gender: {patient.gender}</span>
                                )}
                                {request.latestRiskScore !== null && (
                                  <span className={`font-medium ${
                                    request.latestRiskScore >= 75 ? 'text-red-600' :
                                    request.latestRiskScore >= 50 ? 'text-orange-600' :
                                    request.latestRiskScore >= 20 ? 'text-yellow-600' :
                                    'text-green-600'
                                  }`}>
                                    Risk: {request.latestRiskScore.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                              {patient.phoneNumber && (
                                <p className="text-xs text-gray-500 mt-1">
                                  <Phone className="w-3 h-3 inline mr-1" />
                                  {patient.phoneNumber}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={async () => {
                                try {
                                  await acceptAssignment({ assignmentId: assignment._id });
                                  toast.success("Request accepted successfully");
                                } catch (error: any) {
                                  toast.error(error.message || "Failed to accept request");
                                }
                              }}
                              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Accept</span>
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Are you sure you want to reject ${patientName}'s request?`)) {
                                  try {
                                    await rejectAssignment({ assignmentId: assignment._id });
                                    toast.success("Request rejected");
                                  } catch (error: any) {
                                    toast.error(error.message || "Failed to reject request");
                                  }
                                }
                              }}
                              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                              <X className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Risk Distribution Chart */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Risk Distribution</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Patients by Risk Level</h4>
                  <div className="space-y-3">
                    {[
                      { level: "Low", count: isEmailVerified ? (dashboardData?.riskDistribution?.low || 0) : 0, color: "bg-green-500" },
                      { level: "Moderate", count: isEmailVerified ? (dashboardData?.riskDistribution?.moderate || 0) : 0, color: "bg-yellow-500" },
                      { level: "High", count: isEmailVerified ? (dashboardData?.riskDistribution?.high || 0) : 0, color: "bg-orange-500" },
                      { level: "Very High", count: isEmailVerified ? (dashboardData?.riskDistribution?.very_high || 0) : 0, color: "bg-red-500" },
                    ].map(({ level, count, color }) => (
                      <div key={level} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${color}`}></div>
                          <span className="text-sm text-gray-600">{level}</span>
                        </div>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Recent Activity</h4>
                  <div className="space-y-3">
                    {isEmailVerified && dashboardData?.recentRecords?.slice(0, 5).map((record: any, index: number) => (
                      <div key={index} className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-gray-600">
                          Record #{index + 1} - {new Date(record._creationTime).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    {(!isEmailVerified || !dashboardData?.recentRecords || dashboardData.recentRecords.length === 0) && (
                      <p className="text-sm text-gray-400">No recent activity</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent High Risk Patients */}
            <div data-tutorial="high-risk-patients" className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">High Risk Patients</h3>
              </div>
              <div className="p-6">
                {!isEmailVerified ? (
                  <div className="text-center py-8 text-gray-500">
                    <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>Email verification required to view high risk patients</p>
                  </div>
                ) : highRiskPatients && highRiskPatients.length > 0 ? (
                  <div className="space-y-4">
                    {highRiskPatients.slice(0, 5).map((item: any) => {
                      const patient = item.patient || item;
                      const prediction = item.latestPrediction || item;
                      const patientName = patient.firstName && patient.lastName 
                        ? `${patient.firstName} ${patient.lastName}`
                        : patient.name || 'Unknown Patient';
                      const riskScore = prediction?.riskScore || patient.latestRiskScore || 0;
                      const confidence = prediction?.confidenceScore || patient.confidenceScore || 0;
                      const timestamp = prediction?._creationTime || patient.latestAssessmentDate || patient.latestTimestamp;
                      const assessmentCount = item.assessmentCount || patient.assessmentCount || 0;
                      const trend = item.trend || '→';
                      
                      return (
                        <div key={patient._id || patient.userId} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                                {patientName}
                            </p>
                            <p className="text-sm text-gray-600">
                                Last assessment: {getTimeAgo(timestamp)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold text-red-600">
                              {riskScore.toFixed(1)}%
                          </span>
                          <button
                            onClick={() => {
                                setSelectedPatient({ ...patient, latestPrediction: prediction });
                                setShowPatientModal(true);
                            }}
                            className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-sm">View</span>
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No high-risk patients at this time</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Patients Tab */}
        {activeTab === "patients" && (
          <div className="space-y-6">
            {/* Search and Filter */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search patients..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Risk Levels</option>
                    <option value="high">High Risk Only</option>
                    <option value="moderate">Moderate Risk</option>
                    <option value="low">Low Risk</option>
                  </select>
                  <button
                    onClick={() => {
                      if (!isEmailVerified) {
                        toast.error("Please verify your email address before assigning patients");
                        return;
                      }
                      setShowAddPatient(true);
                    }}
                    disabled={!isEmailVerified}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      isEmailVerified
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                    title={!isEmailVerified ? "Email verification required" : ""}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add Patient</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Email Verification Required Message */}
            {!isEmailVerified && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Email Verification Required</h3>
                    <p className="text-sm text-gray-600">
                      Please verify your email address to view and assign patients.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Patient List */}
            {isEmailVerified && filteredPatients && filteredPatients.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPatients.map((patient: any) => (
                  <div
                    key={patient._id}
                    className={`bg-white rounded-lg shadow-sm border p-6 cursor-pointer transition-all hover:shadow-md ${
                      selectedPatientId === patient.userId ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedPatientId(patient.userId as Id<"users">)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-sm text-gray-600">
                            Patient ID: {patient._id.slice(-6)}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(patient.riskCategory)}`}>
                        {getRiskIcon(patient.riskCategory)}
                        <span className="ml-1 capitalize">
                          {patient.riskCategory?.replace('_', ' ')}
                        </span>
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          {(() => {
                            const diabetesStatus = patient.diabetesStatus || "none";
                            const hasDiagnosedDiabetes = diabetesStatus === "type1" || diabetesStatus === "type2" || 
                                                        diabetesStatus === "gestational" || diabetesStatus === "other";
                            const isPrediabetic = diabetesStatus === "prediabetic";
                            return hasDiagnosedDiabetes 
                              ? 'Complication Risk' 
                              : isPrediabetic 
                              ? 'Progression Risk' 
                              : 'Risk Score';
                          })()}
                        </span>
                        <span className="font-bold text-lg">
                          {patient.latestRiskScore?.toFixed(1) || 'N/A'}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Last Assessment</span>
                        <span className="text-sm text-gray-900">
                          {patient.latestAssessmentDate ? 
                            getTimeAgo(patient.latestAssessmentDate) : 
                            'No assessments'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Assessments</span>
                        <span className="text-sm text-gray-900">
                          {patient.assessmentCount || 0}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPatient(patient);
                          setShowPatientModal(true);
                        }}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Details</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePatient(patient.assignmentId);
                        }}
                        className="flex items-center justify-center px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        title="Remove Patient"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : isEmailVerified ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No patients found</p>
                <p className="text-sm text-gray-400">
                  {searchTerm || riskFilter !== "all" ? 
                    'Try adjusting your search or filter criteria' : 
                    'No patients assigned to you yet'
                  }
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* High Risk Tab */}
        {activeTab === "high-risk" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">High Risk Patients</h3>
              <span className="text-sm text-gray-600">
                {highRiskPatients?.length || 0} patients require immediate attention
              </span>
            </div>

            {highRiskPatients && highRiskPatients.length > 0 ? (
              <div className="space-y-4">
                {highRiskPatients.map((item: any) => {
                  const patient = item.patient || item;
                  const prediction = item.latestPrediction || item;
                  const patientName = patient.firstName && patient.lastName 
                    ? `${patient.firstName} ${patient.lastName}`
                    : patient.name || 'Unknown Patient';
                  const riskScore = prediction?.riskScore || patient.latestRiskScore || 0;
                  const confidence = prediction?.confidenceScore || patient.confidenceScore || 0;
                  const timestamp = prediction?._creationTime || patient.latestAssessmentDate || patient.latestTimestamp;
                  const assessmentCount = item.assessmentCount || patient.assessmentCount || 0;
                  const trend = item.trend || '→';
                  
                  return (
                    <div key={patient._id || patient.userId} className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">
                              {patientName}
                          </p>
                          <p className="text-sm text-gray-600">
                              Last assessment: {getTimeAgo(timestamp)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600">
                            {riskScore.toFixed(1)}%
                        </p>
                        <p className="text-sm text-gray-600">Risk Score</p>
                      </div>
                    </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-white/50 rounded-lg p-3 text-center">
                          <p className="text-sm text-gray-500">Confidence</p>
                          <p className="font-semibold text-gray-900">
                            {confidence ? confidence.toFixed(1) : 'N/A'}%
                        </p>
                      </div>
                        <div className="bg-white/50 rounded-lg p-3 text-center">
                          <p className="text-sm text-gray-500">Assessments</p>
                          <p className="font-semibold text-gray-900">
                            {assessmentCount}
                        </p>
                      </div>
                        <div className="bg-white/50 rounded-lg p-3 text-center">
                          <p className="text-sm text-gray-500">Trend</p>
                          <p className="font-semibold text-gray-900">{trend}</p>
                      </div>
                    </div>

                      <button
                        onClick={() => {
                          setSelectedPatient({ ...patient, latestPrediction: prediction });
                          setShowPatientModal(true);
                        }}
                        className="w-full bg-red-100 text-red-600 py-2 rounded-lg hover:bg-red-200 transition flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-gray-500">No high-risk patients</p>
                <p className="text-sm text-gray-400">All patients are within safe risk levels</p>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Patient Analytics</h2>
              
              {/* Patient Selector */}
              {assignedPatients && assignedPatients.length > 0 && (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Select Patient:</label>
                  <select
                    value={selectedPatientForAnalytics || ""}
                    onChange={(e) => setSelectedPatientForAnalytics(e.target.value ? e.target.value as Id<"users"> : null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[200px]"
                  >
                    <option value="">-- Select a patient --</option>
                    {assignedPatients.map((patient: any) => (
                      <option key={patient.userId} value={patient.userId}>
                        {patient.firstName} {patient.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            {!selectedPatientForAnalytics ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Select a patient to view analytics</p>
                <p className="text-sm text-gray-400 mt-1">Choose a patient from the dropdown above</p>
              </div>
            ) : !assignedPatients || assignedPatients.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No patients assigned</p>
                <p className="text-sm text-gray-400">Assign patients to see analytics</p>
              </div>
            ) : analyticsPatientPredictions === undefined || analyticsMedicalRecords === undefined ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading patient data...</p>
              </div>
            ) : (() => {
              // Use the same analytics implementation as patient dashboard
              const predictions = analyticsPatientPredictions || [];
              const medicalRecords = analyticsMedicalRecords || [];
              
              // Determine patient's diabetes status for context-aware labels
              const patientDiabetesStatus = analyticsPatientProfile?.diabetesStatus || "none";
              const hasDiagnosedDiabetes = patientDiabetesStatus === "type1" || patientDiabetesStatus === "type2" || 
                                          patientDiabetesStatus === "gestational" || patientDiabetesStatus === "other";
              const isPrediabetic = patientDiabetesStatus === "prediabetic";
              
              // CRITICAL: Sort predictions properly - oldest first for chart (ascending)
              // Filter out deleted predictions first
              const nonDeletedPredictions = predictions.filter((p: any) => p.isDeleted !== true);
              const sortedPredictionsForChart = [...nonDeletedPredictions]
                .sort((a: any, b: any) => (a.timestamp || a._creationTime || 0) - (b.timestamp || b._creationTime || 0));
              
              // For latest/previous comparison, sort newest first
              const sortedPredictionsNewestFirst = [...predictions]
                .sort((a: any, b: any) => (b.timestamp || b._creationTime || 0) - (a.timestamp || a._creationTime || 0));
              
              const latestPrediction = sortedPredictionsNewestFirst[0];
              const previousPrediction = sortedPredictionsNewestFirst[1];
              const totalAssessments = sortedPredictionsForChart.length;
              
              // Calculate trend
              const trendDiff = latestPrediction && previousPrediction 
                ? (latestPrediction.riskScore || 0) - (previousPrediction.riskScore || 0)
                : 0;
              const isImproving = trendDiff < -5;
              const isWorsening = trendDiff > 5;
              
              // Use medical records for metric charts (more reliable than predictions)
              const sortedRecords = [...medicalRecords]
                .sort((a: any, b: any) => (a._creationTime || a.timestamp || 0) - (b._creationTime || b.timestamp || 0));
              
              // Prepare chart data - use INDEX as X-axis to avoid overlap (oldest first)
              const chartData = sortedPredictionsForChart
                .map((pred: any, index: number) => {
                  const timestamp = pred.timestamp || pred._creationTime || 0;
                  // Match medical record by timestamp (within 1 hour tolerance) or use index
                  const medicalRecord = sortedRecords.find((r: any) => {
                    const recordTime = r._creationTime || r.timestamp || 0;
                    return Math.abs(recordTime - timestamp) < 3600000; // 1 hour
                  }) || sortedRecords[index] || {};
                  
                  return {
                    index: index + 1,
                    name: `#${index + 1}`,
                    riskScore: pred.riskScore || 0,
                    confidence: pred.confidenceScore || pred.confidence || 0,
                    category: pred.riskCategory || 'Unknown',
                    date: new Date(timestamp).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short'
                    }),
                    time: new Date(timestamp).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit'
                    }),
                    // Extract from medical record
                    glucose: medicalRecord.glucoseLevel || 0,
                    bmi: medicalRecord.bmi || 0,
                    systolic: medicalRecord.systolicBP || 0,
                    diastolic: medicalRecord.diastolicBP || 0,
                  };
                });
              
              const formatRiskCategory = (category: string | undefined): string => {
                if (!category) return 'Unknown';
                return category
                  .split('_')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ');
              };
              
              return (
                <>
                  {/* ===== SUMMARY STATS CARDS ===== */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Assessments */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-500 text-sm font-medium">Total Assessments</span>
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">{totalAssessments}</p>
                      <p className="text-sm text-gray-500 mt-1">completed</p>
                    </div>
                    
                    {/* Current Risk Score */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-500 text-sm font-medium">
                          {hasDiagnosedDiabetes 
                            ? 'Complication Risk' 
                            : isPrediabetic 
                            ? 'Progression Risk' 
                            : 'Current Risk Score'}
                        </span>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          latestPrediction?.riskCategory === 'low' ? 'bg-green-100' :
                          latestPrediction?.riskCategory === 'moderate' ? 'bg-yellow-100' :
                          latestPrediction?.riskCategory === 'high' ? 'bg-orange-100' : 'bg-red-100'
                        }`}>
                          <Activity className={`w-5 h-5 ${
                            latestPrediction?.riskCategory === 'low' ? 'text-green-600' :
                            latestPrediction?.riskCategory === 'moderate' ? 'text-yellow-600' :
                            latestPrediction?.riskCategory === 'high' ? 'text-orange-600' : 'text-red-600'
                          }`} />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">
                        {latestPrediction?.riskScore?.toFixed(1) || '0'}%
                      </p>
                      <p className={`text-sm mt-1 font-medium ${
                        latestPrediction?.riskCategory === 'low' ? 'text-green-600' :
                        latestPrediction?.riskCategory === 'moderate' ? 'text-yellow-600' :
                        latestPrediction?.riskCategory === 'high' ? 'text-orange-600' : 'text-red-600'
                      }`}>
                        {latestPrediction?.riskCategory ? formatRiskCategory(latestPrediction.riskCategory) : 'No data'}
                      </p>
                    </div>
                    
                    {/* Confidence Level */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-500 text-sm font-medium">Confidence Level</span>
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                          <Target className="w-5 h-5 text-purple-600" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">
                        {latestPrediction?.confidenceScore ? latestPrediction.confidenceScore.toFixed(1) : '0'}%
                      </p>
                      <p className="text-sm text-gray-500 mt-1">model confidence</p>
                    </div>
                    
                    {/* Health Trend - Color based on trend direction */}
                    {(() => {
                      // Determine gradient colors based on HEALTH TREND direction
                      // Increasing risk = red (bad), Decreasing risk = green (good), Stable = yellow (neutral)
                      let gradientClasses = 'bg-gradient-to-br from-gray-500 via-gray-600 to-gray-700'; // Default gray
                      let iconBgClasses = 'bg-white/20';
                      let iconColorClasses = 'text-white';
                      let textColorClasses = 'text-white';
                      
                      if (isWorsening) {
                        // Increasing risk = red/orange (negative trend - bad)
                        gradientClasses = 'bg-gradient-to-br from-red-500 via-red-600 to-rose-700';
                      } else if (isImproving) {
                        // Decreasing risk = green (positive trend - good)
                        gradientClasses = 'bg-gradient-to-br from-green-500 via-green-600 to-emerald-700';
                      } else {
                        // Stable = yellow/amber (neutral)
                        gradientClasses = 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-700';
                      }
                      
                      return (
                        <div className={`relative overflow-hidden ${gradientClasses} rounded-2xl p-5 shadow-sm border border-gray-100`}>
                          {/* Background decoration */}
                          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                          
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-white">Health Trend</span>
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBgClasses}`}>
                                {isImproving ? (
                                  <TrendingDown className={`w-5 h-5 ${iconColorClasses} animate-icon-float`} />
                                ) : isWorsening ? (
                                  <TrendingUp className={`w-5 h-5 ${iconColorClasses}`} />
                                ) : (
                                  <Minus className={`w-5 h-5 ${iconColorClasses}`} />
                                )}
                              </div>
                            </div>
                            <p className={`text-lg font-bold ${textColorClasses}`}>
                              {isImproving 
                                ? (hasDiagnosedDiabetes ? 'Improving Control' : 'Improving') 
                                : isWorsening 
                                ? (hasDiagnosedDiabetes ? 'Increasing Complication Risk' : isPrediabetic ? 'Increasing Progression Risk' : 'Increasing Risk') 
                                : 'Stable'}
                            </p>
                            <p className={`text-sm mt-1 ${textColorClasses} opacity-90`}>
                              {trendDiff !== 0 
                                ? `${trendDiff > 0 ? '+' : ''}${trendDiff.toFixed(1)}% ${hasDiagnosedDiabetes ? 'complication risk' : isPrediabetic ? 'progression risk' : 'risk'}`
                                : 'No change'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* ===== RISK SCORE TREND CHART ===== */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {hasDiagnosedDiabetes 
                            ? 'Complication Risk Trend' 
                            : isPrediabetic 
                            ? 'Progression Risk Trend' 
                            : 'Risk Score Trend'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {hasDiagnosedDiabetes 
                            ? 'Patient\'s complication risk progression over time' 
                            : isPrediabetic 
                            ? 'Patient\'s progression risk over time' 
                            : 'Patient\'s risk progression over time'}
                        </p>
                      </div>
                      {totalAssessments >= 2 && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                          isImproving ? 'bg-green-100 text-green-700' :
                          isWorsening ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {isImproving ? <TrendingDown className="w-4 h-4" /> :
                           isWorsening ? <TrendingUp className="w-4 h-4" /> :
                           <Minus className="w-4 h-4" />}
                          {isImproving ? 'Improving' : isWorsening ? 'Worsening' : 'Stable'}
          </div>
        )}
                    </div>
                    
                    {totalAssessments < 2 && (
                      <p className="text-amber-600 text-sm mb-4 bg-amber-50 p-3 rounded-lg">
                        ⚠️ Complete at least 2 assessments to see trend analysis.
                      </p>
                    )}
                    
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                          <defs>
                            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          
                          {/* Risk zone backgrounds */}
                          <ReferenceArea y1={0} y2={20} fill="#22c55e" fillOpacity={0.1} />
                          <ReferenceArea y1={20} y2={50} fill="#eab308" fillOpacity={0.1} />
                          <ReferenceArea y1={50} y2={75} fill="#f97316" fillOpacity={0.1} />
                          <ReferenceArea y1={75} y2={100} fill="#ef4444" fillOpacity={0.1} />
                          
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            axisLine={{ stroke: '#e5e7eb' }}
                          />
                          
                          <YAxis 
                            domain={[0, 100]} 
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            axisLine={{ stroke: '#e5e7eb' }}
                          />
                          
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const data = payload[0].payload;
                              const patientDiabetesStatus = analyticsPatientProfile?.diabetesStatus || "none";
                              const hasDiagnosedDiabetes = patientDiabetesStatus === "type1" || patientDiabetesStatus === "type2" || 
                                                          patientDiabetesStatus === "gestational" || patientDiabetesStatus === "other";
                              const isPrediabetic = patientDiabetesStatus === "prediabetic";
                              return (
                                <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-200">
                                  <p className="font-semibold text-gray-900">Assessment {data.name}</p>
                                  <p className="text-xs text-gray-500 mb-2">{data.date} at {data.time}</p>
                                  <div className="space-y-1 text-sm">
                                    <p>
                                      <span className="text-gray-500">
                                        {hasDiagnosedDiabetes 
                                          ? 'Complication Risk:' 
                                          : isPrediabetic 
                                          ? 'Progression Risk:' 
                                          : 'Risk Score:'}
                                      </span>{" "}
                                      <span className="font-bold text-blue-600">{data.riskScore?.toFixed(1)}%</span>
                                    </p>
                                    <p><span className="text-gray-500">Confidence:</span> <span className="font-medium">{data.confidence?.toFixed(1)}%</span></p>
                                    <p><span className="text-gray-500">Category:</span> <span className={`font-medium ${
                                      data.category === 'low' ? 'text-green-600' :
                                      data.category === 'moderate' ? 'text-yellow-600' :
                                      data.category === 'high' ? 'text-orange-600' : 'text-red-600'
                                    }`}>{formatRiskCategory(data.category)}</span></p>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          
                          <Area 
                            type="monotone" 
                            dataKey="riskScore" 
                            stroke="#3B82F6" 
                            strokeWidth={3}
                            fill="url(#riskGradient)"
                            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6, stroke: '#fff' }}
                            activeDot={{ r: 8, fill: '#2563EB' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-3 bg-green-500/30 rounded"></span> Low (0-20%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-3 bg-yellow-500/30 rounded"></span> Moderate (20-50%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-3 bg-orange-500/30 rounded"></span> High (50-75%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-3 bg-red-500/30 rounded"></span> Very High (75-100%)
                      </span>
                    </div>
                  </div>
                  
                  {/* ===== KEY RISK FACTORS - Enhanced with Health Status & Comparison ===== */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                        <h3 className="font-semibold text-gray-900">
                          {hasDiagnosedDiabetes 
                            ? 'Key Factors for Diabetes Management' 
                            : isPrediabetic 
                            ? 'Key Risk Factors for Diabetes Progression' 
                            : 'Key Risk Factors'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 bg-red-500 rounded-full"></span> Above Normal
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 bg-yellow-500 rounded-full"></span> Borderline
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 bg-green-500 rounded-full"></span> Normal
                        </span>
                      </div>
                    </div>
                    
                    {(() => {
                      const latestImportance = latestPrediction?.featureImportance || {};
                      
                      // Get previous prediction for comparison
                      const previousPrediction = sortedPredictionsNewestFirst[1];
                      
                      // Define healthy ranges
                      const healthyRanges: Record<string, { min: number; max: number; unit: string; borderlineMax?: number }> = {
                        bmi: { min: 18.5, max: 24.9, unit: '', borderlineMax: 29.9 },
                        glucose: { min: 70, max: 100, unit: 'mg/dL', borderlineMax: 125 },
                        bloodPressure: { min: 90, max: 120, unit: 'mmHg', borderlineMax: 139 },
                        insulin: { min: 2, max: 25, unit: 'µU/mL', borderlineMax: 35 },
                        skinThickness: { min: 10, max: 50, unit: 'mm' },
                        hba1c: { min: 4, max: 5.7, unit: '%', borderlineMax: 6.4 },
                        age: { min: 0, max: 45, unit: 'years' },
                      };
                      
                      // Risk factor explanations - Enhanced with structured format (context-aware)
                      const factorExplanations: Record<string, { title: string; description: string; normalRange?: string; diabetesRisk: string }> = {
                        bmi: {
                          title: "Body Mass Index (BMI)",
                          description: "A measure of body fat based on height and weight. It helps assess weight-related health risks.",
                          normalRange: "Healthy: 18.5-24.9 | Overweight: 25-29.9 | Obese: 30+",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Weight management is crucial for diabetes control. Excess body fat increases insulin resistance and makes glucose control more difficult, increasing complication risk."
                            : "Higher BMI increases diabetes risk. Excess body fat can lead to insulin resistance, making it harder for the body to use insulin effectively.",
                        },
                        glucose: {
                          title: "Fasting Blood Glucose",
                          description: hasDiagnosedDiabetes
                            ? "Blood sugar level after fasting (not eating) for at least 8 hours. This is a key indicator of diabetes control and complication risk."
                            : "Blood sugar level after fasting (not eating) for at least 8 hours. This is a key indicator of diabetes risk.",
                          normalRange: hasDiagnosedDiabetes
                            ? "Target: 80-130 mg/dL (before meals) | Good control: <140 mg/dL | Needs attention: 140+ mg/dL"
                            : "Normal: 70-100 mg/dL | Prediabetes: 100-125 mg/dL | Diabetes: 126+ mg/dL",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Maintaining glucose within target range is crucial for preventing complications. Elevated glucose increases risk of cardiovascular disease, kidney damage, and nerve problems."
                            : "Elevated glucose levels indicate the body may not be processing sugar correctly. High fasting glucose is a primary diabetes risk factor.",
                        },
                        bloodpressure: {
                          title: "Blood Pressure",
                          description: "The force of blood against artery walls. Measured as systolic (top) and diastolic (bottom) numbers.",
                          normalRange: hasDiagnosedDiabetes
                            ? "Target: <130/80 mmHg | Elevated: 130-139/80-89 mmHg | High: 140+/90+ mmHg"
                            : "Normal: <120/80 mmHg | Elevated: 120-129/<80 mmHg | High: 130+/80+ mmHg",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "High blood pressure is a major risk factor for diabetes complications, especially cardiovascular disease and kidney damage. Controlling BP is essential."
                            : "High blood pressure often occurs with diabetes. Both conditions share risk factors and can worsen each other, increasing cardiovascular complications.",
                        },
                        age: {
                          title: "Age",
                          description: "Current age. Age is a non-modifiable risk factor that significantly impacts diabetes risk.",
                          normalRange: hasDiagnosedDiabetes
                            ? "Complication risk increases with age, especially after 60 years"
                            : "Risk increases: After 45 years | Highest risk: 65+ years",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Older age increases complication risk. Regular monitoring and preventive care become even more important as patients age."
                            : "Age is a significant risk factor. As patients age, their body becomes less efficient at processing glucose. Risk increases substantially after age 45.",
                        },
                        insulin: {
                          title: "Insulin Level",
                          description: "The amount of insulin hormone in the blood. Insulin helps the body use glucose (sugar) for energy.",
                          normalRange: "Fasting: 2-25 µU/mL (varies by lab)",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "High insulin levels indicate insulin resistance, making glucose control more difficult. Managing insulin resistance through medication and lifestyle is crucial for preventing complications."
                            : "High insulin levels may indicate insulin resistance - the body needs more insulin to process glucose. This is a key early warning sign of type 2 diabetes.",
                        },
                        skinthickness: {
                          title: "Skin Thickness (Triceps Skinfold)",
                          description: "A measurement of subcutaneous fat at the triceps. It's an indicator of overall body fat percentage.",
                          normalRange: "Varies by age, gender, and ethnicity",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Higher body fat increases insulin resistance and makes diabetes management more challenging, increasing complication risk."
                            : "Higher skin thickness measurements indicate more body fat, which is associated with increased diabetes risk and insulin resistance.",
                        },
                        diabetespedigree: {
                          title: "Diabetes Pedigree Function",
                          description: "A calculated measure of family history of diabetes, indicating genetic predisposition based on relatives' diabetes status.",
                          normalRange: "Lower values indicate less genetic risk",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Family history is a non-modifiable factor. Focus on managing current diabetes through lifestyle and medication to prevent complications."
                            : "Having a family history of diabetes significantly increases risk. Genetics play a role, but lifestyle factors can help reduce this inherited risk.",
                        },
                        pregnancies: {
                          title: "Number of Pregnancies",
                          description: "The total number of times the patient has been pregnant, regardless of outcome (live birth, miscarriage, etc.).",
                          normalRange: "Varies by individual",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "For women with diabetes, pregnancy requires careful glucose management to prevent complications for both mother and baby. Preconception planning is essential."
                            : "Multiple pregnancies can increase diabetes risk in women. Gestational diabetes during pregnancy also significantly increases future type 2 diabetes risk.",
                        },
                        glucosebmiratio: {
                          title: "Glucose to BMI Ratio",
                          description: "A calculated ratio comparing blood glucose level to body mass index. Higher ratios indicate elevated blood sugar relative to body weight.",
                          normalRange: "Lower ratios are healthier",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Higher ratios indicate poor glucose control relative to body weight, increasing complication risk. Weight management and glucose control are both important."
                            : "Higher ratios indicate that blood sugar is elevated relative to body weight, which is a strong indicator of diabetes risk and metabolic dysfunction.",
                        },
                        agebmiinteraction: {
                          title: "Age × BMI Interaction",
                          description: "The combined effect of age and BMI. This metric captures how age and body weight interact to influence diabetes risk.",
                          normalRange: "Lower values are healthier",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Older age combined with high BMI significantly increases complication risk. Weight management becomes even more important as patients age with diabetes."
                            : "Older age combined with high BMI significantly increases diabetes risk. The interaction effect is greater than the sum of individual risk factors.",
                        },
                        bpcategory: {
                          title: "Blood Pressure Category",
                          description: "Categorized blood pressure levels (normal, elevated, high) that impact diabetes risk and cardiovascular health.",
                          normalRange: hasDiagnosedDiabetes
                            ? "Target: <130/80 | Elevated: 130-139/80-89 | High: 140+/90+"
                            : "Normal: <120/80 | Elevated: 120-129/<80 | High: 130+/80+",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "High blood pressure is a major risk factor for diabetes complications, especially cardiovascular disease and kidney damage. Controlling BP is essential."
                            : "Higher blood pressure categories are strongly linked to diabetes risk. Hypertension and diabetes often occur together and worsen each other.",
                        },
                        glucosecategory: {
                          title: "Glucose Category",
                          description: hasDiagnosedDiabetes
                            ? "Classifies blood sugar control levels based on fasting glucose measurements. Higher categories indicate poorer control and increased complication risk."
                            : "Classifies blood sugar levels as normal, prediabetic, or diabetic based on fasting glucose measurements.",
                          normalRange: hasDiagnosedDiabetes
                            ? "Well Controlled: <140 mg/dL | Needs Improvement: 140-180 mg/dL | Needs Attention: 180+ mg/dL"
                            : "Normal: <100 mg/dL | Prediabetic: 100-125 mg/dL | Diabetic: 126+ mg/dL",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Higher glucose categories indicate poor diabetes control, significantly increasing risk of complications including heart disease, kidney damage, and nerve problems."
                            : "Higher glucose categories directly indicate diabetes risk. Prediabetic levels signal high risk of developing full diabetes without intervention.",
                        },
                        bmicategory: {
                          title: "BMI Category",
                          description: "Classifies body weight as underweight, normal, overweight, or obese, each with different diabetes risk levels.",
                          normalRange: "Underweight: <18.5 | Normal: 18.5-24.9 | Overweight: 25-29.9 | Obese: 30+",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Higher BMI categories make diabetes management more difficult and increase complication risk. Weight loss can significantly improve glucose control and reduce complications."
                            : "Higher BMI categories significantly increase diabetes risk. Obesity (BMI 30+) is one of the strongest modifiable risk factors for type 2 diabetes.",
                        },
                        metabolicrisk: {
                          title: "Metabolic Risk Score",
                          description: "A composite score combining glucose, BMI, blood pressure, and age indicators of overall metabolic health.",
                          normalRange: "Lower scores indicate better metabolic health",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Higher metabolic risk scores indicate poor control across multiple factors, significantly increasing complication risk including cardiovascular disease, kidney damage, and nerve problems."
                            : "Higher metabolic risk scores indicate poor metabolic health across multiple factors, significantly increasing diabetes and cardiovascular disease risk.",
                        },
                        insulinglucoseratio: {
                          title: "Insulin to Glucose Ratio",
                          description: "Measures insulin resistance by comparing insulin levels to glucose levels. Higher ratios suggest the body needs more insulin to process glucose.",
                          normalRange: "Lower ratios indicate better insulin sensitivity",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Higher ratios indicate significant insulin resistance, making glucose control difficult and increasing complication risk. Medication and lifestyle changes can help improve insulin sensitivity."
                            : "Higher ratios indicate insulin resistance - the body needs more insulin to process the same amount of glucose. This is a key early warning sign of type 2 diabetes.",
                        },
                      };
                      
                      // Get current values from medical records
                      const latestRecord = sortedRecords[sortedRecords.length - 1] || {};
                      
                      // Helper to get value for a feature key
                      const getFeatureValue = (key: string): number => {
                        const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
                        if (normalizedKey.includes('bmi')) return latestRecord?.bmi || 0;
                        if (normalizedKey.includes('glucose')) return latestRecord?.glucoseLevel || 0;
                        if (normalizedKey.includes('bloodpressure') || normalizedKey.includes('bp')) return latestRecord?.systolicBP || 0;
                        if (normalizedKey.includes('age')) return latestRecord?.age || 0;
                        if (normalizedKey.includes('insulin')) return latestRecord?.insulinLevel || 0;
                        if (normalizedKey.includes('skinthickness')) return latestRecord?.skinThickness || 0;
                        if (normalizedKey.includes('diabetespedigree') || normalizedKey.includes('pedigree')) return 0;
                        return 0;
                      };
                      
                      // Helper to get healthy range for a feature
                      const getHealthyRange = (key: string) => {
                        const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
                        if (normalizedKey.includes('bmi')) return healthyRanges.bmi;
                        if (normalizedKey.includes('glucose')) return healthyRanges.glucose;
                        if (normalizedKey.includes('bloodpressure') || normalizedKey.includes('bp')) return healthyRanges.bloodPressure;
                        if (normalizedKey.includes('age')) return healthyRanges.age;
                        if (normalizedKey.includes('insulin')) return healthyRanges.insulin;
                        if (normalizedKey.includes('skinthickness')) return healthyRanges.skinThickness;
                        return { min: 0, max: 0, unit: '', borderlineMax: 0 };
                      };
                      
                      // Build factors array with ALL features from featureImportance
                      const factors = Object.entries(latestImportance)
                        .map(([featureKey, importance]) => {
                          const importancePercent = (importance as number) * 100;
                          const currentValue = getFeatureValue(featureKey);
                          const range = getHealthyRange(featureKey);
                          
                          // Format feature name nicely
                          const formattedName = featureKey
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase())
                            .trim();
                          
                          // Get explanation for this factor
                          const normalizedKey = featureKey.toLowerCase().replace(/[^a-z]/g, '');
                          const explanationData = factorExplanations[normalizedKey];
                          
                          return {
                            key: featureKey,
                            name: formattedName,
                            importance: importancePercent,
                            currentValue,
                            previousValue: null,
                            explanation: explanationData || {
                              title: formattedName,
                              description: `This factor contributes ${importancePercent.toFixed(1)}% to the ${hasDiagnosedDiabetes ? 'complication risk' : isPrediabetic ? 'progression risk' : 'diabetes risk'} assessment.`,
                              diabetesRisk: `This metric is used by our AI model to calculate the patient's personalized ${hasDiagnosedDiabetes ? 'complication risk' : isPrediabetic ? 'progression risk' : 'diabetes risk'} score.`,
                            } as { title: string; description: string; normalRange?: string; diabetesRisk: string },
                            ...range
                          };
                        })
                        .filter(f => {
                          // For diagnosed diabetic patients, filter out factors that are primarily about predicting diabetes risk
                          if (hasDiagnosedDiabetes) {
                            const normalizedKey = f.key.toLowerCase().replace(/[^a-z]/g, '');
                            // Filter out Diabetes Pedigree Function (family history/genetic risk) - not relevant for managing existing diabetes
                            if (normalizedKey.includes('diabetespedigree') || normalizedKey.includes('pedigree')) {
                              return false;
                            }
                          }
                          return f.importance > 0;
                        })
                        .sort((a, b) => b.importance - a.importance);
                      
                      if (factors.length === 0) {
                        return (
                          <div className="text-center py-12 bg-gray-50 rounded-xl">
                            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">No risk factor data available</p>
                          </div>
                        );
                      }
                      
                      const maxImportance = Math.max(...factors.map(f => f.importance));
                      
                      return (
                        <RadixTooltip.Provider>
                          <div className="space-y-3 sm:space-y-4">
                            {factors.map((factor) => {
                            // Determine health status
                            const isAboveNormal = factor.currentValue > (factor.borderlineMax || factor.max);
                            const isBorderline = factor.currentValue > factor.max && factor.currentValue <= (factor.borderlineMax || factor.max);
                            const isNormal = factor.currentValue >= factor.min && factor.currentValue <= factor.max;
                            
                            // Determine bar color
                            const barColor = isAboveNormal ? '#EF4444' : isBorderline ? '#EAB308' : '#22C55E';
                            const statusText = isAboveNormal ? 'High' : isBorderline ? 'Borderline' : 'Normal';
                            const statusBg = isAboveNormal ? 'bg-red-100' : isBorderline ? 'bg-yellow-100' : 'bg-green-100';
                            const statusTextColor = isAboveNormal ? 'text-red-700' : isBorderline ? 'text-yellow-700' : 'text-green-700';
                            
                            // Calculate change from previous
                            const change = factor.previousValue !== null 
                              ? factor.currentValue - factor.previousValue 
                              : null;
                            
                            const barWidth = Math.max((factor.importance / maxImportance) * 100, 20);
                            
                            return (
                              <div key={factor.key} className="group relative">
                                <div className="flex items-center gap-2 sm:gap-3">
                                  {/* Factor name with tooltip */}
                                  <div className="w-32 sm:w-40 flex-shrink-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{factor.name}</span>
                                      <RadixTooltip.Root>
                                        <RadixTooltip.Trigger asChild>
                                          <button
                                            type="button"
                                            className="text-gray-400 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full flex-shrink-0"
                                            aria-label={`Information about ${factor.name}`}
                                          >
                                            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                          </button>
                                        </RadixTooltip.Trigger>
                                        <RadixTooltip.Content
                                          side="right"
                                          sideOffset={8}
                                          className="rounded-lg bg-gray-900 text-white text-xs px-4 py-3 shadow-2xl max-w-sm leading-relaxed z-50 border border-gray-700"
                                        >
                                          {typeof factor.explanation === 'string' ? (
                                            <>
                                              <p className="font-semibold mb-1">{factor.name}</p>
                                              <p>{factor.explanation}</p>
                                            </>
                                          ) : (
                                            <div className="space-y-2">
                                              <h4 className="font-semibold text-white text-sm mb-1.5">{factor.explanation.title || factor.name}</h4>
                                              <p className="text-gray-200">{factor.explanation.description}</p>
                                              {factor.explanation.normalRange && (
                                                <div className="pt-1.5 border-t border-gray-700">
                                                  <p className="text-blue-300 font-medium text-xs mb-1">
                                                    {hasDiagnosedDiabetes ? 'Target Range:' : 'Normal Range:'}
                                                  </p>
                                                  <p className="text-gray-300 text-xs">{factor.explanation.normalRange}</p>
                                                </div>
                                              )}
                                              <div className="pt-1.5 border-t border-gray-700">
                                                <p className="text-amber-300 font-medium text-xs mb-1">
                                                  {hasDiagnosedDiabetes 
                                                    ? 'Complication Risk:' 
                                                    : isPrediabetic 
                                                    ? 'Progression Risk:' 
                                                    : 'Diabetes Risk:'}
                                                </p>
                                                <p className="text-gray-300 text-xs">{factor.explanation.diabetesRisk}</p>
                                              </div>
                                            </div>
                                          )}
                                          <RadixTooltip.Arrow className="fill-gray-900" />
                                        </RadixTooltip.Content>
                                      </RadixTooltip.Root>
                                    </div>
                                  </div>
                                  
                                  {/* Progress bar and right side with tooltip */}
                                  <RadixTooltip.Root>
                                    <RadixTooltip.Trigger asChild>
                                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                        {/* Progress bar */}
                                        <div className="flex-1 min-w-0 h-8 bg-gray-100 rounded-lg overflow-hidden cursor-help">
                                          <div 
                                            className="h-full rounded-lg flex items-center justify-end pr-2 sm:pr-3 transition-all duration-500"
                                            style={{ 
                                              width: `${barWidth}%`,
                                              backgroundColor: barColor 
                                            }}
                                          >
                                            <span className="text-white text-xs sm:text-sm font-semibold drop-shadow whitespace-nowrap">
                                              {factor.importance.toFixed(1)}%
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {/* Current value */}
                                        <div className="w-20 sm:w-24 text-right flex-shrink-0 cursor-help">
                                          <span className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">
                                            {factor.currentValue.toFixed(1)}{factor.unit ? ` ${factor.unit}` : ''}
                                          </span>
                                        </div>
                                        
                                        {/* Status icon */}
                                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center flex-shrink-0 cursor-help ${statusBg}`}>
                                          {isAboveNormal ? (
                                            <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                                          ) : isBorderline ? (
                                            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                                          ) : (
                                            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                                          )}
                                        </div>
                                      </div>
                                    </RadixTooltip.Trigger>
                                    <RadixTooltip.Content
                                      side="top"
                                      sideOffset={8}
                                      className="rounded-lg bg-white text-gray-900 text-sm px-4 py-3 shadow-2xl max-w-xs leading-relaxed z-50 border border-gray-200"
                                    >
                                      <div className="space-y-3">
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="font-semibold text-gray-900">{factor.name}</h4>
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBg} ${statusTextColor}`}>
                                            {statusText}
                                          </span>
                                        </div>
                                        
                                        {/* Current Value, Normal Range, Risk Impact */}
                                        <div className="grid grid-cols-3 gap-3 text-xs">
                                          <div>
                                            <p className="text-gray-500 text-xs mb-1">Current Value</p>
                                            <p className="font-bold text-gray-900">{factor.currentValue.toFixed(1)}{factor.unit ? ` ${factor.unit}` : ''}</p>
                                          </div>
                                          <div>
                                            <p className="text-gray-500 text-xs mb-1">
                                              {hasDiagnosedDiabetes ? 'Target Range' : 'Normal Range'}
                                            </p>
                                            <p className="font-medium text-gray-700">{factor.min}-{factor.max}{factor.unit ? ` ${factor.unit}` : ''}</p>
                                          </div>
                                          <div>
                                            <p className="text-gray-500 text-xs mb-1">
                                              {hasDiagnosedDiabetes 
                                                ? 'Impact on Complication Risk' 
                                                : isPrediabetic 
                                                ? 'Impact on Progression Risk' 
                                                : 'Risk Impact'}
                                            </p>
                                            <p className="font-bold text-blue-600">{factor.importance.toFixed(1)}%</p>
                                          </div>
                                        </div>
                                        
                                        {/* Comparison with previous */}
                                        {change !== null && (
                                          <div className="pt-2 border-t border-gray-100">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs text-gray-500">vs Previous Assessment</span>
                                              <div className={`flex items-center gap-1 text-xs font-medium ${
                                                change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-gray-500'
                                              }`}>
                                                {change > 0 ? (
                                                  <TrendingUp className="w-3 h-3" />
                                                ) : change < 0 ? (
                                                  <TrendingDown className="w-3 h-3" />
                                                ) : (
                                                  <Minus className="w-3 h-3" />
                                                )}
                                                <span>
                                                  {change > 0 ? '+' : ''}{change.toFixed(1)}{factor.unit ? ` ${factor.unit}` : ''}
                                                </span>
                                              </div>
                                            </div>
                                            {factor.previousValue !== null && (
                                              <p className="text-xs text-gray-400 mt-1">
                                                Previous: {(factor.previousValue as number).toFixed(1)}{factor.unit ? ` ${factor.unit}` : ''}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                        
                                        {/* Visual range bar */}
                                        <div className="pt-2 border-t border-gray-100">
                                          <div className="relative h-2 bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded-full">
                                            <div 
                                              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-lg"
                                              style={{
                                                left: `${Math.min(Math.max((factor.currentValue / ((factor.borderlineMax || factor.max) * 1.5)) * 100, 2), 98)}%`
                                              }}
                                            />
                                          </div>
                                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                                            <span>{factor.min}</span>
                                            <span>{factor.max} (normal)</span>
                                            <span>{factor.borderlineMax || (factor.max * 1.2)} (borderline)</span>
                                          </div>
                                        </div>
                                      </div>
                                      <RadixTooltip.Arrow className="fill-white" />
                                    </RadixTooltip.Content>
                                  </RadixTooltip.Root>
                                </div>
                              </div>
                            );
                          })}
                          </div>
                        </RadixTooltip.Provider>
                      );
                    })()}
                  </div>
                  
                  {/* ===== INDIVIDUAL METRIC CHARTS - Fixed to show different values ===== */}
                  {(() => {
                    // Filter medical records to only include those associated with non-deleted predictions
                    const nonDeletedPredictions = (analyticsPatientPredictions || []).filter((p: any) => p.isDeleted !== true);
                    const validMedicalRecordIds = new Set(
                      nonDeletedPredictions.map((p: any) => p.medicalRecordId).filter(Boolean)
                    );
                    
                    // Get ALL medical records, but filter to only those associated with non-deleted predictions
                    const filteredRecords = (analyticsMedicalRecords || []).filter((record: any) => {
                      return validMedicalRecordIds.has(record._id);
                    });
                    
                    // Sort by timestamp (oldest first for chart progression)
                    const sortedRecordsForCharts = [...filteredRecords]
                      .sort((a: any, b: any) => (a._creationTime || a.timestamp || 0) - (b._creationTime || b.timestamp || 0));
                    
                    // Create chart data from medical records
                    let metricChartData = sortedRecordsForCharts.map((record: any, index: number) => ({
                      index: index + 1,
                      name: `#${index + 1}`,
                      glucose: record.glucoseLevel || record.glucose || 0,
                      bmi: record.bmi || 0,
                      systolic: record.systolicBP || record.bloodPressure?.systolic || 0,
                      diastolic: record.diastolicBP || record.bloodPressure?.diastolic || 0,
                      date: new Date(record._creationTime || record.timestamp || 0).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short'
                      }),
                    }));
                    
                    // If no medical records or all values are 0, try to use predictions' inputData
                    // But only use non-deleted predictions
                    if (metricChartData.length === 0 || metricChartData.every((d: any) => d.glucose === 0 && d.bmi === 0)) {
                      const nonDeletedForChart = (analyticsPatientPredictions || [])
                        .filter((p: any) => p.isDeleted !== true)
                        .sort((a: any, b: any) => (a._creationTime || a.timestamp || 0) - (b._creationTime || b.timestamp || 0));
                      
                      const predictionChartData = nonDeletedForChart
                        .map((pred: any, index: number) => ({
                          index: index + 1,
                          name: `#${index + 1}`,
                          glucose: pred.inputData?.glucose || 0,
                          bmi: pred.inputData?.bmi || 0,
                          systolic: pred.inputData?.bloodPressure?.systolic || pred.inputData?.systolic || 0,
                          diastolic: pred.inputData?.bloodPressure?.diastolic || pred.inputData?.diastolic || 0,
                          date: new Date(pred._creationTime || pred.timestamp || 0).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short'
                          }),
                        }));
                      
                      // Use prediction data if it has values
                      if (predictionChartData.some((d: any) => d.glucose > 0 || d.bmi > 0)) {
                        metricChartData = predictionChartData;
                      }
                    }
                    
                    return (
                      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
                        {/* Glucose Chart */}
                        <div 
                          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 cursor-pointer hover:shadow-md transition-all duration-300 group"
                          onClick={() => setZoomedChart("glucose")}
                        >
                          <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <h4 className="font-semibold text-gray-900">Glucose Level</h4>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-lg">
                              <ZoomIn className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                          <div className="h-40 sm:h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={metricChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <ReferenceArea y1={70} y2={100} fill="#22c55e" fillOpacity={0.15} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis domain={[0, 200]} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                  formatter={(value: number) => [`${value} mg/dL`, 'Glucose']}
                                  labelFormatter={(label) => `Assessment ${label}`}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="glucose" 
                                  stroke="#3B82F6" 
                                  strokeWidth={2} 
                                  dot={{ r: 5, fill: '#3B82F6' }}
                                  activeDot={{ r: 7 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-xs text-gray-500 text-center mt-2">Normal: 70-100 mg/dL</p>
                        </div>
                        
                        {/* BMI Chart */}
                        <div 
                          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 cursor-pointer hover:shadow-md transition-all duration-300 group"
                          onClick={() => setZoomedChart("bmi")}
                        >
                          <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <h4 className="font-semibold text-gray-900">BMI</h4>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-lg">
                              <ZoomIn className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                          <div className="h-40 sm:h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={metricChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <ReferenceArea y1={18.5} y2={24.9} fill="#22c55e" fillOpacity={0.15} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis domain={[0, 40]} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                  formatter={(value: number) => [value?.toFixed(1), 'BMI']}
                                  labelFormatter={(label) => `Assessment ${label}`}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="bmi" 
                                  stroke="#10B981" 
                                  strokeWidth={2} 
                                  dot={{ r: 5, fill: '#10B981' }}
                                  activeDot={{ r: 7 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-xs text-gray-500 text-center mt-2">Healthy: 18.5-24.9</p>
                        </div>
                        
                        {/* Blood Pressure Chart */}
                        <div 
                          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 cursor-pointer hover:shadow-md transition-all duration-300 group"
                          onClick={() => setZoomedChart("bloodpressure")}
                        >
                          <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                              <h4 className="font-semibold text-gray-900">Blood Pressure</h4>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-lg">
                              <ZoomIn className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                          <div className="h-40 sm:h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={metricChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <ReferenceArea y1={90} y2={120} fill="#22c55e" fillOpacity={0.15} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis domain={[0, 200]} tick={{ fontSize: 10 }} />
                                <Tooltip labelFormatter={(label) => `Assessment ${label}`} />
                                <Line 
                                  type="monotone" 
                                  dataKey="systolic" 
                                  stroke="#EF4444" 
                                  strokeWidth={2} 
                                  dot={{ r: 5, fill: '#EF4444' }}
                                  name="Systolic"
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="diastolic" 
                                  stroke="#F97316" 
                                  strokeWidth={2} 
                                  dot={{ r: 5, fill: '#F97316' }}
                                  name="Diastolic"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex justify-center gap-4 text-xs text-gray-500 mt-2">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span> Systolic
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-orange-500 rounded-full"></span> Diastolic
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Zoom Modal for Charts */}
                  {zoomedChart && selectedPatientForAnalytics && (() => {
                    // Recreate chart data using the same logic as the analytics section
                    const predictions = analyticsPatientPredictions || [];
                    const medicalRecords = analyticsMedicalRecords || [];
                    
                    // Filter and sort medical records
                    const filteredRecords = medicalRecords.filter((r: any) => r.isDeleted !== true);
                    const sortedRecordsForModal = [...filteredRecords]
                      .sort((a: any, b: any) => (a._creationTime || a.timestamp || 0) - (b._creationTime || b.timestamp || 0));
                    
                    // Create chart data from medical records (same logic as analytics section)
                    let chartData = sortedRecordsForModal.map((record: any, index: number) => ({
                      index: index + 1,
                      name: `#${index + 1}`,
                      glucose: record.glucoseLevel || record.glucose || 0,
                      bmi: record.bmi || 0,
                      systolic: record.systolicBP || record.bloodPressure?.systolic || 0,
                      diastolic: record.diastolicBP || record.bloodPressure?.diastolic || 0,
                    }));
                    
                    // If no medical records or all values are 0, try to use predictions' inputData
                    if (chartData.length === 0 || chartData.every((d: any) => d.glucose === 0 && d.bmi === 0)) {
                      const nonDeletedForChart = predictions
                        .filter((p: any) => p.isDeleted !== true)
                        .sort((a: any, b: any) => (a._creationTime || a.timestamp || 0) - (b._creationTime || b.timestamp || 0));
                      
                      chartData = nonDeletedForChart.map((pred: any, index: number) => ({
                        index: index + 1,
                        name: `#${index + 1}`,
                        glucose: pred.inputData?.glucose || 0,
                        bmi: pred.inputData?.bmi || 0,
                        systolic: pred.inputData?.bloodPressure?.systolic || pred.inputData?.systolic || 0,
                        diastolic: pred.inputData?.bloodPressure?.diastolic || pred.inputData?.diastolic || 0,
                      }));
                    }
                    
                    return (
                      <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
                        onClick={() => setZoomedChart(null)}
                      >
                        <div 
                          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto animate-scale-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                            <h3 className="text-xl font-bold text-gray-900">
                              {zoomedChart === "glucose" && "Glucose Level Trend"}
                              {zoomedChart === "bmi" && "BMI Trend"}
                              {zoomedChart === "bloodpressure" && "Blood Pressure Trend"}
                            </h3>
                            <button
                              onClick={() => setZoomedChart(null)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <XIcon className="w-5 h-5 text-gray-500" />
                            </button>
                          </div>
                          <div className="p-6">
                            {zoomedChart === "glucose" && (
                              <div>
                                <div className="h-96 mb-6">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData.filter((d: any) => d.glucose > 0)} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                      <ReferenceArea y1={70} y2={100} fill="#22c55e" fillOpacity={0.15} />
                                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                      <YAxis domain={[0, 200]} tick={{ fontSize: 12 }} label={{ value: "mg/dL", angle: -90, position: "insideLeft" }} />
                                      <Tooltip 
                                        formatter={(value: number) => [`${value} mg/dL`, 'Glucose']}
                                        labelFormatter={(label) => `Assessment ${label}`}
                                      />
                                      <Line 
                                        type="monotone" 
                                        dataKey="glucose" 
                                        stroke="#3B82F6" 
                                        strokeWidth={3} 
                                        dot={{ r: 6, fill: '#3B82F6' }}
                                        activeDot={{ r: 8 }}
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                                <p className="text-sm text-gray-600 text-center mb-4">Normal Range: 70-100 mg/dL</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                  {chartData.filter((d: any) => d.glucose > 0).map((d: any, i: number) => (
                                    <div key={i} className="bg-gray-50 p-3 rounded-lg text-center">
                                      <p className="text-xs text-gray-500">Assessment {d.index}</p>
                                      <p className="text-lg font-semibold text-gray-900">{d.glucose} mg/dL</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {zoomedChart === "bmi" && (
                              <div>
                                <div className="h-96 mb-6">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData.filter((d: any) => d.bmi > 0)} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                      <ReferenceArea y1={18.5} y2={24.9} fill="#22c55e" fillOpacity={0.15} />
                                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                      <YAxis domain={[0, 40]} tick={{ fontSize: 12 }} />
                                      <Tooltip 
                                        formatter={(value: number) => [value?.toFixed(1), 'BMI']}
                                        labelFormatter={(label) => `Assessment ${label}`}
                                      />
                                      <Line 
                                        type="monotone" 
                                        dataKey="bmi" 
                                        stroke="#10B981" 
                                        strokeWidth={3} 
                                        dot={{ r: 6, fill: '#10B981' }}
                                        activeDot={{ r: 8 }}
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                                <p className="text-sm text-gray-600 text-center mb-4">Healthy Range: 18.5-24.9</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                  {chartData.filter((d: any) => d.bmi > 0).map((d: any, i: number) => (
                                    <div key={i} className="bg-gray-50 p-3 rounded-lg text-center">
                                      <p className="text-xs text-gray-500">Assessment {d.index}</p>
                                      <p className="text-lg font-semibold text-gray-900">{d.bmi?.toFixed(1)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {zoomedChart === "bloodpressure" && (
                              <div>
                                <div className="h-96 mb-6">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData.filter((d: any) => d.systolic > 0 || d.diastolic > 0)} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                      <ReferenceArea y1={90} y2={120} fill="#22c55e" fillOpacity={0.15} />
                                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                      <YAxis domain={[0, 200]} tick={{ fontSize: 12 }} label={{ value: "mmHg", angle: -90, position: "insideLeft" }} />
                                      <Tooltip labelFormatter={(label) => `Assessment ${label}`} />
                                      <Line 
                                        type="monotone" 
                                        dataKey="systolic" 
                                        stroke="#EF4444" 
                                        strokeWidth={3} 
                                        dot={{ r: 6, fill: '#EF4444' }}
                                        name="Systolic"
                                      />
                                      <Line 
                                        type="monotone" 
                                        dataKey="diastolic" 
                                        stroke="#F97316" 
                                        strokeWidth={3} 
                                        dot={{ r: 6, fill: '#F97316' }}
                                        name="Diastolic"
                                      />
                                      <Legend />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="flex justify-center gap-4 text-sm text-gray-600 mb-4">
                                  <span className="flex items-center gap-2">
                                    <span className="w-3 h-3 bg-red-500 rounded-full"></span> Systolic
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <span className="w-3 h-3 bg-orange-500 rounded-full"></span> Diastolic
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                  {chartData.filter((d: any) => d.systolic > 0 || d.diastolic > 0).map((d: any, i: number) => (
                                    <div key={i} className="bg-gray-50 p-3 rounded-lg text-center">
                                      <p className="text-xs text-gray-500">Assessment {d.index}</p>
                                      <p className="text-lg font-semibold text-gray-900">{d.systolic}/{d.diastolic}</p>
                                      <p className="text-xs text-gray-500">mmHg</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* ===== RISK DISTRIBUTION ===== */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                      <h3 className="font-semibold text-gray-900">Risk Distribution</h3>
                    </div>
                    
                    {(() => {
                      const distribution = {
                        low: sortedPredictionsForChart.filter((p: any) => (p.riskScore || 0) < 20).length,
                        moderate: sortedPredictionsForChart.filter((p: any) => (p.riskScore || 0) >= 20 && (p.riskScore || 0) < 50).length,
                        high: sortedPredictionsForChart.filter((p: any) => (p.riskScore || 0) >= 50 && (p.riskScore || 0) < 75).length,
                        veryHigh: sortedPredictionsForChart.filter((p: any) => (p.riskScore || 0) >= 75).length,
                      };
                      
                      const pieData = [
                        { name: 'LOW', value: distribution.low, color: '#22C55E' },
                        { name: 'MODERATE', value: distribution.moderate, color: '#EAB308' },
                        { name: 'HIGH', value: distribution.high, color: '#F97316' },
                        { name: 'VERY HIGH', value: distribution.veryHigh, color: '#EF4444' },
                      ].filter(d => d.value > 0);
                      
                      return (
                        <div className="flex flex-col md:flex-row items-center gap-8">
                          <div className="w-64 h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={100}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="text-center -mt-36">
                              <p className="text-3xl font-bold text-gray-900">{totalAssessments}</p>
                              <p className="text-sm text-gray-500">Total</p>
                            </div>
                          </div>
                          
                          <div className="space-y-3 flex-1">
                            {pieData.map((item) => (
                              <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                                  <span className="font-medium text-gray-700">{item.name}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-gray-900">{item.value}</span>
                                  <span className="text-gray-500 text-sm ml-2">
                                    ({((item.value / totalAssessments) * 100).toFixed(0)}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <ProfilePage onBack={onViewProfile} fallbackProfile={userProfile as any} />
        )}

        {/* Patient Detail Modal */}
        {showPatientModal && selectedPatient && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedPatient.firstName && selectedPatient.lastName
                    ? `${selectedPatient.firstName} ${selectedPatient.lastName}'s Health Details`
                    : `${selectedPatient.name || 'Patient'}'s Health Details`
                  }
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      if (!selectedPatient?.userId) return;
                      try {
                        const reportData = await generatePatientReportPDF({ patientId: selectedPatient.userId as Id<"users"> });
                        generatePatientReportPDFFile(reportData, `${selectedPatient.firstName || 'Patient'}_${selectedPatient.lastName || 'Report'}_${new Date().toISOString().split('T')[0]}`, patientDetails?.diabetesStatus);
                        toast.success("Report generated successfully");
                      } catch (error: any) {
                        toast.error(error.message || "Failed to generate report");
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Generate Report
                  </button>
                  <button
                    onClick={() => {
                      setShowPatientModal(false);
                      setSelectedPatient(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {patientPredictions === undefined ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading patient data...</p>
                  </div>
                ) : (
                  <>
                    {/* Patient Summary */}
                    {(() => {
                      // Get patient's diabetes status for context-aware labels
                      const patientDiabetesStatus = patientDetails?.diabetesStatus || "none";
                      const hasDiagnosedDiabetes = patientDiabetesStatus === "type1" || patientDiabetesStatus === "type2" || 
                                                  patientDiabetesStatus === "gestational" || patientDiabetesStatus === "other";
                      const isPrediabetic = patientDiabetesStatus === "prediabetic";
                      
                      return (
                        <div className="grid grid-cols-4 gap-4 mb-6">
                          <div className="bg-blue-50 p-4 rounded-xl">
                            <p className="text-sm text-gray-600">
                              {hasDiagnosedDiabetes 
                                ? 'Complication Risk' 
                                : isPrediabetic 
                                ? 'Progression Risk' 
                                : 'Risk Score'}
                            </p>
                            <p className="text-2xl font-bold text-blue-600">
                              {(selectedPatient.latestRiskScore || selectedPatient.latestPrediction?.riskScore || patientPredictions?.[0]?.riskScore || 0).toFixed(1)}%
                            </p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-xl">
                            <p className="text-sm text-gray-600">
                              {hasDiagnosedDiabetes 
                                ? 'Complication Category' 
                                : isPrediabetic 
                                ? 'Progression Category' 
                                : 'Risk Category'}
                            </p>
                            <p className="text-lg font-semibold text-green-600">
                              {formatRiskCategory(selectedPatient.riskCategory || selectedPatient.latestPrediction?.riskCategory || patientPredictions?.[0]?.riskCategory)}
                            </p>
                          </div>
                      <div className="bg-purple-50 p-4 rounded-xl">
                        <p className="text-sm text-gray-600">Confidence</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {(selectedPatient.confidenceScore || selectedPatient.latestPrediction?.confidenceScore || patientPredictions?.[0]?.confidenceScore || 0).toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-xl">
                        <p className="text-sm text-gray-600">Assessments</p>
                        <p className="text-2xl font-bold text-amber-600">
                          {patientPredictions?.length || selectedPatient.assessmentCount || selectedPatient.totalAssessments || 0}
                        </p>
                      </div>
                    </div>
                      );
                    })()}

                    {/* Assessment History */}
                {patientPredictions && patientPredictions.length > 0 ? (
                      <>
                        <h3 className="text-lg font-semibold mb-4">Assessment History</h3>
                        <div className="space-y-3 mb-6">
                          {patientPredictions.map((pred: any, idx: number) => {
                            // Find associated medical record if available
                            // First try patientMedicalRecords (for selected patient), then analyticsMedicalRecords
                            const allRecords = patientMedicalRecords || analyticsMedicalRecords || [];
                            const associatedRecord = allRecords.find((rec: any) => {
                              // Match by timestamp (within 1 hour) or by medicalRecordId if available
                              const timeDiff = Math.abs((rec._creationTime || 0) - (pred._creationTime || 0));
                              return timeDiff < 3600000 || rec._id === pred.medicalRecordId;
                            });
                            
                            const patientName = patientDetails 
                              ? `${patientDetails.firstName} ${patientDetails.lastName}`
                              : selectedPatient 
                                ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                                : "Patient";
                            
                            return (
                            <div key={idx} className="border rounded-xl p-4">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">{formatDate(pred._creationTime || pred.timestamp)}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskBadgeColor(pred.riskCategory)}`}>
                                    {(() => {
                                      const patientDiabetesStatus = patientDetails?.diabetesStatus || "none";
                                      const hasDiagnosedDiabetes = patientDiabetesStatus === "type1" || patientDiabetesStatus === "type2" || 
                                                                  patientDiabetesStatus === "gestational" || patientDiabetesStatus === "other";
                                      const isPrediabetic = patientDiabetesStatus === "prediabetic";
                                      return `${pred.riskScore?.toFixed(1) || 'N/A'}% - ${formatRiskCategory(pred.riskCategory)} ${hasDiagnosedDiabetes ? 'Complication' : isPrediabetic ? 'Progression' : ''} Risk`;
                                    })()}
                                  </span>
                                  <button
                                    onClick={() => {
                                      try {
                                        printAssessment(
                                          pred,
                                          patientName,
                                          associatedRecord || pred.medicalRecord,
                                          patientDetails?.diabetesStatus
                                        );
                                      } catch (error: any) {
                                        toast.error(error.message || "Failed to open print dialog");
                                      }
                                    }}
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Print assessment"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              {pred.recommendations && Array.isArray(pred.recommendations) && (
                                <div className="mt-2">
                                  <p className="text-sm text-gray-500">Recommendations:</p>
                                  <ul className="text-sm text-gray-700 list-disc ml-4">
                                    {pred.recommendations.slice(0, 3).map((rec: string, i: number) => (
                                      <li key={i}>{rec}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )})}
                        </div>
                        
                        {/* Charts - Simple risk score trend */}
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-4">
                            {(() => {
                              const patientDiabetesStatus = patientDetails?.diabetesStatus || "none";
                              const hasDiagnosedDiabetes = patientDiabetesStatus === "type1" || patientDiabetesStatus === "type2" || 
                                                          patientDiabetesStatus === "gestational" || patientDiabetesStatus === "other";
                              const isPrediabetic = patientDiabetesStatus === "prediabetic";
                              return hasDiagnosedDiabetes 
                                ? 'Complication Risk Trend' 
                                : isPrediabetic 
                                ? 'Progression Risk Trend' 
                                : 'Risk Score Trend';
                            })()}
                          </h4>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart 
                                data={(() => {
                                  // Sort predictions by timestamp (oldest first) for proper chart progression
                                  const sortedPredictions = [...(patientPredictions || [])]
                                    .filter((p: any) => p.isDeleted !== true)
                                    .sort((a: any, b: any) => (a._creationTime || a.timestamp || 0) - (b._creationTime || b.timestamp || 0));
                                  
                                  return sortedPredictions.map((p: any, idx: number) => ({
                                    name: `#${idx + 1}`,
                                    riskScore: p.riskScore || 0,
                                    date: new Date(p._creationTime || p.timestamp || Date.now()).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short'
                                    }),
                                  }));
                                })()}
                                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                  formatter={(value: number) => {
                                    const patientDiabetesStatus = patientDetails?.diabetesStatus || "none";
                                    const hasDiagnosedDiabetes = patientDiabetesStatus === "type1" || patientDiabetesStatus === "type2" || 
                                                                patientDiabetesStatus === "gestational" || patientDiabetesStatus === "other";
                                    const isPrediabetic = patientDiabetesStatus === "prediabetic";
                                    return [`${value.toFixed(1)}%`, hasDiagnosedDiabetes ? 'Complication Risk' : isPrediabetic ? 'Progression Risk' : 'Risk Score'];
                                  }}
                                  labelFormatter={(label, payload) => {
                                    const data = payload?.[0]?.payload;
                                    return data?.date ? `Assessment ${label} - ${data.date}` : `Assessment ${label}`;
                                  }}
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="riskScore" 
                                  stroke="#3B82F6" 
                                  strokeWidth={2}
                                  fill="#3B82F6" 
                                  fillOpacity={0.2}
                                  dot={{ fill: '#3B82F6', r: 4 }}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No assessment data available</p>
                        <p className="text-sm text-gray-400 mt-2">This patient hasn't completed any assessments yet</p>
                  </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Patient Modal */}
        {showAddPatient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Add Patient</h3>
                  <button
                    onClick={() => setShowAddPatient(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <p className="text-gray-600">Select a patient to assign to you:</p>
                  
                  {allPatients && allPatients.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {allPatients
                        .filter(patient => !assignedPatients?.some(assigned => assigned._id === patient._id))
                        .map((patient: any) => (
                        <div
                          key={patient._id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedPatientForAssignment === patient._id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedPatientForAssignment(patient._id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                {patient.firstName} {patient.lastName}
                              </p>
                              <p className="text-sm text-gray-600">
                                Patient ID: {patient._id.slice(-6)}
                              </p>
                            </div>
                            <div className="w-4 h-4 border-2 border-gray-300 rounded-full flex items-center justify-center">
                              {selectedPatientForAssignment === patient._id && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No patients available for assignment</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 flex justify-end space-x-4">
                  <button
                    onClick={() => setShowAddPatient(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => selectedPatientForAssignment && handleAssignPatient(selectedPatientForAssignment)}
                    disabled={!selectedPatientForAssignment}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Assign Patient
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messaging Modal */}
        <Messaging
          userProfile={{
            userId: userProfile.userId,
            role: userProfile.role,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
          }}
          isOpen={isMessagingOpen}
          onOpenChange={setIsMessagingOpen}
        />
      </div>

      {/* Interactive Tutorial */}
      {showTutorial && (
        <InteractiveTutorial
          steps={doctorTutorialSteps.map((step) => ({
            ...step,
            action: step.id === "analytics-tab" ? () => setActiveTab("analytics") :
                    step.id === "patients-tab" ? () => setActiveTab("patients") :
                    step.id === "high-risk-tab" ? () => setActiveTab("high-risk") :
                    step.id === "messages-tab" ? () => setIsMessagingOpen(true) :
                    step.action,
          }))}
          onComplete={() => setShowTutorial(false)}
          onSkip={() => setShowTutorial(false)}
          role="doctor"
        />
      )}
    </div>
  );
}
