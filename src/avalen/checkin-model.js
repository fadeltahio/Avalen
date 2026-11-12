import { zonedDay,validTimezone,weekday,utcAdd } from './ecosystem/time.js';
import { uid } from './id.js';
const metric = (id,label,unit,min,max,enabled=false,required=false) => ({ id,label,type:'number',unit,min,max,enabled,required,measurementKey:id,builtin:true });
const rating = label => ({ id:`score-${label.toLowerCase()}`,label,type:'rating',unit:'/ 5',min:1,max:5,enabled:['Sleep','Energy'].includes(label),required:false,legacyKey:label,builtin:true });
export const CHECKIN_FIELDS = [
  metric('weight','Weight','kg',20,400,true,true),
  metric('waist','Waist','cm',20,250,true),
  metric('bodyFat','Body fat','%',1,70,true),
  metric('chest','Chest','cm',20,250),
  metric('hips','Hips','cm',20,250),
  { id:'sleepHours',label:'Sleep duration',type:'number',unit:'hours',min:0,max:24,enabled:false,required:false,builtin:true },
  ...['Mood','Sleep','Energy','Hunger','Stress','Training','Nutrition'].map(rating),
  { id:'wins',label:'What went well?',type:'text',enabled:false,required:false,builtin:true },
  { id:'struggles',label:'What felt difficult?',type:'text',enabled:false,required:false,builtin:true },
  { id:'note',label:'Anything else for your coach?',type:'text',enabled:true,required:false,builtin:true },
  { id:'photos',label:'Progress photos',type:'photos',enabled:false,required:false,builtin:true },
];
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(date,days) { const d=new Date(`${date}T12:00:00`); d.setDate(d.getDate()+Number(days)); return localDay(d); }
const distance = (a,b) => Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000);
export function checkinPlanFor(client,today=localDay()) {
  return client.checkinPlan || { timezone:'UTC',reminderTime:'18:00',reminders:true,intervalDays:7,startDate:addDays(client.created || today,7),fields:structuredClone(CHECKIN_FIELDS) };
}
export function checkinSchedule(client,rows,today=zonedDay(client.checkinPlan?.timezone || 'UTC')) {
  const plan=checkinPlanFor(client,today);
  const last=rows.filter(r=>r.clientId===client.id && r.date<=today).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  let first=plan.startDate;
  if(plan.scheduleMode==='weekly' && Number(plan.intervalDays)===7 && Number.isInteger(Number(plan.preferredWeekday)))first=utcAdd(first,(Number(plan.preferredWeekday)-weekday(first)+7)%7);
  const next=last?addDays(plan.scheduleMode==='weekly'?(last.periodDate || last.date):last.date,plan.intervalDays):first;
  const dueDate=next>first?next:first;
  return { dueDate,daysUntil:distance(today,dueDate),due:dueDate<=today,overdue:dueDate<today,intervalDays:Number(plan.intervalDays),last };
}
export function answerFor(row,field) {
  if (row.answers && Object.hasOwn(row.answers,field.id)) return row.answers[field.id];
  if (field.legacyKey) return row.scores?.[field.legacyKey] ?? '';
  if (field.type==='photos') return row.photos || [];
  return row[field.id] ?? '';
}
export function schemaFor(row) {
  // Legacy submissions contain reflection scores, never inferred body measurements.
  return row.schema || CHECKIN_FIELDS.filter(f=>f.legacyKey || ['wins','struggles','note','photos'].includes(f.id) || f.measurementKey && hasAnswer(row[f.id]));
}
export const hasAnswer = value => Array.isArray(value)?value.length>0:typeof value==='string'?value.trim().length>0:value!==null && value!==undefined;
export function checkinError(fields,answers) {
  for (const field of fields) {
    const value=answers[field.id];
    if (!hasAnswer(value)) { if (field.required) return `Please complete ${field.label}.`; continue; }
    if (['number','rating'].includes(field.type) && (!Number.isFinite(Number(value)) || Number(value)<Number(field.min ?? 0) || Number(value)>Number(field.max ?? 100000) || field.type==='rating' && !Number.isInteger(Number(value)))) return `${field.label}: enter ${field.min ?? 0}–${field.max ?? 100000}${field.unit?` ${field.unit}`:''}.`;
    if (field.type==='text' && String(value).length>2000) return `${field.label}: use 2,000 characters or fewer.`;
  }
  return '';
}
export function checkinPlanError(plan) {
  if(plan.scheduleMode==='weekly' && (Number(plan.intervalDays)!==7 || !Number.isInteger(Number(plan.preferredWeekday)) || plan.preferredWeekday<0 || plan.preferredWeekday>6))return 'Fixed weekly check-ins require a weekday and a seven-day cadence.';
  if(plan.timezone && !validTimezone(plan.timezone))return 'Enter a valid timezone, such as Africa/Cairo.';
  if(plan.reminderTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.reminderTime))return 'Choose a valid local reminder time.';
  if (!Number.isInteger(Number(plan.intervalDays)) || plan.intervalDays<1 || plan.intervalDays>365) return 'Choose a whole number of days from 1 to 365.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.startDate || '') || !Number.isFinite(new Date(`${plan.startDate}T12:00:00`).getTime())) return 'Choose the first check-in date.';
  const fields=plan.fields.filter(f=>f.enabled);
  if (!fields.length) return 'Choose at least one field for this client.';
  if (new Set(plan.fields.map(f=>f.id)).size!==plan.fields.length) return 'Each question needs a unique identifier.';
  for (const f of fields) {
    if (!f.label.trim() || f.label.length>100) return 'Give every enabled field a label of 1–100 characters.';
    if (f.type==='number' && (!Number.isFinite(Number(f.min)) || !Number.isFinite(Number(f.max)) || Number(f.max)<=Number(f.min))) return `${f.label}: the maximum must be greater than the minimum.`;
  }
  return '';
}
export function saveCheckin(data,client,row) {
  if(row.clientId!==client.id)throw new Error('This check-in belongs to a different client.');
  const error=checkinError(row.schema,row.answers);
  if (error) throw new Error(error);
  const answers=Object.fromEntries(row.schema.map(f=>[f.id,hasAnswer(row.answers[f.id]) && ['number','rating'].includes(f.type)?Number(row.answers[f.id]):row.answers[f.id] ?? '']));
  const record={...row,answers,reviewed:false,submittedAt:new Date().toISOString()};
  record.scores=Object.fromEntries(row.schema.filter(f=>f.legacyKey && hasAnswer(answers[f.id])).map(f=>[f.legacyKey,answers[f.id]]));
  for (const key of ['wins','struggles','note','photos']) record[key]=answers[key] ?? (key==='photos'?[]:'');
  const index=data.checkins.findIndex(r=>r.id===row.id);
  if(index<0)data.checkins.push(record);else data.checkins[index]=record;
  const fields=row.schema.filter(f=>f.measurementKey);
  let measurement=data.measurements.find(m=>m.clientId===client.id && m.date===row.date);
  if (!measurement && fields.some(f=>hasAnswer(answers[f.id]))) { measurement={id:uid(),clientId:client.id,date:row.date};data.measurements.push(measurement); }
  if(measurement) {
    measurement.checkinFields ??= {};
    for(const f of fields) {
      if(hasAnswer(answers[f.id])) { measurement[f.measurementKey]=Number(answers[f.id]);measurement.checkinFields[f.measurementKey]=row.id; }
      else if(measurement.checkinFields[f.measurementKey]===row.id) { measurement[f.measurementKey]=null;delete measurement.checkinFields[f.measurementKey]; }
    }
  }
  return record;
}
export function trendFields(client,rows) {
  const fields=[...rows.flatMap(schemaFor),...checkinPlanFor(client).fields].filter(f=>['number','rating'].includes(f.type));
  return [...new Map(fields.map(f=>[`${f.id}|${f.type}|${f.unit || ''}`,{...f,seriesKey:`${f.id}|${f.type}|${f.unit || ''}`}])).values()];
}
export function checkinTrend(data,clientId,field) {
  const points=new Map();
  if(field.measurementKey && CHECKIN_FIELDS.find(f=>f.measurementKey===field.measurementKey)?.unit===(field.unit || '')) for(const m of data.measurements.filter(m=>m.clientId===clientId)) if(hasAnswer(m[field.measurementKey]) && Number.isFinite(Number(m[field.measurementKey]))) points.set(m.date,{date:m.date,value:Number(m[field.measurementKey]),source:'Measurement log'});
  for(const row of data.checkins.filter(r=>r.clientId===clientId)) {
    const saved=schemaFor(row).find(f=>f.id===field.id && f.type===field.type && (f.unit || '')===(field.unit || ''));
    const value=saved?answerFor(row,saved):'';
    if(hasAnswer(value) && Number.isFinite(Number(value))) points.set(row.date,{date:row.date,value:Number(value),source:'Check-in'});
  }
  return [...points.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
