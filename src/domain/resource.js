export function resourcePath(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, 'https://pl.invalid');
    return decodeURIComponent(parsed.pathname);
  } catch {
    return String(url).split('?')[0];
  }
}

export function mimeFromUrl(url, sourceType) {
  if (sourceType) return sourceType;
  const path = resourcePath(url).toLowerCase();
  if (path.endsWith('.svg') || path.includes('.svg.')) return 'image/svg+xml';
  if (path.endsWith('.avif')) return 'image/avif';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/*';
}

export function fileKind({ svg, placeholder, mime }) {
  if (placeholder) return 'placeholder';
  if (svg || mime === 'image/svg+xml') return 'vector';
  return 'raster';
}

export function styleHint(url) {
  const path = resourcePath(url);
  const drupal = path.match(/\/styles\/([^/]+)\//);
  if (drupal) return drupal[1];
  const file = path.split('/').pop() || '';
  const named = file.match(/([a-z][a-z0-9_]*\d+x\d+)/i);
  if (named) return named[1];
  return null;
}

export function widthFromUrl(url) {
  const path = resourcePath(url);
  const file = path.split('/').pop() || '';
  const pair = file.match(/(\d{2,5})x(\d{2,5})/);
  if (pair) return Number(pair[1]);
  const wOnly = file.match(/[_-](\d{3,5})w\b/i);
  if (wOnly) return Number(wOnly[1]);
  return 0;
}

export function sourceMaxWidth(candidates, naturalWidth, url) {
  const fromSrcset = Math.max(0, ...candidates.map((c) => c.width || 0));
  return Math.max(fromSrcset, naturalWidth || 0, widthFromUrl(url));
}

export function declaredMaxWidth(candidates, url) {
  return Math.max(0, ...candidates.map((c) => c.width || 0), widthFromUrl(url));
}

export function capCandidateWidths(needed, sourceMax, existingWidths) {
  const existing = new Set(existingWidths.filter(Boolean));
  const unique = [...new Set(needed.map((w) => Math.round(w)))].sort((a, b) => a - b);
  const add = [];
  const rejected = [];
  for (const width of unique) {
    if (sourceMax && width > sourceMax) {
      rejected.push(width);
      continue;
    }
    if ([...existing].some((have) => Math.abs(have - width) / width < 0.08)) continue;
    add.push(width);
  }
  return { add, rejected, sourceMax: sourceMax || null };
}

const LADDER = [160, 256, 320, 384, 480, 640, 690, 750, 828, 960, 1080, 1280, 1440, 1920, 2560];

/** Smaller srcset rungs to add when the smallest existing candidate is far above layout (mobile over-fetch). */
export function smallerCandidateRungs({ minLayout, maxLayout, existing, sourceMax }) {
  const present = existing.filter(Boolean).sort((a, b) => a - b);
  if (!present.length || !minLayout) return [];
  const smallest = present[0];
  const layout = Math.max(minLayout, 1);
  if (smallest <= layout * 2.2) return [];
  const cap = Math.min(sourceMax || smallest, Math.round(smallest * 0.92));
  const spans = maxLayout && maxLayout > minLayout * 1.2
    ? [minLayout, minLayout * 1.5, minLayout * 2, minLayout * 3, maxLayout, maxLayout * 2]
    : [minLayout, minLayout * 1.5, minLayout * 2, minLayout * 3];
  const extras = [256, 384, 690, 828].filter((width) => width >= 160 && width <= cap);
  const snapped = [...spans.map(snapLadder), ...extras].filter((width) => width >= 160 && width <= cap);
  return [...new Set(snapped)].sort((a, b) => a - b);
}

function snapLadder(value) {
  return LADDER.reduce((best, width) => (
    Math.abs(width - value) < Math.abs(best - value) ? width : best
  ));
}

export function isPlaceholderSignals({
  naturalWidth = 0,
  naturalHeight = 0,
  className = '',
  ariaHidden = false,
  url = '',
  bytes = 0,
  paintedWidth = 0,
}) {
  if (naturalWidth > 64 || naturalHeight > 64) return false;
  if (paintedWidth > 80) return false;
  if (bytes > 8 * 1024) return false;
  if (/\d{3,}x\d{3,}/.test(resourcePath(url))) return false;
  const tinyIntrinsic = naturalWidth > 0 && naturalWidth <= 64 && naturalHeight > 0 && naturalHeight <= 64;
  const urlTiny = tinyDimensionInUrl(url);
  const blur = /(?:^|\s)(?:blur(?:-sm|-md|-lg)?|lqip|placeholder|thumbhash|thumb-hash)(?:\s|$)/i.test(className);
  if (!tinyIntrinsic && !urlTiny) return false;
  return blur || ariaHidden || (urlTiny && tinyIntrinsic);
}

function tinyDimensionInUrl(url) {
  const path = resourcePath(url);
  const pair = path.match(/(?:^|\/)(\d{1,2})x(\d{1,2})(?:\/|[._-]|$)/);
  if (!pair) return false;
  return Number(pair[1]) <= 40 && Number(pair[2]) <= 40;
}

export function urlFamily(url) {
  const path = resourcePath(url);
  const href = String(url);
  if (/shopify/i.test(href) || path.includes('/cdn/shop/')) return 'shopify';
  try {
    const host = new URL(href, 'https://pl.invalid').hostname;
    if (/shopify/i.test(host) || /\.myshopify\.com$/i.test(host)) return 'shopify';
  } catch {
    /* ignore */
  }
  const style = path.match(/\/styles\/([^/]+)\//);
  if (style) return `drupal:${style[1]}`;
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(0, slash + 1) : path;
}

export function srcsetShape(subject) {
  return (subject.candidates ?? [])
    .map((c) => c.width)
    .filter(Boolean)
    .sort((a, b) => a - b)
    .join(',');
}

export function groupKey(subject) {
  const kind = subject.fileKind || 'raster';
  const shared = [
    kind,
    srcsetShape(subject),
    subject.sizesAttr ?? '',
    (subject.identity?.hidingClasses ?? []).join(','),
    subject.identity?.component ?? '',
  ];
  if (kind === 'vector' || kind === 'placeholder') {
    return [...shared, resourcePath(subject.resource)].join('\n');
  }
  return [...shared, urlFamily(subject.resource)].join('\n');
}
