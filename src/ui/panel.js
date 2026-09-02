export function renderProgress(panel, ratio, label) {
  const pct = Math.round(ratio * 100);
  panel.innerHTML = `
    <div class="pl-panel__bar">
      <p class="pl-panel__title">Picture Linter</p>
      <button type="button" class="pl-panel__close" data-close>Close</button>
    </div>
    <div class="pl-panel__progress">
      ${escapeHtml(label)}
      <div class="pl-panel__meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" role="progressbar">
        <span style="width:${pct}%"></span>
      </div>
    </div>
  `;
}

export function renderReport(panel, results, copies, onSelect, activeId, filter = 'all') {
  const counts = { red: 0, orange: 0, green: 0, skip: 0 };
  for (const result of results) counts[result.verdict] += 1;
  const phantoms = results.filter((r) => r.findings.some((f) => f.type === 'phantom'));
  const visible = results.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'phantom') return r.findings.some((f) => f.type === 'phantom');
    return r.verdict === filter;
  });

  panel.innerHTML = `
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
    <ul class="pl-list">
      ${visible.length ? visible.map((r) => row(r, activeId)).join('') : '<li class="pl-empty">Nothing in this filter.</li>'}
    </ul>
    <div class="pl-actions">
      <button type="button" data-copy="prompt">Copy prompt</button>
      <button type="button" class="secondary" data-copy="json">Copy JSON</button>
    </div>
    <p class="pl-sr" data-copy-status aria-live="polite"></p>
  `;

  panel.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('click', () => onSelect(el.getAttribute('data-id')));
  });
  panel.querySelectorAll('.pl-counts button').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-filter');
      renderReport(panel, results, copies, onSelect, activeId, next === filter ? 'all' : next);
    });
  });
  bindCopy(panel, panel.querySelector('[data-copy="prompt"]'), copies.prompt, {
    idle: 'Copy prompt',
    done: 'Copied',
    announce: 'Prompt copied',
  });
  bindCopy(panel, panel.querySelector('[data-copy="json"]'), copies.json, {
    idle: 'Copy JSON',
    done: 'Copied',
    announce: 'JSON copied',
  });
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
        <span class="pl-row__verdict">${result.verdict}</span>
      </div>
      <p class="pl-row__resource" title="${escapeHtml(result.subject.resource)}">${escapeHtml(name)}</p>
      ${findings ? `<ul class="pl-row__findings">${findings}</ul>` : ''}
    </li>
  `;
}

function fileName(url) {
  if (!url) return '';
  try {
    const path = new URL(url, document.baseURI).pathname;
    return path.split('/').filter(Boolean).pop() || url;
  } catch {
    return url;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
