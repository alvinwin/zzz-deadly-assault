import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleStatusFromData, formatCycleRemaining, validateCycleStatus } from '../cycle-status.mjs';

const end = '2026-08-28T00:00:00.000Z';

test('formats remaining time by the largest useful units', () => {
  assert.equal(formatCycleRemaining(end, '2026-08-20T20:00:00.000Z'), '7d 4h remaining');
  assert.equal(formatCycleRemaining(end, '2026-08-27T05:28:00.000Z'), '18h 32m remaining');
  assert.equal(formatCycleRemaining(end, '2026-08-27T23:41:30.000Z'), '19m remaining');
  assert.equal(formatCycleRemaining(end, new Date('2026-08-27T23:41:30.000Z')), '19m remaining');
});

test('fails closed at expiry and for invalid dates', () => {
  assert.equal(formatCycleRemaining(end, end), 'Refresh pending');
  assert.equal(formatCycleRemaining(end, '2026-08-28T00:00:00.001Z'), 'Refresh pending');
  assert.equal(formatCycleRemaining(undefined, '2026-08-20T00:00:00.000Z'), 'Status unavailable');
  assert.equal(formatCycleRemaining('not-a-date', '2026-08-20T00:00:00.000Z'), 'Status unavailable');
  assert.equal(formatCycleRemaining('2026-02-31T00:00:00.000Z', '2026-02-20T00:00:00.000Z'), 'Status unavailable');
});

test('derives and validates the build status artifact from current data', () => {
  const status = cycleStatusFromData({ cycle: { startsAt: '2026-08-14T00:00:00.000Z', endsAt: end, checkedAt: '2026-08-15T02:52:48.616Z' } });
  assert.deepEqual(status, { schemaVersion: 1, mode: 'deadly-assault', status: 'current', startsAt: '2026-08-14T00:00:00.000Z', endsAt: end, checkedAt: '2026-08-15T02:52:48.616Z' });
  assert.deepEqual(validateCycleStatus(status), []);
  assert.match(validateCycleStatus({ ...status, endsAt: 'invalid' })[0], /endsAt/);
  assert.match(validateCycleStatus({ ...status, endsAt: '2026-02-31T00:00:00.000Z' })[0], /endsAt/);
  assert.match(validateCycleStatus({ ...status, startsAt: end })[0], /startsAt must be before endsAt/);
});
