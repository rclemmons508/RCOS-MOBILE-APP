import { INDUSTRY_PRESETS } from '../data/presets';

/**
 * The old generic trade list, kept only as a fallback when the business
 * has no industry preset and no services of its own. It is never the
 * first choice — a business's jobs should be filed under its own work.
 */
export const FALLBACK_JOB_CATEGORIES = [
  'HVAC',
  'Automation',
  'Security',
  'Software AI',
  'Electrical',
  'Plumbing',
];

/**
 * Job categories for a business, taken from the business itself — never a
 * hardcoded trade list.
 *
 * Order: the business's own services first (these come from its industry
 * preset when the business is set up, and stay editable in Settings), then
 * the industry preset's default services, then the generic fallback when
 * the business has neither.
 *
 * The same list feeds the Dispatch New Job picker, the Jobs list filter,
 * and the job detail editor, so a category picked in one place always
 * exists in the others.
 */
export function getJobCategories(
  industry?: string | null,
  businessServices?: string[] | null,
): string[] {
  const own = (businessServices || [])
    .map((s) => (s || '').trim())
    .filter(Boolean);
  if (own.length > 0) return [...new Set(own)];

  const industryId = (industry || '').trim().toLowerCase();
  const preset = industryId
    ? INDUSTRY_PRESETS.find((p) => p.id === industryId)
    : undefined;
  const presetServices = (preset?.defaultServices || [])
    .map((s) => (s || '').trim())
    .filter(Boolean);
  if (presetServices.length > 0) return [...new Set(presetServices)];

  return [...FALLBACK_JOB_CATEGORIES];
}
