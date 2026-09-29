import { GRID } from '../measure/grid.js';

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

const RANGE_PART = /^(\d+)(?:[\u2013-](\d+))?px$/;

export function parseRangeLabel(label) {
  if (!label) return [];
  return String(label).split(',').flatMap((part) => {
    const match = RANGE_PART.exec(part.trim());
    if (!match) return [];
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    return [{ from, to: Math.max(from, to) }];
  });
}

export function stripSegments(finding) {
  if (finding.severity !== 'red' && finding.severity !== 'orange') return null;
  const labels = finding.ranges?.length ? finding.ranges : (finding.range ? [finding.range] : []);
  const spans = labels.flatMap(parseRangeLabel);
  if (!spans.length) return null;
  const scale = GRID.maxWidth - GRID.minWidth;
  const segments = spans.map(({ from, to }) => {
    const start = Math.min(Math.max(from, GRID.minWidth), GRID.maxWidth);
    const end = Math.min(Math.max(to, start), GRID.maxWidth);
    let left = (start - GRID.minWidth) / scale;
    let width = Math.max(end - start, GRID.step) / scale;
    if (left + width > 1) left = Math.max(0, 1 - width);
    width = Math.min(width, 1 - left);
    return { left, width };
  });
  return { severity: finding.severity, segments };
}
