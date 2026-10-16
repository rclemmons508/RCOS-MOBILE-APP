import { INDUSTRY_PRESETS } from '../data/presets';

/**
 * Display name for a business industry id. The dashboard used to render
 * the raw id (`activeBusiness.industry`) straight into the chip, so a
 * stale or unknown id showed up as GENERAL_SMALL_BUSINESS. Resolve through
 * the preset list first; anything unknown gets humanized
 * ("general_small_business" -> "General Small Business") instead of
 * leaking a raw key. Never returns an empty string.
 */
export function industryLabel(industryId: unknown): string {
  if (typeof industryId === 'string' && industryId.trim()) {
    const preset = INDUSTRY_PRESETS.find(p => p.id === industryId);
    if (preset?.name) return preset.name;
    const humanized = industryId
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    if (humanized) return humanized;
  }
  return 'Field Services';
}
