import { classifyScale, scaleOf, fitDirection } from '../domain/scale.js';
import { pickCandidate, parseSrcset } from '../domain/srcset.js';
import { parseSizes, isSizesAuto, winningSize, computeLength, sizesMismatch, mediaMinMaxMatches } from '../domain/sizes.js';
import { suggestSizes, capFluidSizes, isBareHundredVw } from '../domain/suggest-sizes.js';
import { aggregateRanges, formatRange } from '../domain/ranges.js';
import { worstSeverity } from '../domain/severity.js';
import { capCandidateWidths, smallerCandidateRungs } from '../domain/resource.js';
import { GRID, parseViewportKey } from '../measure/grid.js';
import { phantomReason, hiddenAncestor, isTiny } from '../collect/paint.js';
import { cssSelector } from '../collect/locator.js';

const DENSITIES = GRID.densities;

export function lintSubject(subject, dimensions) {
  const findings = [];
  findings.push(...markupFindings(subject));

  if (subject.placeholder) {
    findings.push({
      type: 'placeholder',
      severity: 'skip',
      summary: 'LQIP / blur-up placeholder — do not treat as a content image',
    });
    return finish(subject, findings, dimensions);
  }

  if (isSprite(subject)) {
    findings.push({
      type: 'skipped-sprite',
      severity: 'skip',
      summary: 'Sprite sheet excluded from Fit',
    });
    return finish(subject, findings, dimensions);
  }

  findings.push(...phantomFindings(subject, dimensions));

  if (subject.fileKind === 'vector') {
    findings.push(...svgFindings(subject));
    return finish(subject, findings, dimensions);
  }

  findings.push(...sourceShortFindings(subject));

  if (!subject.svg && subject.painted && !isTiny(subject.painted)) {
    findings.push(...fitFindings(subject));
  }

  if (subject.painted) {
    if (subject.kind !== 'background') {
      findings.push(...sizesFindings(subject, dimensions));
      findings.push(...candidateFindings(subject, dimensions));
    } else {
      findings.push(...backgroundFitFindings(subject, dimensions));
    }
  }

  return finish(subject, findings, dimensions);
}

function finish(subject, findings, dimensions) {
  const compact = findings.filter(Boolean);
  const verdict = worstSeverity(compact.map((f) => f.severity));
  const suggestion = capFluidSizes(suggestSizes(dimensions), dimensions);
  return {
    subject,
    findings: compact,
    verdict,
    sizesSuggestion: suggestion,
    actions: actionsFrom(subject, compact, suggestion),
  };
}

function markupFindings(subject) {
  const findings = [];
  if (subject.kind !== 'picture') {
    if (subject.kind === 'img' && subject.sources.length === 0) return findings;
    return findings;
  }
  const picture = subject.picture;
  if (!picture) return findings;
  const imgs = picture.querySelectorAll('img');
  if (imgs.length === 0) {
    findings.push({ type: 'fix-markup', code: 'missing-img', severity: 'red', summary: '<picture> has no <img>' });
  }
  if (imgs.length > 1) {
    findings.push({ type: 'fix-markup', code: 'duplicate-img', severity: 'red', summary: '<picture> has more than one <img>' });
  }
  for (const source of picture.querySelectorAll('source')) {
    if (source.hasAttribute('src')) {
      findings.push({ type: 'fix-markup', code: 'source-src', severity: 'red', summary: '<source> must use srcset, not src' });
    }
  }
  const children = [...picture.children];
  const imgIndex = children.findIndex((el) => el.tagName === 'IMG');
  if (imgIndex !== -1 && children.slice(imgIndex + 1).some((el) => el.tagName === 'SOURCE')) {
    findings.push({ type: 'fix-markup', code: 'wrong-order', severity: 'red', summary: '<source> elements must come before <img>' });
  }
  const mixed = hasMixedDescriptors(subject);
  if (mixed) {
    findings.push({ type: 'fix-markup', code: 'mixed-descriptors', severity: 'red', summary: 'Do not mix w and x descriptors in one srcset' });
  }
  const xAndSizes = usesXAndSizes(subject);
  if (xAndSizes) {
    findings.push({ type: 'fix-markup', code: 'x-and-sizes', severity: 'orange', summary: 'sizes is ignored when srcset uses x descriptors' });
  }
  return findings;
}

function hasMixedDescriptors(subject) {
  const sets = [subject.img?.srcset, ...subject.sources.map((s) => s.srcset)].filter(Boolean);
  return sets.some((value) => {
    const c = parseSrcset(value);
    const w = c.some((x) => x.width != null);
    const x = c.some((x) => x.density != null && x.width == null);
    return w && x;
  });
}

function usesXAndSizes(subject) {
  if (!subject.sizesAttr) return false;
  const sets = [subject.img?.srcset, ...subject.sources.map((s) => s.srcset)].filter(Boolean);
  return sets.some((value) => parseSrcset(value).some((c) => c.density != null && c.width == null));
}

function phantomFindings(subject, dimensions) {
  const findings = [];
  const livePhantom = subject.requested && !subject.painted;
  const hiddenViewports = [];
  for (const [key, width] of Object.entries(dimensions)) {
    const { width: vw } = parseViewportKey(key);
    if (width < 1) hiddenViewports.push({ width: vw, severity: 'red' });
  }

  const hiding = subject.identity?.hiding;
  const hidingLabel = hiding?.classes?.length
    ? hiding.classes.map((c) => `.${c}`).join(' ')
    : null;

  if (livePhantom) {
    const reason = subject.kind === 'background' ? 'background-on-closed-state' : phantomReason(subject.element);
    const why = hidingLabel
      || (reason === 'closed-disclosure' ? explainClosed(subject.element) : reason);
    findings.push({
      type: 'phantom',
      severity: 'red',
      reason,
      hidingClasses: hiding?.classes ?? [],
      hidingAncestors: hiding?.ancestors ?? [],
      groupParent: hiddenAncestor(subject.element),
      summary: hidingLabel
        ? `Requested but not painted — hidden by ${hidingLabel}`
        : `Requested but not painted (${why})`,
    });
  }

  const paintedSomewhere = Object.values(dimensions).some((w) => w >= 1);
  if (!livePhantom && paintedSomewhere && hiddenViewports.length) {
    const ranges = aggregateRanges(hiddenViewports, () => true, GRID.step);
    findings.push({
      type: 'phantom',
      severity: 'red',
      reason: 'css-hidden-at-viewport',
      hidingClasses: hiding?.classes ?? [],
      ranges: ranges.map(formatRange),
      summary: hidingLabel
        ? `Not painted at ${ranges.map(formatRange).join(', ')} — ${hidingLabel}`
        : `Not painted at ${ranges.map(formatRange).join(', ')} but still in the DOM`,
    });
  }
  return findings;
}

function explainClosed(element) {
  if (element.closest('details:not([open])')) return 'inside <details> that is not open';
  if (element.closest('[hidden]')) return 'ancestor has the hidden attribute';
  return 'not painted after request';
}

function svgFindings(subject) {
  if (!subject.painted) return [];
  const intrinsic = subject.img?.naturalWidth || 0;
  const layout = Math.round(subject.painted.width);
  if (!intrinsic || layout < 1) return [];
  const scale = intrinsic / layout;
  if (scale <= 1.5) return [];
  const bytes = subject.bytes || 0;
  const light = bytes > 0 && bytes < 8 * 1024;
  if (light) {
    return [{
      type: 'svg-oversized',
      severity: 'skip',
      informational: true,
      direction: 'oversized',
      intrinsic,
      layout,
      scale: round(scale),
      bytes,
      summary: `SVG viewBox ${intrinsic}w vs ${layout} CSS px (${round(scale)}×), ${formatKb(bytes)} transferred. Informational — vector cost is negligible; do not change CSS or the CMS asset.`,
    }];
  }
  return [{
    type: 'svg-oversized',
    severity: 'orange',
    direction: 'oversized',
    intrinsic,
    layout,
    scale: round(scale),
    bytes,
    summary: `Heavy SVG (${formatKb(bytes)}): intrinsic ${intrinsic}w vs ${layout} CSS px (${round(scale)}×). Do not add raster srcset.`,
  }];
}

function formatKb(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function sourceShortFindings(subject) {
  const decoded = subject.img?.naturalWidth || 0;
  const chosen = subject.candidates.find((c) => c.url === subject.resource);
  const declared = chosen?.width || Math.max(0, ...subject.candidates.map((c) => c.width || 0));
  if (!decoded || !declared) return [];
  if (decoded >= declared * 0.9) return [];
  return [{
    type: 'source-short',
    severity: 'orange',
    decoded,
    declared,
    styleHint: subject.styleHint,
    summary: `Decoded ${decoded}w but srcset/style declares ${declared}w${subject.styleHint ? ` (${subject.styleHint})` : ''}. Theme sizes/srcset cannot invent pixels — fix the image style or original. Out of theme scope.`,
  }];
}

function fitFindings(subject) {
  const current = currentFit(subject);
  if (!current || current.severity === 'green') return [];
  const density = window.devicePixelRatio || 1;
  const layout = Math.round(subject.painted.width);
  const need = Math.round(layout * density);
  const direction = fitDirection(current.scale);
  return [{
    type: 'fit',
    severity: current.severity,
    direction,
    scale: current.scale,
    density,
    layout,
    need,
    have: current.have,
    summary: `${direction} · needed ${need}w (${layout} CSS px × ${density} DPR) · chosen ${current.have}w · fit ${round(current.scale)}×`,
  }];
}

function currentFit(subject) {
  if (!subject.painted || subject.svg) return null;
  const layoutWidth = subject.painted.width;
  const density = window.devicePixelRatio || 1;
  const intrinsic = subject.img?.naturalWidth
    || subject.candidates.find((c) => c.url === subject.resource)?.width
    || 0;
  if (!intrinsic) return null;
  const scale = scaleOf(intrinsic, layoutWidth, density);
  return { scale, severity: classifyScale(scale), have: intrinsic };
}

function evaluateSizesPx(subject, layoutWidth, vw, vh) {
  const items = parseSizes(subject.sizesAttr);
  if (!items.length || isSizesAuto(items) && items.length === 1) return layoutWidth;
  const size = winningSize(items, vw, mediaMinMaxMatches);
  if (!size) return layoutWidth;
  return computeLength(size, vw, vh);
}

function sizesFindings(subject, dimensions) {
  const items = parseSizes(subject.sizesAttr);
  if (isSizesAuto(items)) return [];
  if (!hasWSrcset(subject)) return [];
  if (!items.length) {
    return [{
      type: 'sizes',
      severity: 'orange',
      summary: 'w-descriptors without a sizes attribute (browser assumes 100vw)',
    }];
  }

  const points = [];
  for (const [key, layoutWidth] of Object.entries(dimensions)) {
    if (layoutWidth < 1) continue;
    const { width: vw, height: vh } = parseViewportKey(key);
    const size = winningSize(items, vw, mediaMinMaxMatches);
    const sizesPx = size ? computeLength(size, vw, vh) : null;
    if (sizesPx == null) continue;
    if (!sizesMismatch(layoutWidth, sizesPx)) continue;
    const delta = Math.abs(layoutWidth - sizesPx) / sizesPx;
    const severity = delta > 0.25 ? 'red' : 'orange';
    points.push({ width: vw, severity, layoutWidth, sizesPx });
  }
  if (!points.length) return [];
  const ranges = aggregateRanges(points, (a, b) => a.severity === b.severity, GRID.step);
  return ranges.map((range) => ({
    type: 'sizes',
    severity: range.severity,
    range: formatRange(range),
    layoutWidth: range.layoutWidth,
    sizesPx: range.sizesPx,
    mismatchPx: range.layoutWidth - range.sizesPx,
    summary: `sizes computed ${range.sizesPx}px vs layout ${range.layoutWidth}px (${range.layoutWidth - range.sizesPx >= 0 ? '+' : ''}${range.layoutWidth - range.sizesPx}px) at ${formatRange(range)}`,
  }));
}

function candidateFindings(subject, dimensions) {
  if (!subject.candidates.length) return [];
  const points = [];
  for (const [key, layoutWidth] of Object.entries(dimensions)) {
    if (layoutWidth < 1) continue;
    const { width: vw, height: vh } = parseViewportKey(key);
    for (const density of DENSITIES) {
      const need = layoutWidth * density;
      const picked = pickCandidate(subject.candidates, evaluateSizesPx(subject, layoutWidth, vw, vh) ?? layoutWidth, density);
      const have = picked?.width ?? subject.img?.naturalWidth ?? 0;
      if (!have) continue;
      const scale = have / need;
      const severity = classifyScale(scale);
      if (severity === 'green') continue;
      points.push({
        width: vw,
        severity,
        direction: fitDirection(scale),
        need: Math.round(need),
        have,
        density,
        scale,
        layoutWidth,
      });
    }
  }
  if (!points.length) return [];
  const ranges = collapseRanges(groupAndAggregate(points, (p) => `${p.direction}|${p.density}`));
  return ranges.map((range) => ({
    type: 'candidates',
    severity: range.severity,
    direction: range.direction,
    density: range.density,
    range: range.rangeLabel,
    need: range.need,
    have: range.have,
    layoutWidth: range.layoutWidth,
    scale: range.scale,
    summary: `${range.direction} · needed ${range.need}w (${range.layoutWidth} CSS px × ${range.density} DPR) · chosen ${range.have}w · fit ${round(range.scale)}× at ${range.rangeLabel}`,
  }));
}

function backgroundFitFindings(subject, dimensions) {
  const natural = naturalFromCandidates(subject);
  if (!natural) return [];
  const points = [];
  for (const [key, layoutWidth] of Object.entries(dimensions)) {
    if (layoutWidth < 1) continue;
    const { width: vw } = parseViewportKey(key);
    const painted = subject.painted;
    const layoutHeight = painted && painted.width ? painted.height * (layoutWidth / painted.width) : layoutWidth;
    for (const density of DENSITIES) {
      const need = Math.max(layoutWidth, layoutHeight) * density;
      const scale = natural / need;
      const severity = classifyScale(scale);
      if (severity === 'green') continue;
      points.push({ width: vw, severity, scale, density });
    }
  }
  if (!points.length) return [];
  const ranges = collapseRanges(groupAndAggregate(points, (p) => `${p.severity}|${p.density}`));
  return ranges.map((range) => ({
    type: 'fit-background',
    severity: range.severity,
    density: range.density,
    range: range.rangeLabel,
    summary: `Background Fit ${range.severity} @${range.density}× at ${range.rangeLabel}`,
  }));
}

function collapseRanges(ranges) {
  const groups = new Map();
  for (const range of ranges) {
    const key = `${range.direction ?? range.severity}|${range.density ?? ''}`;
    const list = groups.get(key) ?? [];
    list.push(range);
    groups.set(key, list);
  }
  return [...groups.values()].map((group) => ({
    ...group[0],
    rangeLabel: group.map(formatRange).join(', '),
  }));
}

function hasWSrcset(subject) {
  const attrs = [subject.img?.srcset, ...subject.sources.map((s) => s.srcset)].filter(Boolean);
  return attrs.some((value) => parseSrcset(value).some((c) => c.width != null));
}

function groupAndAggregate(points, keyOf) {
  const groups = new Map();
  for (const point of points) {
    const key = keyOf(point);
    const list = groups.get(key) ?? [];
    list.push(point);
    groups.set(key, list);
  }
  return [...groups.values()].flatMap((group) => aggregateRanges(group, () => true, GRID.step));
}

function naturalFromCandidates(subject) {
  const match = subject.candidates.find((c) => c.url === subject.resource);
  return match?.width || 0;
}

function isSprite(subject) {
  if (subject.kind !== 'background' || !subject.background) return false;
  const { position, size, repeat } = subject.background;
  const pos = position || '';
  const notOrigin = pos && !/^((0|0px|0%)\s+){0,3}(0|0px|0%|left|top)(\s+(0|0px|0%|left|top))?$/.test(pos.trim());
  const repeating = repeat && !/^no-repeat/i.test(repeat) && repeat !== 'repeat no-repeat' /* still maybe sprite */;
  if (notOrigin && /px/.test(pos)) return true;
  if (size && /^\d+(\.\d+)?px/.test(size) && notOrigin) return true;
  if (repeating && /repeat/.test(repeat) && size !== 'cover' && size !== 'contain') {
    const box = subject.painted;
    if (box && box.width < 64 && box.height < 64) return true;
  }
  return false;
}

function actionsFrom(subject, findings, sizesSuggestion) {
  const actions = [];
  const locators = locatorsOf(subject);

  if (subject.placeholder) {
    actions.push({
      action: 'ignore-placeholder',
      locators,
      summary: 'Ignore this node — LQIP / blur-up, not a content image',
    });
    return actions;
  }

  const sizesFinding = findings.find((f) => f.type === 'sizes');
  if (sizesFinding && sizesSuggestion && subject.fileKind === 'raster') {
    const disqualified = isBareHundredVw(sizesSuggestion);
    const same = normalizeSizes(sizesSuggestion) === normalizeSizes(subject.sizesAttr || '');
    if (!disqualified && !same) {
      actions.push({
        action: 'update-sizes',
        locators,
        from: subject.sizesAttr || null,
        to: sizesSuggestion,
        layoutWidth: sizesFinding.layoutWidth,
        sizesPx: sizesFinding.sizesPx,
        mismatchPx: sizesFinding.mismatchPx,
        layoutSamples: layoutSamples(subject),
        summary: `Set sizes from ${JSON.stringify(subject.sizesAttr || '(missing)')} to "${sizesSuggestion}" (layout ${sizesFinding.layoutWidth}px vs sizes ${sizesFinding.sizesPx}px)`,
      });
    }
  }

  const existing = subject.candidates.map((c) => c.width).filter(Boolean);
  const have = existing.length
    ? existing
    : [subject.img?.naturalWidth, subject.sourceMax].filter(Boolean);
  const decoded = subject.img?.naturalWidth || 0;
  const short = findings.find((f) => f.type === 'source-short');
  const effectiveMax = short ? decoded : (subject.sourceMax || null);

  if (short) {
    actions.push({
      action: 'source-short',
      locators,
      decoded: short.decoded,
      declared: short.declared,
      styleHint: short.styleHint,
      summary: short.summary,
    });
  }

  const undersized = findings.filter((f) => f.type === 'candidates' && f.direction === 'undersized');
  if (undersized.length && subject.fileKind === 'raster' && !short) {
    const byDensity = new Map();
    for (const finding of undersized) {
      byDensity.set(finding.density, Math.max(byDensity.get(finding.density) ?? 0, finding.need || 0));
    }
    const needed = [...byDensity.values()].filter(Boolean);
    const { add, rejected, sourceMax } = capCandidateWidths(needed, effectiveMax, have);
    if (add.length) {
      actions.push({
        action: 'add-candidates',
        locators,
        widths: add,
        sourceMax,
        summary: `Add raster srcset candidates ${add.join(', ')}w (source max ${sourceMax || '?'}w)`,
      });
    }
    if (rejected.length && !add.length && !short) {
      actions.push({
        action: 'source-short',
        locators,
        rejected,
        sourceMax,
        summary: `Need ${rejected.join(', ')}w but source max is ${sourceMax}w. Do not invent larger derivatives in the theme.`,
      });
    }
  }

  const oversized = findings.filter((f) => (
    (f.type === 'candidates' || f.type === 'fit') && f.direction === 'oversized'
  ));
  if (oversized.length && subject.fileKind === 'raster') {
    const layouts = oversized.map((f) => f.layoutWidth || f.layout).filter(Boolean);
    const minLayout = Math.min(...layouts, subject.painted?.width || Infinity);
    const maxLayout = Math.max(...layouts, subject.painted?.width || 0);
    const add = smallerCandidateRungs({
      minLayout,
      maxLayout,
      existing: have,
      sourceMax: effectiveMax || subject.sourceMax,
    });
    if (add.length) {
      actions.push({
        action: 'add-candidates',
        locators,
        widths: add,
        sourceMax: effectiveMax || subject.sourceMax,
        summary: `Oversized on small layouts — add smaller srcset rungs ${add.join(', ')}w (smallest today ${Math.min(...have)}w)`,
      });
    }
  }

  const svg = findings.find((f) => f.type === 'svg-oversized' && !f.informational && f.severity !== 'skip');
  if (svg) {
    actions.push({
      action: 'svg-oversized',
      locators,
      intrinsic: svg.intrinsic,
      layout: svg.layout,
      summary: `SVG viewBox/intrinsic ${svg.intrinsic}w vs CSS layout ${svg.layout}px. Do not add srcset. Shrink the asset or the CSS box (${subject.identity?.classes?.find((c) => /^h-/.test(c)) || 'height class'}).`,
    });
  }

  const phantom = findings.find((f) => f.type === 'phantom');
  if (phantom) {
    const parent = phantom.groupParent;
    const twin = subject.identity?.artDirectionTwin;
    const strategy = twin
      ? {
        id: 'merge-picture-sources',
        detail: `Merge with sibling ${twin.selector} (${twin.shownBy || 'shown counterpart'}). Use one <picture> with <source media="${twin.mediaHint || '(min-width: …)'}"> instead of two DOM nodes.`,
      }
      : hidingStrategy(phantom);
    actions.push({
      action: 'stop-phantom',
      locators,
      reason: phantom.reason,
      hidingClasses: phantom.hidingClasses,
      strategy: strategy.id,
      groupSelector: parent ? cssSelector(parent) : subject.selector,
      summary: twin
        ? strategy.detail
        : `${strategy.detail} Hidden by ${formatHiding(phantom)}.`,
    });
  }

  const bg = findings.find((f) => f.type === 'fit-background' && f.severity !== 'green');
  if (bg && subject.fileKind === 'raster') {
    actions.push({
      action: 'fit-background',
      locators,
      summary: 'Serve a smaller file or an image-set() matching the painted box',
    });
  }

  for (const finding of findings.filter((f) => f.type === 'fix-markup')) {
    actions.push({
      action: 'fix-markup',
      locators,
      code: finding.code,
      summary: finding.summary,
    });
  }

  return actions;
}

function normalizeSizes(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function locatorsOf(subject) {
  return {
    resource: subject.resource,
    snippet: subject.snippet,
    selector: subject.identity?.selector || subject.selector,
    classes: subject.identity?.classes ?? [],
    dataTest: subject.identity?.dataTest ?? null,
    alt: subject.identity?.alt || null,
    component: subject.identity?.component ?? null,
  };
}

function layoutSamples(subject) {
  const painted = subject.painted;
  if (!painted) return null;
  return {
    current: { width: Math.round(painted.width), height: Math.round(painted.height), dpr: window.devicePixelRatio || 1 },
  };
}

function hidingStrategy(phantom) {
  const classes = phantom.hidingClasses ?? [];
  if (classes.some((c) => /^(?:sm|md|lg|xl|max-)/.test(c))) {
    return {
      id: 'do-not-render-or-source-media',
      detail: `Do not render this markup when ${classes.map((c) => `.${c}`).join(' ')} applies, or fold it into <source media>. loading="lazy" will not stop a display:none request.`,
    };
  }
  if (phantom.reason === 'display-none-ancestor') {
    return {
      id: 'do-not-assign-src-until-visible',
      detail: 'Do not set src/srcset until the ancestor is shown. loading="lazy" does not help when display:none already has src.',
    };
  }
  return {
    id: 'do-not-request-until-painted',
    detail: 'Keep the file off the network until this node can paint.',
  };
}

function formatHiding(phantom) {
  if (phantom.hidingClasses?.length) return phantom.hidingClasses.map((c) => `.${c}`).join(' ');
  return phantom.reason;
}

function round(n) {
  return Math.round(n * 100) / 100;
}
