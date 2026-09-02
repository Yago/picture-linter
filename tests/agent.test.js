import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  capCandidateWidths,
  isPlaceholderSignals,
  groupKey,
  styleHint,
  sourceMaxWidth,
  fileKind,
  smallerCandidateRungs,
  urlFamily,
} from '../src/domain/resource.js';
import { toAgentDocument, toMarkdown, toAgentPrompt, AGENT_PROMPT_PREAMBLE } from '../src/agent/document.js';

function result(overrides = {}) {
  const subject = {
    kind: 'img',
    fileKind: 'raster',
    resource: 'https://example.com/styles/lhc_avif_4_1_1920x480/public/hero.avif',
    snippet: '<img srcset="a 690w, b 1400w, c 1920w, d 3840w" sizes="1448px" src="d">',
    selector: 'img.hero',
    sizesAttr: '1448px',
    img: { srcset: 'a 690w, b 1400w, c 1920w, d 3840w', naturalWidth: 1920, naturalHeight: 480 },
    sources: [],
    candidates: [
      { url: 'a.jpg', width: 690 },
      { url: 'b.jpg', width: 1400 },
      { url: 'c.jpg', width: 1920 },
      { url: 'd.jpg', width: 3840 },
    ],
    sourceMax: 3840,
    bytes: 80000,
    mime: 'image/avif',
    styleHint: 'lhc_avif_4_1_1920x480',
    identity: {
      component: 'autopromo',
      selector: 'picture.relative',
      classes: ['relative'],
      hidingClasses: ['max-sm:hidden'],
      dataTest: null,
      alt: 'Promo',
      ariaLabel: '',
    },
    painted: { width: 1820, height: 455 },
    ...overrides.subject,
  };
  return {
    subject,
    verdict: 'red',
    findings: overrides.findings ?? [{
      type: 'candidates',
      severity: 'red',
      direction: 'undersized',
      summary: 'undersized · needed 3640w · chosen 1920w · fit 0.53×',
    }],
    actions: overrides.actions ?? [{
      action: 'update-sizes',
      summary: 'Set sizes',
      locators: { resource: subject.resource, selector: subject.identity.selector },
    }],
    sizesSuggestion: '(min-width: 1520px) 1520px, 100vw',
  };
}

test('placeholder 30x38 blur-up is detected', () => {
  assert.equal(isPlaceholderSignals({
    naturalWidth: 30,
    naturalHeight: 38,
    className: 'blur-sm absolute',
    ariaHidden: true,
    url: 'https://x/30x38/lqip.jpg',
  }), true);
  assert.equal(isPlaceholderSignals({
    naturalWidth: 800,
    naturalHeight: 600,
    className: '',
    ariaHidden: false,
    url: 'https://x/hero.jpg',
  }), false);
});

test('featured 2:1 content picture is never a placeholder', () => {
  const url = 'https://example.com/styles/lhc_avif_2_1_3840x1920/public/hero.avif';
  assert.equal(isPlaceholderSignals({
    naturalWidth: 1305,
    naturalHeight: 652,
    className: '',
    ariaHidden: false,
    url,
    bytes: 49.5 * 1024,
    paintedWidth: 1490,
  }), false);
  assert.equal(isPlaceholderSignals({
    naturalWidth: 0,
    naturalHeight: 0,
    url,
    bytes: 0,
    paintedWidth: 0,
  }), false);
});

test('capCandidateWidths rejects above source max', () => {
  const { add, rejected } = capCandidateWidths([2500, 5160], 3840, [1920, 3840]);
  assert.deepEqual(rejected, [5160]);
  assert.equal(add.includes(5160), false);
  assert.deepEqual(add, [2500]);
});

test('Drupal style hint and source max from srcset', () => {
  assert.equal(styleHint('/styles/lhc_avif_4_1_1920x480/public/x.avif'), 'lhc_avif_4_1_1920x480');
  assert.equal(sourceMaxWidth([{ width: 690 }, { width: 3840 }], 1920, '/x.jpg'), 3840);
  assert.equal(fileKind({ svg: true, mime: 'image/svg+xml' }), 'vector');
});

test('identical sponsors collapse to one group with instances', () => {
  const a = result({
    subject: {
      fileKind: 'vector',
      resource: 'https://example.com/vaudoise.svg',
      bytes: 20000,
      img: { srcset: '', naturalWidth: 300, naturalHeight: 80 },
      candidates: [],
      sourceMax: 300,
      identity: {
        component: 'paragraph--sponsors',
        selector: 'img.h-10',
        classes: ['h-10'],
        hidingClasses: [],
        dataTest: null,
        alt: 'Vaudoise',
        ariaLabel: '',
      },
    },
    findings: [{ type: 'svg-oversized', severity: 'orange', direction: 'oversized', summary: 'Heavy SVG' }],
    actions: [{ action: 'svg-oversized', summary: 'Do not add srcset' }],
  });
  const b = result({
    subject: { ...a.subject },
    findings: a.findings,
    actions: a.actions,
  });
  const doc = toAgentDocument('https://example.com', [a, b], {
    viewport: { width: 1440, height: 900 },
    dpr: 2,
  });
  assert.equal(doc.groups.length, 1);
  assert.equal(doc.groups[0].instances, 2);
  assert.equal(doc.groups[0].fileKind, 'vector');
  assert.equal(doc.groups[0].actions.some((x) => x.action === 'add-candidates'), false);

  const md = toMarkdown(doc);
  assert.match(md, /## Scan/);
  assert.match(md, /2 instance/);
  assert.match(md, /svg-oversized/);
});

test('light SVG is informational and omitted from tickets', () => {
  const a = result({
    subject: {
      fileKind: 'vector',
      resource: 'https://example.com/vaudoise.svg',
      bytes: 3700,
      img: { srcset: '', naturalWidth: 300, naturalHeight: 80 },
      candidates: [],
    },
    findings: [{
      type: 'svg-oversized',
      severity: 'skip',
      informational: true,
      direction: 'oversized',
      summary: 'vector cost is negligible',
    }],
    actions: [],
  });
  const doc = toAgentDocument('https://example.com', [a], { viewport: { width: 1440, height: 900 }, dpr: 2 });
  assert.equal(doc.groups.length, 0);
  assert.equal(doc.summary.uniqueIssues, 0);
});

test('Shopify products with the same srcset shape are one group', () => {
  const product = (file) => result({
    subject: {
      resource: `https://cdn.shopify.com/s/files/1/${file}`,
      sizesAttr: '(min-width: 768px) 248px, 168px',
      img: { srcset: `${file} 990w`, naturalWidth: 990, naturalHeight: 990 },
      candidates: [{ url: `https://cdn.shopify.com/s/files/1/${file}`, width: 990 }],
      sourceMax: 990,
      identity: {
        component: null,
        selector: 'img.product',
        classes: [],
        hidingClasses: [],
        dataTest: null,
        alt: file,
        ariaLabel: '',
      },
    },
    findings: [{ type: 'candidates', severity: 'red', direction: 'oversized', summary: 'oversized on mobile' }],
    actions: [{
      action: 'add-candidates',
      widths: [256, 384, 690, 828],
      summary: 'Add smaller srcset rungs 256, 384, 690, 828w',
    }],
  });
  const doc = toAgentDocument('https://example.com', [product('a.jpg'), product('b.jpg')], {
    viewport: { width: 390, height: 844 },
    dpr: 2,
  });
  assert.equal(urlFamily('https://cdn.shopify.com/s/files/1/a.jpg'), 'shopify');
  assert.equal(doc.groups.length, 1);
  assert.equal(doc.groups[0].instances, 2);
  assert.equal(doc.groups[0].identity.family, 'shopify');
  assert.deepEqual(doc.groups[0].actions[0].widths, [256, 384, 690, 828]);
  assert.match(toMarkdown(doc), /Shopify CDN/);
});

test('source-short is out of theme scope', () => {
  const a = result({
    subject: {
      resource: 'https://example.com/styles/lhc_avif_16_9_1080x608/public/x.avif',
      img: { srcset: 'x.avif 1080w', naturalWidth: 430, naturalHeight: 242 },
      candidates: [{ url: 'https://example.com/styles/lhc_avif_16_9_1080x608/public/x.avif', width: 1080 }],
      sourceMax: 1080,
      styleHint: 'lhc_avif_16_9_1080x608',
    },
    findings: [{
      type: 'source-short',
      severity: 'orange',
      decoded: 430,
      declared: 1080,
      summary: 'Decoded 430w but srcset/style declares 1080w',
    }],
    actions: [{
      action: 'source-short',
      decoded: 430,
      declared: 1080,
      summary: 'Decoded 430w but srcset/style declares 1080w',
    }],
  });
  const doc = toAgentDocument('https://example.com', [a], { viewport: { width: 1440, height: 900 }, dpr: 2 });
  assert.equal(doc.groups[0].actions[0].action, 'source-short');
  assert.match(toMarkdown(doc), /theme cannot invent/);
});

test('srcset is listed in full in markdown', () => {
  const doc = toAgentDocument('https://example.com', [result()], { viewport: { width: 1800, height: 900 }, dpr: 1 });
  const md = toMarkdown(doc);
  assert.match(md, /3840w/);
  assert.match(md, /1400w/);
  assert.match(md, /Source max: 3840w/);
});

test('Agent prompt wraps the markdown document with the preamble', () => {
  const doc = toAgentDocument('https://example.com', [result()], { viewport: { width: 1800, height: 900 }, dpr: 1 });
  const md = toMarkdown(doc);
  const prompt = toAgentPrompt(md);
  assert.equal(prompt.startsWith(AGENT_PROMPT_PREAMBLE), true);
  assert.match(prompt, /\n---\n\n# Picture Linter\n/);
  assert.match(prompt, /`Action:` lines are the tickets/);
  assert.ok(prompt.includes(md.trim()));
  assert.equal(prompt.includes(JSON.stringify(doc)), false);
});

test('groupKey differs when hiding class differs', () => {
  const mobile = { fileKind: 'raster', resource: '/a.jpg', img: { srcset: '' }, sources: [], sizesAttr: '', identity: { hidingClasses: ['md:hidden'] } };
  const desktop = { ...mobile, identity: { hidingClasses: ['max-md:hidden'] } };
  assert.notEqual(groupKey(mobile), groupKey(desktop));
});

test('smallerCandidateRungs lists widths to add for mobile over-fetch', () => {
  const add = smallerCandidateRungs({
    minLayout: 271,
    maxLayout: 271,
    existing: [1920],
    sourceMax: 1920,
  });
  assert.ok(add.includes(256));
  assert.ok(add.includes(384));
  assert.ok(add.includes(828));
  assert.equal(add.some((width) => width >= 1920), false);
});
