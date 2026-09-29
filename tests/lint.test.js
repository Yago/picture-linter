import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintSubject } from '../src/lint/run.js';

const RESOURCE = 'https://example.com/files/photo.avif';

function subject(overrides = {}) {
  return {
    kind: 'img',
    fileKind: 'raster',
    resource: RESOURCE,
    sources: [],
    candidates: [
      { url: 'https://example.com/files/small.avif', width: 690 },
      { url: '/files/photo.avif', width: 1400 },
    ],
    img: { naturalWidth: 676, naturalHeight: 400, srcset: '', sizesAttr: '' },
    bitmap: 0,
    painted: { width: 676, height: 400 },
    sizesAttr: '676px',
    svg: false,
    placeholder: false,
    requested: true,
    ...overrides,
  };
}

test('676 CSS px loading an honest 1400w at 2× is not red', () => {
  globalThis.window = { devicePixelRatio: 2 };
  const result = lintSubject(subject(), {});
  assert.equal(result.findings.some((finding) => finding.type === 'fit'), false);
  assert.equal(result.findings.some((finding) => finding.type === 'source-short'), false);
  assert.equal(result.verdict, 'green');
});

test('a bitmap under 90% of its w is source-short and Fit uses the bitmap', () => {
  globalThis.window = { devicePixelRatio: 2 };
  const result = lintSubject(subject({ bitmap: 430, styleHint: 'original_1400' }), {});
  const fit = result.findings.find((finding) => finding.type === 'fit');
  assert.equal(fit.have, 430);
  assert.equal(fit.severity, 'red');
  assert.equal(result.findings.some((finding) => finding.type === 'source-short'), true);
  assert.equal(result.actions.some((action) => action.action === 'source-short'), true);
  assert.equal(result.actions.some((action) => action.action === 'add-candidates'), false);
  assert.equal(result.verdict, 'red');
});

test('a bitmap larger than its w is the Fit width and is not source-short', () => {
  globalThis.window = { devicePixelRatio: 2 };
  const result = lintSubject(subject({
    bitmap: 1400,
    candidates: [{ url: '/files/photo.avif', width: 700 }],
  }), {});
  assert.equal(result.findings.some((finding) => finding.type === 'fit'), false);
  assert.equal(result.findings.some((finding) => finding.type === 'source-short'), false);
});

test('another Candidate keeps its w when the loaded file is short', () => {
  globalThis.window = { devicePixelRatio: 1 };
  const result = lintSubject(subject({
    bitmap: 430,
    painted: { width: 388, height: 200 },
    sizesAttr: '388px',
  }), { '480x270': 388 });
  const oversized = result.findings.find((finding) => finding.have === 690);
  assert.ok(oversized);
  assert.equal(oversized.direction, 'oversized');
  assert.equal(result.findings.some((finding) => finding.have === 1400), false);
});

test('an x descriptor recovers pixels from the density-corrected width', () => {
  globalThis.window = { devicePixelRatio: 2 };
  const result = lintSubject(subject({
    candidates: [{ url: RESOURCE, density: 2 }],
    img: { naturalWidth: 700, naturalHeight: 400, srcset: '', sizesAttr: '' },
    bitmap: 0,
  }), {});
  assert.equal(result.findings.some((finding) => finding.type === 'fit'), false);
  assert.equal(result.findings.some((finding) => finding.type === 'source-short'), false);
  assert.equal(result.verdict, 'green');
});
