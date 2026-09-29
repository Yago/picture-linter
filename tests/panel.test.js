import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitFindingSummary } from '../src/ui/explanation.js';
import { matchesFilter } from '../src/ui/panel.js';
import { solutionParts } from '../src/ui/solution.js';

function result(verdict, types = []) {
  return { verdict, findings: types.map((type) => ({ type })) };
}

test('matchesFilter keeps every row on all', () => {
  assert.equal(matchesFilter(result('green'), 'all'), true);
  assert.equal(matchesFilter(result('red', ['phantom']), 'all'), true);
});

test('solutionParts keeps code out of the prose', () => {
  const sizes = { action: 'update-sizes', to: '(min-width: 800px) 50vw, 100vw' };
  const candidates = { action: 'add-candidates', widths: [1600, 800] };
  assert.deepEqual(
    solutionParts({ actions: [
      { action: 'stop-phantom', summary: 'Do not set src until the ancestor is shown' },
      sizes,
    ] }),
    { prose: 'Do not set src until the ancestor is shown.', code: '' },
  );
  assert.deepEqual(
    solutionParts({ actions: [
      { action: 'fix-markup', summary: '<picture> has no <img>' },
      { action: 'fix-markup', summary: '<source> must use srcset, not src' },
    ] }),
    { prose: '<picture> has no <img>. <source> must use srcset, not src.', code: '' },
  );
  assert.deepEqual(
    solutionParts({ actions: [
      { action: 'source-short', summary: 'Decoded 800w but srcset declares 1600w.' },
      sizes,
      candidates,
    ] }),
    {
      prose: 'Decoded 800w but srcset declares 1600w.',
      code: 'sizes="(min-width: 800px) 50vw, 100vw"',
    },
  );
  assert.deepEqual(solutionParts({ actions: [sizes, candidates] }), {
    prose: '',
    code: 'sizes="(min-width: 800px) 50vw, 100vw"\n800w, 1600w',
  });
  assert.deepEqual(solutionParts({ actions: [candidates] }), {
    prose: '',
    code: '800w, 1600w',
  });
  assert.deepEqual(
    solutionParts({ actions: [{ action: 'ignore-placeholder', summary: 'Ignore this node — LQIP / blur-up, not a content image' }] }),
    { prose: 'Ignore this node — LQIP / blur-up, not a content image.', code: '' },
  );
  assert.deepEqual(solutionParts({ actions: [] }), { prose: 'No change.', code: '' });
});

test('splitFindingSummary lifts undersized and oversized into a title', () => {
  assert.deepEqual(
    splitFindingSummary('oversized · needed 800w · chosen 1600w'),
    { title: 'oversized', body: 'needed 800w · chosen 1600w' },
  );
  assert.deepEqual(
    splitFindingSummary('undersized · needed 400w'),
    { title: 'undersized', body: 'needed 400w' },
  );
  assert.deepEqual(
    splitFindingSummary('undersized needed 400w'),
    { title: 'undersized', body: 'needed 400w' },
  );
  assert.deepEqual(
    splitFindingSummary('<picture> has no <img>'),
    { title: '', body: '<picture> has no <img>' },
  );
});

test('matchesFilter matches verdict, and phantom rows by finding', () => {
  const phantom = result('red', ['phantom']);
  assert.equal(matchesFilter(result('orange'), 'orange'), true);
  assert.equal(matchesFilter(result('orange'), 'red'), false);
  assert.equal(matchesFilter(phantom, 'phantom'), true);
  assert.equal(matchesFilter(result('red'), 'phantom'), false);
});
