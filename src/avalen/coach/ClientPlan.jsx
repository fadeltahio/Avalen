// A client's plan tab: their programme, schedule and daily habits.
import { useState } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { MotionDetails } from '../motion.jsx';
import { useApp } from '../context.js';
import { shortDate } from '../store.js';
import { Button, Tabs } from '../ui.jsx';
import { t } from '../i18n.js';
import { ProgressionSuggestions, HabitEditor } from '../insights.jsx';
import { SmartSchedule } from '../ecosystem/scheduling.jsx';
import { ScheduleEditor } from './ScheduleEditor.jsx';
import { TravelPlan } from './TravelPlan.jsx';

export function ClientPlan({client, onEdit}) {
  const {data, subtab, setSubtab} = useApp();
  const pending = (data.scheduleProposals || []).filter(row => row.clientId === client.id && row.status === 'pending').length;
  const [initialTab] = useState(pending ? 'Schedule' : 'Programme');
  const tab = ['Programme', 'Schedule', 'Habits'].includes(subtab) ? subtab : initialTab;
  return <div className="coach-plan-workspace">
    <Tabs label={t('Plan tools')} items={['Programme', ['Schedule', `Schedule${pending ? ` · ${pending} to review` : ''}`], 'Habits']} value={tab} onChange={setSubtab}/>
    {tab === 'Programme' && <>
      <section className="card"><span className="eyebrow">{client.program.phase}</span><h2>{t(client.program.name)}</h2><p>{t('{weeks} weeks · ends {shortDate}', { weeks: client.program.weeks, shortDate: shortDate(client.programEnd) })}</p><Button onClick={onEdit}>{t('Edit programme')} <ArrowRight size={17}/></Button></section>
      <div className="coach-programme-days">{client.program.days.map(day => <MotionDetails key={day.id}><summary><span><b>{t(day.name)}</b><small>{t('{length} exercises · {minutes} min', { length: day.exercises.length, minutes: day.minutes })}</small></span><ChevronRight size={18}/></summary>{day.exercises.map(exercise => <div className="simple-row" key={exercise.id}><span><b>{t(exercise.name)}</b><small>{exercise.sets} × {exercise.reps}{exercise.kind === 'Duration' ? ' sec' : ' reps'} · {exercise.weight} {t('kg ·')} {exercise.rest}{t('s rest')}</small></span></div>)}</MotionDetails>)}</div>
      <ProgressionSuggestions client={client}/>
    </>}
    {tab === 'Schedule' && <><SmartSchedule client={client} coach/><ScheduleEditor client={client}/><TravelPlan client={client}/></>}
    {tab === 'Habits' && <HabitEditor key={client.id} client={client}/>}
  </div>;
}

