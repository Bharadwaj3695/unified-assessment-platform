/**
 * Unified Assessment Platform — Grading Scheme & Certification Logic Utility (Frontend)
 * Mirrors backend/src/utils/gradingScheme.js for strict client-server parity.
 */

// Approved Default Grading Scheme:
// - 90–100%: A+ — Outstanding
// - 80–less than 90%: A — Excellent
// - 70–less than 80%: B+ — Very Good
// - 60–less than 70%: B — Good
// - 50–less than 60%: C — Satisfactory
// - 0–less than 50%: F — Try Again
export const DEFAULT_GRADING_SCHEME = Object.freeze([
  { grade: 'A+', minPercentage: 90, maxPercentage: 100, label: 'Outstanding' },
  { grade: 'A', minPercentage: 80, maxPercentage: 90, label: 'Excellent' },
  { grade: 'B+', minPercentage: 70, maxPercentage: 80, label: 'Very Good' },
  { grade: 'B', minPercentage: 60, maxPercentage: 70, label: 'Good' },
  { grade: 'C', minPercentage: 50, maxPercentage: 60, label: 'Satisfactory' },
  { grade: 'F', minPercentage: 0, maxPercentage: 50, label: 'Try Again' },
]);

// Standard encouraging feedback for non-passing outcomes
export const NON_PASSING_FEEDBACK =
  'Every attempt is an opportunity to learn. Review the material, strengthen your understanding, and try again when another attempt is available.';

/**
 * Validate that a grading scheme is an array of non-overlapping, contiguous bands covering exactly 0% to 100%.
 *
 * @param {Array} scheme - Array of grade band objects
 * @returns {{ valid: boolean, error?: string, normalizedScheme?: Array }}
 */
export function validateGradingScheme(scheme) {
  if (!Array.isArray(scheme) || scheme.length === 0) {
    return { valid: false, error: 'Grading scheme must contain at least one grade band.' };
  }

  // Validate each band's individual properties
  for (let i = 0; i < scheme.length; i++) {
    const band = scheme[i];
    if (!band || typeof band !== 'object') {
      return { valid: false, error: `Grade band at position ${i + 1} is invalid.` };
    }

    if (!band.grade || typeof band.grade !== 'string' || !band.grade.trim()) {
      return { valid: false, error: `Grade band at position ${i + 1} must have a non-empty grade name.` };
    }

    const min = Number(band.minPercentage);
    const max = Number(band.maxPercentage);

    if (isNaN(min) || isNaN(max)) {
      return { valid: false, error: `Grade band "${band.grade}" must have numeric min and max percentages.` };
    }

    if (min < 0 || max > 100) {
      return { valid: false, error: `Grade band "${band.grade}" boundaries must fall between 0% and 100%.` };
    }

    if (min >= max) {
      return { valid: false, error: `Grade band "${band.grade}" min percentage (${min}%) must be less than max percentage (${max}%).` };
    }
  }

  // Sort descending by minPercentage for contiguous boundary verification
  const sorted = scheme
    .map((b) => ({
      grade: String(b.grade).trim(),
      minPercentage: Math.round(Number(b.minPercentage) * 100) / 100,
      maxPercentage: Math.round(Number(b.maxPercentage) * 100) / 100,
      label: b.label ? String(b.label).trim() : '',
    }))
    .sort((a, b) => b.minPercentage - a.minPercentage);

  // Highest band must end at exactly 100%
  if (Math.abs(sorted[0].maxPercentage - 100) > 0.001) {
    return {
      valid: false,
      error: `The highest grade band ("${sorted[0].grade}") must have a maximum of 100%. Found: ${sorted[0].maxPercentage}%.`,
    };
  }

  // Lowest band must start at exactly 0%
  const lowestBand = sorted[sorted.length - 1];
  if (Math.abs(lowestBand.minPercentage - 0) > 0.001) {
    return {
      valid: false,
      error: `The lowest grade band ("${lowestBand.grade}") must have a minimum of 0%. Found: ${lowestBand.minPercentage}%.`,
    };
  }

  // Verify contiguous alignment: band[i].minPercentage === band[i+1].maxPercentage
  for (let i = 0; i < sorted.length - 1; i++) {
    const upper = sorted[i];
    const lower = sorted[i + 1];

    const diff = Math.abs(upper.minPercentage - lower.maxPercentage);
    if (diff > 0.001) {
      if (upper.minPercentage > lower.maxPercentage) {
        return {
          valid: false,
          error: `Gap detected between "${upper.grade}" (min ${upper.minPercentage}%) and "${lower.grade}" (max ${lower.maxPercentage}%).`,
        };
      } else {
        return {
          valid: false,
          error: `Overlap detected between "${upper.grade}" (min ${upper.minPercentage}%) and "${lower.grade}" (max ${lower.maxPercentage}%).`,
        };
      }
    }
  }

  return { valid: true, normalizedScheme: sorted };
}

/**
 * Resolve the authoritative grade and label for a numeric percentage score.
 *
 * @param {number} percentage - Achieved percentage (0 - 100)
 * @param {Array} gradingScheme - Configured grade bands
 * @param {number} passingPercentage - Passing threshold percentage (defaults to 50)
 * @returns {Object} { grade, label, isPassing, percentage, passingPercentage, outcomeFeedback }
 */
export function resolveGrade(percentage, gradingScheme = DEFAULT_GRADING_SCHEME, passingPercentage = 50) {
  const schemeToUse = Array.isArray(gradingScheme) && gradingScheme.length > 0
    ? gradingScheme
    : DEFAULT_GRADING_SCHEME;

  // Clamp and round percentage to 2 decimal places
  const rawNum = Number(percentage);
  const p = isNaN(rawNum)
    ? 0
    : Math.max(0, Math.min(100, Math.round(rawNum * 100) / 100));

  const threshold = isNaN(Number(passingPercentage)) ? 50 : Number(passingPercentage);
  const isPassing = p >= threshold;

  // Sort descending by minPercentage
  const sorted = [...schemeToUse].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage));

  let matchedBand = null;

  for (let i = 0; i < sorted.length; i++) {
    const band = sorted[i];
    const min = Number(band.minPercentage);
    const max = Number(band.maxPercentage);

    // If score is 100%, match the top band
    if (p >= 100 && max >= 100) {
      matchedBand = band;
      break;
    }

    // Exact min boundary or interior of interval [min, max)
    if (p >= min && p < max) {
      matchedBand = band;
      break;
    }
  }

  // Fallback to lowest band if edge precision rounding occurred
  if (!matchedBand) {
    matchedBand = sorted[sorted.length - 1];
  }

  const label = matchedBand.label || matchedBand.description || (isPassing ? 'Satisfactory' : 'Try Again');

  return {
    grade: matchedBand.grade,
    label,
    isPassing,
    percentage: p,
    passingPercentage: threshold,
    outcomeFeedback: isPassing ? '' : NON_PASSING_FEEDBACK,
  };
}
