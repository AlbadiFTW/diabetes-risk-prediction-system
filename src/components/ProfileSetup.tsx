import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowLeft, X } from "lucide-react";
import { PhoneNumberInput } from "./PhoneNumberInput";
import { useEmailVerification } from "../hooks/useEmailVerification";

export function ProfileSetup() {
  const { signOut } = useAuthActions();
  const cancelAccountCreation = useMutation(api.users.cancelAccountCreation);
  const { email } = useEmailVerification();
  const isGuest = !email; // Guest users don't have emails
  const [role, setRole] = useState<"patient" | "doctor" | "">(isGuest ? "patient" : "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState<"OM" | "AE">("OM");
  const [address, setAddress] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [assignedDoctorId, setAssignedDoctorId] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyContactCountryCode, setEmergencyContactCountryCode] = useState<"OM" | "AE">("OM");
  const [diabetesStatus, setDiabetesStatus] = useState<"none" | "prediabetic" | "type1" | "type2" | "gestational" | "other" | "">("");
  const [diabetesDiagnosisDate, setDiabetesDiagnosisDate] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emergencyContactError, setEmergencyContactError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const createProfile = useMutation(api.users.createUserProfile);
  const doctors = useQuery(api.users.getAllDoctors);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent guest users from creating profiles
    if (isGuest) {
      toast.error("Guest users cannot create profiles. Please register with an email to save your data.");
      return;
    }
    
    if (!role || !firstName || !lastName) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Phone validation is handled by PhoneNumberInput component
    if (!phoneNumber) {
      setPhoneError("Phone number is required");
      toast.error("Please provide a valid phone number");
      return;
    }

    // Diabetes status is mandatory for patients
    if (role === "patient" && !diabetesStatus) {
      toast.error("Please select your diabetes status");
      return;
    }

    try {
      await createProfile({
        role: role as "patient" | "doctor",
        firstName,
        lastName,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        phoneNumber,
        phoneCountryCode,
        address: address || undefined,
        licenseNumber: role === "doctor" ? licenseNumber || undefined : undefined,
        specialization: role === "doctor" ? specialization || undefined : undefined,
        assignedDoctorId: role === "patient" && assignedDoctorId ? assignedDoctorId as any : undefined,
        emergencyContact: role === "patient" && emergencyContact ? emergencyContact : undefined,
        emergencyContactCountryCode: role === "patient" ? emergencyContactCountryCode : undefined,
        diabetesStatus: role === "patient" ? diabetesStatus : undefined,
        diabetesDiagnosisDate: role === "patient" && diabetesStatus && diabetesStatus !== "none" && diabetesDiagnosisDate 
          ? new Date(diabetesDiagnosisDate).getTime() 
          : undefined,
      });
      
      toast.success("Profile created successfully!");
    } catch (error) {
      toast.error("Failed to create profile");
      console.error(error);
    }
  };

  const handleCancel = async () => {
    try {
      // Delete the auth account before signing out
      await cancelAccountCreation({});
      // Sign out the user
      await signOut();
      toast.success("Account creation cancelled. Your account has been deleted.");
    } catch (error: any) {
      console.error("Cancel error:", error);
      // Even if deletion fails, still try to sign out
      try {
        await signOut();
      } catch (signOutError) {
        console.error("Sign out error:", signOutError);
      }
      toast.error(error?.message || "Failed to cancel. Please try again.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8 relative">
      {/* Cancel Button */}
      <button
        onClick={() => setShowCancelConfirm(true)}
        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Cancel and sign out"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Cancel Account Creation?</h3>
            <p className="text-gray-600 mb-6">
              If you cancel, you'll be signed out and will need to create a new account to continue. 
              Any information you've entered will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Continue Setup
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Complete Your Profile</h2>
      </div>
      
      <p className="text-gray-600 mb-6 text-sm">
        You're almost done! Please provide the following information to complete your account setup.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            I am a *
          </label>
          {isGuest ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-sm text-amber-800 font-medium">Guest User - Patient</span>
              <span className="text-xs text-amber-600">(Guest users can only access as patients)</span>
            </div>
          ) : (
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="patient"
                  checked={role === "patient"}
                  onChange={(e) => setRole(e.target.value as "patient")}
                  className="mr-2"
                />
                Patient
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="doctor"
                  checked={role === "doctor"}
                  onChange={(e) => setRole(e.target.value as "doctor")}
                  className="mr-2"
                />
                Healthcare Provider
              </label>
            </div>
          )}
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "male" | "female")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <PhoneNumberInput
          value={phoneNumber}
          onChange={(value) => {
            setPhoneNumber(value);
            setPhoneError(null);
          }}
          onCountryChange={(country) => {
            setPhoneCountryCode(country);
            setPhoneNumber("");
            setPhoneError(null);
          }}
          error={phoneError}
          label="Phone Number"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Doctor-specific fields */}
        {role === "doctor" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical License Number
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialization
              </label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="e.g., Endocrinology, Internal Medicine"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}

        {/* Patient-specific fields */}
        {role === "patient" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Doctor
              </label>
              <select
                value={assignedDoctorId}
                onChange={(e) => setAssignedDoctorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a doctor (optional)</option>
                {doctors?.map((doctor) => (
                  <option key={doctor._id} value={doctor.userId}>
                    Dr. {doctor.firstName} {doctor.lastName}
                    {doctor.specialization && ` - ${doctor.specialization}`}
                  </option>
                ))}
              </select>
            </div>
            <PhoneNumberInput
              value={emergencyContact}
              onChange={(value) => {
                setEmergencyContact(value);
                setEmergencyContactError(null);
              }}
              onCountryChange={(country) => {
                setEmergencyContactCountryCode(country);
                setEmergencyContact("");
                setEmergencyContactError(null);
              }}
              error={emergencyContactError}
              label="Emergency Contact Phone"
              required={false}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Diabetes Status <span className="text-red-500">*</span>
              </label>
              <select
                value={diabetesStatus}
                onChange={(e) => setDiabetesStatus(e.target.value as any)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Please select --</option>
                <option value="none">No Diabetes (Risk Assessment)</option>
                <option value="prediabetic">Pre-diabetes</option>
                <option value="type1">Type 1 Diabetes</option>
                <option value="type2">Type 2 Diabetes</option>
                <option value="gestational">Gestational Diabetes</option>
                <option value="other">Other</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                <span className="text-red-500">Required.</span> Select your current diabetes status. This helps us provide appropriate recommendations.
              </p>
            </div>
            {diabetesStatus !== "none" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diagnosis Date
                </label>
                <input
                  type="date"
                  value={diabetesDiagnosisDate}
                  onChange={(e) => setDiabetesDiagnosisDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  When were you diagnosed? (Optional)
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-colors"
          >
            Complete Profile Setup
          </button>
        </div>
      </form>
    </div>
  );
}
