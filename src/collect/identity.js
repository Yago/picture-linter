const HIDING_CLASS = /^(?:hidden|invisible|sr-only|collapse|opacity-0|x-cloak)$|^(?:sm|md|lg|xl|2xl|max-sm|max-md|max-lg|max-xl):hidden$|^(?:md|lg|xl):invisible$/;

const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };

export function identityOf(element, img) {
  const node = img ?? element;
  const host = element.closest('picture') ?? element;
  const hiding = hidingInfo(host);
  return {
    classes: usefulClasses(host),
    hidingClasses: hiding.classes,
    hiding,
    dataTest: firstData(host, ['data-test', 'data-testid', 'data-cy']),
    alt: node.getAttribute?.('alt') ?? '',
    ariaLabel: node.getAttribute?.('aria-label') || host.getAttribute('aria-label') || '',
    component: guessComponent(host),
    selector: usefulSelector(host),
    artDirectionTwin: artDirectionTwin(host),
  };
}

export function usefulClasses(element) {
  return [...(element.classList ?? [])]
    .filter((name) => name.length < 48 && !/^[a-f0-9]{10,}$/i.test(name))
    .slice(0, 16);
}

export function hidingInfo(element) {
  const hits = [];
  const classes = [];
  let node = element;
  while (node && node.nodeType === 1 && hits.length < 4) {
    const local = [...(node.classList ?? [])].filter((name) => HIDING_CLASS.test(name) || /(?:^|:)hidden$|cloak|invisible/.test(name));
    const xCloak = node.hasAttribute('x-cloak') || node.hasAttribute('hidden');
    const ariaHidden = node.getAttribute('aria-hidden');
    const display = getComputedStyle(node).display;
    if (local.length || xCloak || ariaHidden === 'true' || (node !== element && display === 'none')) {
      hits.push({
        tag: node.tagName.toLowerCase(),
        classes: local,
        display,
        hiddenAttr: node.hasAttribute('hidden'),
        xCloak: node.hasAttribute('x-cloak'),
        ariaHidden,
      });
      classes.push(...local);
    }
    node = node.parentElement;
  }
  return { classes: [...new Set(classes)], ancestors: hits };
}

export function usefulSelector(element) {
  const parts = [];
  let node = element;
  for (let depth = 0; node && node.nodeType === 1 && depth < 6; depth += 1) {
    const test = node.getAttribute('data-test') || node.getAttribute('data-testid');
    if (test) {
      parts.unshift(`[data-test="${test}"]`);
      break;
    }
    const id = node.id && /^[A-Za-z][\w-]*$/.test(node.id) ? `#${cssEscape(node.id)}` : '';
    const bem = [...node.classList].find((c) => /__|--/.test(c) || /^(?:block|paragraph|node|field|picture|header|footer|logo)/i.test(c));
    const hide = [...node.classList].find((c) => HIDING_CLASS.test(c));
    const size = [...node.classList].find((c) => /^(?:h|w|max-w|min-h)-\S+/.test(c));
    const token = [
      node.tagName.toLowerCase(),
      id,
      bem ? `.${bem}` : '',
      hide ? `.${hide}` : '',
      !bem && size ? `.${size}` : '',
    ].filter(Boolean).join('');
    parts.unshift(token);
    if (id || bem) break;
    node = node.parentElement;
  }
  return parts.join(' > ');
}

export function guessComponent(element) {
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    const named = node.getAttribute('data-component')
      || node.getAttribute('data-block')
      || node.getAttribute('data-once');
    if (named) return named;
    const drupal = [...node.classList].find((c) => /^(?:block|paragraph|node|field|media)--/.test(c));
    if (drupal) return drupal;
    const bem = [...node.classList].find((c) => /^[a-z][a-z0-9-]+--[a-z0-9-]+$/i.test(c));
    if (bem) return bem;
  }
  return null;
}

export function artDirectionTwin(element) {
  const root = element.closest('a, article, li, figure, [class*="picture"], [class*="card"], [class*="promo"]')
    ?? element.parentElement;
  if (!root) return null;
  const nodes = [...root.querySelectorAll('picture, img')].filter((node) => {
    if (node === element || element.contains(node) || node.contains(element)) return false;
    if (node.tagName === 'IMG' && node.closest('picture')) return false;
    return true;
  });
  if (!nodes.length) return null;
  const mine = hidingInfo(element).classes;
  if (!mine.length) return null;
  for (const other of nodes) {
    const theirs = hidingInfo(other).classes;
    const pair = complementaryHide(mine, theirs);
    if (pair) {
      return {
        selector: usefulSelector(other),
        classes: theirs,
        shownBy: theirs.join(' '),
        mediaHint: mediaFromHide(mine),
      };
    }
  }
  return null;
}

function complementaryHide(a, b) {
  for (const cls of a) {
    const max = cls.match(/^max-(sm|md|lg|xl|2xl):hidden$/);
    const min = cls.match(/^(sm|md|lg|xl|2xl):hidden$/);
    if (max && b.includes(`${max[1]}:hidden`)) return true;
    if (min && b.includes(`max-${min[1]}:hidden`)) return true;
    if (cls === 'hidden' && b.some((c) => /^(sm|md|lg|xl):block$/.test(c))) return true;
  }
  return false;
}

function mediaFromHide(classes) {
  for (const cls of classes) {
    const max = cls.match(/^max-(sm|md|lg|xl|2xl):hidden$/);
    if (max) return `(min-width: ${BREAKPOINTS[max[1]]}px)`;
    const min = cls.match(/^(sm|md|lg|xl|2xl):hidden$/);
    if (min) return `(max-width: ${BREAKPOINTS[min[1]] - 1}px)`;
  }
  return null;
}

function firstData(element, names) {
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    for (const name of names) {
      const value = node.getAttribute(name);
      if (value) return value;
    }
  }
  return null;
}

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/([^\w-])/g, '\\$1');
}
