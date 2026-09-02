import { groupKey, resourcePath, urlFamily, declaredMaxWidth } from '../domain/resource.js';
import { worstSeverity } from '../domain/severity.js';
import { GRID } from '../measure/grid.js';

export function toAgentDocument(pageUrl, results, scan = {}) {
  const groups = groupResults(results);
  const tickets = groups.filter(isTicket);
  return {
    scan: {
      page: pageUrl,
      generatedAt: new Date().toISOString(),
      viewport: scan.viewport ?? null,
      dpr: scan.dpr ?? null,
      grid: {
        minWidth: GRID.minWidth,
        maxWidth: GRID.maxWidth,
        step: GRID.step,
        densities: GRID.densities,
      },
    },
    summary: {
      uniqueIssues: tickets.filter((g) => g.verdict !== 'green' && g.verdict !== 'skip').length,
      instances: tickets.reduce((sum, group) => sum + group.instances, 0),
      wastedBytes: tickets.reduce((sum, group) => sum + group.wastedBytes, 0),
      placeholders: groups.filter((g) => g.fileKind === 'placeholder').length,
    },
    groups: tickets,
  };
}

export const AGENT_PROMPT_PREAMBLE = `Implement the Picture Linter Agent document below in the repository that serves this page.

Picture Linter inspected the page's images (\`<img>\`, \`<picture>\`, CSS \`background-image\`) across a viewport grid and grouped issues by root cause — not by DOM node.

Rules:
- Each \`##\` heading is one group (one template / one issue). \`instances\` is how many times it appears; fix the shared markup once.
- \`Action:\` lines are the tickets. Implement those. Do not invent extra image work.
- Honor non-actions already in the document: placeholders, informational SVGs, \`source-short\` (decoded file smaller than the style — out of theme scope), and any "Do NOT add" / "Out of theme scope" notes.
- Map locators to this repo in this order: Resource URL → HTML snippet → selector / data-test / component.
- Phantoms (\`stop-phantom\`) were requested but not painted. \`display: none\` does not stop a request. Fold complementary art-direction pairs into one \`<picture>\` with \`<source media>\`, or do not render the markup at that breakpoint.
- Never apply a \`sizes\` value the document itself disqualifies.
- If the document has no findings, make no image changes.

Keep the diff to those actions.`;

export function toAgentPrompt(markdown) {
  return `${AGENT_PROMPT_PREAMBLE}\n\n---\n\n${markdown.replace(/^\n+/, '')}`;
}

export function toMarkdown(doc) {
  const lines = [
    '# Picture Linter',
    '',
    '## Scan',
    '',
    `- Page: ${doc.scan.page}`,
    `- Generated: ${doc.scan.generatedAt}`,
  ];
  if (doc.scan.viewport) {
    lines.push(`- Viewport at dump: ${doc.scan.viewport.width}×${doc.scan.viewport.height} @${doc.scan.dpr || '?'}×`);
  }
  lines.push(`- Grid: ${doc.scan.grid.minWidth}–${doc.scan.grid.maxWidth}px step ${doc.scan.grid.step}, DPR ${doc.scan.grid.densities.join('/')}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Unique issues: ${doc.summary.uniqueIssues}`);
  lines.push(`- Instances: ${doc.summary.instances}`);
  lines.push(`- Estimated waste: ${formatBytes(doc.summary.wastedBytes)}`);
  lines.push(`- Placeholders ignored: ${doc.summary.placeholders}`);
  lines.push('');

  if (!doc.groups.length) {
    lines.push('No Findings.');
    lines.push('');
    return lines.join('\n');
  }

  for (const group of doc.groups) {
    const dir = group.direction || group.verdict;
    lines.push(`## ${dir} · ${group.fileKind} · ${group.instances} instance${group.instances === 1 ? '' : 's'}`);
    lines.push('');
    if (group.identity.component) lines.push(`Component: ${group.identity.component}`);
    if (group.identity.family === 'shopify') {
      lines.push('Family: Shopify CDN — one template; do not treat each product URL as a unique issue');
    }
    lines.push(`Selector: \`${group.identity.selector}\``);
    if (group.identity.classes.length) lines.push(`Classes: ${group.identity.classes.map((c) => `.${c}`).join(' ')}`);
    if (group.identity.hidingClasses.length) {
      lines.push(`Hidden by: ${group.identity.hidingClasses.map((c) => `.${c}`).join(' ')}`);
    }
    if (group.identity.dataTest) lines.push(`data-test: ${group.identity.dataTest}`);
    if (group.identity.alt) lines.push(`alt: ${group.identity.alt}`);
    lines.push('');
    lines.push('Resource:');
    lines.push(`- URL: ${group.resource.url}`);
    lines.push(`- Type: ${group.resource.mime} · ${group.resource.fileKind}`);
    lines.push(`- Intrinsic: ${group.resource.naturalWidth}×${group.resource.naturalHeight}`);
    lines.push(`- Source max: ${group.resource.sourceMax || '?'}w`);
    if (group.resource.declaredMax && group.resource.naturalWidth
      && group.resource.naturalWidth < group.resource.declaredMax * 0.9) {
      lines.push(`- Declared: ${group.resource.declaredMax}w (descriptor/style) vs decoded ${group.resource.naturalWidth}w — theme cannot invent the missing pixels`);
    }
    if (group.resource.bytes) lines.push(`- Transferred: ${formatBytes(group.resource.bytes)}`);
    if (group.resource.styleHint) lines.push(`- Style hint: \`${group.resource.styleHint}\``);
    if (group.resource.srcset.length) {
      lines.push(`- srcset: ${group.resource.srcset.map(formatCandidate).join(', ')}`);
    }
    if (group.resource.sizes) lines.push(`- sizes (raw): "${group.resource.sizes}"`);
    lines.push(`- Chosen: ${group.resource.chosen}`);
    lines.push('');
    if (group.layout.painted) {
      lines.push(`Layout: ${group.layout.painted.width}×${group.layout.painted.height} CSS px @${group.layout.dpr || '?'}×`);
      if (group.layout.widthRange && group.layout.widthRange.min !== group.layout.widthRange.max) {
        lines.push(`Layout range across instances: ${group.layout.widthRange.min}–${group.layout.widthRange.max}px`);
      }
      lines.push('');
    }
    for (const finding of group.findings) {
      lines.push(`- ${finding.severity}: ${finding.summary}`);
    }
    lines.push('');
    for (const action of group.actions) {
      lines.push(`Action: \`${action.action}\``);
      lines.push(action.summary);
      if (action.from != null || action.to) {
        lines.push(`sizes: ${JSON.stringify(action.from)} → ${JSON.stringify(action.to)}`);
      }
      if (action.widths?.length) lines.push(`Add: ${action.widths.join(', ')}w`);
      if (action.rejected?.length) lines.push(`Do NOT add ${action.rejected.join(', ')}w (exceeds source ${action.sourceMax}w)`);
      if (action.action === 'source-short') {
        lines.push('Out of theme scope — fix the image style or original, not sizes.');
      }
      if (action.strategy) lines.push(`Strategy: ${action.strategy}`);
      lines.push('');
    }
    if (group.snippet) {
      lines.push('```html');
      lines.push(group.snippet);
      lines.push('```');
      lines.push('');
    }
  }
  return lines.join('\n');
}

function isTicket(group) {
  if (group.verdict === 'green' && !group.actions.length) return false;
  if (group.verdict === 'skip' && !group.actions.length) return false;
  return true;
}

function groupResults(results) {
  const buckets = new Map();
  for (const result of results) {
    const key = groupKey(result.subject);
    const list = buckets.get(key) ?? [];
    list.push(result);
    buckets.set(key, list);
  }
  return [...buckets.values()].map(packGroup);
}

function packGroup(results) {
  const first = results[0];
  const subject = first.subject;
  const verdict = worstSeverity(results.flatMap((r) => r.findings.map((f) => f.severity)));
  const widths = results.map((r) => r.subject.painted?.width).filter(Boolean);
  return {
    verdict,
    direction: primaryDirection(first.findings),
    fileKind: subject.fileKind || 'raster',
    instances: results.length,
    wastedBytes: wastedBytes(results),
    identity: {
      component: subject.identity?.component ?? null,
      family: urlFamily(subject.resource),
      selector: subject.identity?.selector || subject.selector,
      classes: subject.identity?.classes ?? [],
      hidingClasses: subject.identity?.hidingClasses ?? [],
      dataTest: subject.identity?.dataTest ?? null,
      alt: subject.identity?.alt || null,
      ariaLabel: subject.identity?.ariaLabel || null,
    },
    resource: {
      url: subject.resource,
      path: resourcePath(subject.resource),
      mime: subject.mime || 'image/*',
      fileKind: subject.fileKind || 'raster',
      naturalWidth: subject.img?.naturalWidth || 0,
      naturalHeight: subject.img?.naturalHeight || 0,
      sourceMax: subject.sourceMax || 0,
      declaredMax: declaredMaxWidth(subject.candidates ?? [], subject.resource),
      bytes: subject.bytes || 0,
      styleHint: subject.styleHint ?? null,
      srcset: srcsetList(subject),
      sizes: subject.sizesAttr || '',
      chosen: subject.resource,
    },
    layout: {
      painted: subject.painted
        ? { width: Math.round(subject.painted.width), height: Math.round(subject.painted.height) }
        : null,
      widthRange: widths.length
        ? { min: Math.round(Math.min(...widths)), max: Math.round(Math.max(...widths)) }
        : null,
      dpr: typeof window !== 'undefined' ? window.devicePixelRatio : null,
    },
    findings: first.findings.map(publicFinding),
    actions: first.actions.map(publicAction),
    snippet: subject.snippet,
  };
}

function srcsetList(subject) {
  const seen = new Set();
  const list = [];
  for (const candidate of subject.candidates ?? []) {
    const key = `${candidate.url}|${candidate.width ?? candidate.density}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      url: candidate.url,
      width: candidate.width ?? null,
      density: candidate.density ?? null,
    });
  }
  return list;
}

function primaryDirection(findings) {
  const hit = findings.find((f) => f.direction) || findings.find((f) => f.type === 'phantom') || findings[0];
  if (hit?.direction) return hit.direction;
  if (hit?.type === 'phantom') return 'phantom';
  if (hit?.type === 'placeholder') return 'placeholder';
  if (hit?.type === 'source-short') return 'source-short';
  if (hit?.type === 'svg-oversized') return 'oversized';
  return hit?.severity || 'green';
}

function wastedBytes(results) {
  let total = 0;
  for (const result of results) {
    const bytes = result.subject.bytes || 0;
    if (!bytes) continue;
    if (result.findings.some((f) => f.type === 'phantom')) {
      total += bytes;
      continue;
    }
    const over = result.findings.find((f) => f.direction === 'oversized' && f.scale);
    if (over) total += Math.round(bytes * Math.max(0, 1 - 1 / (over.scale * over.scale)));
  }
  return total;
}

function publicFinding(finding) {
  const { groupParent: _groupParent, ...rest } = finding;
  return rest;
}

function publicAction(action) {
  const { locators, ...rest } = action;
  return {
    ...rest,
    locators: locators
      ? {
        resource: locators.resource,
        selector: locators.selector,
        classes: locators.classes,
        dataTest: locators.dataTest,
        alt: locators.alt,
        component: locators.component,
      }
      : undefined,
  };
}

function formatCandidate(candidate) {
  if (candidate.width) return `${resourcePath(candidate.url).split('/').pop()} ${candidate.width}w`;
  if (candidate.density) return `${resourcePath(candidate.url).split('/').pop()} ${candidate.density}x`;
  return resourcePath(candidate.url).split('/').pop();
}

function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
