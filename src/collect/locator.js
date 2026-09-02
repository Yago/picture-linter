const ROOT_ATTR = 'data-pl-root';

export function cssSelector(element) {
  if (!(element instanceof Element)) return '';
  if (element.id && /^[A-Za-z][\w-]*$/.test(element.id)) {
    const matches = element.getRootNode().querySelectorAll(`#${cssEscape(element.id)}`);
    if (matches.length === 1) return `#${cssEscape(element.id)}`;
  }
  const parts = [];
  let node = element;
  while (node && node.nodeType === 1 && !node.hasAttribute?.(ROOT_ATTR)) {
    const tag = node.tagName.toLowerCase();
    if (tag === 'html') {
      parts.unshift('html');
      break;
    }
    const parent = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const same = [...parent.children].filter((child) => child.tagName === node.tagName);
    const nth = same.indexOf(node) + 1;
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${nth})` : tag);
    node = parent;
    if (parts.length > 8) break;
  }
  return parts.join(' > ');
}

export function htmlSnippet(element, kind) {
  if (kind === 'background') {
    const bg = getComputedStyle(element).backgroundImage;
    const cls = element.getAttribute('class');
    return `<${element.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''} style="background-image: ${bg}">`;
  }
  const root = kind === 'picture' ? (element.closest('picture') ?? element) : element;
  return serialize(root);
}

function serialize(el) {
  if (el.tagName === 'PICTURE') {
    const kids = [...el.children].map((child) => serialize(child)).join('\n');
    return `<picture${attrs(el, ['class', 'data-test', 'data-testid'])}>\n${indent(kids)}\n</picture>`;
  }
  if (el.tagName === 'SOURCE') {
    return `<source${attrs(el, ['class', 'media', 'type', 'sizes', 'srcset', 'src', 'width', 'height'])}>`;
  }
  if (el.tagName === 'IMG') {
    return `<img${attrs(el, ['class', 'alt', 'aria-hidden', 'aria-label', 'loading', 'fetchpriority', 'decoding', 'width', 'height', 'sizes', 'srcset', 'src'])}>`;
  }
  return el.outerHTML;
}

function attrs(el, names) {
  return names.flatMap((name) => {
    const value = el.getAttribute(name);
    if (value == null || value === '') return [];
    return [` ${name}="${value.replace(/"/g, '&quot;')}"`];
  }).join('');
}

function indent(text) {
  return text.split('\n').map((line) => `  ${line}`).join('\n');
}

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/([^\w-])/g, '\\$1');
}
