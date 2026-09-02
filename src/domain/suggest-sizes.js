const THRESHOLD = 0.05;

/**
 * Port of RespImageLint computeSizesAttribute: fit piecewise vw/px/calc
 * ranges to measured layout widths keyed by viewport width.
 */
export function suggestSizes(dimensionsByViewport) {
  const byWidth = {};
  for (const [viewport, width] of Object.entries(dimensionsByViewport)) {
    const viewWidth = Number(String(viewport).split('x')[0]);
    if (!byWidth[viewWidth] && width) byWidth[viewWidth] = width;
  }

  const widths = Object.keys(byWidth).map(Number).sort((a, b) => a - b);
  if (!widths.length) return null;

  const ranges = [];
  let current = null;

  for (const viewport of widths) {
    const width = byWidth[viewport];
    if (!current) {
      current = { fixed: width, variable: 0, viewports: [viewport] };
      continue;
    }
    const firstViewport = current.viewports[0];
    const firstWidth = byWidth[firstViewport];
    const variable = (width - firstWidth) / (viewport - firstViewport);
    const fixed = width - viewport * variable;
    const tryRange = { variable, fixed };
    const holds = current.viewports.every((vp) =>
      inThreshold(vp * tryRange.variable + tryRange.fixed, byWidth[vp]),
    );
    if (holds) {
      current.variable = tryRange.variable;
      current.fixed = tryRange.fixed;
      current.viewports.push(viewport);
      continue;
    }
    ranges.push(current);
    current = { fixed: width, variable: 0, viewports: [viewport] };
  }
  if (current) ranges.push(current);

  ranges.reverse();

  return ranges.map(({ fixed, variable, viewports }, index) => {
    let result = '';
    const vw = `${Math.round(variable * 10000) / 100}vw`;
    const px = `${Math.round(Math.abs(fixed))}px`;
    if (ranges[index + 1]) result += `(min-width: ${viewports[0]}px) `;
    if (Math.abs(fixed) < viewports[0] * Math.abs(variable) * THRESHOLD) result += vw;
    else if (viewports[0] * Math.abs(variable) < Math.abs(fixed) * THRESHOLD) result += px;
    else result += `calc(${vw} ${fixed < 0 ? '-' : '+'} ${px})`;
    return result;
  }).join(', ');
}

/** Replace a bare 100vw that would overshoot the measured layout with min(cap, 100vw). */
export function capFluidSizes(suggestion, dimensionsByViewport) {
  if (!suggestion || !/\b100vw\b/.test(suggestion)) return suggestion;
  const layouts = Object.entries(dimensionsByViewport)
    .filter(([, width]) => width)
    .map(([viewport, width]) => ({
      viewport: Number(String(viewport).split('x')[0]),
      layout: width,
    }));
  if (!layouts.length) return suggestion;
  const maxLayout = Math.max(...layouts.map((item) => item.layout));
  const maxViewport = Math.max(...layouts.map((item) => item.viewport));
  if (maxLayout >= maxViewport * 0.9) return suggestion;
  const cap = Math.round(maxLayout);
  return suggestion.replace(/\b100vw\b/g, `min(${cap}px, 100vw)`);
}

export function isBareHundredVw(suggestion) {
  return Boolean(suggestion) && /\b100vw\b/.test(suggestion) && !suggestion.includes('min(');
}

function inThreshold(value, width) {
  return value > width * (1 - THRESHOLD) && value < width * (1 + THRESHOLD);
}
