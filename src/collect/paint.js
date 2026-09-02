const MIN_BOX = 16;

export function paintedBox(element) {
  const style = getComputedStyle(element);
  if (style.display === 'none') return null;
  if (style.visibility === 'hidden') return null;
  if (Number(style.opacity) === 0) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return rect;
}

export function isTiny(rect) {
  return !rect || rect.width < MIN_BOX || rect.height < MIN_BOX;
}

export function isSvgUrl(url) {
  if (!url) return false;
  return /\.svg(\?|#|$)/i.test(url) || /^data:image\/svg/i.test(url);
}

export function transferredBytes(url) {
  if (!url) return 0;
  try {
    const absolute = new URL(url, document.baseURI).href;
    const entry = performance.getEntriesByName(absolute)[0]
      || performance.getEntriesByName(url)[0];
    if (!entry) return 0;
    return entry.encodedBodySize || entry.transferSize || 0;
  } catch {
    return 0;
  }
}

export function wasRequested(url, element) {
  if (!url) return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return element instanceof HTMLImageElement ? element.complete : true;
  }
  try {
    const absolute = new URL(url, document.baseURI).href;
    if (performance.getEntriesByName(absolute).length > 0) return true;
    if (performance.getEntriesByName(url).length > 0) return true;
  } catch {
    /* invalid URL */
  }
  if (element instanceof HTMLImageElement) {
    return Boolean(element.currentSrc) && element.complete;
  }
  return false;
}

export function phantomReason(element) {
  const closed = element.closest('details:not([open])');
  if (closed) return 'closed-disclosure';

  const slide = element.closest('[aria-hidden="true"]');
  if (slide) {
    if (slide.getAttribute('role') === 'tabpanel' || slide.closest('[aria-roledescription="carousel"], .carousel, [data-carousel]')) {
      return 'inactive-slide';
    }
    return 'closed-disclosure';
  }

  if (element.closest('[hidden]')) return 'closed-disclosure';

  const style = getComputedStyle(element);
  if (style.visibility === 'hidden' || Number(style.opacity) === 0) return 'css-hidden-at-viewport';

  let node = element;
  while (node && node.nodeType === 1) {
    if (getComputedStyle(node).display === 'none') return 'display-none-ancestor';
    node = node.parentElement;
  }
  return 'display-none-ancestor';
}

export function hiddenAncestor(element) {
  const closed = element.closest('details:not([open]), [hidden], [aria-hidden="true"]');
  if (closed) return closed;
  let node = element;
  while (node && node.nodeType === 1) {
    if (getComputedStyle(node).display === 'none') return node;
    node = node.parentElement;
  }
  return element.parentElement;
}
