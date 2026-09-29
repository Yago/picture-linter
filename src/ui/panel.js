import { escapeHtml, fileName } from './text.js';

export function renderProgress(panel, ratio, label) {
  const pct = Math.round(ratio * 100);
  panel.innerHTML = `
    <div class="pl-panel__head">
      <div class="pl-panel__bar">
        <p class="pl-panel__title">Picture Linter</p>
        <button type="button" class="pl-panel__close" data-close>Close</button>
      </div>
    </div>
    <div class="pl-panel__body">
      <div class="pl-panel__progress">
        ${escapeHtml(label)}
        <div class="pl-panel__meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" role="progressbar">
          <span style="width:${pct}%"></span>
        </div>
      </div>
    </div>
  `;
}

export function renderReport(panel, view) {
  const {
    results,
    copies,
    onSelect,
    activeId,
    filter = 'all',
    report,
  } = view;
  const counts = { red: 0, orange: 0, green: 0, skip: 0 };
  for (const result of results) counts[result.verdict] += 1;
  const phantoms = results.filter((r) => r.findings.some((f) => f.type === 'phantom'));
  const visible = results.filter((result) => matchesFilter(result, filter));
  const membership = report?.membership ?? 'add';

  panel.innerHTML = `
    <div class="pl-panel__head">
      <div class="pl-panel__bar">
        <p class="pl-panel__title">Picture Linter</p>
        <button type="button" class="pl-panel__close" data-close>Close</button>
      </div>
      <div class="pl-counts" data-filter="${filter}">
        ${countButton('red', counts.red, filter)}
        ${countButton('orange', counts.orange, filter)}
        ${countButton('green', counts.green, filter)}
        <button type="button" data-filter="phantom" aria-pressed="${filter === 'phantom'}">
          <b>${phantoms.length}</b><span>Phantom</span>
        </button>
      </div>
    </div>
    <div class="pl-panel__body">
      ${reportStrip(report)}
      <ul class="pl-list">
        ${visible.length ? visible.map((r) => row(r, activeId)).join('') : '<li class="pl-empty">Nothing in this filter.</li>'}
      </ul>
    </div>
    <div class="pl-actions">
      ${actionButtons(membership, report, copies)}
    </div>
    <p class="pl-sr" data-copy-status aria-live="polite"></p>
  `;

  panel.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('click', () => onSelect(el.getAttribute('data-id')));
  });
  panel.querySelectorAll('[data-explain]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      view.onExplain(button.getAttribute('data-explain'));
    });
  });
  panel.querySelectorAll('.pl-counts button').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-filter');
      const value = next === filter ? 'all' : next;
      if (view.onFilter) view.onFilter(value);
      else renderReport(panel, { ...view, filter: value });
    });
  });
  bindCopy(panel, panel.querySelector('[data-copy="prompt"]'), copies.prompt, {
    idle: 'Copy prompt',
    done: 'Copied',
    announce: 'Prompt copied',
  });
  panel.querySelector('[data-report="add"]')?.addEventListener('click', () => report?.onAdd?.());
  panel.querySelector('[data-report="reset"]')?.addEventListener('click', () => report?.onReset?.());
  panel.querySelectorAll('[data-report-remove]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      report?.onRemove?.(button.getAttribute('data-report-remove'));
    });
  });
}

function actionButtons(membership, report, copies) {
  const inReport = membership === 'in' || membership === 'update';
  const hasPages = Boolean(report?.pages?.length);
  const parts = [];
  if (membership === 'add') {
    parts.push('<button type="button" data-report="add">Add to report</button>');
  }
  if (membership === 'update') {
    parts.push('<button type="button" class="secondary" data-report="add">Update report</button>');
  }
  if (inReport && copies?.prompt) {
    parts.push('<button type="button" data-copy="prompt">Copy prompt</button>');
  }
  if (hasPages) {
    parts.push('<button type="button" class="secondary" data-report="reset">Reset report</button>');
  }
  return parts.join('');
}

function reportStrip(report) {
  const pages = report?.pages ?? [];
  if (!pages.length) return '';
  const items = pages.map((page) => {
    const label = page.title || hostPath(page.url);
    return `<li>
      <span title="${escapeHtml(page.url)}">${escapeHtml(label)}</span>
      <button type="button" data-report-remove="${escapeHtml(page.url)}" aria-label="Remove from report">×</button>
    </li>`;
  }).join('');
  return `<div class="pl-report">
    <p class="pl-report__label">Report · ${pages.length}</p>
    <ul class="pl-report__pages">${items}</ul>
  </div>`;
}

function hostPath(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, '') || url;
  } catch {
    return url;
  }
}

const copyTimers = new WeakMap();

function bindCopy(panel, button, text, labels) {
  if (!button) return;
  button.addEventListener('click', async () => {
    const ok = await writeClipboard(text);
    flashCopy(button, labels, ok);
    const status = panel.querySelector('[data-copy-status]');
    if (status) status.textContent = ok ? labels.announce : 'Copy failed';
  });
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function flashCopy(button, labels, ok) {
  const previous = copyTimers.get(button);
  if (previous) clearTimeout(previous);
  button.dataset.copied = ok ? 'true' : 'false';
  button.textContent = ok ? labels.done : 'Copy failed';
  const timer = setTimeout(() => {
    button.textContent = labels.idle;
    delete button.dataset.copied;
    copyTimers.delete(button);
  }, 1800);
  copyTimers.set(button, timer);
}

export function matchesFilter(result, filter) {
  if (filter === 'all') return true;
  if (filter === 'phantom') return result.findings.some((finding) => finding.type === 'phantom');
  return result.verdict === filter;
}

function countButton(tone, n, filter) {
  return `<button type="button" data-filter="${tone}" aria-pressed="${filter === tone}">
    <b data-tone="${tone}">${n}</b><span>${tone}</span>
  </button>`;
}

function row(result, activeId) {
  const name = fileName(result.subject.resource) || result.subject.selector;
  const findings = result.findings.map((f) => `<li>${escapeHtml(f.summary)}</li>`).join('');
  return `
    <li class="pl-row" data-id="${result.subject.id}" data-verdict="${result.verdict}" data-active="${result.subject.id === activeId}">
      <div class="pl-row__meta">
        <span>${result.subject.kind}${result.findings.some((f) => f.type === 'phantom') ? ' · phantom' : ''}</span>
        <span class="pl-row__end">
          <span class="pl-row__verdict">${result.verdict}</span>
          <button type="button" class="pl-info" data-explain="${escapeHtml(result.subject.id)}" aria-label="Explain this subject">ℹ</button>
        </span>
      </div>
      <p class="pl-row__resource" title="${escapeHtml(result.subject.resource)}">${escapeHtml(name)}</p>
      ${findings ? `<ul class="pl-row__findings">${findings}</ul>` : ''}
    </li>
  `;
}

