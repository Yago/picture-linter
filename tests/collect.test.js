import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAriaHidden } from '../src/collect/subjects.js';

function element({ attrs = {}, parent = null, root = null } = {}) {
  const node = {
    nodeType: 1,
    parentElement: parent,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    getRootNode() {
      return root ?? node;
    },
  };
  return node;
}

test('aria-hidden on the element itself is Ignored', () => {
  assert.equal(isAriaHidden(element({ attrs: { 'aria-hidden': 'true' } })), true);
  assert.equal(isAriaHidden(element({ attrs: { 'aria-hidden': 'false' } })), false);
});

test('aria-hidden on an ancestor is Ignored', () => {
  const ancestor = element({ attrs: { 'aria-hidden': 'true' } });
  const parent = element({ parent: ancestor });
  const child = element({ parent });
  assert.equal(isAriaHidden(child), true);
  assert.equal(isAriaHidden(element({ parent: element() })), false);
});

test('aria-hidden on a shadow host is Ignored', () => {
  const host = element({ attrs: { 'aria-hidden': 'true' } });
  const inner = element({ root: { host } });
  assert.equal(isAriaHidden(inner), true);
});
