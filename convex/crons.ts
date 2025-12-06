import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Schedule medication reminder checks (runs every hour)
// Note: For production, this runs hourly. For testing, you can change { hours: 1 } to { minutes: 5 } temporarily
crons.interval(
  "check and send medication reminders",
  { hours: 1 },
  internal.medicationReminders.sendMedicationReminderNotifications,
  {}
);

export default crons;

