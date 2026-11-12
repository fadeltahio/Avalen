import test from 'node:test';
import assert from 'node:assert/strict';
import { checkinPlanFor,checkinSchedule,saveCheckin,schemaFor,checkinTrend,checkinPlanError,checkinError } from '../src/avalen/checkin-model.js';
import { attentionFor } from '../src/avalen/store.js';
import { createWorkspace } from '../src/avalen/seed.js';
const client={id:'a',created:'2026-10-01'};
const weight={id:'weight',label:'Weight',type:'number',unit:'kg',min:20,max:400,required:true,enabled:true,measurementKey:'weight'};

test('each client cadence starts on its first due date and advances from submission',()=>{
 assert.equal(checkinSchedule(client,[],'2026-10-07').due,false);
 assert.equal(checkinSchedule(client,[],'2026-10-08').due,true);
 const c={...client,checkinPlan:{...checkinPlanFor(client),intervalDays:14}};
 const rows=[{id:'r',clientId:'a',date:'2026-10-05'},{id:'other',clientId:'b',date:'2026-10-16'}];
 assert.equal(checkinSchedule(c,rows,'2026-10-16').dueDate,'2026-10-19');
 c.checkinPlan.intervalDays=3;assert.equal(checkinSchedule(c,rows,'2026-10-16').overdue,true);
 c.checkinPlan.startDate='2026-11-01';assert.equal(checkinSchedule(c,rows,'2026-10-16').dueDate,'2026-11-01');
 assert.equal(checkinSchedule(client,[],'2026-10-07').intervalDays,7);
});
test('measurements from a check-in update progress without duplicating a date or replacing other body data',()=>{
 const d={checkins:[],measurements:[{id:'m',clientId:'a',date:'2026-10-16',chest:100}]};
 const row={id:'r',clientId:'a',date:'2026-10-16',schema:[weight],answers:{weight:'80.5'}};
 saveCheckin(d,client,row);saveCheckin(d,client,{...row,answers:{weight:'79.5'}});
 assert.equal(d.checkins.length,1);assert.equal(d.measurements.length,1);assert.equal(d.measurements[0].chest,100);assert.equal(d.measurements[0].weight,79.5);
 assert.deepEqual(checkinTrend(d,'a',weight).map(p=>p.value),[79.5]);assert.deepEqual(checkinTrend(d,'b',weight),[]);
});
test('optional blank measurements clear only values written by this check-in, while zero custom readings remain real',()=>{
 const waist={id:'waist',measurementKey:'waist',label:'Waist',type:'number',unit:'cm',min:20,max:250};
 const d={checkins:[],measurements:[{id:'m',clientId:'a',date:'2026-10-16',weight:80,waist:90}]};
 const row={id:'r',clientId:'a',date:'2026-10-16',schema:[waist],answers:{waist:''}};saveCheckin(d,client,row);assert.equal(d.measurements[0].waist,90);
 saveCheckin(d,client,{...row,answers:{waist:88}});saveCheckin(d,client,row);assert.equal(d.measurements[0].waist,null);assert.equal(d.measurements[0].weight,80);
 const zero={id:'pain',label:'Pain',type:'number',unit:'points',min:0,max:10};saveCheckin(d,client,{...row,id:'custom',schema:[zero],answers:{pain:0}});assert.equal(checkinTrend(d,'a',zero)[0].value,0);
});
test('saved questions survive template edits and legacy check-ins never gain inferred measurements',()=>{
 const schema=structuredClone([weight]);const d={checkins:[],measurements:[]};
 saveCheckin(d,client,{id:'r',clientId:'a',date:'2026-10-16',schema,answers:{weight:80}});
 const plan=checkinPlanFor(client);plan.fields[0].label='Morning weight';assert.equal(d.checkins[0].schema[0].label,'Weight');
 assert.equal(schemaFor({scores:{Mood:3},date:'2026-10-01'}).some(f=>f.id==='weight'),false);
 assert.deepEqual(checkinTrend({checkins:[{clientId:'a',date:'2026-10-01',scores:{Mood:3}}],measurements:[]},'a',weight),[]);
 assert.deepEqual(checkinTrend(d,'a',{...weight,unit:'lb'}),[]);
});
test('settings and required answers reject missing, nonfinite or out-of-range values',()=>{
 const plan=checkinPlanFor(client);plan.intervalDays=0;assert.ok(checkinPlanError(plan));plan.intervalDays=2.5;assert.ok(checkinPlanError(plan));plan.intervalDays=3;assert.equal(checkinPlanError(plan),'');
 assert.ok(checkinError([weight],{}));assert.ok(checkinError([weight],{weight:'bad'}));assert.ok(checkinError([weight],{weight:1}));assert.equal(checkinError([weight],{weight:75.2}),'');
 plan.fields.forEach(f=>f.enabled=false);assert.ok(checkinPlanError(plan));
});
test('coach attention follows configured cadence rather than a fixed week',()=>{
 const d=createWorkspace(),c=d.clients[0];c.checkinPlan=checkinPlanFor(c);c.checkinPlan.intervalDays=14;
 assert.equal(attentionFor(d,c).some(f=>f.key==='checkin'),false);c.checkinPlan.intervalDays=3;assert.equal(attentionFor(d,c).some(f=>f.key==='checkin'),true);
});
test('required written answers reject whitespace and actual legacy measurements remain visible',()=>{
 assert.ok(checkinError([{id:'q',label:'Question',type:'text',required:true}],{q:'   '}));
 assert.ok(schemaFor({date:'2026-10-16',weight:80,scores:{Mood:4}}).some(f=>f.id==='weight'));
 assert.throws(()=>saveCheckin({checkins:[],measurements:[]},client,{clientId:'b',schema:[weight],answers:{weight:80}}),/different client/);
});
