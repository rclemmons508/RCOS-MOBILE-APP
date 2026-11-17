import { INDUSTRY_PRESETS } from '../data/presets';

/**
 * Job categories for a business, taken from the business itself — never a
 * hardcoded trade list, and never another company's work.
 *
 * Industry-only rule: the ONLY sources are the business's own services
 * (these come from its industry preset when the business is set up, and
 * stay editable in Settings) and the industry preset's default services.
 * When the business has neither, the honest answer is an empty list —
 * the caller shows an empty state that points at Settings — not a
 * generic trade list. A software company must never see plumbing,
 * electrical, or HVAC options, and a plumber must never see IT work.
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

  // No services of the business's own and no industry preset: no
  // categories. Never fall back to another trade's list.
  return [];
}
