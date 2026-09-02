import { collectSubjects } from './collect/subjects.js';
import { measureLayout } from './measure/clone.js';
import { lintSubject } from './lint/run.js';
import { toAgentDocument, toMarkdown, toAgentPrompt } from './agent/document.js';
import { mountHost, teardown } from './ui/host.js';
import { renderOverlays, highlight } from './ui/overlay.js';
import { renderProgress, renderReport } from './ui/panel.js';

let running = false;
let abortPass = null;

export function togglePass() {
  if (abortPass) {
    abortPass();
    return;
  }
  return startPass();
}

export async function startPass() {
  if (running) return;
  running = true;
  let aborted = false;
  const ui = mountHost();
  const listeners = [];
  const close = () => {
    aborted = true;
    abortPass = null;
    for (const { target, type, fn, options } of listeners) {
      target.removeEventListener(type, fn, options);
    }
    teardown();
    running = false;
  };
  abortPass = close;
  ui.panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) close();
  });

  try {
    renderProgress(ui.panel, 0.02, 'Collecting subjects');
    const subjects = collectSubjects();
    if (aborted) return;
    renderProgress(ui.panel, 0.05, `${subjects.length} subjects — measuring layout`);

    const dimensions = await measureLayout(subjects, (ratio, label) => {
      if (!aborted) renderProgress(ui.panel, 0.05 + ratio * 0.9, `Measuring ${label}`);
    });
    if (aborted) return;

    renderProgress(ui.panel, 0.96, 'Linting');
    const results = subjects.map((subject) => lintSubject(subject, dimensions[subject.id] ?? {}));
    const doc = toAgentDocument(location.href, results, {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      dpr: window.devicePixelRatio,
    });
    const copies = { prompt: toAgentPrompt(toMarkdown(doc)), json: JSON.stringify(doc, null, 2) };
    let activeId = null;
    const select = (id) => {
      activeId = id;
      highlight(ui.layer, id);
      resultById(results, id)?.subject.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      renderReport(ui.panel, results, copies, select, activeId, 'all');
    };

    const place = renderOverlays(ui.layer, results, select);
    const onReflow = () => place();
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    listeners.push(
      { target: window, type: 'scroll', fn: onReflow, options: true },
      { target: window, type: 'resize', fn: onReflow, options: undefined },
    );

    renderReport(ui.panel, results, copies, select, activeId, 'all');
    abortPass = close;
  } catch (error) {
    if (!aborted) renderProgress(ui.panel, 1, error instanceof Error ? error.message : String(error));
  } finally {
    if (!document.querySelector('[data-pl-root="host"]')) {
      running = false;
      abortPass = null;
    } else {
      running = false;
    }
  }
}

function resultById(results, id) {
  return results.find((r) => r.subject.id === id);
}

export { teardown };
