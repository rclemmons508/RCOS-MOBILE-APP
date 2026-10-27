import { INDUSTRY_PRESETS } from '../data/presets';

/**
 * Which departments a business offers for call transfers.
 *
 * Worked out from the business's industry + services when the business is
 * saved (at onboarding and on every later save): every business gets
 * sales, support, billing, and emergency. Dispatch is included only when
 * the business involves field/dispatch work or a skilled trade — a
 * business with no dispatch function (an IT consultancy, a law office)
 * never sees Dispatch in its options. The receptionist only offers these
 * departments, and the transfer picker only shows them.
 */
export type TransferDepartment = 'sales' | 'support' | 'dispatch' | 'billing' | 'emergency';

export const ALL_TRANSFER_DEPARTMENTS: TransferDepartment[] = [
  'sales',
  'support',
  'dispatch',
  'billing',
  'emergency',
];

export const DEPARTMENT_LABELS: Record<TransferDepartment, string> = {
  sales: 'Sales',
  support: 'Support',
  dispatch: 'Dispatch',
  billing: 'Billing',
  emergency: 'Emergency',
};

export function isTransferDepartment(value: unknown): value is TransferDepartment {
  return typeof value === 'string' && (ALL_TRANSFER_DEPARTMENTS as string[]).includes(value);
}

/** Keep only known departments, in canonical order, no duplicates. Falls back to all when nothing valid remains. */
export function normalizeDepartments(value: unknown): TransferDepartment[] {
  const list = Array.isArray(value) ? value.filter(isTransferDepartment) : [];
  const deduped = ALL_TRANSFER_DEPARTMENTS.filter((d) => list.includes(d));
  return deduped.length > 0 ? deduped : [...ALL_TRANSFER_DEPARTMENTS];
}

/** Industries built around field work / skilled trades — these businesses have a dispatch function. */
const FIELD_TRADE_PRESETS = new Set([
  'cleaning',
  'handyman',
  'landscaping',
  'painting',
  'pressure_washing',
  'hvac',
  'roofing',
  'construction',
  'auto_services',
  'plumbing',
  'electrical',
  'pest_control',
  'pool_spa_services',
  'appliance_repair',
  'garage_door',
  'flooring',
  'fence_deck',
  'septic_services',
  'tree_service',
]);

/** Words in an industry name or service list that signal field/dispatch work. Biased toward inclusion: offering Dispatch to a business that does not need it is harmless, hiding it from one that does is not. */
const FIELD_KEYWORDS = [
  'dispatch',
  'field',
  'technician',
  'install',
  'repair',
  'maintenance',
  'on-site',
  'on site',
  'site visit',
  'truck',
  'fleet',
  'route',
  'crew',
  'job site',
  'property',
  'plumb',
  'hvac',
  'heating',
  'cooling',
  'electrical',
  'electric',
  'roof',
  'appliance',
  'pest',
  'landscape',
  'lawn',
  'cleaning',
  'paint',
  'handyman',
  'construction',
  'carpentr',
  'mechanic',
  'brake',
  'emergency service',
  'in-home',
  'in home',
  'mobile service',
  'snow',
  'pool',
  'home health',
  'home visit',
  'exterminat',
];

export function hasFieldWork(business: { industry?: unknown; services?: unknown }): boolean {
  if (typeof business.industry === 'string' && FIELD_TRADE_PRESETS.has(business.industry)) return true;
  const preset = typeof business.industry === 'string'
    ? INDUSTRY_PRESETS.find((p) => p.id === business.industry)
    : undefined;
  const servicesText = Array.isArray(business.services)
    ? business.services.map((s) => String(s ?? '')).join(' ')
    : '';
  const text = `${preset?.name ?? ''} ${typeof business.industry === 'string' ? business.industry : ''} ${servicesText}`.toLowerCase();
  return FIELD_KEYWORDS.some((k) => text.includes(k));
}

export function availableDepartmentsFor(business: { industry?: unknown; services?: unknown }): TransferDepartment[] {
  if (!hasFieldWork(business)) return ['sales', 'support', 'billing', 'emergency'];
  return ['sales', 'support', 'dispatch', 'billing', 'emergency'];
}

/** Maps the transfer-picker entries to transfer departments (the picker calls support "Customer Accounts & Support"). */
export const MODAL_DEPARTMENT_TO_TRANSFER: Record<string, TransferDepartment> = {
  'dept-dispatch': 'dispatch',
  'dept-billing': 'billing',
  'dept-emergency': 'emergency',
  'dept-sales': 'sales',
  'dept-accounts': 'support',
};
