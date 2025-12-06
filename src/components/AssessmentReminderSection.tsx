import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Clock, Bell, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function AssessmentReminderSection() {
  const reminder = useQuery(api.reminders.getPatientReminder);
  const setReminder = useMutation(api.reminders.setAssessmentReminder);
  const [selectedFrequency, setSelectedFrequency] = useState<string>(
    reminder?.frequency || "monthly"
  );
  const [customDays, setCustomDays] = useState<number>(30);
  const [isSaving, setIsSaving] = useState(false);

  const frequencyOptions = [
    { value: "weekly", label: "Weekly", days: 7 },
    { value: "biweekly", label: "Every 2 Weeks", days: 14 },
    { value: "monthly", label: "Monthly", days: 30 },
    { value: "quarterly", label: "Every 3 Months", days: 90 },
    { value: "custom", label: "Custom", days: customDays },
  ];

  const handleSaveReminder = async () => {
    setIsSaving(true);
    try {
      await setReminder({
        frequency: selectedFrequency as any,
        customDays: selectedFrequency === "custom" ? customDays : undefined,
      });
      toast.success("Reminder settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save reminder settings");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
          <Bell className="w-5 h-5 text-blue-600" />
        </div>
        Assessment Reminders
      </h3>

      {reminder && reminder.isActive ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Reminder Active</p>
                <p className="text-sm text-gray-600">
                  Frequency: {frequencyOptions.find((f) => f.value === reminder.frequency)?.label || reminder.frequency}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Next Reminder:</span>
                <span className="font-medium text-gray-900">
                  {formatDate(reminder.reminderDate)}
                </span>
              </div>
              {reminder.lastAssessmentDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Assessment:</span>
                  <span className="font-medium text-gray-900">
                    {formatDate(reminder.lastAssessmentDate)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-600 mb-4">
            Set up automatic reminders to help you stay on track with regular health assessments.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reminder Frequency
          </label>
          <select
            value={selectedFrequency}
            onChange={(e) => setSelectedFrequency(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {frequencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.days} days)
              </option>
            ))}
          </select>
        </div>

        {selectedFrequency === "custom" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Days
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={customDays}
              onChange={(e) => setCustomDays(parseInt(e.target.value) || 30)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        <button
          onClick={handleSaveReminder}
          disabled={isSaving}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Clock className="w-4 h-4" />
              {reminder?.isActive ? "Update Reminder" : "Set Reminder"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}








