/**
 * Collapse consecutive viewport widths that share the same payload into ranges.
 * `points` is [{ width, ...payload }], sorted by width.
 * Two points merge when adjacent on the sampled grid (default step 20) and payloadEqual.
 */
export function aggregateRanges(points, payloadEqual, step = 20) {
  if (!points.length) return [];
  const sorted = [...points].sort((a, b) => a.width - b.width);
  const ranges = [];
  let current = { from: sorted[0].width, to: sorted[0].width, ...stripWidth(sorted[0]) };

  for (let i = 1; i < sorted.length; i += 1) {
    const point = sorted[i];
    const same = payloadEqual(current, point) && point.width - current.to <= step;
    if (same) {
      current.to = point.width;
      continue;
    }
    ranges.push(current);
    current = { from: point.width, to: point.width, ...stripWidth(point) };
  }
  ranges.push(current);
  return ranges;
}

function stripWidth({ width: _width, ...rest }) {
  return rest;
}

export function formatRange(range) {
  if (range.from === range.to) return `${range.from}px`;
  return `${range.from}–${range.to}px`;
}
