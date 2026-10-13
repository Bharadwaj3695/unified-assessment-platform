export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const formatDuration = (minutes) => {
  if (!minutes) return '0 min';
  if (minutes < 60) return `${minutes} mins`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

export const formatPercentage = (val) => {
  if (val === null || val === undefined) return '0%';
  return `${Math.round(val)}%`;
};

/**
 * Extract clean user initials with support for multi-part names,
 * honorifics/titles (e.g. Prof., Dr., Mr.), and fallbacks.
 * Examples:
 *   "Alex Johnson" -> "AJ"
 *   "Prof. Alan Turing" -> "AT"
 *   "Admin User" -> "AU"
 *   "Student" -> "S"
 */
export const getInitials = (name, fallback = 'U') => {
  if (!name || typeof name !== 'string') return fallback;
  const titles = new Set(['prof', 'prof.', 'dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.']);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const filtered = parts.filter((part) => !titles.has(part.toLowerCase()));
  const meaningfulParts = filtered.length > 0 ? filtered : parts;
  if (meaningfulParts.length === 0) return fallback;
  if (meaningfulParts.length === 1) {
    return meaningfulParts[0].charAt(0).toUpperCase();
  }
  return (
    meaningfulParts[0].charAt(0) + meaningfulParts[meaningfulParts.length - 1].charAt(0)
  ).toUpperCase();
};

