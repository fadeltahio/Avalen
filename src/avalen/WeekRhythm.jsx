import React, {useMemo} from 'react';
import {Check} from 'lucide-react';
import {useApp} from './context.js';
import {dayKey, offsetDay, dateOf, scheduleDay} from './store.js';

import { t, locale } from './i18n.js';
// The week reflects prescriptions and records, never an inferred activity score.
export function WeekRhythm({start}) {
  const {data, client, openTrainingDate}=useApp();
  const today=dayKey();
  const days=useMemo(()=>{
    const weekday=new Intl.DateTimeFormat(locale(),{weekday:'short'}), fullDate=new Intl.DateTimeFormat(locale(),{weekday:'long',month:'long',day:'numeric'});
    return Array.from({length:7},(_,index)=>{const date=offsetDay(index,start), value=dateOf(date);return {date,label:fullDate.format(value),weekday:weekday.format(value),number:value.getDate()};});
  },[start]);
  const first=dateOf(days[0].date), last=dateOf(days[6].date);
  const span=first.getMonth()===last.getMonth()?last.toLocaleDateString(locale(),{month:'long',year:'numeric'}):`${first.toLocaleDateString(locale(),{month:'short'})} – ${last.toLocaleDateString(locale(),{month:'short',year:'numeric'})}`;
  return <><p className="calendar-month">{span}</p><div className="week-rhythm" role="group" aria-label={t('Your training week')}>{days.map(({date,label,weekday,number})=>{
    const day=scheduleDay(client,date), completed=data.sessions.some(session=>session.clientId===client.id && session.date===date);
    const status=completed?t('Completed'):day?date<today?t('Not logged'):t('Planned'):t('Recovery');
    return <button key={date} className={completed?'is-complete':day?'is-planned':'is-recovery'} aria-current={date===today?'date':undefined} aria-label={`${label} · ${day?.name ? t(day.name) : t('Recovery')} · ${status}`} onClick={()=>openTrainingDate(date)}><small>{weekday}</small><span>{completed?<Check size={17}/>:number}</span><i aria-hidden="true"/></button>;
  })}</div></>;
}
