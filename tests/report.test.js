import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeLabel } from '../src/report/badge.js';

test('badgeLabel is empty at 0, 9+ above 9', () => {
  assert.equal(badgeLabel(0), '');
  assert.equal(badgeLabel(1), '1');
  assert.equal(badgeLabel(9), '9');
  assert.equal(badgeLabel(10), '9+');
});
