import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react";
import { exportToCSV, exportToPDF } from "../utils/exportData";
import AssessmentReminderSection from "./AssessmentReminderSection";
import { TwoFactorAuthSetup } from "./TwoFactorAuthSetup";
import { PhoneNumberInput, parsePhoneNumber } from "./PhoneNumberInput";
import {
  Loader2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Activity,
  Stethoscope,
  ArrowLeft,
  Edit3,
  User,
  Camera,
  Settings,
  Bell,
  Share2,
  Download,
  FileText,
  UserPlus,
  Trash2,
  AlertTriangle,
  Search,
  X,
  PlayCircle,
  Check,
  Clock,
  Smartphone,
  MessageSquare,
} from "lucide-react";

interface BaseProfile {
  _id: string | Id<"userProfiles">;
  userId: string | Id<"users">;
  role: "patient" | "doctor";
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: "male" | "female";
  phoneNumber?: string;
  address?: string;
  isGuest?: boolean;
  emergencyContact?: string;
  licenseNumber?: string;
  specialization?: string;
  assignedDoctorId?: string;
}

interface ProfilePageProps {
  onBack?: () => void;
  fallbackProfile?: BaseProfile;
}

// Phone number handling moved to PhoneNumberInput component

// Restart Tutorial Button Component
function RestartTutorialButton() {
  const [isResetting, setIsResetting] = useState(false);
  const resetTutorial = useMutation(api.users.resetTutorial);

  const handleRestart = async () => {
    setIsResetting(true);
    try {
      await resetTutorial({});
      toast.success("Tutorial reset! Refresh the page to see it again.");
      // Reload after a short delay to show the tutorial
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || "Failed to reset tutorial");
      setIsResetting(false);
    }
  };

  return (
    <button
      onClick={handleRestart}
      disabled={isResetting}
      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isResetting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Resetting...</span>
        </>
      ) : (
        <>
          <PlayCircle className="w-4 h-4" />
          <span>Restart Tutorial</span>
        </>
      )}
    </button>
  );
}

export function ProfilePage({ onBack, fallbackProfile }: ProfilePageProps) {
  const profileDetails = useQuery(api.users.getProfileDetails);
  const updateProfile = useMutation(api.users.createUserProfile);
  const updateAccountSettings = useMutation(api.users.updateAccountSettings);
  const exportData = useQuery(api.users.getExportData);
  const logExportAction = useMutation(api.users.logExportAction);
  const deleteAccount = useMutation(api.users.deleteAccount);
  const { signOut } = useAuthActions();
  const [isExporting, setIsExporting] = useState<"pdf" | "csv" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const updateProfileImage = useMutation(api.fileStorage.updateProfileImage);
  const removeProfileImage = useMutation(api.fileStorage.removeProfileImage);
  const generateUploadUrl = useMutation(api.fileStorage.generateUploadUrl);

  const profile = useMemo(() => profileDetails?.profile || fallbackProfile, [profileDetails, fallbackProfile]);
  
  // Note: updateAccountSettings mutation needs to be created in convex/users.ts
  // Check role from profileDetails or fallbackProfile to avoid using profile before it's defined
  const isPatient = profileDetails?.profile?.role === "patient" || fallbackProfile?.role === "patient";
  const assignmentStatus = useQuery(
    api.patientAssignments.getPatientAssignmentStatus,
    isPatient ? {} : undefined
  );
  const pendingDoctorRequests = useQuery(
    api.patientAssignments.getPendingDoctorRequests,
    isPatient ? {} : undefined
  );
  const assignDoctor = useMutation(api.patientAssignments.assignDoctor);
  const removeAssignedDoctor = useMutation(api.patientAssignments.removeAssignedDoctor);
  const acceptDoctorRequest = useMutation(api.patientAssignments.acceptDoctorRequest);
  const rejectDoctorRequest = useMutation(api.patientAssignments.rejectDoctorRequest);
  const latestPrediction = profileDetails?.latestPrediction;
  const doctorStats = profileDetails?.doctorStats;
  
  // Determine assignment status
  // assignedDoctor: active assignment
  // pendingDoctor: patient-initiated pending request (waiting for doctor to approve)
  // pendingDoctorRequests: doctor-initiated pending requests (patient can accept/reject)
  const assignedDoctor = assignmentStatus?.status === "active" ? assignmentStatus.doctor : null;
  // Only show pendingDoctor if it's a patient-initiated request
  // If assignedBy === patientId, it means the patient initiated the request
  const pendingDoctor = assignmentStatus?.status === "pending" && 
                        assignmentStatus.assignment &&
                        assignmentStatus.assignment.assignedBy === assignmentStatus.assignment.patientId
                        ? assignmentStatus.doctor : null;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emergencyContactError, setEmergencyContactError] = useState<string | null>(null);
  const [emailNotifications, setEmailNotifications] = useState(profileDetails?.profile?.emailNotifications ?? true);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState("");
  
  const twoFactorStatus = useQuery(api.twoFactorAuth.get2FAStatus);
  const disable2FA = useMutation(api.twoFactorAuth.disable2FA);
  const changeEmail = useAction(api.accountManagement.changeEmail);
  const sendVerificationEmail = useAction(api.emails.sendVerificationEmail);

  // Update local state when profileDetails changes
  useEffect(() => {
    if (profileDetails?.profile) {
      setEmailNotifications(profileDetails.profile.emailNotifications ?? true);
    }
  }, [profileDetails?.profile]);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Query for all doctors
  const allDoctors = useQuery(api.patientAssignments.getAllDoctorsForSelection);
  
  // Filter doctors by search
  const filteredDoctors = allDoctors?.filter((doc: any) => {
    const fullName = doc.name || `${doc.firstName || ''} ${doc.lastName || ''}`;
    const specialty = doc.specialty || doc.specialization || '';
    const clinic = doc.clinicName || '';
    const searchLower = doctorSearch.toLowerCase();
    return (
      fullName.toLowerCase().includes(searchLower) ||
      specialty.toLowerCase().includes(searchLower) ||
      clinic.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Parse phone numbers to extract country code and number
  const parsedPhone = useMemo(() => {
    if (profile?.phoneNumber) {
      return parsePhoneNumber(profile.phoneNumber);
    }
    return { countryCode: "OM" as const, phoneNumber: "" };
  }, [profile?.phoneNumber]);

  const parsedEmergencyContact = useMemo(() => {
    if (profile?.emergencyContact) {
      return parsePhoneNumber(profile.emergencyContact);
    }
    return { countryCode: "OM" as const, phoneNumber: "" };
  }, [profile?.emergencyContact]);

  const [phoneCountryCode, setPhoneCountryCode] = useState<"OM" | "AE">(parsedPhone?.countryCode || "OM");
  const [emergencyContactCountryCode, setEmergencyContactCountryCode] = useState<"OM" | "AE">(parsedEmergencyContact?.countryCode || "OM");

  const [formState, setFormState] = useState({
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    gender: (profile?.gender as "male" | "female") ?? "male",
    dateOfBirth: profile?.dateOfBirth ?? "",
    phoneNumber: parsedPhone?.phoneNumber ?? "",
    address: profile?.address ?? "",
    emergencyContact: parsedEmergencyContact?.phoneNumber ?? "",
    licenseNumber: profile?.licenseNumber ?? "",
    specialization: profile?.specialization ?? "",
    diabetesStatus: (profile?.diabetesStatus as "none" | "prediabetic" | "type1" | "type2" | "gestational" | "other") ?? "none",
    diabetesDiagnosisDate: profile?.diabetesDiagnosisDate 
      ? new Date(profile.diabetesDiagnosisDate).toISOString().split('T')[0] 
      : "",
  });

  useEffect(() => {
    if (profile && !isEditing) {
      const parsedPhone = parsePhoneNumber(profile.phoneNumber || "");
      const parsedEmergency = parsePhoneNumber(profile.emergencyContact || "");
      
      setFormState({
        firstName: profile.firstName,
        lastName: profile.lastName,
        gender: (profile.gender as "male" | "female") || "male",
        dateOfBirth: profile.dateOfBirth || "",
        phoneNumber: parsedPhone?.phoneNumber || "",
        address: profile.address || "",
        emergencyContact: parsedEmergency?.phoneNumber || "",
        licenseNumber: profile.licenseNumber || "",
        specialization: profile.specialization || "",
        diabetesStatus: (profile.diabetesStatus as any) || "none",
        diabetesDiagnosisDate: profile.diabetesDiagnosisDate 
          ? new Date(profile.diabetesDiagnosisDate).toISOString().split('T')[0] 
          : "",
      });
      setPhoneCountryCode(parsedPhone?.countryCode || "OM");
      setEmergencyContactCountryCode(parsedEmergency?.countryCode || "OM");
      setPhoneError(null);
      setEmergencyContactError(null);
    }
  }, [profile, isEditing]);

  // Phone validation is handled by PhoneNumberInput component

  const resetEditingState = () => {
    setIsEditing(false);
    if (profile) {
      const parsedPhone = parsePhoneNumber(profile.phoneNumber || "");
      const parsedEmergency = parsePhoneNumber(profile.emergencyContact || "");
      
      setFormState({
        firstName: profile.firstName,
        lastName: profile.lastName,
        gender: (profile.gender as "male" | "female") || "male",
        dateOfBirth: profile.dateOfBirth || "",
        phoneNumber: parsedPhone?.phoneNumber || "",
        address: profile.address || "",
        emergencyContact: parsedEmergency?.phoneNumber || "",
        licenseNumber: profile.licenseNumber || "",
        specialization: profile.specialization || "",
        diabetesStatus: (profile.diabetesStatus as any) || "none",
        diabetesDiagnosisDate: profile.diabetesDiagnosisDate 
          ? new Date(profile.diabetesDiagnosisDate).toISOString().split('T')[0] 
          : "",
      });
      setPhoneCountryCode(parsedPhone?.countryCode || "OM");
      setEmergencyContactCountryCode(parsedEmergency?.countryCode || "OM");
    }
    setPhoneError(null);
    setEmergencyContactError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      return;
    }

    if (!formState.firstName.trim() || !formState.lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    // Phone validation is handled by PhoneNumberInput component
    if (!formState.phoneNumber) {
      setPhoneError("Phone number is required");
      toast.error("Please provide a valid phone number");
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        role: profile.role,
        firstName: formState.firstName.trim(),
        lastName: formState.lastName.trim(),
        dateOfBirth: formState.dateOfBirth || undefined,
        gender: formState.gender as "male" | "female",
        phoneNumber: formState.phoneNumber,
        phoneCountryCode,
        address: formState.address || undefined,
        licenseNumber: profile.role === "doctor" ? formState.licenseNumber || undefined : undefined,
        specialization: profile.role === "doctor" ? formState.specialization || undefined : undefined,
        assignedDoctorId: profile.role === "patient" ? (profile.assignedDoctorId as any) : undefined,
        emergencyContact:
          profile.role === "patient" ? formState.emergencyContact || undefined : undefined,
        emergencyContactCountryCode:
          profile.role === "patient" ? emergencyContactCountryCode : undefined,
        diabetesStatus: profile.role === "patient" ? formState.diabetesStatus : undefined,
        diabetesDiagnosisDate: profile.role === "patient" && formState.diabetesStatus !== "none" && formState.diabetesDiagnosisDate
          ? new Date(formState.diabetesDiagnosisDate).getTime()
          : undefined,
      });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (!profileDetails && !fallbackProfile) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile not found</h2>
        <p className="text-gray-600">We couldn't load your profile information.</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        )}
      </div>
    );
  }

  const fullName = `${profile.firstName} ${profile.lastName}`;
  const roleLabel = profile.isGuest ? "Guest User" : (profile.role === "patient" ? "Patient" : "Doctor");
  const assignedDoctorLabel =
    profile.role === "patient"
      ? profileDetails?.assignedDoctor
        ? `Dr. ${profileDetails.assignedDoctor.firstName} ${profileDetails.assignedDoctor.lastName}`
        : "Not assigned"
      : null;

  const riskBadgeClasses = {
    low: "text-green-700 bg-green-50",
    moderate: "text-yellow-700 bg-yellow-50",
    high: "text-orange-700 bg-orange-50",
    very_high: "text-red-700 bg-red-50",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Professional Medical Header */}
      <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 overflow-hidden shadow-lg">
        {/* Subtle decorative pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full translate-y-1/2 -translate-x-1/4" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Profile Image - Professional Style */}
            <div className="relative group">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-2xl shadow-xl border-4 border-white/20 overflow-hidden transform hover:scale-105 transition-transform duration-300">
                {profileDetails?.profile?.profileImageUrl ? (
                  <img src={profileDetails.profile.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span className="text-6xl md:text-7xl font-bold text-white">{fullName.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <label className="absolute inset-0 bg-blue-900/80 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-300 backdrop-blur-sm">
                <Camera className="w-8 h-8 text-white" />
                <span className="text-sm font-semibold text-white">Change Photo</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden"
                  disabled={isUploadingImage}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Image must be less than 5MB");
                      return;
                    }
                    
                    setIsUploadingImage(true);
                    try {
                      const uploadUrl = await generateUploadUrl();
                      const result = await fetch(uploadUrl, {
                        method: "POST",
                        headers: { "Content-Type": file.type },
                        body: file,
                      });
                      const { storageId } = await result.json();
                      await updateProfileImage({ storageId: storageId as any });
                      toast.success("Profile image updated");
                    } catch (error) {
                      toast.error("Failed to upload image");
                      console.error(error);
                    } finally {
                      setIsUploadingImage(false);
                    }
                  }}
                />
              </label>
            </div>
            
            {/* User Info - Professional Style */}
            <div className="flex-1 text-center md:text-left">
              <div className="mb-4">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {fullName}
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-3 text-white/90">
                  <Mail className="w-5 h-5" />
                  <span className="text-lg font-medium">{profileDetails?.user?.email || ''}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <span className="px-5 py-2 bg-white/20 backdrop-blur-sm text-white font-semibold text-sm rounded-full shadow-lg">
                  {roleLabel}
                </span>
                {profile?.gender && (
                  <span className="px-5 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium text-sm rounded-full">
                    {profile.gender}
                  </span>
                )}
              </div>
            </div>
            
            {/* Actions - Professional Style */}
            <div className="flex flex-col gap-3">
              {onBack && (
                <button 
                  onClick={onBack}
                  className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold text-sm rounded-xl hover:bg-white/20 transition-all duration-200 shadow-lg"
                >
                  <ArrowLeft className="w-4 h-4 inline mr-2" />
                  Dashboard
                </button>
              )}
              <button
                onClick={() => (isEditing ? resetEditingState() : setIsEditing(true))}
                className="px-6 py-3 bg-white text-blue-600 font-semibold text-sm rounded-xl hover:bg-blue-50 border-2 border-white transition-all duration-200 shadow-lg transform hover:scale-105"
              >
                <Edit3 className="w-4 h-4 inline mr-2" />
                {isEditing ? "Cancel" : "Edit Profile"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

      {isEditing && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <div className="mb-6 pb-4 border-b-2 border-gray-200">
            <h2 className="text-3xl font-bold text-gray-900">Edit Profile</h2>
          </div>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  value={formState.firstName}
                  onChange={(e) => setFormState((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                  required
                />
              </div>
              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  value={formState.lastName}
                  onChange={(e) => setFormState((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={formState.dateOfBirth}
                  onChange={(e) => setFormState((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Gender</label>
                <select
                  value={formState.gender}
                  onChange={(e) => setFormState((prev) => ({ ...prev, gender: e.target.value as "male" | "female" }))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <PhoneNumberInput
                value={formState.phoneNumber}
                onChange={(value) => {
                  setFormState((prev) => ({ ...prev, phoneNumber: value }));
                  setPhoneError(null);
                }}
                onCountryChange={(country) => {
                  setPhoneCountryCode(country);
                  setFormState((prev) => ({ ...prev, phoneNumber: "" }));
                  setPhoneError(null);
                }}
                error={phoneError}
                label="Phone Number"
                required
              />
              {profile.role === "patient" && (
                <>
                  <PhoneNumberInput
                    value={formState.emergencyContact}
                    onChange={(value) => {
                      setFormState((prev) => ({ ...prev, emergencyContact: value }));
                      setEmergencyContactError(null);
                    }}
                    onCountryChange={(country) => {
                      setEmergencyContactCountryCode(country);
                      setFormState((prev) => ({ ...prev, emergencyContact: "" }));
                      setEmergencyContactError(null);
                    }}
                    error={emergencyContactError}
                    label="Emergency Contact Phone"
                    required={false}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Diabetes Status
                    </label>
                    <select
                      value={formState.diabetesStatus}
                      onChange={(e) => setFormState((prev) => ({ ...prev, diabetesStatus: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="none">No Diabetes (Risk Assessment)</option>
                      <option value="prediabetic">Pre-diabetes</option>
                      <option value="type1">Type 1 Diabetes</option>
                      <option value="type2">Type 2 Diabetes</option>
                      <option value="gestational">Gestational Diabetes</option>
                      <option value="other">Other</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      This helps us provide appropriate recommendations and management tools.
                    </p>
                  </div>
                  {formState.diabetesStatus !== "none" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Diagnosis Date
                      </label>
                      <input
                        type="date"
                        value={formState.diabetesDiagnosisDate}
                        onChange={(e) => setFormState((prev) => ({ ...prev, diabetesDiagnosisDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        When were you diagnosed? (Optional)
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                rows={3}
                value={formState.address}
                onChange={(e) => setFormState((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Street, city, region"
              />
            </div>

            {profile.role === "doctor" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    License Number
                  </label>
                  <input
                    type="text"
                    value={formState.licenseNumber}
                    onChange={(e) => setFormState((prev) => ({ ...prev, licenseNumber: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-white border-2 border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={formState.specialization}
                    onChange={(e) => setFormState((prev) => ({ ...prev, specialization: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-white border-2 border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                    placeholder="e.g., Endocrinology"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4 border-t-2 border-gray-200">
              <button
                type="button"
                onClick={resetEditingState}
                className="px-6 py-3 bg-gray-100 border-2 border-gray-300 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-200 transition-all duration-200"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-8 py-3 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Info cards grid - Professional Medical Style */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 transform hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Phone className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-xl">Contact</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <Phone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Primary Phone</p>
                <p className="text-gray-600">{profile.phoneNumber || "Not provided"}</p>
              </div>
            </div>
            {profile.role === "patient" && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">Emergency Contact</p>
                  <p className="text-gray-600">{profile.emergencyContact || "Not provided"}</p>
                </div>
              </div>
            )}
            {profileDetails?.user?.email && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">Email</p>
                  <p className="text-gray-600">{profileDetails.user.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Address</p>
                <p className="text-gray-600">{profile.address || "Not provided"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 transform hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-200">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-xl">Account</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <Calendar className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Member Since</p>
                <p className="text-gray-600">
                  {profileDetails?.user?._creationTime
                    ? new Date(profileDetails.user._creationTime).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Role</p>
                <p className="text-gray-600 capitalize">{roleLabel}</p>
              </div>
            </div>
          </div>
        </div>

        {profile.role === "patient" && (
          <>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 transform hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-200">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-xl">Medical</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <Calendar className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">Date of Birth</p>
                    <p className="text-gray-600">{profile.dateOfBirth || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">Gender</p>
                    <p className="text-gray-600 capitalize">{profile.gender ? profile.gender : "Not set"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <Stethoscope className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">Diabetes Status</p>
                    <p className="text-gray-600">
                      {profile.diabetesStatus 
                        ? profile.diabetesStatus === "none" 
                          ? "No Diabetes (Risk Assessment)" 
                          : profile.diabetesStatus === "prediabetic"
                          ? "Pre-diabetes"
                          : profile.diabetesStatus === "type1"
                          ? "Type 1 Diabetes"
                          : profile.diabetesStatus === "type2"
                          ? "Type 2 Diabetes"
                          : profile.diabetesStatus === "gestational"
                          ? "Gestational Diabetes"
                          : "Other"
                        : "Not set"}
                    </p>
                  </div>
                </div>
                {profile.diabetesDiagnosisDate && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <Calendar className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm mb-1">Diagnosis Date</p>
                      <p className="text-gray-600">{new Date(profile.diabetesDiagnosisDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <Stethoscope className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">Assigned Doctor</p>
                    <p className="text-gray-600">{assignedDoctorLabel}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <Activity className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">Latest Assessment</p>
                    {latestPrediction ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-600">
                          {latestPrediction.riskScore.toFixed(1)}% •{" "}
                          {new Date(latestPrediction._creationTime).toLocaleDateString()}
                        </span>
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${riskBadgeClasses[latestPrediction.riskCategory as keyof typeof riskBadgeClasses] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {latestPrediction.riskCategory.replace("_", " ")}
                        </span>
                      </div>
                    ) : (
                      <p className="text-gray-600">No assessments recorded yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {profile.role === "doctor" && (
          <>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 transform hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-200">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-xl">Professional</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <Stethoscope className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">Specialization</p>
                    <p className="text-gray-600">{profile.specialization || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">License Number</p>
                    <p className="text-gray-600">{profile.licenseNumber || "Not provided"}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 transform hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-200">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-xl">Practice</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 transform hover:scale-105 transition-transform shadow-lg">
                  <p className="text-sm font-semibold text-white/90 mb-2">Active Patients</p>
                  <p className="text-4xl font-bold text-white">
                    {doctorStats?.activePatients ?? 0}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 transform hover:scale-105 transition-transform shadow-lg">
                  <p className="text-sm font-semibold text-white/90 mb-2">High Risk</p>
                  <p className="text-4xl font-bold text-white">
                    {doctorStats?.highRiskPatients ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Healthcare Provider Section (for patients) - Professional Style */}
      {profile.role === "patient" && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Stethoscope className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 text-2xl">Healthcare Provider</h3>
            </div>
            <button
              onClick={() => {
                console.log('Opening doctor modal');
                setShowDoctorModal(true);
              }}
              className="px-6 py-3 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!!pendingDoctor}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              {assignedDoctor ? 'Change Doctor' : pendingDoctor ? 'Request Pending' : 'Assign Doctor'}
            </button>
          </div>
          
          {assignedDoctor ? (
            <div className="flex items-center gap-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 transform hover:scale-[1.02] transition-transform">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {assignedDoctor.firstName?.charAt(0) || 'D'}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-xl mb-2">Dr. {assignedDoctor.firstName} {assignedDoctor.lastName}</p>
                <p className="text-gray-700 font-medium mb-1">{assignedDoctor.specialization || assignedDoctor.specialty || 'General Practice'}</p>
                {assignedDoctor.clinicName && (
                  <p className="text-gray-500 text-sm">{assignedDoctor.clinicName}</p>
                )}
              </div>
              <button
                onClick={async () => {
                  if (confirm('Remove this doctor?')) {
                    try {
                      await removeAssignedDoctor({});
                      toast.success("Doctor removed");
                    } catch (error) {
                      toast.error("Failed to remove doctor");
                    }
                  }
                }}
                className="p-3 bg-red-500 rounded-xl text-white hover:bg-red-600 transition-all duration-200 transform hover:scale-110 shadow-lg"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ) : pendingDoctor ? (
            <div className="flex items-center gap-6 p-6 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border-2 border-amber-200 transform hover:scale-[1.02] transition-transform">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {pendingDoctor.firstName?.charAt(0) || 'D'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="font-bold text-gray-900 text-xl">Dr. {pendingDoctor.firstName} {pendingDoctor.lastName}</p>
                  <span className="px-3 py-1 bg-amber-400 text-white rounded-full font-semibold text-xs">
                    Pending
                  </span>
                </div>
                <p className="text-gray-700 font-medium mb-1">{pendingDoctor.specialization || pendingDoctor.specialty || 'General Practice'}</p>
                {pendingDoctor.clinicName && (
                  <p className="text-gray-500 text-sm">{pendingDoctor.clinicName}</p>
                )}
                <p className="text-amber-700 font-semibold text-sm mt-3">
                  Waiting for doctor to accept your request...
                </p>
              </div>
            </div>
          ) : pendingDoctorRequests && pendingDoctorRequests.length > 0 ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border-2 border-amber-200 p-6">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b-2 border-amber-300">
                  <Clock className="w-6 h-6 text-amber-600" />
                  <h4 className="font-bold text-gray-900 text-xl">Pending Requests</h4>
                  <span className="px-4 py-1 bg-amber-400 text-white rounded-full font-semibold text-xs">
                    {pendingDoctorRequests.length}
                  </span>
                </div>
                <p className="text-gray-700 font-medium mb-6">
                  You have {pendingDoctorRequests.length} doctor request{pendingDoctorRequests.length > 1 ? 's' : ''} waiting for your response.
                </p>
                <div className="space-y-4">
                  {pendingDoctorRequests.map((request: any) => (
                    <div key={request.assignment._id} className="bg-white rounded-xl border-2 border-gray-200 p-6 transform hover:shadow-lg transition-all">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                          <Stethoscope className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-lg mb-1">
                            Dr. {request.doctor.firstName} {request.doctor.lastName}
                          </p>
                          <p className="text-gray-700 font-medium">
                            {request.doctor.specialization || request.doctor.specialty || 'General Practice'}
                          </p>
                          {request.doctor.clinicName && (
                            <p className="text-gray-500 text-sm">{request.doctor.clinicName}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-800 font-medium mb-4">
                        Dr. {request.doctor.firstName} {request.doctor.lastName} wants to be your healthcare provider.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={async () => {
                            try {
                              await acceptDoctorRequest({ assignmentId: request.assignment._id });
                              toast.success("Doctor request accepted successfully");
                            } catch (error: any) {
                              toast.error(error.message || "Failed to accept request");
                            }
                          }}
                          className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold text-sm rounded-xl hover:bg-green-700 transition-all transform hover:scale-105 shadow-lg"
                        >
                          <Check className="w-4 h-4 inline mr-2" />
                          Accept
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to reject Dr. ${request.doctor.firstName} ${request.doctor.lastName}'s request?`)) {
                              try {
                                await rejectDoctorRequest({ assignmentId: request.assignment._id });
                                toast.success("Request rejected");
                              } catch (error: any) {
                                toast.error(error.message || "Failed to reject request");
                              }
                            }
                          }}
                          className="flex-1 px-6 py-3 bg-red-500 text-white font-semibold text-sm rounded-xl hover:bg-red-600 transition-all transform hover:scale-105 shadow-lg"
                        >
                          <X className="w-4 h-4 inline mr-2" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-700 font-bold text-xl mb-2">No Doctor Assigned</p>
              <p className="text-gray-500 font-medium">Click "Assign Doctor" to connect with a healthcare provider</p>
            </div>
          )}
        </div>
      )}

      {/* Tutorial Settings - Professional Style */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 transform hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-gray-200">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <PlayCircle className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-xl">Interactive Tutorial</h3>
        </div>
        <p className="text-gray-600 font-medium mb-6">
          Restart the interactive tutorial to learn how to use the dashboard features.
        </p>
        <RestartTutorialButton />
      </div>

      {/* Account Settings - Professional Style */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b-2 border-gray-200">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-bold text-gray-900 text-2xl">Account Settings</h3>
        </div>
        <div className="space-y-6">
          {/* Email Notifications Toggle - Professional Style */}
          <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-100 transform hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <Bell className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg mb-1">Email Notifications</p>
                <p className="text-gray-600 font-medium text-sm">Receive health tips and reminders</p>
              </div>
            </div>
            <button
              onClick={async () => {
                const newValue = !emailNotifications;
                setEmailNotifications(newValue);
                try {
                  await updateAccountSettings({ emailNotifications: newValue });
                  toast.success("Email notification settings updated");
                } catch (error: any) {
                  setEmailNotifications(!newValue);
                  toast.error(error.message || "Failed to update settings");
                }
              }}
              className={`relative w-16 h-9 rounded-full transition-all duration-200 ${
                emailNotifications ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-8 h-8 bg-white rounded-full shadow-md transition-transform duration-200 ${
                emailNotifications ? 'translate-x-7' : 'translate-x-0'
              }`} />
            </button>
          </div>
          
          {/* Two-Factor Authentication - Professional Style */}
          <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border-2 border-purple-100 transform hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                twoFactorStatus?.enabled ? 'bg-green-500' : 'bg-purple-500'
              }`}>
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg mb-1">Two-Factor Authentication</p>
                <p className="text-gray-600 font-medium text-sm">
                  {twoFactorStatus?.enabled
                    ? `Enabled via ${twoFactorStatus.method === "totp" ? "Authenticator App" : "SMS"}`
                    : "Add an extra layer of security to your account"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {twoFactorStatus?.enabled && (
                <span className="px-4 py-2 bg-green-500 text-white rounded-full font-semibold text-xs">
                  Active
                </span>
              )}
              {twoFactorStatus?.enabled ? (
                <button
                  onClick={async () => {
                    if (confirm("Are you sure you want to disable two-factor authentication? This will make your account less secure.")) {
                      try {
                        await disable2FA({ password: "" });
                        toast.success("2FA disabled successfully");
                      } catch (error: any) {
                        toast.error(error.message || "Failed to disable 2FA");
                      }
                    }
                  }}
                  className="px-6 py-3 bg-red-500 text-white font-semibold text-sm rounded-xl hover:bg-red-600 transition-all"
                >
                  Disable
                </button>
              ) : (
                <button
                  onClick={() => setShow2FASetup(true)}
                  className="px-6 py-3 bg-purple-600 text-white font-semibold text-sm rounded-xl hover:bg-purple-700 transition-all transform hover:scale-105 shadow-lg"
                >
                  Enable
                </button>
              )}
            </div>
          </div>

          {/* Change Email - Professional Style */}
          <div className="flex items-center justify-between p-6 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border-2 border-cyan-100 transform hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <Mail className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg mb-1">Email Address</p>
                <p className="text-gray-600 font-medium text-sm">{profileDetails?.user?.email || "Not set"}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowChangeEmail(true);
                setNewEmail("");
                setEmailVerificationCode("");
                setEmailChangeError("");
              }}
              className="px-6 py-3 bg-cyan-500 text-white font-semibold text-sm rounded-xl hover:bg-cyan-600 transition-all transform hover:scale-105 shadow-lg"
            >
              Change
            </button>
          </div>

        </div>
      </div>

      {/* 2FA Setup Modal */}
      {show2FASetup && (
        <TwoFactorAuthSetup
          onClose={() => setShow2FASetup(false)}
          onComplete={() => {
            setShow2FASetup(false);
            // Status will update automatically via query
          }}
        />
      )}

      {/* Change Email Modal */}
      {showChangeEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Change Email Address</h3>
              <button
                onClick={() => {
                  setShowChangeEmail(false);
                  setNewEmail("");
                  setEmailVerificationCode("");
                  setEmailChangeError("");
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setEmailChangeError("");
                  }}
                  placeholder="Enter new email address"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                />
              </div>

              {newEmail && newEmail.includes("@") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={emailVerificationCode}
                      onChange={(e) => {
                        setEmailVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setEmailChangeError("");
                      }}
                      placeholder="Enter 6-digit code"
                      className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                    />
                    <button
                      onClick={async () => {
                        if (!newEmail || !newEmail.includes("@")) {
                          setEmailChangeError("Please enter a valid email address");
                          return;
                        }
                        try {
                          await sendVerificationEmail({ email: newEmail });
                          toast.success("Verification code sent to your new email address");
                        } catch (error: any) {
                          setEmailChangeError(error.message || "Failed to send verification code");
                        }
                      }}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px] touch-manipulation"
                    >
                      Send Code
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    We'll send a verification code to your new email address
                  </p>
                </div>
              )}

              {emailChangeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{emailChangeError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowChangeEmail(false);
                    setNewEmail("");
                    setEmailVerificationCode("");
                    setEmailChangeError("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors min-h-[44px] touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newEmail || !newEmail.includes("@")) {
                      setEmailChangeError("Please enter a valid email address");
                      return;
                    }
                    if (!emailVerificationCode || emailVerificationCode.length !== 6) {
                      setEmailChangeError("Please enter the 6-digit verification code");
                      return;
                    }

                    setIsChangingEmail(true);
                    setEmailChangeError("");

                    try {
                      const result = await changeEmail({
                        newEmail: newEmail.trim(),
                        verificationCode: emailVerificationCode,
                      });

                      if (result.success) {
                        toast.success("Email address changed successfully! Please verify your new email.");
                        setShowChangeEmail(false);
                        setNewEmail("");
                        setEmailVerificationCode("");
                        // Reload to get updated email
                        setTimeout(() => window.location.reload(), 1500);
                      } else {
                        setEmailChangeError(result.error || "Failed to change email address");
                      }
                    } catch (error: any) {
                      setEmailChangeError(error.message || "Failed to change email address");
                    } finally {
                      setIsChangingEmail(false);
                    }
                  }}
                  disabled={isChangingEmail || !newEmail || !emailVerificationCode || emailVerificationCode.length !== 6}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation flex items-center justify-center gap-2"
                >
                  {isChangingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    "Change Email"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Assessment Reminders (for patients) */}
      {profile.role === "patient" && (
        <AssessmentReminderSection />
      )}

      {/* Account Information - Professional Style */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 transform hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-gray-200">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-xl">Account Information</h3>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-4 border-b-2 border-gray-200">
            <span className="text-sm font-semibold text-gray-700">Account Type</span>
            <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full font-semibold text-sm">{profile.isGuest ? 'Guest User' : (profile.role === 'doctor' ? 'Healthcare Provider' : 'Patient')}</span>
          </div>
          <div className="flex justify-between items-center py-4 border-b-2 border-gray-200">
            <span className="text-sm font-semibold text-gray-700">Account Status</span>
            <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full font-semibold text-sm">Active</span>
          </div>
          <div className="flex justify-between items-center py-4">
            <span className="text-sm font-semibold text-gray-700">Member Since</span>
            <span className="text-sm font-semibold text-gray-900">
              {profileDetails?.user?._creationTime ? new Date(profileDetails.user._creationTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Export Data - Only for patients - Professional Style */}
      {isPatient && (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 transform hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-gray-200">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Download className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-xl">Export Your Data</h3>
        </div>
        <p className="text-gray-600 font-medium mb-6">Download your health data for your records</p>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={async () => {
              if (!exportData) {
                toast.error("Loading data... Please try again in a moment.");
                return;
              }
              setIsExporting("pdf");
              try {
                await exportToPDF(exportData, profileDetails?.profile?.diabetesStatus);
                await logExportAction({ exportType: "pdf" });
                toast.success("PDF exported successfully!");
              } catch (error: any) {
                console.error("PDF export error:", error);
                toast.error(error.message || "Failed to export PDF. Please try again.");
              } finally {
                setIsExporting(null);
              }
            }}
            disabled={isExporting !== null || !exportData}
            className="flex items-center gap-3 px-6 py-3 bg-red-500 text-white font-semibold text-sm rounded-xl hover:bg-red-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isExporting === "pdf" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Export PDF
              </>
            )}
          </button>
          <button 
            onClick={async () => {
              if (!exportData) {
                toast.error("Loading data... Please try again in a moment.");
                return;
              }
              setIsExporting("csv");
              try {
                exportToCSV(exportData, profileDetails?.profile?.diabetesStatus);
                await logExportAction({ exportType: "csv" });
                toast.success("CSV exported successfully!");
              } catch (error: any) {
                console.error("CSV export error:", error);
                toast.error(error.message || "Failed to export CSV. Please try again.");
              } finally {
                setIsExporting(null);
              }
            }}
            disabled={isExporting !== null || !exportData}
            className="flex items-center gap-3 px-6 py-3 bg-green-500 text-white font-semibold text-sm rounded-xl hover:bg-green-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isExporting === "csv" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Export CSV
              </>
            )}
          </button>
        </div>
      </div>
      )}

      {/* Danger Zone - Delete Account - Professional Style */}
      <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl shadow-lg border-2 border-red-200 p-8">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-red-300">
          <div className="w-16 h-16 bg-red-500 rounded-xl flex items-center justify-center shadow-lg">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-bold text-red-700 text-2xl">Danger Zone</h3>
        </div>
        <p className="text-gray-700 font-medium mb-6">Permanently delete your account and all associated data</p>
        <div>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="flex items-center gap-3 px-8 py-4 bg-red-500 text-white font-semibold text-sm rounded-xl hover:bg-red-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Account
              </>
            )}
          </button>
        </div>

        {/* Delete Account Confirmation Modal */}
        {showDeleteConfirm && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDeleteConfirm(false);
                setDeleteConfirmEmail('');
                setDeleteError('');
              }
            }}
          >
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
              {/* Modal Header */}
              <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-white" />
                  <h3 className="text-lg font-semibold text-white">Delete Account</h3>
                </div>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmEmail('');
                    setDeleteError('');
                  }}
                  className="text-white/80 hover:text-white"
                  disabled={isDeleting}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800 text-sm font-medium mb-2">
                    This action cannot be undone!
                  </p>
                  <p className="text-red-700 text-sm mb-2">
                    This will permanently delete:
                  </p>
                  <ul className="text-red-700 text-sm space-y-1 list-disc list-inside">
                    <li>Your profile and personal information</li>
                    {profile?.role === "patient" ? (
                      <>
                        <li>All health assessments and predictions</li>
                        <li>All medical records</li>
                        <li>Doctor-patient connections</li>
                      </>
                    ) : (
                      <>
                        <li>All predictions you created</li>
                        <li>All patient assignments</li>
                      </>
                    )}
                  </ul>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800">{profileDetails?.user?.email || 'your email'}</span> to confirm:
                  </label>
                  <input
                    type="email"
                    value={deleteConfirmEmail}
                    onChange={(e) => {
                      setDeleteConfirmEmail(e.target.value);
                      setDeleteError('');
                    }}
                    placeholder={profileDetails?.user?.email || "Enter your email"}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    disabled={isDeleting}
                    autoComplete="off"
                  />
                </div>
                
                {deleteError && (
                  <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm mb-4">
                    {deleteError}
                  </div>
                )}
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmEmail('');
                      setDeleteError('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setDeleteError('');
                      
                      const trimmedEmail = deleteConfirmEmail.trim();
                      
                      if (!trimmedEmail) {
                        setDeleteError('Please enter your email address');
                        return;
                      }
                      
                      const userEmail = profileDetails?.user?.email;
                      if (!userEmail) {
                        setDeleteError('Unable to retrieve your email. Please refresh the page and try again.');
                        return;
                      }
                      
                      // Client-side validation (case-insensitive, trimmed)
                      if (trimmedEmail.toLowerCase() !== userEmail.toLowerCase()) {
                        setDeleteError(`Email does not match. Please enter: ${userEmail}`);
                        return;
                      }
                      
                      setIsDeleting(true);
                      try {
                        // Trim the email before sending to backend
                        await deleteAccount({ confirmEmail: trimmedEmail });
                        toast.success("Account deleted successfully");
                        // Sign out the user
                        setTimeout(() => {
                          signOut();
                        }, 1000);
                      } catch (error: any) {
                        console.error("Delete account error:", error);
                        setDeleteError(error.message || "Failed to delete account. Please try again.");
                        setIsDeleting(false);
                      }
                    }}
                    disabled={
                      isDeleting || 
                      !deleteConfirmEmail.trim() ||
                      deleteConfirmEmail.trim().toLowerCase() !== profileDetails?.user?.email?.toLowerCase()
                    }
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Forever
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== DOCTOR SELECTION MODAL - Persona 5 Style ===== */}
      {showDoctorModal && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDoctorModal(false);
            }
          }}
        >
          <div className="bg-white border-4 border-black w-full max-w-lg max-h-[85vh] flex flex-col shadow-[12px_12px_0_0_#E60012]">
            {/* Modal Header - Persona 5 Style */}
            <div className="p-6 border-b-4 border-black bg-[#E60012] text-white flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-xl uppercase tracking-wider flex items-center gap-3">
                  <UserPlus className="w-6 h-6" />
                  Select Healthcare Provider
                </h3>
                <button
                  onClick={() => setShowDoctorModal(false)}
                  className="p-2 bg-black border-2 border-white hover:bg-white hover:text-black transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Search Input - Persona 5 Style */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                <input
                  type="text"
                  placeholder="Search by name or specialty..."
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-black/30 border-4 border-white text-white placeholder-white/50 focus:outline-none focus:bg-black/50 focus:border-white font-semibold"
                />
              </div>
            </div>
            
            {/* Modal Body - Doctor List - Persona 5 Style */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 bg-white">
              {filteredDoctors.length === 0 ? (
                <div className="text-center py-12">
                  <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-700 font-black text-lg uppercase tracking-wider">No Doctors Found</p>
                  <p className="text-gray-500 font-semibold text-sm mt-2">
                    {doctorSearch ? 'Try a different search term' : 'No doctors available in the system'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDoctors.map((doctor: any) => (
                    <div 
                      key={doctor._id}
                      className="p-5 border-4 border-black bg-white hover:shadow-[6px_6px_0_0_#E60012] transition-all duration-200 transform hover:-translate-y-1"
                    >
                      <div className="flex items-center gap-4">
                        {/* Doctor Avatar - Persona 5 Style */}
                        <div className="w-16 h-16 bg-[#E60012] border-4 border-black flex items-center justify-center text-white font-black text-xl transform rotate-[-5deg] flex-shrink-0">
                          {doctor.profileImageUrl ? (
                            <img 
                              src={doctor.profileImageUrl} 
                              alt={doctor.name || 'Doctor'} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            doctor.name?.charAt(0)?.toUpperCase() || doctor.firstName?.charAt(0)?.toUpperCase() || 'D'
                          )}
                        </div>
                        
                        {/* Doctor Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-black text-lg uppercase tracking-wider mb-1">
                            Dr. {doctor.name || `${doctor.firstName} ${doctor.lastName}`}
                          </h4>
                          <p className="text-[#E60012] font-bold text-sm">
                            {doctor.specialty || doctor.specialization || 'General Practice'}
                          </p>
                          {doctor.clinicName && (
                            <p className="text-gray-600 font-semibold text-sm truncate">{doctor.clinicName}</p>
                          )}
                        </div>
                        
                        {/* Select Button - Persona 5 Style */}
                        <button
                          onClick={async () => {
                            setIsAssigning(true);
                            try {
                              const doctorUserId = doctor.userId;
                              if (!doctorUserId) {
                                throw new Error("Invalid doctor ID");
                              }
                              const result = await assignDoctor({ doctorId: doctorUserId as Id<"users"> });
                              setShowDoctorModal(false);
                              setDoctorSearch('');
                              if (result?.status === "pending") {
                                toast.success("Request sent! The doctor will be notified and can accept or reject your request.");
                              } else {
                                toast.success("Doctor assigned successfully");
                              }
                            } catch (error: any) {
                              console.error('Failed to assign doctor:', error);
                              const errorMessage = error.message || 'Failed to assign doctor. Please try again.';
                              if (errorMessage.includes('already have a pending request')) {
                                toast.error('You already have a pending request with this doctor. Please wait for their response.');
                              } else {
                                toast.error(errorMessage);
                              }
                            } finally {
                              setIsAssigning(false);
                            }
                          }}
                          disabled={isAssigning}
                          className="px-6 py-3 bg-[#E60012] border-4 border-black text-white font-black text-sm uppercase tracking-wider hover:bg-black hover:border-[#E60012] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          {isAssigning ? (
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Assigning...
                            </span>
                          ) : (
                            'Select'
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Modal Footer - Persona 5 Style */}
            <div className="p-4 border-t-4 border-black bg-black flex-shrink-0">
              <button
                onClick={() => {
                  setShowDoctorModal(false);
                  setDoctorSearch('');
                }}
                className="w-full py-3 bg-white border-4 border-[#E60012] text-[#E60012] font-black text-sm uppercase tracking-wider hover:bg-[#E60012] hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}



