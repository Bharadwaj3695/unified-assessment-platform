/**
 * Time-based greeting helper for Unified Assessment Platform (UAP).
 * Formats greeting based on user's local browser time:
 * - 05:00 - 11:59: "Good morning"
 * - 12:00 - 16:59: "Good afternoon"
 * - 17:00 - 04:59: "Good evening"
 * 
 * If name is provided: "Good {timeOfDay}, {name} 👋"
 * If name is missing: "Good {timeOfDay} 👋"
 */

export const getTimeOfDay = (date = new Date()) => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'afternoon';
  }
  return 'evening';
};

export const getTimeBasedGreeting = (name, date = new Date()) => {
  const timeOfDay = getTimeOfDay(date);
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed) {
    return `Good ${timeOfDay}, ${trimmed} 👋`;
  }
  return `Good ${timeOfDay} 👋`;
};

export default getTimeBasedGreeting;
