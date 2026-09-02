import { iterateGrid, viewportKey, gridSize } from './grid.js';

const STAMP = 'data-pl-id';

export async function measureLayout(subjects, onProgress) {
  stamp(subjects);
  const iframe = await openClone();
  const dimensions = Object.fromEntries(subjects.map((s) => [s.id, {}]));
  const total = gridSize();
  let step = 0;

  try {
    for (const { width, height } of iterateGrid()) {
      await setIframeSize(iframe, width, height);
      await waitForLayout(iframe);
      const key = viewportKey(width, height);
      for (const subject of subjects) {
        const clone = queryDeep(iframe.contentDocument, subject.id);
        dimensions[subject.id][key] = clone ? layoutWidth(clone, subject.kind) : 0;
      }
      step += 1;
      if (step % 5 === 0 || step === total) onProgress?.(step / total, `${width}×${height}`);
      await yieldFrame();
    }
  } finally {
    iframe.remove();
    unstamp(subjects);
  }

  return dimensions;
}

function stamp(subjects) {
  for (const subject of subjects) {
    subject.element.setAttribute(STAMP, subject.id);
    subject.picture?.setAttribute(STAMP, subject.id);
  }
}

function unstamp(subjects) {
  for (const subject of subjects) {
    subject.element.removeAttribute(STAMP);
    subject.picture?.removeAttribute(STAMP);
  }
}

async function openClone() {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.setAttribute('data-pl-root', 'clone');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    border: '0',
    margin: '0',
    padding: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    zIndex: '-1',
  });
  document.documentElement.appendChild(iframe);

  const idoc = iframe.contentDocument;
  idoc.open();
  idoc.write('<!DOCTYPE html><html><head></head><body></body></html>');
  idoc.close();

  const clone = cloneWithShadow(document.documentElement, idoc);
  clone.querySelectorAll?.('script, iframe, object, embed, [data-pl-root]').forEach((n) => n.remove());
  stripScriptsDeep(clone);
  const base = idoc.createElement('base');
  base.href = document.baseURI;
  (clone.querySelector('head') ?? clone).prepend(base);
  idoc.documentElement.replaceWith(clone);
  idoc.documentElement.style.overflow = 'hidden';
  if (idoc.body) idoc.body.style.overflow = 'hidden';
  return iframe;
}

function cloneWithShadow(node, idoc) {
  if (node.nodeType === Node.TEXT_NODE) return idoc.createTextNode(node.nodeValue ?? '');
  if (node.nodeType === Node.COMMENT_NODE) return idoc.createComment(node.nodeValue ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return idoc.importNode(node, false);

  if (node.tagName === 'SCRIPT' || node.hasAttribute?.('data-pl-root')) {
    return idoc.createComment('');
  }

  const clone = idoc.importNode(node, false);
  if (node.shadowRoot) {
    try {
      const shadow = clone.attachShadow({ mode: node.shadowRoot.mode });
      for (const child of node.shadowRoot.childNodes) {
        shadow.appendChild(cloneWithShadow(child, idoc));
      }
    } catch {
      /* closed or already attached */
    }
  }
  for (const child of node.childNodes) {
    clone.appendChild(cloneWithShadow(child, idoc));
  }
  return clone;
}

function stripScriptsDeep(root) {
  const visit = (node) => {
    if (node.querySelectorAll) {
      node.querySelectorAll('script').forEach((n) => n.remove());
    }
    if (node.shadowRoot) visit(node.shadowRoot);
    if (node.querySelectorAll) {
      for (const el of node.querySelectorAll('*')) {
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    }
  };
  visit(root);
}

function queryDeep(root, id) {
  const selector = `[${STAMP}="${id}"]`;
  const hit = root.querySelector?.(selector);
  if (hit) return hit;
  const elements = root.querySelectorAll?.('*') ?? [];
  for (const el of elements) {
    if (el.shadowRoot) {
      const inner = queryDeep(el.shadowRoot, id);
      if (inner) return inner;
    }
  }
  return null;
}

function setIframeSize(iframe, width, height) {
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  const idoc = iframe.contentDocument;
  if (idoc?.documentElement) {
    idoc.documentElement.style.width = `${width}px`;
    idoc.documentElement.style.height = `${height}px`;
  }
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function waitForLayout(iframe) {
  const imgs = [...(iframe.contentDocument?.images ?? [])];
  const pending = imgs.filter((img) => !img.complete);
  for (const img of pending) {
    img.loading = 'eager';
  }
  if (!pending.length) return Promise.resolve();
  return Promise.race([
    Promise.all(pending.map((img) => new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }))),
    new Promise((resolve) => setTimeout(resolve, 400)),
  ]);
}

function layoutWidth(element, kind) {
  const target = kind === 'picture'
    ? (element.tagName === 'PICTURE' ? element.querySelector('img') ?? element : element)
    : element;
  const width = target.clientWidth || target.getBoundingClientRect().width;
  if (!width) return 0;
  if (!(target instanceof HTMLImageElement) || !target.naturalWidth || !target.naturalHeight) {
    return Math.round(width);
  }
  const style = getComputedStyle(target);
  const ratio = target.naturalWidth / target.naturalHeight;
  const height = target.clientHeight || target.height;
  if (
    (['contain', 'scale-down'].includes(style.objectFit) && height * ratio < width)
    || (style.objectFit === 'cover' && height * ratio > width)
  ) {
    return Math.round(height * ratio);
  }
  return Math.round(width);
}

function yieldFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
