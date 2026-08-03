import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

/**
 * Format a date as a relative string ("2 hours ago", "3 days ago")
 * with a fallback for null/undefined values.
 */
export const relativeTime = (date) => {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '—';
  }
};

/**
 * Format a date as a concise human-readable string.
 * Today → "2:34 PM", Yesterday → "Yesterday", older → "Aug 1"
 */
export const shortDate = (date) => {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  } catch {
    return '—';
  }
};

/**
 * Format a date as "Aug 1, 2026 at 9:00 AM" for full display contexts.
 */
export const fullDate = (date) => {
  if (!date) return '—';
  try {
    return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return '—';
  }
};

/**
 * Truncate text to a given character limit with ellipsis.
 */
export const truncate = (text, limit = 120) => {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
};

/**
 * Format a number as a percentage with one decimal place.
 */
export const pct = (numerator, denominator) => {
  if (!denominator || denominator === 0) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
};

/**
 * Capitalize the first letter of a string.
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
};
