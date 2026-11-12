import test from 'node:test';
import assert from 'node:assert/strict';
import { chartRecords, consistencyState, programError } from '../src/avalen/validation.js';
import { parseWorkspace } from '../src/avalen/persistence.js';
import { createWorkspace } from '../src/avalen/seed.js';

test('charts omit absent values, preserve real zero and sort by date', () => {
  const records = [
    { date: '2026-10-03', fat: null }, { date: '2026-10-02', fat: '' },
    { date: '2026-10-01', fat: 0 }, { date: '2026-09-30', fat: '15.2' },
    { date: '2026-10-04', fat: ' ' }, { date: '2026-10-05', fat: 'NaN' },
  ];
  assert.deepEqual(chartRecords(records, 'fat').map(x => x.fat), ['15.2', 0]);
  assert.equal(records[0].date, '2026-10-03');
});
test('workspace parsing preserves valid data and fills appearance defaults only', () => {
  const data = createWorkspace();
  delete data.settings.theme;
  const parsed = parseWorkspace(JSON.stringify(data));
  assert.equal(parsed.settings.theme, 'dark');
  assert.deepEqual(parsed.clients, data.clients);
  assert.deepEqual(parsed.sessions, data.sessions);
});
test('unreadable or unsupported workspaces are rejected, never silently seeded', () => {
  for (const raw of ['{broken', 'null', '{}', '{"version":2}', JSON.stringify({ ...createWorkspace(), clients: [] }), JSON.stringify({ ...createWorkspace(), messages: null })]) {
    assert.throws(() => parseWorkspace(raw));
  }
});

test('consistency distinguishes rest days, partial nutrition and no habits', () => {
  const base = { mode: 'Training + nutrition', workout: false, scheduled: false, foodLogged: true, nutrition: true };
  assert.equal(consistencyState(base), 'both');
  assert.equal(consistencyState({ ...base, scheduled: true }), 'nutrition');
  assert.equal(consistencyState({ ...base, nutrition: false }), 'partial');
  assert.equal(consistencyState({ ...base, mode: 'Habits', habits: [], values: {} }), 'none');
  assert.equal(consistencyState({ ...base, foodLogged: false, nutrition: false }), 'none');
});

test('programme validation rejects fractional sets, invalid minutes and nonfinite load', () => {
  const program = createWorkspace().clients[0].program;
  assert.equal(programError(program), '');
  program.weeks = 1.5;
  assert.match(programError(program), /Weeks/);
  program.weeks = 12;
  program.days[0].minutes = -5;
  assert.match(programError(program), /minutes/);
  program.days[0].minutes = 45;
  program.days[0].exercises[0].sets = 2.5;
  assert.match(programError(program), /sets/);
  program.days[0].exercises[0].sets = 3;
  program.days[0].exercises[0].weight = Infinity;
  assert.match(programError(program), /load/);
});
