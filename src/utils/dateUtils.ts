/**
 * Date and time formatting utilities for the diabetes risk prediction system
 */

/**
 * Format a timestamp to include both date and time
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted string like "25 Nov 2025 at 09:34 PM"
 */
export const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
};

/**
 * Format a timestamp to show only the date
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted string like "25 Nov 2025"
 */
export const formatDateOnly = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format a timestamp to show only the time
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted string like "09:34 PM"
 */
export const formatTimeOnly = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format a timestamp as relative time (e.g., "2h ago", "3d ago")
 * @param timestamp Unix timestamp in milliseconds
 * @returns Relative time string or formatted date if older than 7 days
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return formatDateOnly(timestamp);
};

/**
 * Calculate age from date of birth
 * @param dateOfBirth Date string (YYYY-MM-DD format) or timestamp
 * @returns Age in years
 */
export const calculateAge = (dateOfBirth: string | number | null | undefined): number => {
  if (!dateOfBirth) return 0;
  
  const birthDate = typeof dateOfBirth === 'string' 
    ? new Date(dateOfBirth) 
    : new Date(dateOfBirth);
  
  if (isNaN(birthDate.getTime())) return 0;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return Math.max(0, age);
};

