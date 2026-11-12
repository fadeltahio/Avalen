import React, {useMemo} from 'react';
import {Check} from 'lucide-react';
import {useApp} from './context.js';
import {dayKey, offsetDay, dateOf, scheduleDay} from './store.js';

// The week reflects prescriptions and records, never an inferred activity score.
export function WeekRhythm({start}) {
  const {data, client, openTrainingDate}=useApp();
  const today=dayKey();
  const days=useMemo(()=>{
    const weekday=new Intl.DateTimeFormat('en',{weekday:'short'}), fullDate=new Intl.DateTimeFormat('en',{weekday:'long',month:'long',day:'numeric'});
    return Array.from({length:7},(_,index)=>{const date=offsetDay(index,start), value=dateOf(date);return {date,label:fullDate.format(value),weekday:weekday.format(value),number:value.getDate()};});
  },[start]);
  const first=dateOf(days[0].date), last=dateOf(days[6].date);
  const span=first.getMonth()===last.getMonth()?last.toLocaleDateString('en',{month:'long',year:'numeric'}):`${first.toLocaleDateString('en',{month:'short'})} – ${last.toLocaleDateString('en',{month:'short',year:'numeric'})}`;
  return <><p className="calendar-month">{span}</p><div className="week-rhythm" role="group" aria-label="Your training week">{days.map(({date,label,weekday,number})=>{
    const day=scheduleDay(client,date), completed=data.sessions.some(session=>session.clientId===client.id && session.date===date);
    const status=completed?'Completed':day?date<today?'Not logged':'Planned':'Recovery';
    return <button key={date} className={completed?'is-complete':day?'is-planned':'is-recovery'} aria-current={date===today?'date':undefined} aria-label={`${label} · ${day?.name || 'Recovery'} · ${status}`} onClick={()=>openTrainingDate(date)}><small>{weekday}</small><span>{completed?<Check size={17}/>:number}</span><i aria-hidden="true"/></button>;
  })}</div></>;
}
