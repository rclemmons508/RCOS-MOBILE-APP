// Server-side onboarding document analysis (Bug 1).
//
// The client sends binary files (PDF / DOCX / images) as base64 and expects
// the SERVER to parse them. This module owns that parsing plus the scored
// keyword matcher used when the LLM is unavailable.
//
// Honesty rule: a keyword fallback MUST return `source: 'fallback'` and must
// never be labelled as a neural-engine result. `source: 'llm'` is returned
// only when the LLM actually produced the result.

import { INDUSTRY_PRESETS } from '../src/data/presets';
import { executeGeminiWithFallback, FAST_MODEL } from './gemini';

export interface AnalyzeDocumentInput {
  fileText?: string;
  fileName?: string;
  fileType?: string;
  fileBase64?: string;
}

export interface AnalyzeDocumentAlternative {
  industryId: string;
  score?: number;
  confidence?: number;
}

export interface AnalyzePriceHint {
  service: string;
  price: string;
}

export interface AnalyzeContactInfo {
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

export interface AnalyzeDocumentResult {
  industryId: string;
  confidence?: number;
  uncertain?: boolean;
  alternatives?: AnalyzeDocumentAlternative[];
  source: 'llm' | 'fallback';
  reasoning?: string;
  businessName?: string;
  extractedServices?: string[];
  keyInsights?: string[];
  recommendedTone?: string;
  technicianRoleName?: string;
  dollarThreshold?: number;
  // Deeper profile — set only when the document/typed input actually
  // said it. Absent on keyword-fallback results: never fabricated.
  serviceArea?: string;
  businessHours?: string;
  emergencyAvailable?: boolean;
  teamSize?: string;
  servesResidential?: boolean;
  servesCommercial?: boolean;
  priceHints?: AnalyzePriceHint[];
  contactInfo?: AnalyzeContactInfo;
}

export interface ScoredPresetMatch {
  preset: (typeof INDUSTRY_PRESETS)[number];
  score: number;
  matchedTerms: string[];
}

  const PRESET_KEYWORD_WEIGHTS: Record<string, Array<{ term: string; weight: number }>> = {
    cleaning: [
      { term: 'move-in clean', weight: 5 },
      { term: 'move-out clean', weight: 5 },
      { term: 'move-in cleaning', weight: 5 },
      { term: 'move-out cleaning', weight: 5 },
      { term: 'move in clean', weight: 5 },
      { term: 'move out clean', weight: 5 },
      { term: 'move in cleaning', weight: 5 },
      { term: 'move out cleaning', weight: 5 },
      { term: 'deep clean', weight: 4 },
      { term: 'deep cleaning', weight: 4 },
      { term: 'house cleaning', weight: 4 },
      { term: 'office cleaning', weight: 4 },
      { term: 'maid', weight: 4 },
      { term: 'janitorial', weight: 4 },
      { term: 'janitor', weight: 3 },
      { term: 'housekeeping', weight: 3 },
      { term: 'carpet cleaning', weight: 3 },
      { term: 'window cleaning', weight: 3 },
      { term: 'cleaning', weight: 2 },
    ],
    handyman: [
      { term: 'handyman', weight: 5 },
      { term: 'drywall', weight: 4 },
      { term: 'carpentry', weight: 4 },
      { term: 'home repair', weight: 3 },
      { term: 'fixture installation', weight: 3 },
      { term: 'furniture assembly', weight: 3 },
      { term: 'door repair', weight: 3 },
    ],
    landscaping: [
      { term: 'landscaping', weight: 5 },
      { term: 'landscaper', weight: 5 },
      { term: 'lawn', weight: 4 },
      { term: 'mowing', weight: 4 },
      { term: 'mow', weight: 3 },
      { term: 'hedge trimming', weight: 3 },
      { term: 'tree trimming', weight: 3 },
      { term: 'mulch', weight: 3 },
      { term: 'yard work', weight: 3 },
      { term: 'sprinkler', weight: 3 },
      { term: 'garden', weight: 2 },
    ],
    painting: [
      { term: 'interior painting', weight: 4 },
      { term: 'exterior painting', weight: 4 },
      { term: 'painting', weight: 4 },
      { term: 'painter', weight: 4 },
      { term: 'cabinet refinishing', weight: 3 },
      { term: 'deck staining', weight: 3 },
      { term: 'staining', weight: 3 },
      { term: 'paint', weight: 2 },
    ],
    pressure_washing: [
      { term: 'pressure washing', weight: 5 },
      { term: 'pressure wash', weight: 5 },
      { term: 'power washing', weight: 4 },
      { term: 'soft wash', weight: 4 },
      { term: 'driveway wash', weight: 3 },
      { term: 'siding wash', weight: 3 },
    ],
    hvac: [
      { term: 'hvac', weight: 5 },
      { term: 'air conditioning', weight: 4 },
      { term: 'furnace', weight: 4 },
      { term: 'heat pump', weight: 4 },
      { term: 'ac repair', weight: 4 },
      { term: 'heating', weight: 3 },
      { term: 'thermostat', weight: 3 },
      { term: 'duct', weight: 3 },
      { term: 'cooling', weight: 2 },
      { term: 'air quality', weight: 2 },
    ],
    roofing: [
      { term: 'roofing', weight: 5 },
      { term: 'roofer', weight: 5 },
      { term: 'roof leak', weight: 5 },
      { term: 'reroof', weight: 5 },
      { term: 'roof repair', weight: 4 },
      { term: 'shingle', weight: 4 },
      { term: 'gutter', weight: 3 },
      { term: 'roof', weight: 3 },
      { term: 'storm damage', weight: 2 },
    ],
    construction: [
      { term: 'general contractor', weight: 4 },
      { term: 'construction', weight: 4 },
      { term: 'framing', weight: 4 },
      { term: 'buildout', weight: 4 },
      { term: 'concrete', weight: 3 },
      { term: 'remodel', weight: 3 },
      { term: 'renovation', weight: 3 },
      { term: 'contractor', weight: 2 },
    ],
    auto_services: [
      { term: 'auto repair', weight: 4 },
      { term: 'car repair', weight: 4 },
      { term: 'mechanic', weight: 4 },
      { term: 'oil change', weight: 4 },
      { term: 'engine diagnostics', weight: 4 },
      { term: 'brake', weight: 3 },
      { term: 'fleet maintenance', weight: 3 },
      { term: 'tire', weight: 2 },
      { term: 'auto', weight: 1 },
    ],
    professional_services: [
      { term: 'business consulting', weight: 5 },
      { term: 'consulting', weight: 4 },
      { term: 'consultant', weight: 4 },
      { term: 'advisory', weight: 3 },
      { term: 'audit', weight: 2 },
    ],
    real_estate: [
      { term: 'real estate', weight: 5 },
      { term: 'realtor', weight: 5 },
      { term: 'property listing', weight: 4 },
      { term: 'home buying', weight: 3 },
      { term: 'broker', weight: 3 },
      { term: 'listing', weight: 2 },
    ],
    general_small_business: [],
    healthcare: [
      { term: 'healthcare', weight: 4 },
      { term: 'health care', weight: 4 },
      { term: 'urgent care', weight: 5 },
      { term: 'physical therapy', weight: 4 },
      { term: 'mental health', weight: 4 },
      { term: 'chiropractic', weight: 4 },
      { term: 'clinic', weight: 4 },
      { term: 'medical', weight: 4 },
      { term: 'patient', weight: 4 },
      { term: 'doctor', weight: 3 },
    ],
    legal_accounting: [
      { term: 'law firm', weight: 5 },
      { term: 'attorney', weight: 5 },
      { term: 'lawyer', weight: 5 },
      { term: 'accounting', weight: 4 },
      { term: 'accountant', weight: 4 },
      { term: 'tax preparation', weight: 4 },
      { term: 'bookkeeping', weight: 4 },
      { term: 'legal', weight: 3 },
      { term: 'cpa', weight: 3 },
    ],
    restaurants: [
      { term: 'restaurant', weight: 5 },
      { term: 'food truck', weight: 4 },
      { term: 'bakery', weight: 4 },
      { term: 'cafe', weight: 3 },
      { term: 'chef', weight: 3 },
      { term: 'dining', weight: 3 },
      { term: 'catering', weight: 2 },
      { term: 'menu', weight: 2 },
    ],
    salons_spas: [
      { term: 'hair salon', weight: 5 },
      { term: 'nail salon', weight: 5 },
      { term: 'salon', weight: 5 },
      { term: 'haircut', weight: 4 },
      { term: 'manicure', weight: 4 },
      { term: 'pedicure', weight: 4 },
      { term: 'facial', weight: 4 },
      { term: 'massage', weight: 4 },
      { term: 'barber', weight: 4 },
      { term: 'spa', weight: 4 },
    ],
    retail_ecommerce: [
      { term: 'retail', weight: 4 },
      { term: 'ecommerce', weight: 4 },
      { term: 'e-commerce', weight: 4 },
      { term: 'online store', weight: 4 },
      { term: 'shopify', weight: 4 },
      { term: 'inventory', weight: 2 },
      { term: 'store', weight: 1 },
    ],
    nonprofits: [
      { term: 'nonprofit', weight: 5 },
      { term: 'non-profit', weight: 5 },
      { term: 'charity', weight: 4 },
      { term: 'donor', weight: 4 },
      { term: 'fundraising', weight: 4 },
      { term: 'volunteer', weight: 3 },
      { term: 'grant', weight: 3 },
    ],
    plumbing: [
      { term: 'plumbing', weight: 5 },
      { term: 'plumber', weight: 5 },
      { term: 'water leak', weight: 5 },
      { term: 'pipe leak', weight: 5 },
      { term: 'slab leak', weight: 5 },
      { term: 'plumbing leak', weight: 5 },
      { term: 'leak repair', weight: 4 },
      { term: 'water heater', weight: 4 },
      { term: 'sewer', weight: 4 },
      { term: 'hydrojetting', weight: 4 },
      { term: 'hydro-jetting', weight: 4 },
      { term: 'drain', weight: 3 },
      { term: 'pipe', weight: 3 },
      { term: 'water line', weight: 3 },
      { term: 'toilet', weight: 3 },
      { term: 'faucet', weight: 3 },
    ],
    electrical: [
      { term: 'electrician', weight: 5 },
      { term: 'ev charger', weight: 5 },
      { term: 'panel upgrade', weight: 5 },
      { term: 'electrical panel', weight: 5 },
      { term: 'breaker panel', weight: 5 },
      { term: 'main panel', weight: 4 },
      { term: 'rewiring', weight: 4 },
      { term: 'electrical', weight: 4 },
      { term: 'wiring', weight: 3 },
      { term: 'breaker', weight: 3 },
      { term: 'gfci', weight: 3 },
      { term: 'afci', weight: 3 },
      { term: 'lighting', weight: 2 },
    ],
    it_services: [
      { term: 'managed it', weight: 5 },
      { term: 'msp', weight: 4 },
      { term: 'helpdesk', weight: 4 },
      { term: 'help desk', weight: 4 },
      { term: 'cybersecurity', weight: 4 },
      { term: 'cloud migration', weight: 4 },
      { term: 'it support', weight: 4 },
      { term: 'microsoft 365', weight: 3 },
      { term: 'network', weight: 2 },
    ],
    fitness_gyms: [
      { term: 'personal training', weight: 5 },
      { term: 'personal trainer', weight: 5 },
      { term: 'gym', weight: 4 },
      { term: 'fitness', weight: 4 },
      { term: 'strength training', weight: 4 },
      { term: 'crossfit', weight: 4 },
      { term: 'workout', weight: 3 },
      { term: 'yoga', weight: 3 },
      { term: 'pilates', weight: 3 },
      { term: 'nutrition coaching', weight: 2 },
    ],
    pet_care: [
      { term: 'pet grooming', weight: 5 },
      { term: 'pet care', weight: 5 },
      { term: 'dog daycare', weight: 4 },
      { term: 'canine', weight: 4 },
      { term: 'veterinary', weight: 4 },
      { term: 'grooming', weight: 3 },
      { term: 'pet', weight: 3 },
      { term: 'dog', weight: 3 },
      { term: 'vet', weight: 2 },
      { term: 'boarding', weight: 2 },
    ],
    event_production: [
      { term: 'event planning', weight: 5 },
      { term: 'event production', weight: 5 },
      { term: 'wedding', weight: 4 },
      { term: 'banquet', weight: 4 },
      { term: 'party planning', weight: 4 },
      { term: 'catering', weight: 3 },
      { term: 'audio visual', weight: 3 },
      { term: 'av staging', weight: 3 },
      { term: 'event', weight: 2 },
    ],
    dental_practices: [
      { term: 'dental', weight: 5 },
      { term: 'dentist', weight: 5 },
      { term: 'root canal', weight: 5 },
      { term: 'teeth whitening', weight: 4 },
      { term: 'orthodontic', weight: 4 },
      { term: 'dental hygiene', weight: 4 },
      { term: 'toothache', weight: 4 },
      { term: 'veneers', weight: 4 },
      { term: 'braces', weight: 3 },
      { term: 'cavity', weight: 3 },
    ],
    moving_storage: [
      { term: 'moving company', weight: 5 },
      { term: 'office relocation', weight: 5 },
      { term: 'piano moving', weight: 5 },
      { term: 'moving', weight: 4 },
      { term: 'movers', weight: 4 },
      { term: 'relocation', weight: 4 },
      { term: 'packing', weight: 3 },
      { term: 'storage', weight: 2 },
    ],
    solar_cleanenergy: [
      { term: 'solar panel', weight: 5 },
      { term: 'solar panels', weight: 5 },
      { term: 'solar array', weight: 5 },
      { term: 'solar installation', weight: 5 },
      { term: 'photovoltaic', weight: 5 },
      { term: 'powerwall', weight: 5 },
      { term: 'microinverter', weight: 4 },
      { term: 'microinverters', weight: 4 },
      { term: 'solar energy', weight: 4 },
      { term: 'net metering', weight: 4 },
      { term: 'solar', weight: 4 },
      { term: 'battery storage', weight: 3 },
      { term: 'inverter', weight: 3 },
      { term: 'panels', weight: 2 },
    ],
    marketing_creative: [
      { term: 'digital marketing', weight: 5 },
      { term: 'marketing', weight: 4 },
      { term: 'ad campaign', weight: 4 },
      { term: 'ad campaigns', weight: 4 },
      { term: 'paid ads', weight: 4 },
      { term: 'lead generation', weight: 3 },
      { term: 'ads', weight: 3 },
      { term: 'seo', weight: 4 },
      { term: 'brand identity', weight: 3 },
      { term: 'website design', weight: 3 },
      { term: 'content strategy', weight: 3 },
      { term: 'social media', weight: 2 },
    ],
    hospitality_rentals: [
      { term: 'vacation rental', weight: 5 },
      { term: 'airbnb', weight: 5 },
      { term: 'guest turnover', weight: 4 },
      { term: 'short-term rental', weight: 4 },
      { term: 'hospitality', weight: 4 },
      { term: 'concierge', weight: 3 },
      { term: 'property management', weight: 3 },
      { term: 'rental', weight: 2 },
    ],
    education_tutoring: [
      { term: 'tutoring', weight: 5 },
      { term: 'test prep', weight: 5 },
      { term: 'tutor', weight: 4 },
      { term: 'standardized test', weight: 4 },
      { term: 'academic', weight: 3 },
      { term: 'curriculum', weight: 3 },
      { term: 'sat', weight: 2 },
      { term: 'act', weight: 2 },
      { term: 'student', weight: 2 },
      { term: 'learning', weight: 2 },
    ],
    property_operations: [
      { term: 'property operations', weight: 5 },
      { term: 'facility maintenance', weight: 4 },
      { term: 'building maintenance', weight: 4 },
      { term: 'property management', weight: 4 },
      { term: 'tenant', weight: 3 },
      { term: 'lease', weight: 3 },
    ],
    security_locksmith: [
      { term: 'locksmith', weight: 5 },
      { term: 'lockout', weight: 4 },
      { term: 'rekeying', weight: 4 },
      { term: 'security camera', weight: 4 },
      { term: 'cctv', weight: 4 },
      { term: 'access control', weight: 4 },
      { term: 'alarm system', weight: 3 },
      { term: 'smart lock', weight: 3 },
      { term: 'security', weight: 2 },
    ],
    pest_control: [
      { term: 'pest control', weight: 5 },
      { term: 'exterminator', weight: 5 },
      { term: 'termite treatment', weight: 5 },
      { term: 'termite', weight: 4 },
      { term: 'bed bug', weight: 4 },
      { term: 'bed bugs', weight: 4 },
      { term: 'rodent', weight: 4 },
      { term: 'fumigation', weight: 4 },
      { term: 'mosquito treatment', weight: 4 },
      { term: 'pest', weight: 3 },
    ],
    pool_spa_services: [
      { term: 'pool cleaning', weight: 5 },
      { term: 'pool service', weight: 5 },
      { term: 'pool and spa', weight: 4 },
      { term: 'pool equipment', weight: 4 },
      { term: 'pool pump', weight: 4 },
      { term: 'pool heater', weight: 4 },
      { term: 'pool opening', weight: 4 },
      { term: 'pool closing', weight: 4 },
      { term: 'salt water pool', weight: 4 },
      { term: 'hot tub', weight: 3 },
      { term: 'chemical balancing', weight: 3 },
      { term: 'pool', weight: 3 },
    ],
    appliance_repair: [
      { term: 'appliance repair', weight: 5 },
      { term: 'washer repair', weight: 4 },
      { term: 'dryer repair', weight: 4 },
      { term: 'refrigerator repair', weight: 4 },
      { term: 'oven repair', weight: 4 },
      { term: 'dishwasher repair', weight: 4 },
      { term: 'appliance', weight: 4 },
      { term: 'washing machine', weight: 3 },
    ],
    garage_door: [
      { term: 'garage door opener', weight: 5 },
      { term: 'garage door spring', weight: 5 },
      { term: 'garage door', weight: 5 },
      { term: 'garage door installation', weight: 4 },
      { term: 'garage door repair', weight: 4 },
      { term: 'overhead door', weight: 4 },
      { term: 'garage', weight: 2 },
    ],
    flooring: [
      { term: 'hardwood flooring', weight: 5 },
      { term: 'flooring installation', weight: 5 },
      { term: 'hardwood floor', weight: 4 },
      { term: 'floor refinishing', weight: 4 },
      { term: 'vinyl plank', weight: 4 },
      { term: 'tile installation', weight: 4 },
      { term: 'carpet installation', weight: 3 },
      { term: 'flooring', weight: 4 },
    ],
    fence_deck: [
      { term: 'fence installation', weight: 5 },
      { term: 'deck building', weight: 5 },
      { term: 'chain-link fence', weight: 4 },
      { term: 'wood fence', weight: 4 },
      { term: 'fence repair', weight: 4 },
      { term: 'deck resurfacing', weight: 4 },
      { term: 'fencing', weight: 4 },
      { term: 'fence', weight: 3 },
      { term: 'deck', weight: 2 },
    ],
    septic_services: [
      { term: 'septic tank', weight: 5 },
      { term: 'septic pumping', weight: 5 },
      { term: 'septic system', weight: 5 },
      { term: 'septic installation', weight: 4 },
      { term: 'septic inspection', weight: 4 },
      { term: 'drain field', weight: 4 },
      { term: 'septic', weight: 4 },
      { term: 'grease trap', weight: 3 },
    ],
    tree_service: [
      { term: 'tree removal', weight: 5 },
      { term: 'tree service', weight: 5 },
      { term: 'stump grinding', weight: 5 },
      { term: 'arborist', weight: 5 },
      { term: 'tree trimming', weight: 5 },
      { term: 'tree pruning', weight: 4 },
      { term: 'storm cleanup', weight: 3 },
      { term: 'tree', weight: 3 },
    ],
  };

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Count whole-word / whole-phrase hits, capped so repetition can't dominate.
const countPhraseHits = (haystackLower: string, term: string): number => {
  const matches = haystackLower.match(new RegExp(`\\b${escapeRegExp(term.toLowerCase())}\\b`, 'g'));
  return matches ? Math.min(matches.length, 3) : 0;
};

// SAT/ACT only count alongside another education anchor, so a plain verb
// ("we act fast") or "customer satisfaction" can never match Education.
const EDUCATION_ANCHORS = ['tutor', 'tutoring', 'test prep', 'student', 'academic', 'curriculum', 'learning', 'school', 'exam', 'college', 'class'];

// Score every preset against the text; highest score wins. Word boundaries
// only (never substrings) and multi-word phrases outrank bare words. That
// fixes the known collisions:
// - "roof leak" must NOT match Plumbing: bare "leak" is not a Plumbing
//   term — only qualified phrases (water/pipe/slab/plumbing leak) count.
// - "move-in clean" must NOT match Moving: Moving matches \bmoving\b /
//   \bmovers\b, never the substring "mov".
// - "leads" must NOT match Marketing: Marketing matches \bads\b / "ad
//   campaign", never the substring "ads" inside "leads".
// - "customer satisfaction" / "contract" must NOT match Education:
//   \bsat\b / \bact\b do not fire inside those words.
// - salon "wellness" must NOT match Healthcare: "wellness" is not a
//   Healthcare term at all.
// - solar proposal must NOT match Electrical via "panel": bare "panel" is
//   not an Electrical term — only qualified phrases count, while
//   "solar panel(s)" count for Solar.
export function scorePresetsByKeywords(text: string): ScoredPresetMatch[] {
  const lower = (text || '').toLowerCase();
  const scored = INDUSTRY_PRESETS.map((preset) => {
    const keywords = PRESET_KEYWORD_WEIGHTS[preset.id] || [];
    let score = 0;
    const matchedTerms: string[] = [];
    for (const kw of keywords) {
      if (preset.id === 'education_tutoring' && (kw.term === 'sat' || kw.term === 'act')) {
        const hasAnchor = EDUCATION_ANCHORS.some((anchor) => countPhraseHits(lower, anchor) > 0);
        if (!hasAnchor) continue;
      }
      const hits = countPhraseHits(lower, kw.term);
      if (hits > 0) {
        score += kw.weight * hits;
        matchedTerms.push(kw.term);
      }
    }
    return { preset, score, matchedTerms };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// Top scored match, or the general preset when nothing scored.
export function topPresetMatch(text: string): ScoredPresetMatch {
  const ranked = scorePresetsByKeywords(text);
  const general = INDUSTRY_PRESETS.find((p) => p.id === 'general_small_business') || INDUSTRY_PRESETS[0];
  if (ranked.length > 0 && ranked[0].score > 0) return ranked[0];
  return { preset: general, score: 0, matchedTerms: [] };
}

function isUsableText(value: string): boolean {
  if (!value) return false;
  // Never treat the legacy binary placeholder or raw binary bytes as content.
  if (value.startsWith('[Binary document payload:')) return false;
  // Binary garbage (e.g. raw ZIP bytes sent as text): mostly NUL / control
  // chars / replacement chars. Real text is overwhelmingly printable.
  const sample = value.slice(0, 2000);
  if (!sample) return false;
  let bad = 0;
  for (const ch of sample) {
    const code = ch.charCodeAt(0);
    if (code < 9 || (code > 13 && code < 32) || code === 0xfffd) bad++;
  }
  return bad < sample.length * 0.05;
}

// Parse a document payload into readable text. PDF via pdf-parse, DOCX via
// mammoth, plain text passed through. Images have no extractable text here
// (the caller may still send them to the LLM multimodally). Returns ''
// when nothing readable could be extracted.
export async function extractDocumentText(input: AnalyzeDocumentInput): Promise<string> {
  const fileText = typeof input.fileText === 'string' ? input.fileText : '';
  const fileBase64 = typeof input.fileBase64 === 'string' ? input.fileBase64 : '';
  const fileName = typeof input.fileName === 'string' ? input.fileName : '';
  const fileType = typeof input.fileType === 'string' ? input.fileType : '';

  if (isUsableText(fileText)) return fileText;
  if (!fileBase64) return '';

  let buf: Buffer;
  try {
    buf = Buffer.from(fileBase64, 'base64');
  } catch {
    return '';
  }
  if (!buf.length) return '';

  const lowerName = fileName.toLowerCase();
  const lowerType = fileType.toLowerCase();
  const isPdf =
    lowerType.includes('pdf') || lowerName.endsWith('.pdf') || buf.subarray(0, 5).toString('latin1') === '%PDF-';
  // ZIP magic (PK..) means a DOCX (or another zip) — mammoth either reads
  // it or fails gracefully and we return ''.
  const isDocx =
    lowerType.includes('wordprocessingml') ||
    lowerName.endsWith('.docx') ||
    (buf[0] === 0x50 && buf[1] === 0x4b);

  try {
    if (isPdf) {
      // Import the inner parser directly: pdf-parse's index.js runs a debug
      // block (reads ./test/data/05-versions-space.pdf) when loaded without
      // a CJS parent, which crashes under ESM/tsx imports.
      const pdfMod: any = await import('pdf-parse/lib/pdf-parse.js');
      const parse = pdfMod.default ?? pdfMod;
      const data = await parse(buf);
      return typeof data?.text === 'string' ? data.text : '';
    }
    if (isDocx) {
      const mammothMod: any = await import('mammoth');
      const out = await mammothMod.extractRawText({ buffer: buf });
      return typeof out?.value === 'string' ? out.value : '';
    }
  } catch (err: any) {
    console.warn('[onboarding-docs] document parse failed:', err?.message || err);
    return '';
  }

  // Plain-text file delivered as base64.
  const asText = buf.toString('utf8');
  return isUsableText(asText) ? asText : '';
}

function extractBusinessName(text: string, fileName: string): string {
  const namePatterns = [
    /(?:Company|Business|Name|Organization|Invoice From|Prepared For|Client|Contractor):\s*([^\n\r,]+)/i,
    /^([A-Z0-9][A-Za-z0-9\s&'-]{3,35}(?:LLC|Inc|Co|Services|Solutions|Pros|Group|Plumbing|Electric|HVAC|Care|Studio|Agency|Cleaning))/m,
    /^([A-Z][a-zA-Z0-9\s&'-]{3,30})$/m,
  ];
  for (const pat of namePatterns) {
    const hit = text.match(pat);
    if (hit && hit[1] && hit[1].trim().length > 2) return hit[1].trim();
  }
  if (fileName) {
    return fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .trim()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return '';
}

function dollarThresholdFor(presetId: string): number {
  return presetId === 'electrical' || presetId === 'construction' || presetId === 'solar_cleanenergy' ? 1750 : 1000;
}

function fallbackConfidence(score: number): number {
  if (score >= 15) return 0.9;
  if (score >= 8) return 0.8;
  if (score > 0) return 0.65;
  return 0.4;
}

// Offline keyword fallback. Honest by construction: source 'fallback',
// uncertain true, and a modest score-derived confidence the client never
// displays as an AI result.
function buildFallbackResult(text: string, fileName: string): AnalyzeDocumentResult {
  const top = topPresetMatch(text);
  const preset = top.preset;
  const alternatives = scorePresetsByKeywords(text)
    .filter((r) => r.preset.id !== preset.id && r.score > 0)
    .slice(0, 2)
    .map((r) => ({ industryId: r.preset.id, score: r.score }));
  return {
    industryId: preset.id,
    confidence: fallbackConfidence(top.score),
    uncertain: true,
    alternatives,
    source: 'fallback',
    reasoning: `Offline keyword match from your document text — please confirm this is the right industry: ${preset.description}`,
    businessName: extractBusinessName(text, fileName) || `${preset.name.split('&')[0].trim()} Company`,
    extractedServices: preset.defaultServices.slice(0, 4),
    keyInsights: [
      'Document indicates active customer service requests and field scheduling',
      'Workflows benefit from 24/7 automated receptionist & trade dispatch',
      'Safety limits calibrated to trade operational scope',
    ],
    recommendedTone: preset.recommendedTone,
    technicianRoleName: preset.technicianRoleName || 'Field Specialist',
    dollarThreshold: dollarThresholdFor(preset.id),
  };
}

function buildLlmPrompt(text: string, fileName: string, fileType: string): string {
  const presetList = INDUSTRY_PRESETS.map(
    (p) => `- ${p.id}: "${p.name}" (${p.description}) Services: ${p.defaultServices.join(', ')}`
  ).join('\n');
  return `You are an elite AI Business Onboarding Agent for RCOS (Autonomous Operations OS).
Your goal is to thoroughly read the user's uploaded business document (invoice, company overview, service rate card, proposal, or operations manual), decipher their exact business identity and operations, and determine the optimal industry preset.

AVAILABLE INDUSTRY PRESETS:
${presetList}

DOCUMENT FILENAME: ${fileName || 'Uploaded_Document.txt'}
DOCUMENT MIME TYPE: ${fileType || 'text/plain'}

DOCUMENT CONTENT:
"""
${text.slice(0, 10000)}
"""

DECIPHERING INSTRUCTIONS:
1. "businessName": Extract the official business/company name from the header, invoice, letterhead, or email. If not explicitly found, infer a professional company name based on their primary service.
2. "industryId": Pick the single most accurate matching preset id from the AVAILABLE INDUSTRY PRESETS above.
3. "confidence": A float between 0 and 1 reflecting match precision. Do NOT clamp it to 0.75-0.99: if the document is ambiguous, give your honest lower confidence and set "uncertain": true.
4. "uncertain": true when the document is ambiguous or the match is a best guess; otherwise false.
5. "reasoning": A 2-sentence explanation citing the specific services, terms, or clues from the document that justify this preset.
6. "extractedServices": 3 to 5 real services offered by this business based on the document.
7. "recommendedTone": Optimal brand tone for customer communications in this trade.
8. "dollarThreshold": Recommended autonomous action approval threshold in dollars (e.g. 500-2500).
9. "technicianRoleName": Precise specialist role title (e.g. "Journeyman Plumber", "Systems Engineer", "Certified Solar Lead").
10. "keyInsights": Array of 2 to 3 concise bullet points highlighting key business traits deciphered from the document (e.g. "Offers 24/7 emergency dispatch", "Commercial and residential service lines").
11. "alternativeIndustries": Array of up to 2 alternative preset IDs if the user wants to adjust.
12. "serviceArea": The towns, cities, counties, or region the business serves, exactly as stated in the document (e.g. "Greater Atlanta, GA"). Omit the field entirely if the document does not state a service area — never guess one.
13. "businessHours": Regular opening hours exactly as stated (e.g. "Mon-Fri 8am-6pm, Sat 9am-2pm"). Omit if not stated.
14. "emergencyAvailable": true ONLY if the document says the business offers emergency, after-hours, or 24/7 service. Otherwise false.
15. "teamSize": One of "solo", "small team", or "larger crew", based only on what the document shows (one named operator = solo; a crew/truck count = larger crew). Omit if unclear.
16. "servesResidential": true if the document shows homes/residential customers; "servesCommercial": true if it shows businesses/commercial customers. Otherwise false for each.
17. "priceHints": ONLY prices actually printed in the document, each tied to a service (e.g. {"service": "Standard diagnostic", "price": "$149"}). NEVER invent, round, or estimate a price, and never attach a price to a service the document did not price. If the document shows no prices, use an empty array.
18. "contactInfo": Phone, email, website, and street address ONLY if printed in the document. Omit any field that is not present.

DISAMBIGUATION RULES (overlapping presets — follow these, do not guess):
- healthcare vs dental_practices: teeth / dental / orthodontic / cavity work is dental_practices; medical / clinic / patient / therapy work is healthcare. "Wellness" alone (salon/spa context) is NOT healthcare.
- real_estate vs property_operations vs hospitality_rentals: buying/selling homes, listings, brokers, open houses are real_estate; tenant leases, rent collection, facility/building maintenance for owners are property_operations; Airbnb / vacation / short-term rentals and guest turnover are hospitality_rentals.
- plumbing vs roofing: "roof leak" is roofing. Only a water / pipe / slab / plumbing leak is plumbing.
- cleaning vs moving_storage: "move-in / move-out clean(ing)" is cleaning; moving / movers / relocation / packing is moving_storage.
- marketing_creative: the word "leads" alone is NOT marketing. Require ads / campaigns / SEO / branding / content work.
- education_tutoring: "SAT" / "ACT" only count with tutoring / student / test-prep context. "Satisfaction", "contract", or "act" as a verb are NOT education.
- electrical vs solar_cleanenergy: bare "panel" is NOT electrical. "Solar panel(s)" / photovoltaic is solar_cleanenergy; breaker / wiring / EV charger / electrical panel work is electrical.
- salons_spas vs healthcare: salon / spa / facial / massage / hair work is salons_spas, not healthcare.
- restaurants vs event_production: catering for a dining business is restaurants unless weddings / venues / event staging dominate.

Respond with ONLY valid JSON with this exact schema:
{
  "businessName": "...",
  "industryId": "...",
  "confidence": 0.9,
  "uncertain": false,
  "reasoning": "...",
  "extractedServices": ["...", "..."],
  "recommendedTone": "...",
  "dollarThreshold": 1250,
  "technicianRoleName": "...",
  "keyInsights": ["...", "..."],
  "alternativeIndustries": ["...", "..."],
  "serviceArea": "Greater Atlanta, GA",
  "businessHours": "Mon-Fri 8am-6pm",
  "emergencyAvailable": true,
  "teamSize": "small team",
  "servesResidential": true,
  "servesCommercial": false,
  "priceHints": [{"service": "Standard diagnostic", "price": "$149"}],
  "contactInfo": {"phone": "(555) 000-0000", "email": "hello@example.com", "website": "", "address": ""}
}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function asFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Full handler logic for POST /api/business/analyze-document. Returns the
// exact client contract, with `source: 'llm'` only when the LLM actually ran.
export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentResult> {
  const fileName = typeof input.fileName === 'string' ? input.fileName : '';
  const fileType = typeof input.fileType === 'string' ? input.fileType : '';
  const fileBase64 = typeof input.fileBase64 === 'string' ? input.fileBase64 : '';

  const text = await extractDocumentText(input);
  if (!text && !fileBase64) {
    throw new Error('No document text or file payload provided');
  }

  const fallback = buildFallbackResult(text, fileName);
  const prompt = buildLlmPrompt(
    text || '(No readable text could be extracted from this file. Use the file name and any attached file content.)',
    fileName,
    fileType
  );

  // No extractable text + a binary payload: let the LLM read the file
  // itself (images, scanned PDFs). Otherwise the extracted text is enough.
  let contents: any = prompt;
  if (!text && fileBase64) {
    contents = [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: fileType || 'application/octet-stream', data: fileBase64 } },
          { text: prompt },
        ],
      },
    ];
  }

  const aiRes = await executeGeminiWithFallback({
    preferredModel: FAST_MODEL,
    contents,
    config: { responseMimeType: 'application/json' },
    fallbackFn: () => JSON.stringify(fallback),
  });

  // The LLM did not run (no key, or every model failed): return the
  // keyword fallback, honestly labelled — never as an LLM result.
  if (aiRes.source !== 'llm') return fallback;

  let parsed: any;
  try {
    parsed = JSON.parse(aiRes.text || '');
  } catch {
    return fallback;
  }
  if (!parsed || typeof parsed !== 'object') return fallback;

  const matchedPreset =
    INDUSTRY_PRESETS.find((p) => p.id === parsed.industryId) ||
    INDUSTRY_PRESETS.find((p) => p.id === 'general_small_business') ||
    INDUSTRY_PRESETS[0];
  if (!matchedPreset) return fallback;

  const rawConfidence = asFiniteNumber(parsed.confidence);
  const confidence = rawConfidence !== undefined ? Math.min(1, Math.max(0, rawConfidence)) : 0.5;
  const uncertain = parsed.uncertain === true || confidence < 0.75;

  const llmAlternatives = asStringArray(parsed.alternativeIndustries)
    .filter((id) => id !== matchedPreset.id && INDUSTRY_PRESETS.some((p) => p.id === id))
    .slice(0, 2)
    .map((industryId) => ({ industryId }));
  const alternatives =
    llmAlternatives.length > 0
      ? llmAlternatives
      : scorePresetsByKeywords(text)
          .filter((r) => r.preset.id !== matchedPreset.id && r.score > 0)
          .slice(0, 2)
          .map((r) => ({ industryId: r.preset.id, score: r.score }));

  const extractedServices = asStringArray(parsed.extractedServices);
  const keyInsights = asStringArray(parsed.keyInsights);
  const threshold = asFiniteNumber(parsed.dollarThreshold);

  // Deeper profile — coerced strictly, never invented: strings only when
  // non-empty, booleans only when explicitly true, prices only when the
  // document tied a price to a service. Anything else stays unset.
  const asTextOrUndef = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;
  const teamSizeRaw = asTextOrUndef(parsed.teamSize);
  const priceHints = (Array.isArray(parsed.priceHints) ? parsed.priceHints : [])
    .filter((h: unknown): h is Record<string, unknown> => !!h && typeof h === 'object')
    .map((h: Record<string, unknown>) => ({ service: asTextOrUndef(h.service) || '', price: asTextOrUndef(h.price) || '' }))
    .filter((h: { service: string; price: string }) => h.service && h.price)
    .slice(0, 8);
  const contactRaw = parsed.contactInfo && typeof parsed.contactInfo === 'object' ? parsed.contactInfo : {};
  const contactInfo = {
    phone: asTextOrUndef(contactRaw.phone),
    email: asTextOrUndef(contactRaw.email),
    website: asTextOrUndef(contactRaw.website),
    address: asTextOrUndef(contactRaw.address),
  };
  const hasContact = !!(contactInfo.phone || contactInfo.email || contactInfo.website || contactInfo.address);

  return {
    industryId: matchedPreset.id,
    confidence,
    uncertain,
    alternatives,
    source: 'llm',
    reasoning:
      typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
        ? parsed.reasoning
        : `Deciphered from document: ${matchedPreset.description}`,
    businessName:
      typeof parsed.businessName === 'string' && parsed.businessName.trim()
        ? parsed.businessName.trim()
        : fallback.businessName,
    extractedServices: extractedServices.length > 0 ? extractedServices : matchedPreset.defaultServices.slice(0, 4),
    keyInsights: keyInsights.length > 0 ? keyInsights : fallback.keyInsights,
    recommendedTone:
      typeof parsed.recommendedTone === 'string' && parsed.recommendedTone.trim()
        ? parsed.recommendedTone
        : matchedPreset.recommendedTone,
    technicianRoleName:
      typeof parsed.technicianRoleName === 'string' && parsed.technicianRoleName.trim()
        ? parsed.technicianRoleName
        : matchedPreset.technicianRoleName || 'Field Specialist',
    dollarThreshold: threshold !== undefined && threshold > 0 ? threshold : dollarThresholdFor(matchedPreset.id),
    serviceArea: asTextOrUndef(parsed.serviceArea),
    businessHours: asTextOrUndef(parsed.businessHours),
    emergencyAvailable: parsed.emergencyAvailable === true,
    teamSize: teamSizeRaw === 'solo' || teamSizeRaw === 'small team' || teamSizeRaw === 'larger crew' ? teamSizeRaw : undefined,
    servesResidential: parsed.servesResidential === true,
    servesCommercial: parsed.servesCommercial === true,
    priceHints,
    contactInfo: hasContact ? contactInfo : undefined,
  };
}
