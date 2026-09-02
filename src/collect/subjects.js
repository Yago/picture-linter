import { parseSrcset } from '../domain/srcset.js';
import { mimeFromUrl, fileKind, styleHint, sourceMaxWidth, isPlaceholderSignals } from '../domain/resource.js';
import { cssSelector, htmlSnippet } from './locator.js';
import { identityOf } from './identity.js';
import { paintedBox, wasRequested, isSvgUrl, transferredBytes } from './paint.js';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'HTML']);

export function collectSubjects(root = document) {
  const subjects = [];
  const seenImgs = new Set();
  walk(root, (element) => {
    if (element.hasAttribute?.('data-pl-root')) return 'skip';
    if (element.closest?.('[data-pl-root]')) return;

    if (element.tagName === 'PICTURE') {
      const img = element.querySelector('img');
      if (img) seenImgs.add(img);
      subjects.push(fromPicture(element, img));
      return;
    }

    if (element.tagName === 'IMG') {
      if (seenImgs.has(element) || element.closest('picture')) return;
      seenImgs.add(element);
      subjects.push(fromImg(element));
      return;
    }

    if (element.tagName === 'IMG' || element.tagName === 'PICTURE' || element.tagName === 'SOURCE') return;
    const background = readBackground(element);
    if (background) subjects.push(fromBackground(element, background));
  });
  return subjects.map((subject, index) => ({ ...subject, id: `pl-${index}` }));
}

function walk(root, visit) {
  const roots = root.nodeType === 11 || root.nodeType === 9 ? [root] : [root];
  const stack = [...roots];
  while (stack.length) {
    const node = stack.pop();
    const elements = node.querySelectorAll ? node.querySelectorAll('*') : [];
    const list = node.nodeType === 1 ? [node, ...elements] : [...elements];
    for (const element of list) {
      if (SKIP_TAGS.has(element.tagName)) continue;
      const instruction = visit(element);
      if (instruction === 'skip') continue;
      if (element.shadowRoot) stack.push(element.shadowRoot);
    }
  }
}

function fromPicture(picture, img) {
  const sources = [...picture.querySelectorAll('source')].map(readSource);
  const imgData = img ? readImg(img) : null;
  const resource = img?.currentSrc || imgData?.src || parseSrcset(sources[0]?.srcset || '')[0]?.url || '';
  return enrich({
    kind: 'picture',
    element: img ?? picture,
    picture,
    resource,
    snippet: htmlSnippet(picture, 'picture'),
    selector: cssSelector(picture),
    sources,
    img: imgData,
    candidates: candidatesFrom(sources, imgData),
    sizesAttr: imgData?.sizesAttr ?? sources.find((s) => s.sizesAttr)?.sizesAttr ?? '',
    painted: img ? paintedBox(img) : paintedBox(picture),
    requested: wasRequested(resource, img),
    svg: isSvgUrl(resource),
  }, picture, img);
}

function fromImg(img) {
  const imgData = readImg(img);
  const resource = img.currentSrc || imgData.src;
  return enrich({
    kind: 'img',
    element: img,
    picture: null,
    resource,
    snippet: htmlSnippet(img, 'img'),
    selector: cssSelector(img),
    sources: [],
    img: imgData,
    candidates: parseFromImg(imgData),
    sizesAttr: imgData.sizesAttr,
    painted: paintedBox(img),
    requested: wasRequested(resource, img),
    svg: isSvgUrl(resource),
  }, img, img);
}

function fromBackground(element, background) {
  const resource = background.chosen || background.candidates[0]?.url || '';
  const natural = naturalWidthOf(resource);
  const candidates = background.candidates.map((c) => (
    c.width ? c : { ...c, width: c.url === resource ? natural : c.width }
  ));
  return enrich({
    kind: 'background',
    element,
    picture: null,
    resource,
    snippet: htmlSnippet(element, 'background'),
    selector: cssSelector(element),
    sources: [],
    img: natural ? { naturalWidth: natural, naturalHeight: 0, src: resource, srcset: '', sizesAttr: '' } : null,
    candidates,
    sizesAttr: '',
    painted: paintedBox(element),
    requested: wasRequested(resource, element),
    svg: isSvgUrl(resource),
    background,
  }, element, null);
}

function enrich(subject, host, img) {
  const identity = identityOf(host, img);
  const mime = mimeFromUrl(subject.resource, subject.sources.find((s) => s.type)?.type);
  const placeholder = isPlaceholderSignals({
    naturalWidth: subject.img?.naturalWidth || 0,
    naturalHeight: subject.img?.naturalHeight || 0,
    className: `${host.className || ''} ${img?.className || ''}`,
    ariaHidden: identity.ariaHidden,
    url: subject.resource,
    bytes: transferredBytes(subject.resource),
    paintedWidth: subject.painted?.width || 0,
  });
  const kind = fileKind({ svg: subject.svg, placeholder, mime });
  return {
    ...subject,
    identity,
    mime,
    fileKind: kind,
    placeholder,
    styleHint: styleHint(subject.resource),
    sourceMax: sourceMaxWidth(subject.candidates, subject.img?.naturalWidth || 0, subject.resource),
    bytes: transferredBytes(subject.resource),
    selector: identity.selector || subject.selector,
  };
}

function naturalWidthOf(url) {
  if (!url) return 0;
  const img = new Image();
  img.src = url;
  return img.naturalWidth || 0;
}

function readImg(img) {
  return {
    src: img.getAttribute('src') || '',
    srcset: img.getAttribute('srcset') || '',
    sizesAttr: img.getAttribute('sizes') || '',
    alt: img.getAttribute('alt'),
    loading: img.getAttribute('loading') || '',
    naturalWidth: img.naturalWidth || 0,
    naturalHeight: img.naturalHeight || 0,
    currentSrc: img.currentSrc || '',
  };
}

function readSource(source) {
  return {
    srcset: source.getAttribute('srcset') || '',
    sizesAttr: source.getAttribute('sizes') || '',
    media: source.getAttribute('media') || '',
    type: source.getAttribute('type') || '',
    src: source.getAttribute('src') || '',
    width: source.getAttribute('width'),
    height: source.getAttribute('height'),
  };
}

function parseFromImg(imgData) {
  const parsed = parseSrcset(imgData.srcset);
  if (parsed.length) return parsed;
  if (imgData.src) return [{ url: imgData.src, density: 1 }];
  return [];
}

function candidatesFrom(sources, imgData) {
  const fromSources = sources.flatMap((s) => parseSrcset(s.srcset));
  if (fromSources.length) return fromSources;
  return imgData ? parseFromImg(imgData) : [];
}

const URL_IN_BG = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

function readBackground(element) {
  const style = getComputedStyle(element);
  const value = style.backgroundImage;
  if (!value || value === 'none') return null;
  const candidates = parseImageSet(value);
  if (!candidates.length) return null;
  const chosen = pickComputedUrl(value);
  const size = style.backgroundSize;
  const position = style.backgroundPosition;
  return { candidates, chosen, size, position, repeat: style.backgroundRepeat };
}

function parseImageSet(value) {
  const imageSet = value.match(/image-set\((.*)\)/i);
  if (imageSet) return parseSrcset(imageSet[1]);
  const urls = [];
  let match;
  const re = new RegExp(URL_IN_BG);
  while ((match = re.exec(value))) {
    const url = match[2];
    if (url && url !== 'none') urls.push({ url, density: 1 });
  }
  return urls;
}

function pickComputedUrl(value) {
  const match = /url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(value);
  return match ? match[2] : '';
}
