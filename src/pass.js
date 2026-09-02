import { collectSubjects } from './collect/subjects.js';
import { measureLayout } from './measure/clone.js';
import { lintSubject } from './lint/run.js';
import { toAgentDocument, toMarkdown, toAgentPrompt, documentForCopy } from './agent/document.js';
import { mountHost, teardown } from './ui/host.js';
import { renderOverlays, highlight } from './ui/overlay.js';
import { renderProgress, renderReport } from './ui/panel.js';
import { addToReport, fetchReport, removeFromReport, resetReport } from './report/client.js';

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
    const currentDoc = toAgentDocument(location.href, results, {
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      dpr: window.devicePixelRatio,
    });
    let reportPages = (await fetchReport()).pages ?? [];
    let addedThisPass = false;
    let activeId = null;
    let filter = 'all';

    const copiesOf = (pages) => {
      const merged = documentForCopy(pages, currentDoc);
      return { prompt: toAgentPrompt(toMarkdown(merged)) };
    };

    const membershipOf = (pages) => {
      const inReport = pages.some((page) => page.url === location.href);
      if (!inReport) return 'add';
      if (addedThisPass) return 'in';
      return 'update';
    };

    const paint = () => {
      if (aborted) return;
      renderReport(ui.panel, {
        results,
        copies: copiesOf(reportPages),
        onSelect: select,
        onFilter: (next) => {
          filter = next;
          paint();
        },
        activeId,
        filter,
        report: {
          pages: reportPages,
          membership: membershipOf(reportPages),
          onAdd: async () => {
            const next = await addToReport({
              url: location.href,
              title: document.title,
              doc: currentDoc,
            });
            reportPages = next.pages ?? [];
            addedThisPass = true;
            paint();
          },
          onReset: async () => {
            const next = await resetReport();
            reportPages = next.pages ?? [];
            addedThisPass = false;
            paint();
          },
          onRemove: async (url) => {
            const next = await removeFromReport(url);
            reportPages = next.pages ?? [];
            if (url === location.href) addedThisPass = false;
            paint();
          },
        },
      });
    };

    const select = (id) => {
      activeId = id;
      highlight(ui.layer, id);
      resultById(results, id)?.subject.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      paint();
    };

    const place = renderOverlays(ui.layer, results, select);
    const onReflow = () => place();
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    listeners.push(
      { target: window, type: 'scroll', fn: onReflow, options: true },
      { target: window, type: 'resize', fn: onReflow, options: undefined },
    );

    paint();
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
