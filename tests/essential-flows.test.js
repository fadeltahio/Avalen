import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../src/avalen/seed.js';
import {dayKey, offsetDay} from '../src/avalen/store.js';
import {reviewQueue, matchesReview, reviewAction} from '../src/avalen/coach-review.js';
import {readWorkoutInput, writeWorkoutInput, clearWorkoutInput} from '../src/avalen/workout-input.js';

function quietWorkspace() {
  const data = createWorkspace(), client = data.clients[0];
  data.clients.forEach(row => {row.paused = row.id !== client.id;});
  client.goal = 'Build strength'; client.schedule = []; client.programEnd = '2099-01-01';
  client.subscription.status = 'Active'; client.subscription.nextDate = '2099-01-01';
  client.checkinPlan = {intervalDays:7, startDate:'2099-01-01', fields:[]};
  for (const key of ['checkins', 'messages', 'formSubmissions', 'measurements', 'sessions', 'foodLogs', 'nutritionDays', 'dismissed']) data[key] = [];
  return {data, client};
}
test('review queue surfaces check-ins, pending technique and messages in actionable order', () => {
  const {data, client} = quietWorkspace();
  data.checkins.push({id:'check', clientId:client.id, date:dayKey(), reviewed:false});
  data.formSubmissions.push({id:'form', clientId:client.id, status:'pending', createdAt:new Date().toISOString(), exerciseName:'Bench press'});
  data.messages.push({clientId:client.id, from:'client', read:false, at:new Date().toISOString(), text:'Quick question'});
  const flags = reviewQueue(data)[0].flags;
  assert.deepEqual(flags.map(flag => flag.key), ['review', 'form', 'message']);
  assert.equal(reviewAction(flags[0]), 'Review check-in');
  assert.deepEqual(flags.filter(flag => matchesReview(flag, 'Technique')).map(flag => flag.tab), ['FormLab']);
  assert.equal(flags.filter(flag => matchesReview(flag, 'Messages')).length, 1);
});
test('review queue removes resolved work and respects snoozes and paused clients', () => {
  const {data, client} = quietWorkspace();
  data.formSubmissions.push({id:'form', clientId:client.id, status:'pending', createdAt:new Date().toISOString(), exerciseName:'Bench press'});
  data.dismissed.push({clientId:client.id, key:'form', until:offsetDay(1)});
  assert.equal(reviewQueue(data).length, 0);
  data.dismissed[0].until = offsetDay(-1);
  assert.equal(reviewQueue(data).length, 1);
  data.formSubmissions[0].status = 'reviewed';
  assert.equal(reviewQueue(data).length, 0);
  data.formSubmissions[0].status = 'pending'; client.paused = true;
  assert.equal(reviewQueue(data).length, 0);
});
test('pending schedule approvals lead to the client plan and leave the queue after confirmation', () => {
  const {data, client} = quietWorkspace();
  data.scheduleProposals = [{id:'proposal', clientId:client.id, status:'pending', created:new Date().toISOString()}];
  const flag = reviewQueue(data)[0].flags[0];
  assert.equal(flag.tab, 'Plan');
  assert.equal(reviewAction(flag), 'Review schedule');
  data.scheduleProposals[0].status = 'confirmed';
  assert.equal(reviewQueue(data).length, 0);
});
test('unlogged inputs survive refresh, are scoped to a set, and cannot replace logged history', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {configurable:true, value:{getItem:key => values.get(key) ?? null, setItem:(key, value) => values.set(key, value), removeItem:key => values.delete(key)}});
  try {
    const inputs = {weight:'62.5', reps:'11', effort:'Hard'};
    assert.equal(writeWorkoutInput('draft-a', 'bench', 2, inputs), true);
    assert.deepEqual(readWorkoutInput('draft-a', 'bench', 2), inputs);
    assert.equal(readWorkoutInput('draft-a', 'bench', 3), null);
    assert.equal(readWorkoutInput('draft-b', 'bench', 2), null);
    writeWorkoutInput('draft-a', 'row', 1, {weight:40, reps:12});
    clearWorkoutInput('draft-a', 'bench');
    assert.equal(readWorkoutInput('draft-a', 'bench', 2), null);
    assert.ok(readWorkoutInput('draft-a', 'row', 1));
    clearWorkoutInput('draft-a'); assert.equal(values.size, 0);
    localStorage.setItem('avalen.workout-input.corrupt', 'invalid');
    assert.equal(readWorkoutInput('corrupt', 'bench', 1), null);
    localStorage.setItem = () => {throw new Error('Storage unavailable');};
    assert.equal(writeWorkoutInput('draft-a', 'bench', 1, inputs), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
