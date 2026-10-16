/**
 * Coercion helpers for values that reach JSX from untrusted sources
 * (server records, Firestore docs, Gemini JSON). React throws #310
 * ("Objects are not valid as a React child") when an object slips into
 * JSX, so every rendered field from these sources goes through asText /
 * asStringList first. Shared so every render site uses the same rule.
 */
export const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
};

export const asScore = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/** Sanitize an industry-optimization suggestion payload (Gemini JSON). */
export function asSafeSuggestion<T extends Record<string, unknown>>(s: T): T {
  return {
    ...s,
    currentIndustryId: asText(s.currentIndustryId),
    suggestedPresetId: asText(s.suggestedPresetId),
    suggestedPresetName: asText(s.suggestedPresetName),
    confidence: asScore(s.confidence),
    matchScore: asScore(s.matchScore),
    reason: asText(s.reason),
    newServicesDetected: asStringList(s.newServicesDetected),
    recommendedTone: asText(s.recommendedTone),
    technicianRoleName: asText(s.technicianRoleName),
    suggestedServices: asStringList(s.suggestedServices),
    activeEmployees:
      typeof s.activeEmployees === 'object' && s.activeEmployees !== null && !Array.isArray(s.activeEmployees)
        ? (s.activeEmployees as T['activeEmployees'])
        : ({} as T['activeEmployees']),
    triggers: asStringList(s.triggers),
  };
}
