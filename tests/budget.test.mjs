import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BUDGETS, evaluateBudget, measureDist } from '../scripts/check-budget.mjs';

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deadly-assault-budget-'));
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return root;
}

test('measures a below-target fixture', () => {
  const root = fixture({ 'app.js': 'small asset' });
  const measured = measureDist(root);
  assert.equal(measured.missing, false);
  assert.equal(evaluateBudget(measured.rawBytes, BUDGETS.raw), 'ok');
  assert.equal(evaluateBudget(measured.gzipProxyBytes, BUDGETS.gzipProxy), 'ok');
});

test('measures the warning band without making it a failure', () => {
  const root = fixture({ 'app.js': Buffer.alloc(BUDGETS.raw.warning + 1, 'a') });
  const measured = measureDist(root);
  assert.equal(evaluateBudget(measured.rawBytes, BUDGETS.raw), 'warning');
  assert.equal(evaluateBudget(measured.gzipProxyBytes, BUDGETS.gzipProxy), 'ok');
});

test('evaluates a raw hard-limit fixture', () => {
  const root = fixture({ 'app.js': Buffer.alloc(BUDGETS.raw.hard + 1, 'a') });
  const measured = measureDist(root);
  assert.equal(evaluateBudget(measured.rawBytes, BUDGETS.raw), 'hard');
});

test('sums per-file gzip proxies and catches a gzip hard-limit fixture', () => {
  const incompressible = Buffer.alloc(4000);
  let state = 0x12345678;
  for (let index = 0; index < incompressible.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    incompressible[index] = state & 255;
  }
  const root = fixture({ 'a.bin': incompressible, 'nested/b.bin': incompressible, 'c.bin': incompressible });
  const measured = measureDist(root);
  assert.ok(measured.gzipProxyBytes > BUDGETS.gzipProxy.hard);
  assert.equal(evaluateBudget(measured.gzipProxyBytes, BUDGETS.gzipProxy), 'hard');
});

test('reports a missing dist fixture', () => {
  const root = path.join(os.tmpdir(), `deadly-assault-budget-missing-${process.pid}-${Date.now()}`);
  assert.equal(measureDist(root).missing, true);
});
