import { sameResource } from './resource.js';

/**
 * Scale = Candidate pixels ÷ (layout width × density).
 * Thresholds from the shared understanding, looser than Sizes (5% + 15px).
 */

/**
 * Pixels Fit compares. The requested Resource uses its density-1 bitmap when
 * that decode exists. Otherwise a `w` descriptor, or (for that Resource only)
 * the density-corrected width × an `x` descriptor. Any other Candidate keeps its `w`.
 */
export function fitPixels(candidate, { resource = '', bitmap = 0, naturalWidth = 0 } = {}) {
  if (candidate && sameResource(candidate.url, resource) && bitmap > 0) return bitmap;
  if (candidate?.width != null) return candidate.width;
  if (candidate && sameResource(candidate.url, resource) && naturalWidth > 0) {
    const density = candidate.density ?? 1;
    return Math.round(naturalWidth * density);
  }
  if (!candidate && bitmap > 0) return bitmap;
  if (!candidate && naturalWidth > 0) return naturalWidth;
  return 0;
}

export function classifyScale(scale) {
  if (!Number.isFinite(scale) || scale <= 0) return 'red';
  if (scale >= 0.9 && scale <= 1.5) return 'green';
  if ((scale >= 0.75 && scale < 0.9) || (scale > 1.5 && scale <= 2)) return 'orange';
  return 'red';
}

export function scaleOf(intrinsicPx, layoutWidth, density) {
  const need = layoutWidth * density;
  if (need <= 0) return Infinity;
  return intrinsicPx / need;
}

/** undersized = blur risk, oversized = over-fetch. Independent of traffic-light severity. */
export function fitDirection(scale) {
  if (!Number.isFinite(scale) || scale <= 0) return 'undersized';
  if (scale < 0.9) return 'undersized';
  if (scale > 1.5) return 'oversized';
  return 'ok';
}
