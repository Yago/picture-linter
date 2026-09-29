import { stripSegments } from '../domain/ranges.js';
import { GRID } from '../measure/grid.js';
import { solutionMarkup } from './solution.js';
import { escapeHtml, fileName } from './text.js';

const FINDING_HEAD = /^(undersized|oversized)\b\s*(?:·\s*)?/i;

export function splitFindingSummary(summary) {
  const text = summary ?? '';
  const match = FINDING_HEAD.exec(text);
  if (!match) return { title: '', body: text };
  return { title: match[1].toLowerCase(), body: text.slice(match[0].length) };
}

export function renderExplanation(root, result) {
  if (!result) {
    root.hidden = true;
    root.replaceChildren();
    return;
  }
  const name = fileName(result.subject.resource) || result.subject.selector;
  const findings = result.findings
    .map((finding) => `<li>${findingCopy(finding)}${stripMarkup(finding)}</li>`)
    .join('');
  root.hidden = false;
  root.innerHTML = `
    <div class="pl-explain__sheet" role="dialog" aria-modal="true" aria-labelledby="pl-explain-title" data-verdict="${escapeHtml(result.verdict)}">
      <span class="pl-crop pl-crop--tl"></span>
      <span class="pl-crop pl-crop--tr"></span>
      <span class="pl-crop pl-crop--bl"></span>
      <span class="pl-crop pl-crop--br"></span>
      <div class="pl-explain__bar">
        <p class="pl-explain__kind">${escapeHtml(result.subject.kind)}</p>
        <p class="pl-explain__verdict">${escapeHtml(result.verdict)}</p>
        <button type="button" class="pl-explain__close" data-explain-close aria-label="Close explanation">×</button>
      </div>
      <h2 class="pl-explain__title" id="pl-explain-title">${escapeHtml(name)}</h2>
      <p class="pl-explain__resource">${escapeHtml(result.subject.resource)}</p>
      <div class="pl-explain__body">
        <h3 class="pl-explain__label">HTML</h3>
        <pre class="pl-explain__snippet">${escapeHtml(result.subject.snippet)}</pre>
        <h3 class="pl-explain__label">Findings</h3>
        ${findings ? `<ul class="pl-explain__findings">${findings}</ul>` : '<p class="pl-explain__empty">No findings.</p>'}
        <h3 class="pl-explain__label">Solution</h3>
        ${solutionMarkup(result)}
      </div>
    </div>
  `;
}

export function bindExplanation(root, { resultOf, repaint }) {
  let explainedId = null;

  const render = () => {
    renderExplanation(root, explainedId ? resultOf(explainedId) : null);
  };

  const open = (id) => {
    explainedId = id;
    repaint();
    root.querySelector('[data-explain-close]')?.focus();
  };

  const close = () => {
    if (!explainedId) return;
    explainedId = null;
    repaint();
  };

  const onExplanationClose = (event) => {
    if (!explainedId) return;
    const dismiss = event.target === root || event.target.closest('[data-explain-close]');
    if (!dismiss) return;
    close();
  };

  const onExplanationKey = (event) => {
    if (!explainedId) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...root.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const active = root.getRootNode().activeElement;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !root.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  root.addEventListener('click', onExplanationClose);
  window.addEventListener('keydown', onExplanationKey, true);

  return {
    open,
    render,
    disconnect() {
      root.removeEventListener('click', onExplanationClose);
      window.removeEventListener('keydown', onExplanationKey, true);
    },
  };
}

function findingCopy(finding) {
  const { title, body } = splitFindingSummary(finding.summary);
  if (!title) return `<p class="pl-explain__finding-text">${escapeHtml(body)}</p>`;
  return `<p class="pl-explain__finding-kicker" data-severity="${escapeHtml(finding.severity)}">${escapeHtml(title)}</p><p class="pl-explain__finding-text">${escapeHtml(body)}</p>`;
}

function stripMarkup(finding) {
  const strip = stripSegments(finding);
  if (!strip) return '';
  const spans = strip.segments.map((segment) => (
    `<span class="pl-strip__span" data-severity="${strip.severity}" style="left:${pct(segment.left)};width:${pct(segment.width)}"></span>`
  )).join('');
  return `<div class="pl-strip" aria-hidden="true"><div class="pl-strip__track">${spans}</div><div class="pl-strip__axis"><span>${GRID.minWidth}</span><span>${GRID.maxWidth}</span></div></div>`;
}

function pct(ratio) {
  return `${(ratio * 100).toFixed(2)}%`;
}
