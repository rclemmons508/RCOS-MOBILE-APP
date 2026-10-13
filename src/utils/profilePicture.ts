/**
 * Profile pictures for Settings → My Profile.
 *
 * Stored value on the business record:
 *   'default:<id>' — one of the built-in pictures below (inline SVG, no downloads)
 *   'data:...'     — an uploaded photo, downscaled to a small JPEG (<=200KB)
 * Legacy absolute URLs (e.g. the old dicebear avatar) still resolve as-is.
 */

export interface DefaultProfilePicture {
  id: string;
  label: string;
  bg: string;
}

export const DEFAULT_PROFILE_PICTURES: DefaultProfilePicture[] = [
  { id: 'lime', label: 'Green', bg: '#84CC16' },
  { id: 'blue', label: 'Blue', bg: '#3B82F6' },
  { id: 'purple', label: 'Purple', bg: '#8B5CF6' },
  { id: 'orange', label: 'Orange', bg: '#F97316' },
  { id: 'teal', label: 'Teal', bg: '#14B8A6' },
  { id: 'rose', label: 'Rose', bg: '#F43F5E' },
];

/** Inline SVG data URL for a built-in picture (a person silhouette on a color). */
export function defaultPictureDataUrl(id: string): string {
  const pic = DEFAULT_PROFILE_PICTURES.find((p) => p.id === id) || DEFAULT_PROFILE_PICTURES[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" rx="56" fill="${pic.bg}"/><circle cx="128" cy="100" r="42" fill="rgba(255,255,255,0.92)"/><path d="M128 160c-42 0-76 26-76 58 0 12 10 22 22 22h108c12 0 22-10 22-22 0-32-34-58-76-58z" fill="rgba(255,255,255,0.92)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Turn a stored profile-picture value into something an <img> can show. */
export function resolveProfilePicture(value: string | undefined | null, fallback: string): string {
  if (!value) return fallback;
  if (value.startsWith('default:')) return defaultPictureDataUrl(value.slice('default:'.length));
  return value; // data: URL upload, or a legacy absolute URL
}

const MAX_BYTES = 200 * 1024;
const MAX_SIDE = 256;

function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Shrink an uploaded photo to a small JPEG data URL (max 256px on the long
 * side, <=200KB) so it never bloats the business record. Throws a plain
 * message when the file can't be read, isn't a photo, or stays too big.
 */
export async function downscaleImageFile(file: File): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That file is not a photo the app can use.'));
    image.src = src;
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process that photo.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  // Try a few quality levels until the file fits the 200KB cap.
  for (const quality of [0.85, 0.7, 0.55]) {
    const out = canvas.toDataURL('image/jpeg', quality);
    if (dataUrlByteLength(out) <= MAX_BYTES) return out;
  }
  throw new Error('That photo is too large even after shrinking. Please pick a smaller one.');
}
