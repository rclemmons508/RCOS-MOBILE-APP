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
export function asSafeSuggestion<T extends object>(s: T): T {
  const v = s as unknown as Record<string, unknown>;
  return {
    ...s,
    currentIndustryId: asText(v.currentIndustryId),
    suggestedPresetId: asText(v.suggestedPresetId),
    suggestedPresetName: asText(v.suggestedPresetName),
    confidence: asScore(v.confidence),
    matchScore: asScore(v.matchScore),
    reason: asText(v.reason),
    newServicesDetected: asStringList(v.newServicesDetected),
    recommendedTone: asText(v.recommendedTone),
    technicianRoleName: asText(v.technicianRoleName),
    suggestedServices: asStringList(v.suggestedServices),
    activeEmployees:
      typeof v.activeEmployees === 'object' && v.activeEmployees !== null && !Array.isArray(v.activeEmployees)
        ? v.activeEmployees
        : {},
    triggers: asStringList(v.triggers),
  } as T;
}
