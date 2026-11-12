import test from 'node:test';
import assert from 'node:assert/strict';
import { recordFood, ensureNutritionDay, nutritionScore } from '../src/avalen/nutrition-model.js';
const client = { id:'a', nutrition:{ kcal:2000,p:120,c:200,f:60 } };
test('partial days and legacy entries do not lower adherence; completion uses the saved prescription', () => {
 const d = { foodLogs:[{id:'legacy',clientId:'a',date:'2026-10-01',kcal:400}] };
 assert.deepEqual(nutritionScore(d,'a','2026-10-01','2026-10-31'),{score:null,days:0});
 recordFood(d,client,{id:'new',clientId:'a',date:'2026-10-02',kcal:1900});
 assert.equal(nutritionScore(d,'a','2026-10-01','2026-10-31').score,null);
 ensureNutritionDay(d,client,'2026-10-02').complete = true;
 const changed = {...client,nutrition:{...client.nutrition,kcal:3000}};
 assert.deepEqual(nutritionScore(d,'a','2026-10-01','2026-10-31'),{score:100,days:1});
 recordFood(d,changed,{id:'later',clientId:'a',date:'2026-10-03',kcal:2900});
 assert.equal(d.nutritionDays[0].target.kcal,2000);
 assert.equal(d.nutritionDays[1].target.kcal,3000);
});
test('correction replaces one entry, keeps its photo and reopens the day without crossing clients', () => {
 const d={foodLogs:[]};const entry={id:'meal',clientId:'a',date:'2026-10-02',kcal:2000,photo:{id:'photo'}};
 recordFood(d,client,entry);ensureNutritionDay(d,client,entry.date).complete=true;
 recordFood(d,client,{...entry,kcal:1000});
 assert.equal(d.foodLogs.length,1);assert.equal(d.foodLogs[0].photo.id,'photo');assert.equal(d.nutritionDays[0].complete,false);
 assert.deepEqual(nutritionScore(d,'another','2026-10-01','2026-10-31'),{score:null,days:0});
});
