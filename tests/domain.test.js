import { classifyScale, scaleOf, fitDirection } from '../src/domain/scale.js';
import { parseSrcset, pickCandidate } from '../src/domain/srcset.js';
import { parseSizes, winningSize, sizesMismatch, computeLength, isSizesAuto, mediaMinMaxMatches } from '../src/domain/sizes.js';
import { suggestSizes, capFluidSizes, isBareHundredVw } from '../src/domain/suggest-sizes.js';
import { aggregateRanges, formatRange } from '../src/domain/ranges.js';
import { worstSeverity } from '../src/domain/severity.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('classifyScale traffic lights', () => {
  assert.equal(classifyScale(1), 'green');
  assert.equal(classifyScale(1.4), 'green');
  assert.equal(classifyScale(1.5), 'green');
  assert.equal(classifyScale(0.9), 'green');
  assert.equal(classifyScale(0.8), 'orange');
  assert.equal(classifyScale(1.8), 'orange');
  assert.equal(classifyScale(2), 'orange');
  assert.equal(classifyScale(0.5), 'red');
  assert.equal(classifyScale(2.1), 'red');
});

test('scaleOf divides intrinsic by layout × density', () => {
  assert.equal(scaleOf(800, 400, 2), 1);
  assert.equal(scaleOf(400, 400, 1), 1);
});

test('parseSrcset w and x', () => {
  const w = parseSrcset('a.jpg 200w, b.jpg 400w, c.jpg 800w');
  assert.deepEqual(w.map((c) => c.width), [200, 400, 800]);
  const x = parseSrcset('a.jpg 1x, b.jpg 2x');
  assert.deepEqual(x.map((c) => c.density), [1, 2]);
});

test('pickCandidate w-descriptor uses sizes × density', () => {
  const c = parseSrcset('a.jpg 200w, b.jpg 400w, c.jpg 800w');
  assert.equal(pickCandidate(c, 200, 1).width, 200);
  assert.equal(pickCandidate(c, 200, 2).width, 400);
  assert.equal(pickCandidate(c, 400, 2).width, 800);
  assert.equal(pickCandidate(c, 900, 3).width, 800);
});

test('sizes auto is skipped; media min-width wins', () => {
  const items = parseSizes('auto, (min-width: 768px) 50vw, 100vw');
  assert.equal(isSizesAuto(items), true);
  assert.equal(winningSize(items, 800, mediaMinMaxMatches), '50vw');
  assert.equal(winningSize(items, 320, mediaMinMaxMatches), '100vw');
});

test('computeLength vw px calc', () => {
  assert.equal(computeLength('100vw', 320), 320);
  assert.equal(computeLength('200px', 320), 200);
  assert.equal(computeLength('calc(50vw - 24px)', 800), 376);
});

test('sizesMismatch uses 5% + 15px', () => {
  assert.equal(sizesMismatch(200, 200), false);
  assert.equal(sizesMismatch(400, 200), true);
  assert.equal(sizesMismatch(210, 200), false);
});

test('suggestSizes emits vw for fluid, px for fixed', () => {
  const fluid = {};
  for (let w = 300; w <= 1000; w += 20) fluid[`${w}x${Math.round(w * 9 / 16)}`] = w;
  assert.equal(suggestSizes(fluid), '100vw');

  const fixed = {};
  for (let w = 300; w <= 1000; w += 20) fixed[`${w}x${Math.round(w * 9 / 16)}`] = 200;
  assert.equal(suggestSizes(fixed), '200px');
});

test('capFluidSizes replaces bare 100vw when layout is capped', () => {
  const dimensions = {};
  for (let w = 300; w <= 3000; w += 20) {
    dimensions[`${w}x${Math.round(w * 9 / 16)}`] = Math.min(w, 1540);
  }
  assert.equal(isBareHundredVw('100vw'), true);
  assert.equal(capFluidSizes('100vw', dimensions), 'min(1540px, 100vw)');
  assert.equal(isBareHundredVw('min(1540px, 100vw)'), false);
  assert.equal(
    capFluidSizes('(min-width: 1520px) 1520px, 100vw', dimensions),
    '(min-width: 1520px) 1520px, min(1540px, 100vw)',
  );
});

test('computeLength understands min()', () => {
  assert.equal(computeLength('min(1540px, 100vw)', 3000), 1540);
  assert.equal(computeLength('min(1540px, 100vw)', 375), 375);
});

test('aggregateRanges collapses consecutive equal payloads', () => {
  const points = [320, 340, 360, 640, 660].map((width) => ({
    width,
    severity: width < 400 ? 'red' : 'green',
  }));
  const ranges = aggregateRanges(points, (a, b) => a.severity === b.severity, 20);
  assert.equal(ranges.length, 2);
  assert.equal(formatRange(ranges[0]), '320–360px');
  assert.equal(formatRange(ranges[1]), '640–660px');
});

test('verdict is worst finding', () => {
  assert.equal(worstSeverity(['green', 'orange', 'skip']), 'orange');
  assert.equal(worstSeverity(['orange', 'red']), 'red');
  assert.equal(worstSeverity([]), 'green');
});

test('fitDirection names undersized vs oversized', () => {
  assert.equal(fitDirection(0.25), 'undersized');
  assert.equal(fitDirection(1.05), 'ok');
  assert.equal(fitDirection(8), 'oversized');
});
