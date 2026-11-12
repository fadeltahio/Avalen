import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { uid } from '../src/avalen/id.js';

test('IDs use the native UUID method when available', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', {configurable: true, value: {
      randomUUID: () => 'native-id',
      getRandomValues: () => { throw new Error('Native UUID should be used'); },
    }});
    assert.equal(uid(), 'native-id');
  } finally { Object.defineProperty(globalThis, 'crypto', original); }
});

test('LAN previews create unique UUID v4 IDs without the HTTPS-only method', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', {configurable: true, value: {
      getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
    }});
    const ids = Array.from({length: 1000}, () => uid());
    for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(new Set(ids).size, ids.length);
  } finally { Object.defineProperty(globalThis, 'crypto', original); }
});
