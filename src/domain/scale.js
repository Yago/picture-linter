/**
 * Scale = intrinsic CSS pixels ÷ (layout width × density).
 * Thresholds from the shared understanding, looser than Sizes (5% + 15px).
 */
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
