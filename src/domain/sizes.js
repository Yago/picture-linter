const AUTO = /^auto$/i;
const SIZES_THRESHOLD_RATIO = 0.05;
const SIZES_THRESHOLD_PX = 15;

export { SIZES_THRESHOLD_RATIO, SIZES_THRESHOLD_PX };

export function parseSizes(value) {
  if (!value || !value.trim()) return [];
  const items = [];
  for (const raw of splitSizes(value)) {
    const item = parseSizesItem(raw.trim());
    if (item) items.push(item);
  }
  return items;
}

function splitSizes(value) {
  const parts = [];
  let current = '';
  let depth = 0;
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function parseSizesItem(part) {
  if (!part) return null;
  const mediaAndSize = part.match(/^(.*?)\s+(\S+(?:\s*\/\s*\S+)*)$/);
  if (mediaAndSize && mediaAndSize[1].includes('(')) {
    return { media: mediaAndSize[1].trim(), size: mediaAndSize[2].trim() };
  }
  return { media: null, size: part.trim() };
}

export function isSizesAuto(items) {
  return items.length > 0 && !items[0].media && AUTO.test(items[0].size);
}

export function winningSize(items, viewportWidth, mediaMatches) {
  const list = isSizesAuto(items) ? items.slice(1) : items;
  for (const item of list) {
    if (item.media && !mediaMatches(item.media, viewportWidth)) continue;
    if (AUTO.test(item.size)) continue;
    return item.size;
  }
  return null;
}

export function sizesMismatch(layoutWidth, sizesPx) {
  if (sizesPx == null || layoutWidth <= 0) return false;
  const slop = sizesPx * SIZES_THRESHOLD_RATIO + SIZES_THRESHOLD_PX;
  return layoutWidth < sizesPx - slop || layoutWidth > sizesPx + slop;
}

/**
 * Resolve a sizes length against a viewport. Handles px, vw/vh/vmin/vmax, em/rem,
 * and simple calc() of those. Unparsed lengths return null.
 */
export function computeLength(length, viewportWidth, viewportHeight = Math.round(viewportWidth * 9 / 16)) {
  if (!length) return null;
  let expr = length.trim().toLowerCase();
  expr = expr.replace(
    /(-?\d*\.?\d+)(svw|lvw|dvw|vw|svh|lvh|dvh|vh|vi|vb|vmin|vmax)/g,
    (_, n, unit) => {
      const value = Number(n);
      const u = unit.replace(/^[sld]/, '');
      const px =
        u === 'vw' || u === 'vi' ? viewportWidth :
        u === 'vh' || u === 'vb' ? viewportHeight :
        u === 'vmin' ? Math.min(viewportWidth, viewportHeight) :
        u === 'vmax' ? Math.max(viewportWidth, viewportHeight) :
        0;
      return String((value * px) / 100);
    },
  );
  expr = expr.replace(/(-?\d*\.?\d+)r?em/g, (_, n) => String(Number(n) * 16));
  expr = expr.replace(/(-?\d*\.?\d+)px/g, (_, n) => n);

  if (/^[-+]?\d*\.?\d+$/.test(expr)) return Math.round(Number(expr));

  const minFn = expr.match(/^min\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);
  if (minFn) return Math.round(Math.min(Number(minFn[1]), Number(minFn[2])));
  const maxFn = expr.match(/^max\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);
  if (maxFn) return Math.round(Math.max(Number(maxFn[1]), Number(maxFn[2])));

  const calc = expr.match(/^calc\((.+)\)$/);
  if (calc) expr = calc[1];

  if (!/^[-+\d.\s*/()]+$/.test(expr)) return null;
  try {
    const result = Function(`"use strict"; return (${expr})`)();
    if (!Number.isFinite(result)) return null;
    return Math.round(result);
  } catch {
    return null;
  }
}

export function mediaMinMaxMatches(media, viewportWidth) {
  if (!media) return true;
  const min = media.match(/\(min-width:\s*(\d+(?:\.\d+)?)px\)/i);
  const max = media.match(/\(max-width:\s*(\d+(?:\.\d+)?)px\)/i);
  if (min && viewportWidth < Number(min[1])) return false;
  if (max && viewportWidth > Number(max[1])) return false;
  if (!min && !max) return true;
  return true;
}
