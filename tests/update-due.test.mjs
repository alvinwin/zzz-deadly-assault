import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isUpdateDue, loadJson } from '../scripts/check-update-due.mjs';

const boundary = '2026-08-28T00:00:00.000Z';

test('reports before, at, and after the cycle boundary', () => {
  const data = { cycle: { endsAt: boundary } };
  assert.equal(isUpdateDue(data, new Date('2026-08-27T23:59:59.999Z')), false);
  assert.equal(isUpdateDue(data, new Date(boundary)), true);
  assert.equal(isUpdateDue(data, new Date('2026-08-28T00:00:00.001Z')), true);
});

test('reads compact deployed and full source payloads', () => {
  const compact = { cycle: { id: '3.1.2', endsAt: boundary, publishable: true } };
  const full = { cycle: { id: '3.1.2', endsAt: boundary, provenance: { rotation: ['source'] } }, encounters: [] };
  const before = new Date('2026-08-27T00:00:00Z');
  assert.equal(isUpdateDue(compact, before), false);
  assert.equal(isUpdateDue(full, before), false);
});

test('loads a local JSON path and prints only the boolean result', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deadly-assault-update-due-'));
  const source = path.join(root, 'current.json');
  fs.writeFileSync(source, JSON.stringify({ cycle: { endsAt: '2020-01-01T00:00:00.000Z' } }));
  assert.equal(execFileSync(process.execPath, ['scripts/check-update-due.mjs', source], { encoding: 'utf8' }), 'true\n');
});

test('loads a URL through the injectable fetch implementation', async () => {
  const data = await loadJson('https://example.test/current.json', async url => {
    assert.equal(url.href, 'https://example.test/current.json');
    return { ok: true, text: async () => JSON.stringify({ cycle: { endsAt: boundary } }) };
  });
  assert.equal(isUpdateDue(data, new Date(boundary)), true);
});

test('rejects missing or invalid cycle end dates', () => {
  assert.throws(() => isUpdateDue({ cycle: {} }, new Date()), /cycle\.endsAt is missing/);
  assert.throws(() => isUpdateDue({ cycle: { endsAt: 'not-a-date' } }, new Date()), /cycle\.endsAt is not a valid date/);
});
