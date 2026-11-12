import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../src/avalen/seed.js';
import {commitLocalWorkspace} from '../src/avalen/local-transaction.js';
import {latestMeasurement} from '../src/avalen/validation.js';
const actor = {id:'device-preview', role:'client'};
test('local updates acknowledge a stored complete snapshot without mutating previous records', () => {
  const previous = createWorkspace(), baseline = JSON.stringify(previous);
  let stored;
  const next = commitLocalWorkspace(previous, draft => {draft.clients[0].name = 'Amira Test';}, actor, {setItem:(key, value) => {assert.equal(key, 'workspace'); stored = value;}}, 'workspace');
  assert.equal(JSON.stringify(previous), baseline);
  assert.equal(JSON.parse(stored).clients[0].name, 'Amira Test');
  assert.deepEqual(JSON.parse(stored), next);
});
test('storage failure leaves existing records intact and throws before new state can be published', () => {
  const previous = createWorkspace(), baseline = JSON.stringify(previous);
  assert.throws(() => commitLocalWorkspace(previous, draft => {draft.messages.push({id:'new-message'});}, actor, {setItem:() => {throw new Error('Full storage');}}, 'workspace'), /Full storage/);
  assert.equal(JSON.stringify(previous), baseline);
});
test('a failed mutation never writes a partial workspace; sequential updates retain both changes', () => {
  let current = createWorkspace(), writes = 0;
  const storage = {setItem:() => {writes++;}};
  assert.throws(() => commitLocalWorkspace(current, draft => {draft.clients[0].name = 'Partial'; throw new Error('Invalid');}, actor, storage, 'workspace'));
  assert.equal(writes, 0);
  current = commitLocalWorkspace(current, draft => {draft.clients[0].name = 'Amira';}, actor, storage, 'workspace');
  current = commitLocalWorkspace(current, draft => {draft.clients[0].goal = 'Build strength';}, actor, storage, 'workspace');
  assert.equal(current.clients[0].name, 'Amira'); assert.equal(current.clients[0].goal, 'Build strength');
});
test('latest body metrics retain their own dates, omit missing readings and keep actual zero', () => {
  const rows = [{date:'2026-10-01', weight:80, chest:100, bodyFat:22}, {date:'2026-10-10', weight:79, bodyFat:null}, {date:'2026-10-12', weight:78, chest:''}, {date:'2026-10-14', custom:0}];
  assert.deepEqual(latestMeasurement(rows, 'chest'), rows[0]);
  assert.equal(latestMeasurement(rows, 'bodyFat').bodyFat, 22);
  assert.equal(latestMeasurement(rows, 'weight').weight, 78);
  assert.equal(latestMeasurement(rows, 'custom').custom, 0);
  assert.equal(latestMeasurement(rows, 'waist'), null);
});
