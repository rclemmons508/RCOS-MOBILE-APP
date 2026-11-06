import createDOMPurify from 'dompurify';

/**
 * Email HTML sanitizer (audit #17). One isolated DOMPurify instance so
 * its hooks never affect any other sanitize call in the app.
 *
 * - Scripts, handlers, javascript: URLs, iframes, forms, embeds: stripped
 *   (DOMPurify defaults + FORBID_TAGS).
 * - NO styling from the sender: `style` attributes and <style> tags are
 *   removed, and so are `class` / `id` (they could reuse the app's own
 *   Tailwind classes such as "fixed inset-0" to overlay and spoof app UI).
 * - Remote images are BLOCKED by default (tracking pixels leak opens and
 *   the user's IP). Their URL is kept in `data-blocked-src` only to count
 *   them; the caller re-sanitizes with `loadImages: true` when the user
 *   taps "Load images".
 * - Links get target=_blank + rel=noopener noreferrer nofollow, and only
 *   http(s) / mailto / tel hrefs survive.
 */
const purifier = typeof window !== 'undefined' ? createDOMPurify(window) : null;

let loadImagesForCurrentCall = false;
let blockedCountForCurrentCall = 0;

const isRemoteUrl = (v: string) => /^\s*(https?:)?\/\//i.test(v);
const SAFE_LINK = /^\s*(https?:|mailto:|tel:)/i;

if (purifier) {
  purifier.addHook('afterSanitizeAttributes', (node: Element) => {
    const tag = node.tagName?.toLowerCase();
    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (isRemoteUrl(src) && !loadImagesForCurrentCall) {
        node.removeAttribute('src');
        node.setAttribute('data-blocked-src', '1');
        node.setAttribute('alt', node.getAttribute('alt') || '[image blocked]');
        blockedCountForCurrentCall += 1;
      } else if (!/^\s*(https?:|data:image\/(png|gif|jpe?g|webp);)/i.test(src) && !src.startsWith('//')) {
        // cid:, file:, blob: and anything else: drop.
        node.removeAttribute('src');
      }
    }
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      if (href && !SAFE_LINK.test(href)) node.removeAttribute('href');
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

export interface SanitizedEmail {
  html: string;
  /** Number of remote images that were blocked (0 when loadImages was true). */
  blockedImages: number;
}

export function sanitizeEmailHtml(html: string, opts: { loadImages?: boolean } = {}): SanitizedEmail {
  if (!purifier || !html) return { html: '', blockedImages: 0 };
  loadImagesForCurrentCall = !!opts.loadImages;
  blockedCountForCurrentCall = 0;
  try {
    const out = purifier.sanitize(html, {
      FORBID_TAGS: [
        'script', 'style', 'iframe', 'object', 'embed', 'form', 'input',
        'button', 'select', 'textarea', 'link', 'meta', 'base', 'title',
        'noscript', 'template', 'frame', 'frameset', 'applet',
        // Remote media / vector content that can fetch or position itself.
        'svg', 'math', 'video', 'audio', 'source', 'track', 'picture',
      ],
      FORBID_ATTR: ['style', 'class', 'id', 'background', 'srcset', 'sizes', 'poster', 'ping', 'formaction'],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target', 'data-blocked-src'],
    }) as unknown as string;
    return { html: String(out), blockedImages: blockedCountForCurrentCall };
  } finally {
    loadImagesForCurrentCall = false;
    blockedCountForCurrentCall = 0;
  }
}
