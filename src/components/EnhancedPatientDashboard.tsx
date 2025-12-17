import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { EnhancedMedicalRecordForm } from "./EnhancedMedicalRecordForm";
import { EnhancedRiskChart } from "./EnhancedRiskChart";
import { InteractiveTutorial } from "./InteractiveTutorial";
import { patientTutorialSteps } from "./tutorialSteps";
import EmailVerificationBanner from "./EmailVerificationBanner";
import { useEmailVerification } from "../hooks/useEmailVerification";
import { Messaging } from "./Messaging";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { printAssessment } from "../utils/printUtils";
import { PatientEducationResources } from "./PatientEducationResources";
import { NotificationBell } from "./NotificationBell";
import { BloodSugarFoodRecommendations } from "./BloodSugarFoodRecommendations";
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  Shield, 
  AlertTriangle, 
  Heart, 
  Activity,
  FileText,
  BarChart3,
  Clock,
  CheckCircle,
  UserCircle,
  ChevronDown,
  Target,
  Minus,
  Check,
  X,
  Trash2,
  Star,
  Pill,
  Plus,
  Edit2,
  Bell,
  Stethoscope,
  MessageSquare,
  Printer,
  BookOpen,
  Info,
  ZoomIn,
  X as XIcon
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

interface EnhancedPatientDashboardProps {
  userProfile: Doc<"userProfiles"> & { role: "patient" } & { isGuest?: boolean };
  onViewProfile?: () => void;
}

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  action?: () => void;
};

// Favorite Assessment Button Component
function FavoriteAssessmentButton({ 
  predictionId, 
  isFavorite 
}: { 
  predictionId: Id<"riskPredictions">;
  isFavorite?: boolean;
}) {
  const { t } = useTranslation();
  const [isToggling, setIsToggling] = useState(false);
  const toggleFavorite = useMutation(api.predictions.toggleFavorite);

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await toggleFavorite({ predictionId });
      // No toast needed - visual feedback is enough
    } catch (error: any) {
      toast.error(error.message || t("dashboard.removeFromFavorites"));
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={`p-2 rounded-lg transition-colors ${
        isFavorite
          ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50"
          : "text-gray-400 hover:text-yellow-500 hover:bg-yellow-50"
      }`}
      title={isFavorite ? t("dashboard.removeFromFavorites") : t("dashboard.addToFavorites")}
    >
      <Star className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
    </button>
  );
}

// Delete Assessment Button Component
function DeleteAssessmentButton({ predictionId }: { predictionId: Id<"riskPredictions"> }) {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deletePrediction = useMutation(api.predictions.deletePrediction);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePrediction({ predictionId });
      toast.success(t("dashboard.assessmentDeleted"));
      setShowConfirm(false);
    } catch (error: any) {
      toast.error(error.message || t("dashboard.deleteAssessment"));
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Delete assessment"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">{t("dashboard.deleteAssessmentConfirm")}</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {t("dashboard.deleteAssessmentDesc")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{t("dashboard.deleting")}</span>
                  </>
                ) : (
                  t("dashboard.deleteAssessment")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Medication Tracker Component
function MedicationTracker({ patientId }: { patientId: Id<"users"> }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Id<"medications"> | null>(null);
  const [showReminderModal, setShowReminderModal] = useState<Id<"medications"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    frequency: "once_daily" as const,
    times: [] as string[],
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
    isActive: true,
    notes: "",
  });
  const [reminderTimes, setReminderTimes] = useState<string[]>([]);
  const [enableReminders, setEnableReminders] = useState(false);
  const [newReminderTime, setNewReminderTime] = useState("");
  const [editingReminderId, setEditingReminderId] = useState<Id<"medicationReminders"> | null>(null);
  const [editingReminderTime, setEditingReminderTime] = useState("");

  const medications = useQuery(api.medications.getMedicationsByPatient, { patientId });
  const createMedication = useMutation(api.medications.createMedication);
  const updateMedication = useMutation(api.medications.updateMedication);
  const deleteMedication = useMutation(api.medications.deleteMedication);
  const updateReminders = useMutation(api.medicationReminders.updateMedicationReminders);
  const deleteReminder = useMutation(api.medicationReminders.deleteReminder);
  const updateReminderTime = useMutation(api.medicationReminders.updateReminderTime);
  const upcomingReminders = useQuery(api.medicationReminders.getUpcomingReminders, { patientId });
  
  // Get existing reminders for the medication being edited
  const existingReminders = useQuery(
    api.medicationReminders.getRemindersForMedication,
    showReminderModal ? { medicationId: showReminderModal } : "skip" as any
  );
  
  // Check for interactions
  const activeMedicationNames = medications?.filter(m => m.isActive && !m.endDate).map(m => m.name) || [];
  const interactions = useQuery(
    api.drugInteractions.checkInteractions,
    activeMedicationNames.length >= 2 ? { medicationNames: activeMedicationNames } : "skip" as any
  );

  const frequencyOptions = [
    { value: "once_daily", label: t("dashboard.medications.frequencyOptions.onceDaily") },
    { value: "twice_daily", label: t("dashboard.medications.frequencyOptions.twiceDaily") },
    { value: "thrice_daily", label: t("dashboard.medications.frequencyOptions.threeTimesDaily") },
    { value: "four_times_daily", label: t("dashboard.medications.frequencyOptions.fourTimesDaily") },
    { value: "as_needed", label: t("dashboard.medications.frequencyOptions.asNeeded") },
    { value: "weekly", label: t("dashboard.medications.frequencyOptions.weekly") },
    { value: "monthly", label: t("dashboard.medications.frequencyOptions.monthly") },
    { value: "custom", label: t("dashboard.medications.frequencyOptions.custom") },
  ];

  const getFrequencyLabel = (freq: string) => {
    return frequencyOptions.find(opt => opt.value === freq)?.label || freq;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const startTimestamp = new Date(formData.startDate).getTime();
      const endTimestamp = formData.endDate ? new Date(formData.endDate).getTime() : undefined;

      if (editingMedication) {
        await updateMedication({
          medicationId: editingMedication,
          updates: {
            name: formData.name,
            dosage: formData.dosage,
            frequency: formData.frequency,
            times: formData.times.length > 0 ? formData.times : undefined,
            startDate: startTimestamp,
            endDate: endTimestamp,
            isActive: formData.isActive,
            notes: formData.notes || undefined,
          },
        });
        toast.success(t("dashboard.medications.editMedication"));
      } else {
        await createMedication({
          patientId,
          name: formData.name,
          dosage: formData.dosage,
          frequency: formData.frequency,
          times: formData.times.length > 0 ? formData.times : undefined,
          startDate: startTimestamp,
          endDate: endTimestamp,
          isActive: formData.isActive,
          notes: formData.notes || undefined,
        });
        toast.success(t("dashboard.medications.addMedication"));
      }

      // Reset form
      setFormData({
        name: "",
        dosage: "",
        frequency: "once_daily",
        times: [],
        startDate: new Date().toISOString().split('T')[0],
        endDate: "",
        isActive: true,
        notes: "",
      });
      setShowForm(false);
      setEditingMedication(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save medication");
    }
  };

  const handleEdit = (medication: any) => {
    setEditingMedication(medication._id);
    setFormData({
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      times: medication.times || [],
      startDate: new Date(medication.startDate).toISOString().split('T')[0],
      endDate: medication.endDate ? new Date(medication.endDate).toISOString().split('T')[0] : "",
      isActive: medication.isActive,
      notes: medication.notes || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (medicationId: Id<"medications">) => {
    if (confirm(t("dashboard.medications.deleteMedication"))) {
      try {
        await deleteMedication({ medicationId });
        toast.success(t("dashboard.medications.deleteMedication"));
      } catch (error: any) {
        toast.error(error.message || t("dashboard.medications.deleteMedication"));
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const activeMedications = medications?.filter(m => m.isActive && !m.endDate) || [];
  const inactiveMedications = medications?.filter(m => !m.isActive || (m.endDate && m.endDate < Date.now())) || [];


  const handleSaveReminders = async (medicationId: Id<"medications">) => {
    try {
      await updateReminders({
        medicationId,
        reminderTimes,
        enableReminders,
      });
      toast.success("Reminders updated successfully");
      setShowReminderModal(null);
      setReminderTimes([]);
      setEnableReminders(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update reminders");
    }
  };

  const handleOpenReminderModal = (medication: any) => {
    setShowReminderModal(medication._id);
    setReminderTimes(medication.reminderTimes || medication.times || []);
    setEnableReminders(medication.enableReminders || false);
    setNewReminderTime("");
  };

  const addReminderTime = () => {
    if (!newReminderTime.trim()) {
      toast.error("Please enter a time");
      return;
    }
    
    // Validate time format (HH:MM)
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(newReminderTime)) {
      toast.error("Invalid time format. Please use HH:MM (e.g., 08:00)");
      return;
    }
    
    if (reminderTimes.includes(newReminderTime)) {
      toast.error("This time is already added");
      return;
    }
    
    setReminderTimes([...reminderTimes, newReminderTime].sort());
    setNewReminderTime("");
  };

  const removeReminderTime = (time: string) => {
    setReminderTimes(reminderTimes.filter(t => t !== time));
  };

  const handleDeleteReminder = async (reminderId: Id<"medicationReminders">) => {
    if (!confirm("Are you sure you want to delete this reminder?")) {
      return;
    }
    try {
      await deleteReminder({ reminderId });
      toast.success("Reminder deleted successfully");
    } catch (error: any) {
      toast.error(error.message || t("dashboard.medications.setReminders"));
    }
  };

  const handleStartEditReminder = (reminderId: Id<"medicationReminders">, currentTime: string) => {
    setEditingReminderId(reminderId);
    setEditingReminderTime(currentTime);
  };

  const handleSaveEditReminder = async () => {
    if (!editingReminderId || !editingReminderTime) return;
    
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(editingReminderTime)) {
      toast.error(t("dashboard.medications.reminderTimes"));
      return;
    }
    
    try {
      await updateReminderTime({ reminderId: editingReminderId, newTime: editingReminderTime });
      toast.success(t("dashboard.medications.saveReminders"));
      setEditingReminderId(null);
      setEditingReminderTime("");
    } catch (error: any) {
      toast.error(error.message || t("dashboard.medications.saveReminders"));
    }
  };

  const handleCancelEditReminder = () => {
    setEditingReminderId(null);
    setEditingReminderTime("");
  };

  return (
    <div className="space-y-6">
      {/* Interaction Warnings */}
      {interactions && interactions.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-2">{t("dashboard.medications.interactionWarning")}</h4>
              <div className="space-y-2">
                {interactions.map((interaction: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        interaction.severity === 'severe' ? 'bg-red-600 text-white' :
                        interaction.severity === 'moderate' ? 'bg-orange-500 text-white' :
                        'bg-yellow-500 text-white'
                      }`}>
                        {interaction.severity === 'severe' ? t("dashboard.medications.severe") :
                         interaction.severity === 'moderate' ? t("dashboard.medications.moderate") :
                         t("dashboard.medications.mild")}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {interaction.medication1} + {interaction.medication2}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{interaction.description}</p>
                    <p className="text-sm font-medium text-gray-900">{t("dashboard.medications.recommendation")}: {interaction.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Reminders */}
      {upcomingReminders && upcomingReminders.length > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-2">{t("dashboard.medications.upcomingReminders")}</h4>
              <div className="space-y-2">
                {upcomingReminders.map((reminder: any) => {
                  const reminderDate = new Date(reminder.nextReminderDate);
                  const isToday = reminderDate.toDateString() === new Date().toDateString();
                  const isEditing = editingReminderId === reminder._id;
                  
                  return (
                    <div key={reminder._id} className="bg-white rounded-lg p-3 border border-blue-200">
                      {isEditing ? (
                        // Edit mode
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 mb-1">
                              {reminder.medication?.name} - {reminder.medication?.dosage}
                            </p>
                            <input
                              type="time"
                              value={editingReminderTime}
                              onChange={(e) => setEditingReminderTime(e.target.value)}
                              className="w-full px-3 py-1.5 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleSaveEditReminder}
                            className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditReminder}
                            className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        // View mode
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {reminder.medication?.name} - {reminder.medication?.dosage}
                            </p>
                            <p className="text-sm text-gray-600">
                              {isToday ? t("dashboard.medications.today") : reminderDate.toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })} at {reminder.reminderTime}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-3">
                            <button
                              type="button"
                              onClick={() => handleStartEditReminder(reminder._id, reminder.reminderTime)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit reminder time"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteReminder(reminder._id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete reminder"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-primary-500 rounded-full" />
          <h3 className="text-lg font-semibold text-gray-900">Medication Tracker</h3>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingMedication(null);
            if (!showForm) {
              setFormData({
                name: "",
                dosage: "",
                frequency: "once_daily",
                times: [],
                startDate: new Date().toISOString().split('T')[0],
                endDate: "",
                isActive: true,
                notes: "",
              });
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {showForm ? "Cancel" : "Add Medication"}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-premium p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            {editingMedication ? "Edit Medication" : "Add New Medication"}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medication Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                  placeholder="e.g., Metformin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("dashboard.medications.dosage")} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.dosage}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                  placeholder="e.g., 500mg, 10 units"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency *
                </label>
                <select
                  required
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                >
                  {frequencyOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("dashboard.medications.startDate")} *
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for ongoing medication</p>
              </div>
              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{t("dashboard.medications.currentlyActive")}</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                placeholder="Additional instructions or notes..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors"
              >
                {editingMedication ? t("dashboard.medications.editMedication") : t("dashboard.medications.addMedication")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingMedication(null);
                }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                {t("dashboard.medications.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Medications */}
      <div className="bg-white rounded-2xl shadow-premium p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <h4 className="text-lg font-semibold text-gray-900">{t("dashboard.medications.activeMedications")}</h4>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            {activeMedications.length}
          </span>
        </div>
        {activeMedications.length > 0 ? (
          <div className="space-y-3">
            {activeMedications.map((medication) => (
              <div
                key={medication._id}
                className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border-l-4 border-green-500"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Pill className="w-5 h-5 text-primary-600" />
                      <h5 className="font-semibold text-gray-900">{medication.name}</h5>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        {t("dashboard.medications.active")}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-600 ml-8">
                      <p><span className="font-medium">{t("dashboard.medications.dosage")}:</span> {medication.dosage}</p>
                      <p><span className="font-medium">{t("dashboard.medications.frequency")}:</span> {getFrequencyLabel(medication.frequency)}</p>
                      <p><span className="font-medium">{t("dashboard.medications.started")}:</span> {formatDate(medication.startDate)}</p>
                      {medication.times && medication.times.length > 0 && (
                        <p><span className="font-medium">{t("dashboard.medications.times")}:</span> {medication.times.join(", ")}</p>
                      )}
                    </div>
                    {medication.notes && (
                      <p className="text-sm text-gray-500 mt-2 ml-8 italic">{medication.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenReminderModal(medication)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t("dashboard.medications.setReminders")}
                    >
                      <Bell className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(medication)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title={t("dashboard.medications.editMedication")}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(medication._id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={t("dashboard.medications.deleteMedication")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Pill className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>{t("dashboard.medications.noActiveMedications")}</p>
          </div>
        )}
      </div>

      {/* Inactive/Completed Medications */}
      {inactiveMedications.length > 0 && (
        <div className="bg-white rounded-2xl shadow-premium p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-gray-400" />
            <h4 className="text-lg font-semibold text-gray-900">{t("dashboard.medications.pastMedications")}</h4>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
              {inactiveMedications.length}
            </span>
          </div>
          <div className="space-y-3">
            {inactiveMedications.map((medication) => (
              <div
                key={medication._id}
                className="p-4 bg-gray-50 rounded-xl border-l-4 border-gray-300 opacity-75"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Pill className="w-5 h-5 text-gray-400" />
                      <h5 className="font-semibold text-gray-700">{medication.name}</h5>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {medication.endDate && medication.endDate < Date.now() ? "Completed" : "Inactive"}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-500 ml-8">
                      <p><span className="font-medium">Dosage:</span> {medication.dosage}</p>
                      <p><span className="font-medium">Frequency:</span> {getFrequencyLabel(medication.frequency)}</p>
                      <p><span className="font-medium">Period:</span> {formatDate(medication.startDate)}
                        {medication.endDate && ` - ${formatDate(medication.endDate)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(medication)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Edit medication"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(medication._id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete medication"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reminder Setup Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t("dashboard.medications.setReminders")}</h3>
              <button
                onClick={() => {
                  setShowReminderModal(null);
                  setReminderTimes([]);
                  setEnableReminders(false);
                  setNewReminderTime("");
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={enableReminders}
                  onChange={(e) => setEnableReminders(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">{t("dashboard.medications.enableReminders")}</span>
              </label>

              {enableReminders && (
                <div className="space-y-4">
                  {/* Existing Active Reminders */}
                  {existingReminders && existingReminders.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">{t("dashboard.medications.activeReminders")}</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {existingReminders.map((reminder: any) => (
                          <div key={reminder._id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            {editingReminderId === reminder._id ? (
                              // Edit mode
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={editingReminderTime}
                                  onChange={(e) => setEditingReminderTime(e.target.value)}
                                  className="flex-1 px-3 py-1.5 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveEditReminder}
                                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                                  title={t("common.save")}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditReminder}
                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
                                  title={t("common.cancel")}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              // View mode
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <Bell className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium text-gray-900">{reminder.reminderTime}</span>
                                  <span className="text-xs text-gray-500">
                                    ({t("dashboard.history.latest")}: {new Date(reminder.nextReminderDate).toLocaleDateString()})
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditReminder(reminder._id, reminder.reminderTime)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                    title={t("dashboard.medications.setReminders")}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReminder(reminder._id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title={t("dashboard.medications.setReminders")}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add New Reminder Times */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      {existingReminders && existingReminders.length > 0 ? t("dashboard.medications.addReminderTimes") : t("dashboard.medications.reminderTimes")}
                    </label>
                    
                    {/* Add Time Input */}
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={newReminderTime}
                        onChange={(e) => setNewReminderTime(e.target.value)}
                        className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-500"
                        placeholder={t("dashboard.medications.reminderTimes")}
                      />
                      <button
                        type="button"
                        onClick={addReminderTime}
                        disabled={!newReminderTime}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {t("dashboard.medications.add")}
                      </button>
                    </div>

                    {/* New Reminder Times List (to be added) */}
                    {reminderTimes.length > 0 && (
                      <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                        {reminderTimes.map((time) => (
                          <div key={time} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-900">{time}</span>
                              <span className="text-xs text-gray-500">(New)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeReminderTime(time)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={t("common.delete")}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-900 font-medium mb-1">📧 {t("dashboard.medications.notificationInfo")}</p>
                    <p className="text-xs text-blue-800">
                      {t("dashboard.medications.notificationInfo")}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowReminderModal(null);
                    setReminderTimes([]);
                    setEnableReminders(false);
                    setNewReminderTime("");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {t("dashboard.medications.cancel")}
                </button>
                <button
                  onClick={() => handleSaveReminders(showReminderModal)}
                  disabled={enableReminders && reminderTimes.length === 0}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("dashboard.medications.saveReminders")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EnhancedPatientDashboard({ userProfile, onViewProfile }: EnhancedPatientDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDateRange, setSelectedDateRange] = useState("30"); // days
  const [showTutorial, setShowTutorial] = useState(false);
  const [favoriteFilter, setFavoriteFilter] = useState<"all" | "favorites">("all");
  const [zoomedChart, setZoomedChart] = useState<"glucose" | "bmi" | "bloodpressure" | null>(null);

  // Fetch dashboard data
  const dashboardData = useQuery(api.dashboard.getPatientDashboardData);
  
  // Determine if patient has diagnosed diabetes (for conditional dashboard views)
  const hasDiagnosedDiabetes = userProfile.diabetesStatus && 
    userProfile.diabetesStatus !== "none" && 
    userProfile.diabetesStatus !== "prediabetic";
  const isPrediabetic = userProfile.diabetesStatus === "prediabetic";
  
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

  const medicalRecords = useQuery(
    api.medicalRecords.getMedicalRecordsByPatient,
    userProfile?.userId ? { patientId: userProfile.userId } : "skip"
  );

  const riskPredictions = useQuery(
    api.predictions.getRiskPredictionsByPatient,
    userProfile?.userId ? { patientId: userProfile.userId } : "skip"
  );

  // Advanced Analytics Queries
  const populationStats = useQuery(api.analytics.getPopulationStatistics);
  const [cohortFilter, setCohortFilter] = useState<"age" | "gender">("age");
  const cohortStats = useQuery(api.analytics.getCohortStatistics, { 
    cohortType: cohortFilter 
  });
  const predictiveTrends = useQuery(
    api.analytics.getPredictiveTrends,
    userProfile?.userId ? { patientId: userProfile.userId, forecastDays: 30 } : "skip"
  );

  // Get complication risk for diagnosed patients
  const complicationRisk = useQuery(
    api.complicationRisk.getComplicationRisk,
    hasDiagnosedDiabetes && userProfile?.userId ? { patientId: userProfile.userId } : "skip"
  );

  // Get pending doctor requests
  const pendingDoctorRequests = useQuery(api.patientAssignments.getPendingDoctorRequests);
  const acceptDoctorRequest = useMutation(api.patientAssignments.acceptDoctorRequest);
  const rejectDoctorRequest = useMutation(api.patientAssignments.rejectDoctorRequest);

  // Calculate health trend from latest vs previous risk scores
  const healthTrend = useMemo(() => {
    if (!riskPredictions || riskPredictions.length < 2) {
      return {
        direction: 'stable',
        change: 0,
        label: riskPredictions?.length === 1 ? 'First Assessment' : 'Need more data',
        icon: '→',
        color: 'text-gray-600'
      };
    }

    // Sort by creation time (oldest first) to get proper order
    const sorted = [...riskPredictions].sort((a, b) => a._creationTime - b._creationTime);
    const previous = sorted[sorted.length - 2];
    const latest = sorted[sorted.length - 1];
    
    const previousScore = previous.riskScore || 0;
    const latestScore = latest.riskScore || 0;
    const change = latestScore - previousScore;
    const changePercent = change.toFixed(1);

    if (change > 5) {
      return {
        direction: 'increasing',
        change: change,
        changePercent: `+${changePercent}`,
        label: 'Increasing Risk',
        icon: '↗',
        color: 'text-red-600'
      };
    } else if (change < -5) {
      return {
        direction: 'decreasing',
        change: change,
        changePercent: changePercent,
        label: 'Decreasing Risk',
        icon: '↘',
        color: 'text-green-600'
      };
    } else {
      return {
        direction: 'stable',
        change: change,
        changePercent: change > 0 ? `+${changePercent}` : changePercent,
        label: 'Stable Trend',
        icon: '→',
        color: 'text-yellow-600'
      };
    }
  }, [riskPredictions]);

  // Format risk category for display (snake_case to Title Case)
  const formatRiskCategory = (category: string): string => {
    if (!category) return 'Unknown';
    const formatted = category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    return formatted;
  };

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
      case "low": return <Shield className="w-5 h-5" />;
      case "moderate": return <TrendingUp className="w-5 h-5" />;
      case "high": return <AlertTriangle className="w-5 h-5" />;
      case "very_high": return <Heart className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  // Messaging state and query - only for registered users, not guests
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const unreadCountResult = useQuery(
    api.messages.getUnreadMessageCount,
    userProfile.isGuest ? "skip" : {}
  );
  const unreadCount = typeof unreadCountResult === 'number' ? unreadCountResult : 0;

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const baseNavItems: NavItem[] = [
    { id: "overview", label: t("dashboard.tabs.overview"), icon: BarChart3 },
    { id: "assessment", label: t("dashboard.tabs.newAssessment"), icon: FileText },
    { id: "history", label: t("dashboard.tabs.history"), icon: Calendar },
    { id: "medications", label: t("dashboard.tabs.medications"), icon: Pill },
    { id: "analytics", label: t("dashboard.tabs.analytics"), icon: TrendingUp },
    { id: "education", label: t("dashboard.tabs.education"), icon: BookOpen },
    { id: "messages", label: t("dashboard.tabs.messages"), icon: MessageSquare, action: () => setIsMessagingOpen(true) },
  ];

  // Filter out Messages for guests, add Profile for registered users only
  const filteredNavItems = userProfile.isGuest 
    ? baseNavItems.filter(item => item.id !== "messages")
    : baseNavItems;
  
  const navItems = onViewProfile
    ? [...filteredNavItems, { id: "profile-link", label: t("dashboard.tabs.profile"), icon: UserCircle, action: onViewProfile }]
    : filteredNavItems;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Email Verification Banner - Only show for registered users, not guests */}
      {!userProfile.isGuest && <EmailVerificationBanner />}
      
      {/* Pending Doctor Request Notification Banner */}
      {pendingDoctorRequests && pendingDoctorRequests.length > 0 && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg mb-1">
                    New Healthcare Provider Request{pendingDoctorRequests.length > 1 ? 's' : ''}
                  </h3>
                  <p className="text-blue-100 text-xs sm:text-sm">
                    {pendingDoctorRequests.length === 1 && pendingDoctorRequests[0]?.doctor
                      ? `Dr. ${pendingDoctorRequests[0].doctor.firstName} ${pendingDoctorRequests[0].doctor.lastName} wants to be your healthcare provider`
                      : `You have ${pendingDoctorRequests.length} doctors requesting to be your healthcare provider`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (onViewProfile) {
                    onViewProfile();
                  }
                }}
                className="w-full sm:w-auto ml-0 sm:ml-4 px-4 sm:px-6 py-2 sm:py-2.5 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors shadow-sm flex items-center justify-center gap-2 flex-shrink-0 min-h-[44px] touch-manipulation"
              >
                <Stethoscope className="w-4 h-4" />
                View Requests
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
                {t("dashboard.welcome", { firstName: userProfile.firstName })}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm sm:text-base text-gray-600">{t("dashboard.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right hidden sm:block">
                <p className="text-xs sm:text-sm text-gray-500">{t("dashboard.lastAssessment")}</p>
                <p className="text-sm sm:text-base font-semibold text-gray-900">
                  {dashboardData.latestPrediction ? 
                    getTimeAgo(dashboardData.latestPrediction._creationTime) : 
                    t("dashboard.noAssessmentsYet")
                  }
                </p>
              </div>
              <NotificationBell onNavigate={(tab) => setActiveTab(tab)} />
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Navigation Tabs - Premium Pill Style */}
        <div className="mb-6 sm:mb-8">
          <nav className="bg-surface-100 p-1 sm:p-1.5 rounded-2xl overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 sm:gap-1.5 min-w-max sm:inline-flex">
              {navItems.map(({ id, label, icon: Icon, action }) => {
                const isActive = !action && activeTab === id;
                const isMessages = id === "messages";
                return (
                <button
                  key={id}
                  data-tutorial={
                    id === "analytics" ? "analytics-tab" : 
                    id === "profile-link" ? "profile-tab" :
                    id === "history" ? "history-tab" :
                    id === "medications" ? "medications-tab" :
                    id === "education" ? "education-tab" :
                    id === "messages" ? "messages-tab" :
                    id === "assessment" ? "new-assessment" : undefined
                  }
                    onClick={() => {
                      if (action) {
                        action();
                        return;
                      }
                      setActiveTab(id);
                    }}
                    className={`
                      relative px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-medium text-xs sm:text-sm transition-all duration-300
                      flex items-center gap-1.5 sm:gap-2 min-h-[44px] touch-manipulation flex-shrink-0
                      ${isActive 
                        ? 'bg-white text-primary-700 shadow-premium' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-white/50 active:bg-white/70'
                      }
                      ${id === "profile-link" ? "mr-2 sm:mr-0" : ""}
                    `}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${isActive ? 'text-primary-500 animate-icon-float' : ''}`} />
                    <span className="whitespace-nowrap">{label}</span>
                    {isMessages && typeof unreadCount === 'number' && unreadCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] flex items-center justify-center flex-shrink-0">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-500 rounded-full" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Hero Card - Conditional based on diabetes status */}
              {hasDiagnosedDiabetes ? (
                // For diagnosed patients: Show HbA1c or Glucose Control
                (() => {
                  // Filter medical records to only include those associated with non-deleted predictions
                  const validMedicalRecordIds = new Set(
                    riskPredictions
                      ?.filter((p: any) => p.isDeleted !== true && p.medicalRecordId)
                      .map((p: any) => p.medicalRecordId) || []
                  );
                  const validMedicalRecords = medicalRecords?.filter((r: any) => 
                    validMedicalRecordIds.has(r._id)
                  ) || [];
                  const latestRecord = validMedicalRecords[0];
                  const hba1c = latestRecord?.hba1c;
                  const glucose = latestRecord?.glucoseLevel || dashboardData.latestPrediction?.riskScore || 0;
                  
                  // Determine status based on HbA1c (target: <7% for most, <6.5% for some)
                  let status = 'good';
                  let statusText = t("dashboard.status.wellControlled");
                  let gradientClasses = 'bg-gradient-to-br from-green-500 via-green-600 to-emerald-700';
                  
                  if (hba1c) {
                    if (hba1c < 7.0) {
                      status = 'good';
                      statusText = t("dashboard.status.wellControlled");
                      gradientClasses = 'bg-gradient-to-br from-green-500 via-green-600 to-emerald-700';
                    } else if (hba1c < 8.0) {
                      status = 'moderate';
                      statusText = t("dashboard.status.needsImprovement");
                      gradientClasses = 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-700';
                    } else {
                      status = 'poor';
                      statusText = t("dashboard.status.needsAttention");
                      gradientClasses = 'bg-gradient-to-br from-red-600 via-red-700 to-rose-800';
                    }
                  } else {
                    // Fallback to glucose level if no HbA1c
                    if (glucose < 140) {
                      status = 'good';
                      statusText = t("dashboard.status.wellControlled");
                      gradientClasses = 'bg-gradient-to-br from-green-500 via-green-600 to-emerald-700';
                    } else if (glucose < 180) {
                      status = 'moderate';
                      statusText = t("dashboard.status.needsImprovement");
                      gradientClasses = 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-700';
                    } else {
                      status = 'poor';
                      statusText = t("dashboard.status.needsAttention");
                      gradientClasses = 'bg-gradient-to-br from-red-600 via-red-700 to-rose-800';
                    }
                  }
                  
                  return (
                    <div data-tutorial="risk-score" className={`relative overflow-hidden ${gradientClasses} rounded-3xl p-6 shadow-premium animate-fade-in-up`}>
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                      
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-2 bg-white/20 rounded-xl">
                            <Activity className="w-5 h-5 text-white animate-pulse" />
                          </div>
                          <span className="text-sm font-medium text-white">
                            {hba1c ? t("dashboard.metrics.hba1cLevel") : t("dashboard.metrics.glucoseControl")}
                          </span>
                        </div>
                        
                        <div className="flex items-end gap-2 mb-2">
                          <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                            {hba1c ? hba1c.toFixed(1) : glucose.toFixed(0)}
                          </span>
                          <span className="text-xl sm:text-2xl font-medium text-white/90 mb-1">
                            {hba1c ? '%' : 'mg/dL'}
                          </span>
                        </div>
                        
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-full">
                          <span className={`w-2 h-2 rounded-full animate-pulse ${
                            status === 'good' ? 'bg-green-300' :
                            status === 'moderate' ? 'bg-yellow-300' :
                            'bg-red-300'
                          }`} />
                          <span className="text-sm font-medium text-white">
                            {statusText}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                // For at-risk patients: Show Risk Score
                (() => {
                  const riskCategory = dashboardData.latestPrediction?.riskCategory?.toLowerCase() || 'low';
                  const riskScore = dashboardData.latestPrediction?.riskScore || 0;
                  
                  // Determine gradient colors based on risk category
                  let gradientClasses = 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700'; // Default blue
                  if (riskCategory === 'low') {
                    gradientClasses = 'bg-gradient-to-br from-green-500 via-green-600 to-emerald-700';
                  } else if (riskCategory === 'moderate') {
                    gradientClasses = 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-700';
                  } else if (riskCategory === 'high') {
                    gradientClasses = 'bg-gradient-to-br from-orange-500 via-orange-600 to-red-600';
                  } else if (riskCategory === 'very_high') {
                    gradientClasses = 'bg-gradient-to-br from-red-600 via-red-700 to-rose-800';
                  }
                  
                  return (
                    <div data-tutorial="risk-score" className={`relative overflow-hidden ${gradientClasses} rounded-3xl p-6 shadow-premium animate-fade-in-up`}>
                      {/* Background decoration */}
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                      
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-2 bg-white/20 rounded-xl">
                            <Shield className="w-5 h-5 text-white animate-pulse" />
                          </div>
                          <span className="text-sm font-medium text-white">
                            {hasDiagnosedDiabetes 
                              ? t("dashboard.metrics.complicationRisk")
                              : isPrediabetic 
                              ? t("dashboard.metrics.progressionRisk")
                              : t("dashboard.metrics.latestRiskScore")}
                          </span>
                        </div>
                        
                        <div className="flex items-end gap-2 mb-2">
                          <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                            {typeof dashboardData.latestPrediction?.riskScore === 'number'
                              ? dashboardData.latestPrediction.riskScore.toFixed(1)
                              : 'N/A'}
                          </span>
                          <span className="text-xl sm:text-2xl font-medium text-white/90 mb-1">%</span>
                        </div>
                        
                        {dashboardData.latestPrediction && (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-full">
                            <span className={`w-2 h-2 rounded-full animate-pulse ${
                              riskCategory === 'low' ? 'bg-green-300' :
                              riskCategory === 'moderate' ? 'bg-yellow-300' :
                              riskCategory === 'high' ? 'bg-orange-300' :
                              'bg-red-300'
                            }`} />
                            <span className="text-sm font-medium capitalize text-white">
                              {formatRiskCategory(dashboardData.latestPrediction.riskCategory)} {hasDiagnosedDiabetes ? t("dashboard.metrics.complicationRisk") : isPrediabetic ? t("dashboard.metrics.progressionRisk") : ''} {t("dashboard.risk.low")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Secondary Stats Cards */}
              <div className="bg-white rounded-2xl p-5 shadow-premium hover:shadow-premium-hover transition-all duration-300 animate-fade-in-up stagger-1">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-500">{t("dashboard.metrics.totalAssessments")}</span>
                  <div className="p-2.5 bg-emerald-50 rounded-xl">
                    <FileText className="w-5 h-5 text-emerald-600 animate-icon-float" />
                  </div>
                  </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData.totalAssessments || 0}</span>
                  <span className="text-xs sm:text-sm text-gray-400">{t("dashboard.metrics.completed")}</span>
                </div>
                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {dashboardData.totalAssessments > 0 ? 
                    `${t("dashboard.lastAssessment")} ${getTimeAgo(dashboardData.latestPrediction?._creationTime || 0)}` : 
                    t("dashboard.recentAssessments.startFirst")
                  }
                </p>
              </div>

              {hasDiagnosedDiabetes && dashboardData.latestPrediction ? (
                // Complication Risk card for diagnosed patients - use latest prediction risk score
                <div className="bg-white rounded-2xl p-5 shadow-premium hover:shadow-premium-hover transition-all duration-300 animate-fade-in-up stagger-2">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-500">Complication Risk</span>
                    <div className={`p-2.5 rounded-xl ${
                      dashboardData.latestPrediction.riskCategory === 'low' ? 'bg-green-50' :
                      dashboardData.latestPrediction.riskCategory === 'moderate' ? 'bg-yellow-50' :
                      dashboardData.latestPrediction.riskCategory === 'high' ? 'bg-orange-50' :
                      'bg-red-50'
                    }`}>
                      <AlertTriangle className={`w-5 h-5 ${
                        dashboardData.latestPrediction.riskCategory === 'low' ? 'text-green-600' :
                        dashboardData.latestPrediction.riskCategory === 'moderate' ? 'text-yellow-600' :
                        dashboardData.latestPrediction.riskCategory === 'high' ? 'text-orange-600' :
                        'text-red-600'
                      } animate-pulse`} />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {(() => {
                        // Ensure riskScore is properly formatted (0-100)
                        let riskScore = dashboardData.latestPrediction.riskScore;
                        if (typeof riskScore === 'number') {
                          // If between 0-1, convert to percentage
                          if (riskScore > 0 && riskScore <= 1) {
                            riskScore = riskScore * 100;
                          }
                          return riskScore.toFixed(1);
                        }
                        return '0.0';
                      })()}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-400">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 capitalize">
                    {dashboardData.latestPrediction.riskCategory.replace('_', ' ')} risk
                  </p>
                </div>
              ) : (
                // Confidence Level card for at-risk/prediabetic patients
                <div className="bg-white rounded-2xl p-5 shadow-premium hover:shadow-premium-hover transition-all duration-300 animate-fade-in-up stagger-2">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-500">{t("dashboard.metrics.confidenceLevel")}</span>
                    <div className="p-2.5 bg-yellow-50 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-yellow-600 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {typeof dashboardData.latestPrediction?.confidenceScore === 'number'
                        ? dashboardData.latestPrediction.confidenceScore.toFixed(1)
                        : 'N/A'}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-400">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Model confidence in prediction</p>
                </div>
              )}

              {(() => {
                // Determine gradient colors based on HEALTH TREND direction, not risk category
                // This makes more sense: increasing risk = red (bad), decreasing risk = green (good)
                let gradientClasses = 'bg-gradient-to-br from-gray-500 via-gray-600 to-gray-700'; // Default gray for stable/no data
                let iconBgClasses = 'bg-white/20';
                let iconColorClasses = 'text-white';
                let textColorClasses = 'text-white';
                
                if (healthTrend.direction === 'increasing') {
                  // Increasing risk = red/orange (negative trend - bad)
                  gradientClasses = 'bg-gradient-to-br from-red-500 via-red-600 to-rose-700';
                } else if (healthTrend.direction === 'decreasing') {
                  // Decreasing risk = green (positive trend - good)
                  gradientClasses = 'bg-gradient-to-br from-green-500 via-green-600 to-emerald-700';
                } else {
                  // Stable or no data = yellow/amber (neutral)
                  gradientClasses = 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-700';
                }
                
                return (
                  <div data-tutorial="health-trend" className={`relative overflow-hidden ${gradientClasses} rounded-2xl p-5 shadow-premium hover:shadow-premium-hover transition-all duration-300 animate-fade-in-up stagger-3`}>
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-white">Health Trend</span>
                        <div className={`p-2.5 rounded-xl ${iconBgClasses}`}>
                          {healthTrend.direction === 'increasing' ? (
                            <TrendingUp className={`w-5 h-5 ${iconColorClasses} animate-bounce`} />
                          ) : healthTrend.direction === 'decreasing' ? (
                            <TrendingDown className={`w-5 h-5 ${iconColorClasses} animate-bounce`} />
                          ) : (
                            <Minus className={`w-5 h-5 ${iconColorClasses}`} />
                          )}
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-bold ${textColorClasses}`}>
                          {healthTrend.direction === 'increasing' ? (
                            <TrendingUp className="w-8 h-8 inline-block" />
                          ) : healthTrend.direction === 'decreasing' ? (
                            <TrendingDown className="w-8 h-8 inline-block" />
                    ) : (
                      <Minus className="w-8 h-8 inline-block" />
                          )}
                        </span>
                      </div>
                      <p className={`text-xs mt-2 ${textColorClasses} opacity-90`}>
                        {healthTrend.direction === 'increasing' ? (
                          `Increasing ${hasDiagnosedDiabetes ? 'Complication' : isPrediabetic ? 'Progression' : ''} Risk (${healthTrend.changePercent}%)`
                        ) : healthTrend.direction === 'decreasing' ? (
                          `Decreasing ${hasDiagnosedDiabetes ? 'Complication' : isPrediabetic ? 'Progression' : ''} Risk (${healthTrend.changePercent}%)`
                        ) : (
                          healthTrend.label
                        )}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Recent Assessments */}
            <div data-tutorial="recent-assessments" className="bg-white rounded-2xl shadow-premium p-4 sm:p-6 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="h-8 w-1 bg-primary-500 rounded-full" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">{t("dashboard.recentAssessments.title")}</h3>
              </div>
              <div>
                {dashboardData.recentPredictions?.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.recentPredictions.map((prediction: any, index: number) => (
                      <div 
                        key={prediction._id} 
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            prediction.riskCategory.toLowerCase() === 'low' ? 'bg-green-100' :
                            prediction.riskCategory.toLowerCase() === 'moderate' ? 'bg-yellow-100' :
                            prediction.riskCategory.toLowerCase() === 'high' ? 'bg-orange-100' :
                            'bg-red-100'
                          }`}>
                            <Shield className={`w-5 h-5 sm:w-6 sm:h-6 animate-icon-float ${
                              prediction.riskCategory.toLowerCase() === 'low' ? 'text-green-600' :
                              prediction.riskCategory.toLowerCase() === 'moderate' ? 'text-yellow-600' :
                              prediction.riskCategory.toLowerCase() === 'high' ? 'text-orange-600' :
                              'text-red-600'
                            }`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                              {typeof prediction.riskScore === 'number'
                                ? prediction.riskScore.toFixed(1)
                                : 'N/A'}% {hasDiagnosedDiabetes 
                                  ? t("dashboard.metrics.complicationRisk")
                                  : isPrediabetic 
                                  ? t("dashboard.metrics.progressionRisk")
                                  : t("dashboard.metrics.latestRiskScore")}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">
                              {formatDateTime(prediction._creationTime)} • 
                              {t("dashboard.recentAssessments.confidence")}: {prediction.confidenceScore ? 
                                (typeof prediction.confidenceScore === 'number' ? 
                                  prediction.confidenceScore.toFixed(1) : 
                                  prediction.confidenceScore) : 'N/A'}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end sm:justify-start">
                          <span className={`inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium ${getRiskColor(prediction.riskCategory)}`}>
                            {getRiskIcon(prediction.riskCategory)}
                            <span className="ml-1 capitalize">
                              {formatRiskCategory(prediction.riskCategory)}
                            </span>
                          </span>
                          <button
                            onClick={() => {
                              try {
                                // Find the associated medical record for this prediction
                                const associatedRecord = medicalRecords?.find(
                                  (record: any) => record._id === prediction.medicalRecordId
                                );
                                printAssessment(
                                  prediction, 
                                  `${userProfile.firstName} ${userProfile.lastName}`,
                                  associatedRecord,
                                  userProfile.diabetesStatus
                                );
                              } catch (error: any) {
                                toast.error(error.message || t("dashboard.printAssessment"));
                              }
                            }}
                            className="p-2 sm:p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                            title="Print assessment"
                          >
                            <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <FavoriteAssessmentButton 
                            predictionId={prediction._id} 
                            isFavorite={prediction.isFavorite === true}
                          />
                          <DeleteAssessmentButton predictionId={prediction._id} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("dashboard.recentAssessments.noAssessments")}</h3>
                    <p className="text-gray-500 max-w-sm">{t("dashboard.recentAssessments.startFirst")}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-2xl p-6 shadow-premium">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("dashboard.quickActions.title")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  data-tutorial="new-assessment"
                  onClick={() => setActiveTab("assessment")}
                  className="flex items-center space-x-3 p-4 bg-white rounded-xl hover:shadow-premium-hover transition-all duration-300 transform hover:scale-[1.01]"
                >
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{t("dashboard.quickActions.newAssessment")}</p>
                    <p className="text-sm text-gray-600">
                      {hasDiagnosedDiabetes 
                        ? t("dashboard.quickActions.assessComplicationRisk")
                        : isPrediabetic 
                        ? t("dashboard.quickActions.assessProgressionRisk")
                        : t("dashboard.quickActions.getRiskScore")}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("history")}
                  className="flex items-center space-x-3 p-4 bg-white rounded-xl hover:shadow-premium-hover transition-all duration-300 transform hover:scale-[1.01]"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-green-600 animate-icon-float" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{t("dashboard.quickActions.viewHistory")}</p>
                    <p className="text-sm text-gray-600">{t("dashboard.quickActions.seePastAssessments")}</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("analytics")}
                  className="flex items-center space-x-3 p-4 bg-white rounded-xl hover:shadow-premium-hover transition-all duration-300 transform hover:scale-[1.01]"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-600 animate-icon-float" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{t("dashboard.quickActions.analytics")}</p>
                    <p className="text-sm text-gray-600">{t("dashboard.quickActions.trackProgress")}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assessment Tab */}
        {activeTab === "assessment" && userProfile?.userId && (
          <EnhancedMedicalRecordForm
            patientId={userProfile.userId}
            onSuccess={() => {
              setActiveTab("overview");
              // Scroll to top after tab change
              setTimeout(() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }, 100);
            }}
          />
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-primary-500 rounded-full" />
              <h3 className="text-lg font-semibold text-gray-900">{t("dashboard.history.title")}</h3>
              </div>
              <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">{t("dashboard.history.filterBy")}</label>
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                    className="px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all"
                >
                  <option value="7">{t("dashboard.history.last7Days")}</option>
                  <option value="30">{t("dashboard.history.last30Days")}</option>
                  <option value="90">{t("dashboard.history.last90Days")}</option>
                  <option value="365">{t("dashboard.history.lastYear")}</option>
                </select>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">{t("dashboard.history.show")}:</label>
                  <select
                    value={favoriteFilter}
                    onChange={(e) => setFavoriteFilter(e.target.value as "all" | "favorites")}
                    className="px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all"
                  >
                    <option value="all">{t("dashboard.history.allAssessments")}</option>
                    <option value="favorites">{t("dashboard.history.favoritesOnly")}</option>
                  </select>
                </div>
              </div>
            </div>

            {riskPredictions && riskPredictions.length > 0 ? (
              (() => {
                // Apply favorite filter
                let filtered = riskPredictions;
                if (favoriteFilter === "favorites") {
                  filtered = riskPredictions.filter((p: any) => p.isFavorite === true);
                }
                
                // Show empty state if filtering by favorites and none found
                if (favoriteFilter === "favorites" && filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl shadow-sm border border-gray-100">
                      <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mb-4">
                        <Star className="w-8 h-8 text-yellow-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("dashboard.history.noFavorites")}</h3>
                      <p className="text-sm text-gray-500 max-w-md">
                        {t("dashboard.history.noFavoritesDesc")}
                      </p>
                    </div>
                  );
                }
                
                // Show favorites first, then others
                const favorites = filtered.filter((p: any) => p.isFavorite === true);
                const others = filtered.filter((p: any) => p.isFavorite !== true);
                const sorted = [...favorites, ...others];
                
                return (
              <div className="space-y-4">
                    {sorted.map((prediction: any, index: number) => {
                  const originalIndex = riskPredictions.findIndex((p: any) => p._id === prediction._id);
                  const assessmentNumber = riskPredictions.length - originalIndex;
                  const isFavorite = prediction.isFavorite === true;
                  const riskCategory = prediction.riskCategory.toLowerCase();
                  const borderColor = riskCategory === 'low' ? 'border-l-green-500' :
                                     riskCategory === 'moderate' ? 'border-l-yellow-500' :
                                     riskCategory === 'high' ? 'border-l-orange-500' :
                                     'border-l-red-500';
                  const bgColor = riskCategory === 'low' ? 'bg-green-100' :
                                 riskCategory === 'moderate' ? 'bg-yellow-100' :
                                 riskCategory === 'high' ? 'bg-orange-100' :
                                 'bg-red-100';
                  const badgeColor = riskCategory === 'low' ? 'bg-green-100 text-green-700' :
                                    riskCategory === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                                    riskCategory === 'high' ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700';
                  
                  return (
                    <div 
                      key={prediction._id} 
                      className={`
                        relative bg-white rounded-2xl p-5 shadow-premium 
                        hover:shadow-premium-hover transition-all duration-300
                        border-l-4 animate-fade-in-up
                        ${borderColor}
                        ${isFavorite ? 'ring-2 ring-yellow-200' : ''}
                      `}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {/* Timeline connector */}
                      {index !== riskPredictions.length - 1 && (
                        <div className="absolute left-7 top-full w-0.5 h-4 bg-gray-200" />
                      )}
                      
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bgColor}`}>
                            <span className="text-lg font-bold text-gray-700">#{assessmentNumber}</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                              Assessment #{assessmentNumber}
                              {originalIndex === 0 && <span className="text-xs text-primary-600 font-normal">(Latest)</span>}
                              {isFavorite && (
                                <span title="Favorite">
                                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-gray-500">{formatDateTime(prediction._creationTime)} • {getTimeAgo(prediction._creationTime)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${badgeColor}`}>
                          {formatRiskCategory(prediction.riskCategory)} Risk
                        </span>
                        <button
                          onClick={() => {
                            try {
                              // Find the associated medical record for this prediction
                              const associatedRecord = medicalRecords?.find(
                                (record: any) => record._id === prediction.medicalRecordId
                              );
                              printAssessment(
                                prediction, 
                                `${userProfile.firstName} ${userProfile.lastName}`,
                                associatedRecord,
                                userProfile.diabetesStatus
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
                        <FavoriteAssessmentButton 
                          predictionId={prediction._id} 
                          isFavorite={isFavorite}
                        />
                        <DeleteAssessmentButton predictionId={prediction._id} />
                      </div>
                    </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-900">{prediction.riskScore?.toFixed(1)}%</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {hasDiagnosedDiabetes 
                              ? 'Complication Risk' 
                              : isPrediabetic 
                              ? 'Progression Risk' 
                              : 'Risk Score'}
                          </p>
                      </div>
                        <div className="text-center border-x border-gray-200">
                        <p className="text-2xl font-bold text-gray-900">
                          {prediction.confidenceScore ? 
                            (typeof prediction.confidenceScore === 'number' ? 
                              prediction.confidenceScore.toFixed(1) : 
                              prediction.confidenceScore) : 'N/A'}%
                        </p>
                          <p className="text-xs text-gray-500 mt-1">Confidence</p>
                      </div>
                        <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">
                          {hasDiagnosedDiabetes 
                            ? ((prediction.riskScore || 0) >= 50 ? 'High' : (prediction.riskScore || 0) >= 30 ? 'Moderate' : 'Low')
                            : (prediction.riskScore || 0) >= 75 ? 'Yes' : 'No'}
                        </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {hasDiagnosedDiabetes 
                              ? 'Complication Risk' 
                              : isPrediabetic 
                              ? 'Progression Risk' 
                              : 'Diabetes Risk'}
                          </p>
                      </div>
                    </div>

                      {/* Expandable recommendations */}
                    {prediction.recommendations && prediction.recommendations.length > 0 && (
                        <details className="mt-4 group">
                          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-primary-600 hover:text-primary-700">
                            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                            {t("dashboard.history.viewRecommendations")}
                          </summary>
                          <div className="mt-3 pl-6 space-y-2">
                            {prediction.recommendations.map((rec: string, i: number) => (
                              <p key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-primary-500 mt-0.5">•</span>
                              {rec}
                              </p>
                          ))}
                      </div>
                        </details>
                    )}
                  </div>
                  );
                })}
              </div>
                );
              })()
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <Calendar className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("dashboard.history.noHistory")}</h3>
                <p className="text-gray-500 max-w-sm">{t("dashboard.history.completeFirst")}</p>
              </div>
            )}
          </div>
        )}

        {/* ==================== MEDICATIONS TAB ==================== */}
        {activeTab === "medications" && userProfile?.userId && (
          <MedicationTracker patientId={userProfile.userId} />
        )}

        {/* ==================== EDUCATION TAB ==================== */}
        {activeTab === "education" && (
          <PatientEducationResources />
        )}

        {/* Messaging Modal - Only for registered users, not guests */}
        {userProfile?.userId && !userProfile.isGuest && (
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
        )}

        {/* ==================== ANALYTICS TAB ==================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">{t("dashboard.analytics.title")}</h2>
            
            {(() => {
              // Use riskPredictions as the main data source
              const predictions = riskPredictions || [];
              
              // CRITICAL: Sort predictions properly - newest first
              const sortedPredictions = [...predictions]
                .sort((a: any, b: any) => (b.timestamp || b._creationTime || 0) - (a.timestamp || a._creationTime || 0));
              
              const latestPrediction = sortedPredictions[0];
              const previousPrediction = sortedPredictions[1];
              const totalAssessments = sortedPredictions.length;
              
              // Calculate trend
              const trendDiff = latestPrediction && previousPrediction 
                ? (latestPrediction.riskScore || 0) - (previousPrediction.riskScore || 0)
                : 0;
              const isImproving = trendDiff < -5;
              const isWorsening = trendDiff > 5;
              
              // Use medical records for metric charts (more reliable than predictions)
              const sortedRecords = [...(medicalRecords || [])]
                .sort((a: any, b: any) => (a._creationTime || a.timestamp || 0) - (b._creationTime || b.timestamp || 0));
              
              // Prepare chart data - use INDEX as X-axis to avoid overlap
              const chartData = sortedPredictions
                .slice()
                .reverse() // Oldest first for left-to-right progression
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
              
              // Debug log
              console.log('Analytics Debug:', {
                totalPredictions: predictions?.length,
                sortedCount: sortedPredictions.length,
                chartDataCount: chartData.length,
                chartData: chartData,
                latestPrediction: latestPrediction,
                featureImportance: latestPrediction?.featureImportance
              });
              
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
                            ? t("dashboard.metrics.complicationRisk")
                            : isPrediabetic 
                            ? t("dashboard.metrics.progressionRisk")
                            : t("dashboard.metrics.latestRiskScore")}
                        </span>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          latestPrediction?.riskCategory === 'low' ? 'bg-green-100' :
                          latestPrediction?.riskCategory === 'moderate' ? 'bg-yellow-100' :
                          latestPrediction?.riskCategory === 'high' ? 'bg-orange-100' : 'bg-red-100'
                        }`}>
                          <Activity className={`w-5 h-5 animate-icon-float ${
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
                          <Target className="w-5 h-5 text-purple-600 animate-icon-float" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">
                        {latestPrediction?.confidenceScore ? latestPrediction.confidenceScore.toFixed(1) : '0'}%
                      </p>
                      <p className="text-sm text-gray-500 mt-1">model confidence</p>
                    </div>
                    
                    {/* Health Trend - Color based on trend direction, not risk category */}
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
                              {isImproving ? t("dashboard.analytics.trendImproving") : isWorsening ? t("dashboard.status.increasingRisk") : t("dashboard.analytics.trendStable")}
                            </p>
                            <p className={`text-sm mt-1 ${textColorClasses} opacity-90`}>
                              {trendDiff !== 0 ? `${trendDiff > 0 ? '+' : ''}${trendDiff.toFixed(1)}%` : 'No change'}
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
                            ? t("dashboard.analytics.complicationRiskTrend")
                            : isPrediabetic 
                            ? t("dashboard.analytics.progressionRiskTrend")
                            : t("dashboard.analytics.riskScoreTrend")}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {hasDiagnosedDiabetes 
                            ? t("dashboard.analytics.complicationRiskTrend")
                            : isPrediabetic 
                            ? t("dashboard.analytics.progressionRiskTrend")
                            : t("dashboard.analytics.riskScoreTrend")}
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
                          {isImproving ? t("dashboard.analytics.trendImproving") : isWorsening ? t("dashboard.analytics.trendWorsening") : t("dashboard.analytics.trendStable")}
              </div>
            )}
                    </div>
                    
                    {totalAssessments < 2 && (
                      <p className="text-amber-600 text-sm mb-4 bg-amber-50 p-3 rounded-lg">
                        ⚠️ {t("dashboard.analytics.needMoreAssessments")}
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
                            ? t("dashboard.analytics.keyFactorsManagement")
                            : isPrediabetic 
                            ? t("dashboard.analytics.keyFactorsProgression")
                            : t("dashboard.analytics.keyRiskFactors")}
                        </h3>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 bg-red-500 rounded-full"></span> {t("dashboard.analytics.aboveNormal")}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 bg-yellow-500 rounded-full"></span> {t("dashboard.analytics.borderline")}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 bg-green-500 rounded-full"></span> {t("dashboard.analytics.normal")}
                        </span>
                      </div>
                    </div>
                    
                    {(() => {
                      const latestImportance = latestPrediction?.featureImportance || {};
                      
                      // Get previous prediction for comparison
                      const previousPrediction = sortedPredictions[1];
                      
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
                      
                      // Risk factor explanations - Enhanced with structured format
                      const factorExplanations: Record<string, { title: string; description: string; normalRange?: string; diabetesRisk: string }> = {
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
                        bloodpressure: {
                          title: "Blood Pressure",
                          description: "The force of blood against your artery walls. Measured as systolic (top) and diastolic (bottom) numbers.",
                          normalRange: hasDiagnosedDiabetes
                            ? "Target: <130/80 mmHg | Elevated: 130-139/80-89 mmHg | High: 140+/90+ mmHg"
                            : "Normal: <120/80 mmHg | Elevated: 120-129/<80 mmHg | High: 130+/80+ mmHg",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "High blood pressure significantly increases complication risk in diabetes. Managing BP is crucial for preventing heart disease, kidney damage, and stroke."
                            : "High blood pressure often occurs with diabetes. Both conditions share risk factors and can worsen each other, increasing cardiovascular complications.",
                        },
                        age: {
                          title: "Age",
                          description: "Your current age. Age is a non-modifiable risk factor that significantly impacts diabetes risk.",
                          normalRange: hasDiagnosedDiabetes
                            ? "Complication risk increases with age, especially after 60 years"
                            : "Risk increases: After 45 years | Highest risk: 65+ years",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Older age increases complication risk. Regular monitoring and preventive care become even more important as you age."
                            : "Age is a significant risk factor. As you age, your body becomes less efficient at processing glucose. Risk increases substantially after age 45.",
                        },
                        insulin: {
                          title: "Insulin Level",
                          description: "The amount of insulin hormone in your blood. Insulin helps your body use glucose (sugar) for energy.",
                          normalRange: "Fasting: 2-25 µU/mL (varies by lab)",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "High insulin levels indicate insulin resistance, making glucose control more difficult. Managing insulin resistance through medication and lifestyle is crucial for preventing complications."
                            : "High insulin levels may indicate insulin resistance - your body needs more insulin to process glucose. This is a key early warning sign of type 2 diabetes.",
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
                          diabetesRisk: "Having a family history of diabetes significantly increases your risk. Genetics play a role, but lifestyle factors can help reduce this inherited risk.",
                        },
                        pregnancies: {
                          title: "Number of Pregnancies",
                          description: "The total number of times you have been pregnant, regardless of outcome (live birth, miscarriage, etc.).",
                          normalRange: "Varies by individual",
                          diabetesRisk: "Multiple pregnancies can increase diabetes risk in women. Gestational diabetes during pregnancy also significantly increases future type 2 diabetes risk.",
                        },
                        glucosebmiratio: {
                          title: "Glucose to BMI Ratio",
                          description: "A calculated ratio comparing your blood glucose level to your body mass index. Higher ratios indicate elevated blood sugar relative to body weight.",
                          normalRange: "Lower ratios are healthier",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Higher ratios indicate poor glucose control relative to body weight, increasing complication risk. Weight management and glucose control are both important."
                            : "Higher ratios indicate that your blood sugar is elevated relative to your body weight, which is a strong indicator of diabetes risk and metabolic dysfunction.",
                        },
                        agebmiinteraction: {
                          title: "Age × BMI Interaction",
                          description: "The combined effect of age and BMI. This metric captures how age and body weight interact to influence diabetes risk.",
                          normalRange: "Lower values are healthier",
                          diabetesRisk: hasDiagnosedDiabetes
                            ? "Older age combined with high BMI significantly increases complication risk. Weight management becomes even more important as you age with diabetes."
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
                            : "Higher ratios indicate insulin resistance - your body needs more insulin to process the same amount of glucose. This is a key early warning sign of type 2 diabetes.",
                        },
                      };
                      
                      // Get current values from medical records
                      const latestRecord = medicalRecords?.[0];
                      
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
                      
                      // Get user gender to filter out pregnancy factors for males
                      const userGender = (dashboardData?.profile?.gender || userProfile?.gender || 'male')?.toLowerCase();
                      const isMale = userGender === 'male';
                      
                      // Build factors array with ALL features from featureImportance
                      const factors = Object.entries(latestImportance)
                        .map(([featureKey, importance]) => {
                          const importancePercent = (importance as number) * 100;
                          const currentValue = getFeatureValue(featureKey);
                          const range = getHealthyRange(featureKey);
                          
                          // Format feature name nicely - handle underscores and camelCase
                          const formatFeatureName = (key: string): string => {
                            // Replace underscores with spaces
                            let formatted = key.replace(/_/g, ' ');
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
                          
                          const formattedName = formatFeatureName(featureKey);
                          
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
                              description: `This factor contributes ${importancePercent.toFixed(1)}% to your ${hasDiagnosedDiabetes ? 'complication risk' : isPrediabetic ? 'progression risk' : 'diabetes risk'} assessment.`,
                              diabetesRisk: `This metric is used by our AI model to calculate your personalized ${hasDiagnosedDiabetes ? 'complication risk' : isPrediabetic ? 'progression risk' : 'diabetes risk'} score.`,
                            },
                            ...range
                          };
                        })
                        .filter(f => {
                          // Filter out pregnancy-related factors for males
                          if (isMale) {
                            const normalizedKey = f.key.toLowerCase().replace(/[^a-z]/g, '');
                            if (normalizedKey.includes('pregnancy') || normalizedKey.includes('pregnancies')) {
                              return false;
                            }
                          }
                          
                          // For diagnosed diabetic patients, filter out factors that are primarily about predicting diabetes risk
                          // These factors are less relevant for managing existing diabetes
                          if (hasDiagnosedDiabetes) {
                            const normalizedKey = f.key.toLowerCase().replace(/[^a-z]/g, '');
                            // Filter out Diabetes Pedigree Function (family history/genetic risk) - not relevant for managing existing diabetes
                            if (normalizedKey.includes('diabetespedigree') || normalizedKey.includes('pedigree')) {
                              return false;
                            }
                            // Keep all other factors as they're relevant for complication risk and management
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
                    const nonDeletedPredictions = (riskPredictions || []).filter((p: any) => p.isDeleted !== true);
                    const validMedicalRecordIds = new Set(
                      nonDeletedPredictions.map((p: any) => p.medicalRecordId).filter(Boolean)
                    );
                    
                    // Get ALL medical records, but filter to only those associated with non-deleted predictions
                    const filteredRecords = (medicalRecords || []).filter((record: any) => {
                      // Include record if it's associated with a non-deleted prediction
                      return validMedicalRecordIds.has(record._id);
                    });
                    
                    // Sort by timestamp (oldest first for chart progression)
                    const sortedRecords = [...filteredRecords]
                      .sort((a: any, b: any) => (a._creationTime || a.timestamp || 0) - (b._creationTime || b.timestamp || 0));
                    
                    // Debug log to see what data we have
                    console.log('Medical Records for charts (filtered):', sortedRecords.length, sortedRecords);
                    
                    // Create chart data from medical records
                    let metricChartData = sortedRecords.map((record: any, index: number) => ({
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
                    
                    console.log('Chart data created from medical records:', metricChartData);
                    
                    // If no medical records or all values are 0, try to use predictions' inputData
                    // But only use non-deleted predictions
                    if (metricChartData.length === 0 || metricChartData.every((d: any) => d.glucose === 0 && d.bmi === 0)) {
                      console.log('No medical records or all zeros, trying predictions inputData...');
                      
                      const nonDeletedSortedPredictions = sortedPredictions
                        .filter((p: any) => p.isDeleted !== true)
                        .slice()
                        .reverse(); // Oldest first
                      
                      const predictionChartData = nonDeletedSortedPredictions.map((pred: any, index: number) => ({
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
                      
                      console.log('Prediction inputData chart data:', predictionChartData);
                      
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
                  {zoomedChart && (
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
                          {(() => {
                            const chartData = (() => {
                              if (!riskPredictions || riskPredictions.length === 0) {
                                return [];
                              }
                              
                              const sortedPredictions = [...riskPredictions]
                                .filter((p: any) => !p.isDeleted)
                                .sort((a: any, b: any) => a._creationTime - b._creationTime);
                              
                              return sortedPredictions.map((prediction: any, index: number) => {
                                const record = medicalRecords?.find((r: any) => r._id === prediction.medicalRecordId);
                                return {
                                  name: `#${index + 1}`,
                                  index: index + 1,
                                  glucose: record?.glucoseLevel || 0,
                                  bmi: record?.bmi || 0,
                                  systolic: record?.systolicBP || 0,
                                  diastolic: record?.diastolicBP || 0,
                                };
                              });
                            })();
                            
                            if (zoomedChart === "glucose") {
                              return (
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
                              );
                            } else if (zoomedChart === "bmi") {
                              return (
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
                              );
                            } else if (zoomedChart === "bloodpressure") {
                              return (
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
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* ===== RISK DISTRIBUTION ===== */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                      <h3 className="font-semibold text-gray-900">Risk Distribution</h3>
                    </div>
                    
                    {(() => {
                      const distribution = {
                        low: sortedPredictions.filter((p: any) => (p.riskScore || 0) < 20).length,
                        moderate: sortedPredictions.filter((p: any) => (p.riskScore || 0) >= 20 && (p.riskScore || 0) < 50).length,
                        high: sortedPredictions.filter((p: any) => (p.riskScore || 0) >= 50 && (p.riskScore || 0) < 75).length,
                        veryHigh: sortedPredictions.filter((p: any) => (p.riskScore || 0) >= 75).length,
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

                  {/* ===== COMPARATIVE ANALYSIS (Combined: Your Comparison + Population Benchmarks) ===== */}
                  {populationStats && latestPrediction && medicalRecords && medicalRecords.length > 0 && cohortStats && (() => {
                    const latestRecord = medicalRecords[0];
                    
                    // Calculate patient age and determine cohort
                    const patientAge = userProfile.dateOfBirth
                      ? Math.floor((Date.now() - new Date(userProfile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                      : null;
                    const ageCohort = patientAge !== null
                      ? patientAge < 30 ? "18-29"
                      : patientAge < 40 ? "30-39"
                      : patientAge < 50 ? "40-49"
                      : patientAge < 60 ? "50-59"
                      : patientAge < 70 ? "60-69"
                      : "70+"
                      : null;
                    
                    // Get cohort-specific averages
                    const userCohort = cohortStats.userCohort || "";
                    const matchingCohort = cohortStats.cohorts?.find((c: any) => 
                      c.cohort === userCohort || 
                      (ageCohort && c.cohort === ageCohort) ||
                      (userProfile.gender && c.cohort === userProfile.gender) ||
                      (ageCohort && userProfile.gender && c.cohort === `${ageCohort}_${userProfile.gender}`)
                    );
                    
                    // Use cohort-specific averages if available, otherwise use general population
                    const avgRiskScore = matchingCohort?.averageRiskScore ?? populationStats.averageRiskScore;
                    const avgGlucose = matchingCohort?.averageGlucose ?? populationStats.averageGlucose;
                    const avgBMI = matchingCohort?.averageBMI ?? populationStats.averageBMI;
                    const avgSystolicBP = matchingCohort?.averageSystolicBP ?? populationStats.averageSystolicBP;
                    const avgDiastolicBP = matchingCohort?.averageDiastolicBP ?? populationStats.averageDiastolicBP;
                    
                    // Determine comparison label
                    let comparisonLabel = "vs. Average Population";
                    if (matchingCohort) {
                      if (matchingCohort.cohort.includes("_")) {
                        const [age, gender] = matchingCohort.cohort.split("_");
                        comparisonLabel = `vs. ${age} ${gender === "male" ? "Males" : "Females"}`;
                      } else if (ageCohort && matchingCohort.cohort === ageCohort) {
                        comparisonLabel = `vs. ${ageCohort} Age Group`;
                      } else if (userProfile.gender && matchingCohort.cohort === userProfile.gender) {
                        comparisonLabel = `vs. ${userProfile.gender === "male" ? "Males" : "Females"}`;
                      }
                    }
                    
                    return (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                          <h3 className="font-semibold text-gray-900">Population Comparison</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Compare by:</span>
                          <select
                            value={cohortFilter}
                            onChange={(e) => setCohortFilter(e.target.value as "age" | "gender")}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                          >
                            <option value="age">Age</option>
                            <option value="gender">Gender</option>
                          </select>
                        </div>
                      </div>

                      {/* Your Personal Comparison Section */}
                      <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <h4 className="font-semibold text-gray-900">Your Comparison</h4>
                          <span className="text-xs text-gray-500">
                            {comparisonLabel} (Global Average)
                          </span>
                        </div>

                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Risk Score Comparison */}
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              {hasDiagnosedDiabetes 
                                ? 'Complication Risk' 
                                : isPrediabetic 
                                ? 'Progression Risk' 
                                : 'Risk Score'}
                            </span>
                            <Activity className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>You</span>
                                <span className="font-bold text-blue-700">
                                  {latestPrediction.riskScore?.toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full"
                                  style={{ width: `${Math.min(latestPrediction.riskScore || 0, 100)}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Population Avg</span>
                                <span className="font-medium text-gray-700">
                                  {avgRiskScore.toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gray-400 rounded-full"
                                  style={{ width: `${Math.min(avgRiskScore, 100)}%` }}
                                />
                              </div>
                            </div>
                            <div className={`text-xs font-medium mt-2 ${
                              (latestPrediction.riskScore || 0) < avgRiskScore
                                ? 'text-green-600'
                                : (latestPrediction.riskScore || 0) > avgRiskScore
                                ? 'text-red-600'
                                : 'text-gray-600'
                            }`}>
                              {Math.abs((latestPrediction.riskScore || 0) - avgRiskScore).toFixed(1)}% {
                                (latestPrediction.riskScore || 0) < avgRiskScore
                                  ? 'below'
                                  : (latestPrediction.riskScore || 0) > avgRiskScore
                                  ? 'above'
                                  : 'equal to'
                              } average
                            </div>
                          </div>
                        </div>

                        {/* Glucose Comparison */}
                        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Glucose</span>
                            <Activity className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>You</span>
                                <span className="font-bold text-green-700">
                                  {latestRecord.glucoseLevel?.toFixed(0) || 'N/A'} mg/dL
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Population Avg</span>
                                <span className="font-medium text-gray-700">
                                  {avgGlucose.toFixed(0)} mg/dL
                                </span>
                              </div>
                            </div>
                            {latestRecord.glucoseLevel && (
                              <div className={`text-xs font-medium mt-2 ${
                                latestRecord.glucoseLevel < avgGlucose
                                  ? 'text-green-600'
                                  : latestRecord.glucoseLevel > avgGlucose
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}>
                                {Math.abs(latestRecord.glucoseLevel - avgGlucose).toFixed(0)} mg/dL {
                                  latestRecord.glucoseLevel < avgGlucose
                                    ? 'below'
                                    : latestRecord.glucoseLevel > avgGlucose
                                    ? 'above'
                                    : 'equal to'
                                } average
                              </div>
                            )}
                          </div>
                        </div>

                        {/* BMI Comparison */}
                        <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">BMI</span>
                            <Activity className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>You</span>
                                <span className="font-bold text-purple-700">
                                  {latestRecord.bmi?.toFixed(1) || 'N/A'}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Population Avg</span>
                                <span className="font-medium text-gray-700">
                                  {avgBMI.toFixed(1)}
                                </span>
                              </div>
                            </div>
                            {latestRecord.bmi && (
                              <div className={`text-xs font-medium mt-2 ${
                                latestRecord.bmi < avgBMI
                                  ? 'text-green-600'
                                  : latestRecord.bmi > avgBMI
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}>
                                {Math.abs(latestRecord.bmi - avgBMI).toFixed(1)} {
                                  latestRecord.bmi < avgBMI
                                    ? 'below'
                                    : latestRecord.bmi > avgBMI
                                    ? 'above'
                                    : 'equal to'
                                } average
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Blood Pressure Comparison */}
                        <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Systolic BP</span>
                            <Activity className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>You</span>
                                <span className="font-bold text-red-700">
                                  {latestRecord.systolicBP?.toFixed(0) || 'N/A'} mmHg
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Population Avg</span>
                                <span className="font-medium text-gray-700">
                                  {avgSystolicBP.toFixed(0)} mmHg
                                </span>
                              </div>
                            </div>
                            {latestRecord.systolicBP && (
                              <div className={`text-xs font-medium mt-2 ${
                                latestRecord.systolicBP < avgSystolicBP
                                  ? 'text-green-600'
                                  : latestRecord.systolicBP > avgSystolicBP
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}>
                                {Math.abs(latestRecord.systolicBP - avgSystolicBP).toFixed(0)} mmHg {
                                  latestRecord.systolicBP < avgSystolicBP
                                    ? 'below'
                                    : latestRecord.systolicBP > avgSystolicBP
                                    ? 'above'
                                    : 'equal to'
                                } average
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      </div>

                      {/* Population Benchmarks Reference Table */}
                      {cohortStats && cohortStats.cohorts && cohortStats.cohorts.length > 0 && (
                        <div className="border-t border-gray-200 pt-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">Population Benchmarks</h4>
                              <span className="text-xs text-gray-500">
                                Reference data for all {cohortFilter === "age" ? "age groups" : "genders"} (Global Average)
                              </span>
                            </div>
                          </div>
                          
                          {/* Compact Table View */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-3 font-semibold text-gray-700">
                                    {cohortFilter === "age" ? "Age Group" : "Gender"}
                                  </th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-700">
                                    {hasDiagnosedDiabetes ? "Avg Complication Risk" : isPrediabetic ? "Avg Progression Risk" : "Avg Risk Score"}
                                  </th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Avg Glucose</th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Avg BMI</th>
                                  {cohortFilter === "age" && (
                                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Avg BP</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {cohortStats.cohorts.map((cohort: any) => {
                                  const isPatientCohort = cohort.cohort === cohortStats.userCohort;
                                  const cohortDisplayName = cohort.cohort.includes("_")
                                    ? cohort.cohort.split("_").map((part: string) => 
                                        part === "male" ? "Male" : 
                                        part === "female" ? "Female" : 
                                        part
                                      ).join(" - ")
                                    : cohort.cohort === "male" ? "Male" 
                                    : cohort.cohort === "female" ? "Female"
                                    : cohort.cohort;
                                  
                                  return (
                                    <tr
                                      key={cohort.cohort}
                                      className={`border-b border-gray-100 ${
                                        isPatientCohort ? "bg-indigo-50" : "hover:bg-gray-50"
                                      }`}
                                    >
                                      <td className="py-2 px-3">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-gray-900">{cohortDisplayName}</span>
                                          {isPatientCohort && (
                                            <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-medium rounded-full">
                                              You
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="text-right py-2 px-3 font-medium text-gray-900">
                                        {cohort.averageRiskScore.toFixed(1)}%
                                      </td>
                                      <td className="text-right py-2 px-3 text-gray-700">
                                        {cohort.averageGlucose.toFixed(0)} mg/dL
                                      </td>
                                      <td className="text-right py-2 px-3 text-gray-700">
                                        {cohort.averageBMI.toFixed(1)}
                                      </td>
                                      {cohortFilter === "age" && (
                                        <td className="text-right py-2 px-3 text-gray-700">
                                          {cohort.averageSystolicBP ? `${cohort.averageSystolicBP.toFixed(0)}/${cohort.averageDiastolicBP?.toFixed(0) || '--'}` : '--'}
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {/* ===== PREDICTIVE TRENDS ===== */}
                  {predictiveTrends && predictiveTrends.hasEnoughData && predictiveTrends.historicalData && predictiveTrends.historicalData.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
                        <h3 className="font-semibold text-gray-900">Predictive Trends</h3>
                        <span className="text-xs text-gray-500 ml-2">30-day Forecast</span>
                      </div>

                      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5 text-amber-600" />
                          <span className="font-medium text-amber-900">
                            Trend: {predictiveTrends.trend?.direction === "increasing" 
                              ? (hasDiagnosedDiabetes ? "Increasing Complication Risk" : isPrediabetic ? "Increasing Progression Risk" : "Increasing Risk")
                              : predictiveTrends.trend?.direction === "decreasing" 
                              ? (hasDiagnosedDiabetes ? "Decreasing Complication Risk" : isPrediabetic ? "Decreasing Progression Risk" : "Decreasing Risk")
                              : "Stable"}
                          </span>
                        </div>
                        <p className="text-sm text-amber-700">
                          Based on your historical data, your {hasDiagnosedDiabetes 
                            ? 'complication risk' 
                            : isPrediabetic 
                            ? 'progression risk' 
                            : 'risk score'} is projected to{" "}
                          {predictiveTrends.trend?.direction === "increasing"
                            ? "increase"
                            : predictiveTrends.trend?.direction === "decreasing"
                            ? "decrease"
                            : "remain stable"}{" "}
                          over the next 30 days.
                        </p>
                      </div>

                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={[
                              ...predictiveTrends.historicalData.map((d: any, i: number) => {
                                // Ensure riskScore is properly parsed
                                let riskScore: number;
                                if (typeof d.riskScore === 'number') {
                                  riskScore = d.riskScore;
                                } else if (d.riskScore !== null && d.riskScore !== undefined) {
                                  riskScore = parseFloat(String(d.riskScore));
                                  if (isNaN(riskScore)) {
                                    riskScore = 0;
                                  }
                                } else {
                                  riskScore = 0;
                                }
                                
                                // If riskScore is between 0-1 (excluding 0), convert from probability to percentage
                                if (riskScore > 0 && riskScore <= 1) {
                                  riskScore = riskScore * 100;
                                }
                                
                                // Ensure it's in 0-100 range
                                riskScore = Math.max(0, Math.min(100, riskScore));
                                
                                return {
                                  date: new Date(d.date).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                  }),
                                  type: "historical",
                                  riskScore: riskScore,
                                  historical: riskScore,
                                  forecast: undefined,
                                  index: i,
                                };
                              }),
                              ...predictiveTrends.forecast.map((d: any, i: number) => {
                                // Ensure riskScore is properly parsed
                                let riskScore: number;
                                if (typeof d.riskScore === 'number') {
                                  riskScore = d.riskScore;
                                } else if (d.riskScore !== null && d.riskScore !== undefined) {
                                  riskScore = parseFloat(String(d.riskScore));
                                  if (isNaN(riskScore)) {
                                    riskScore = 0;
                                  }
                                } else {
                                  riskScore = 0;
                                }
                                
                                // If riskScore is between 0-1 (excluding 0), convert from probability to percentage
                                if (riskScore > 0 && riskScore <= 1) {
                                  riskScore = riskScore * 100;
                                }
                                
                                // Ensure it's in 0-100 range
                                riskScore = Math.max(0, Math.min(100, riskScore));
                                
                                return {
                                  date: new Date(d.date).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                  }),
                                  type: "forecast",
                                  riskScore: riskScore,
                                  historical: undefined,
                                  forecast: riskScore,
                                  index: predictiveTrends.historicalData.length + i,
                                };
                              }),
                            ]}
                            margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                          >
                            <defs>
                              <linearGradient id="historicalGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12, fill: "#6b7280" }}
                              axisLine={{ stroke: "#e5e7eb" }}
                            />
                            <YAxis
                              domain={[0, 100]}
                              tickFormatter={(v) => `${v}%`}
                              tick={{ fontSize: 12, fill: "#6b7280" }}
                              axisLine={{ stroke: "#e5e7eb" }}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const data = payload[0].payload;
                                // Get the value from the payload - it should have historical or forecast
                                // The payload value comes from the dataKey (historical or forecast)
                                let riskValue: number = 0;
                                
                                // Try to get from payload value first (this is what the chart uses)
                                if (payload[0].value !== null && payload[0].value !== undefined) {
                                  riskValue = typeof payload[0].value === 'number' ? payload[0].value : parseFloat(String(payload[0].value)) || 0;
                                } else if (data.historical !== null && data.historical !== undefined) {
                                  riskValue = typeof data.historical === 'number' ? data.historical : parseFloat(String(data.historical)) || 0;
                                } else if (data.forecast !== null && data.forecast !== undefined) {
                                  riskValue = typeof data.forecast === 'number' ? data.forecast : parseFloat(String(data.forecast)) || 0;
                                } else if (data.riskScore !== null && data.riskScore !== undefined) {
                                  riskValue = typeof data.riskScore === 'number' ? data.riskScore : parseFloat(String(data.riskScore)) || 0;
                                }
                                
                                // Ensure it's in 0-100 range
                                if (riskValue > 0 && riskValue <= 1) {
                                  riskValue = riskValue * 100;
                                }
                                riskValue = Math.max(0, Math.min(100, riskValue));
                                
                                return (
                                  <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-200">
                                    <p className="font-semibold text-gray-900">
                                      {data.type === "forecast" ? "🔮 Forecast" : "📊 Historical"}
                                    </p>
                                    <p className="text-xs text-gray-500 mb-2">{data.date}</p>
                                    <p className="text-sm">
                                      <span className="text-gray-500">
                                        {hasDiagnosedDiabetes 
                                          ? 'Complication Risk:' 
                                          : isPrediabetic 
                                          ? 'Progression Risk:' 
                                          : 'Risk Score:'}
                                      </span>{" "}
                                      <span className="font-bold text-blue-600">
                                        {riskValue.toFixed(1)}%
                                      </span>
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="historical"
                              stroke="#3B82F6"
                              strokeWidth={3}
                              fill="url(#historicalGradient)"
                              dot={{ fill: "#3B82F6", strokeWidth: 2, r: 4 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="forecast"
                              stroke="#F59E0B"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              fill="url(#forecastGradient)"
                              dot={{ fill: "#F59E0B", strokeWidth: 2, r: 4 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-2 bg-blue-500 rounded"></span> Historical Data
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-2 bg-amber-500 rounded border-2 border-dashed border-amber-600"></span> Forecast
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Blood Sugar Food Recommendations */}
                  {userProfile?.userId && (
                    <BloodSugarFoodRecommendations 
                      patientId={userProfile.userId}
                      diabetesStatus={userProfile.diabetesStatus}
                    />
                  )}

                  {predictiveTrends && !predictiveTrends.hasEnoughData && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
                        <h3 className="font-semibold text-gray-900">Predictive Trends</h3>
                      </div>
                      <div className="text-center py-8">
                        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium">{predictiveTrends.message}</p>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
      
      {/* Interactive Tutorial */}
      {showTutorial && (
        <InteractiveTutorial
          steps={patientTutorialSteps.map((step) => ({
            ...step,
            action: step.id === "analytics-tab" ? () => setActiveTab("analytics") :
                    step.id === "history-tab" ? () => setActiveTab("history") :
                    step.id === "medications-tab" ? () => setActiveTab("medications") :
                    step.id === "education-tab" ? () => setActiveTab("education") :
                    step.id === "messages-tab" ? () => setIsMessagingOpen(true) :
                    step.action,
          }))}
          onComplete={() => setShowTutorial(false)}
          onSkip={() => setShowTutorial(false)}
          role="patient"
        />
      )}
    </div>
  );
}
