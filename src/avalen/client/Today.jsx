// An older home screen, kept for reference. It is not rendered anywhere: the
// "today" route renders EditorialHome (see editorial.jsx) instead. Exported in
// case something still depends on it; safe to delete if nothing does.
import { useApp } from '../context.js';
import { useState } from 'react';
import { Dumbbell, ChevronRight, Check, Clock3, Footprints, Lock, ArrowRight, Share2, MessageCircle, Flame, Plus } from 'lucide-react';
import { dayKey, offsetDay, scheduleDay, shortDate, sum, useFile } from '../store.js';
import { groupLabel } from '../exercise-catalogue.js';
import { exerciseImage } from '../ExerciseMedia.jsx';
import trainingPortrait from '../../assets/campaign-athlete.webp';
import recoveryCover from '../../assets/share-recovery-v2.jpg';
import { Hydration } from '../ReferenceMotion.jsx';
import { ResumeWorkout } from '../resume.jsx';
import { Avatar, Button, Calendar, Meter, SectionHead } from '../ui.jsx';
import { t } from '../i18n.js';

export function Today() {
  const { data, client, navigate, openWorkout, openShare, ask } = useApp();
  const [date, setDate] = useState(dayKey());
  const day = scheduleDay(client, date);
  const coverUrl = useFile(day?.coverFile?.id);
  const completed = data.sessions.find(s => s.clientId === client.id && s.date === date);
  const future = date > dayKey();
  const foods = data.foodLogs.filter(x => x.clientId === client.id && x.date === date);
  const values = data.habitLogs.find(x => x.clientId === client.id && x.date === date)?.values || {};
  const kcal = sum(foods, 'kcal'), protein = sum(foods, 'p');
  const coachMessage = data.messages.filter(m => m.clientId === client.id && m.from === 'coach').slice(-1)[0];
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const isToday = date === dayKey();
  const weekStart = offsetDay(-((new Date().getDay() + 6) % 7));
  const weekDays = Array.from({length: 7}, (_, i) => offsetDay(i, weekStart));
  const weekSessions = data.sessions.filter(s => s.clientId === client.id && weekDays.includes(s.date));
  const plannedSessions = weekDays.filter(d => scheduleDay(client, d)).length;
  const weekVolume = sum(weekSessions.flatMap(s => s.sets), s => !s.skipped && s.kind !== 'Duration' ? Number(s.weight || 0) * Number(s.reps || 0) : 0);
  const muscles = [...new Set((day?.exercises || []).map(e => e.group).filter(Boolean))];
  return (
    <>
      <div className="today-intro">
        <div>
          <span className="eyebrow"><Dumbbell size={12}/>{data.coach.brand} {t('· YOUR TRAINING')}</span>
          <h1>{greeting},<br/><em>{client.name.split(' ')[0]}.</em></h1>
          <p>{t(client.program.name)} <span> / </span> {client.program.phase}</p>
        </div>
      </div>
      <div className="today-layout">
        <div className="today-main">
          <div className="section-head home-section-head"><h2>{t('Training plan')}</h2><button className="text-link" onClick={() => navigate('plan', 'Training')}>{t('View plan')} <ChevronRight size={14}/></button></div>
          <div className="training-week-summary" aria-label={t('Training this week')}><span>{t('THIS WEEK')}</span><b>{weekSessions.length}{plannedSessions > 0 && <small> / {plannedSessions}</small>} <small>{t('sessions')}</small></b><div className="week-track" aria-hidden="true">{Array.from({length: Math.max(plannedSessions, weekSessions.length)}, (_, i) => <i key={i} className={i < weekSessions.length ? 'complete' : ''}/>)}</div></div>
          <Calendar selected={date} onChange={setDate} client={client} sessions={data.sessions}/>
          {isToday && data.drafts[client.id] ? <ResumeWorkout /> : (
            <section id="training-session" className={`workout-hero card ${completed ? 'done' : ''}`} style={{backgroundImage: `url(${coverUrl || (day ? trainingPortrait : recoveryCover)})`}}>
              <div className="session-photo" aria-hidden="true"><img src={coverUrl || (day ? trainingPortrait : recoveryCover)} alt=""/></div>
              <div className="workout-card-top"><span>{isToday ? t('TODAY’S SESSION') : shortDate(date)}</span><span className="workout-tag">{completed ? <><Check size={12}/>{t('Completed')}</> : day ? <><Dumbbell size={12}/>{t('Workout')}</> : t('Recovery')}</span></div>
              <h2>{day?.name || t('Space to recover.')}</h2>
              {muscles.length > 0 && <div className="muscle-tags" aria-label={t('Muscle groups')}>{muscles.map(group => <span key={group}>{groupLabel(group)}</span>)}</div>}
              <div className="session-details">{day ? <><span><Clock3 size={13}/>{completed ? Math.round(completed.duration / 60) : day.minutes} {t('min')}</span><span><Dumbbell size={13}/>{day.exercises.length} {t('exercises')}</span><span>{completed ? t('{length} sets logged', { length: completed.sets.filter(x => !x.skipped).length }) : t('{sum} working sets', { sum: sum(day.exercises, e => Number(e.sets)) })}</span></> : <span>{t('Rest well. Come back stronger.')}</span>}</div>
              {completed ? <Button onClick={() => openShare(completed)}>{t('Workout complete')} <Share2 size={16}/></Button> : day ? (
                <Button disabled={future || date < dayKey()} onClick={() => openWorkout(day, date)}>{future ? <><Lock size={15}/>{t('Scheduled for')} {shortDate(date)}</> : date < dayKey() ? t('Not logged') : t('Start Workout')}{!future && <ArrowRight size={17}/>}</Button>
              ) : <Button onClick={() => navigate('plan','Habits')}>{t('View recovery habits')} <ArrowRight size={16}/></Button>}
            </section>
          )}
          <section className="next-training" aria-label={t('Upcoming training')}>
            <SectionHead title={t('Your next sessions')} action={<button className="text-link" onClick={() => navigate('plan', 'Training')}>{t('Explore all')} <ChevronRight size={14}/></button>}/>
            <div className="session-carousel">{client.program.days.filter(d => d.id !== day?.id).slice(0,2).map((d, i) => {
              const next = client.schedule.find(s => s.dayId === d.id && s.date >= dayKey());
              return <SessionPreview key={d.id} number={i + 1} day={d} next={next} onSelect={() => { if (!next) return; setDate(next.date); window.scrollTo({top:0,behavior:data.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}); }}/>
            })}</div>
          </section>
          <button className="programme-link-row" aria-label={t('View programme')} onClick={() => navigate('plan','Training')}><span><b>{t(client.program.name)}</b><small>{t('{weeks} weeks · {phase}', { weeks: client.program.weeks, phase: client.program.phase })}</small></span><ArrowRight size={20}/></button>
          <section className="daily-summary" aria-label={t('Daily activity')}>
            <div><Dumbbell size={17}/><span><b>{Math.round(weekVolume).toLocaleString()}<em> kg</em></b><small>{t('volume lifted this week')}</small></span></div>
            <div><Footprints size={17}/><span><b>{(values.steps || 0).toLocaleString()}</b><small>{isToday ? t('steps today') : t('steps logged')}</small></span></div>
            <button aria-label={t('Update daily habits')} onClick={() => navigate('plan','Habits')}><ArrowRight size={18}/></button>
          </section>
          <section className="coach-note card">
            <div className="coach-note-heading"><Avatar name={data.coach.name}/><span><b>{t(data.coach.name)}</b><small>{t('Your coach')}</small></span><MessageCircle size={18}/></div>
            <h2>{coachMessage ? t('A note from your coach.') : t('Let’s check in.')}</h2>
            <p>{coachMessage ? coachMessage.text.slice(0, 180) + (coachMessage.text.length > 180 ? '…' : '') : t('Share how training is feeling and get help with your plan.')}</p>
            <div className="coach-note-actions"><button className="text-link" onClick={() => ask('Today’s training', 'How I’m feeling today: ')}>{t('Message your coach')} <ArrowRight size={15}/></button><button className="text-link" onClick={() => navigate('coach','Check-in')}>{t('Weekly Check-in')} <ChevronRight size={14}/></button></div>
          </section>
        </div>
        <div className="today-side">
          <div className="section-head home-section-head"><h2>{t('Your daily balance')}</h2><span className="muted">{isToday ? t('Today') : shortDate(date)}</span></div>
          <section className="card daily-nutrition" aria-label={t('Nutrition summary')}>
            <div className="balance-heading"><span className="balance-icon"><Flame size={18}/></span><h2>{t('Training fuel')}</h2><button className="icon-btn" aria-label={t('Open nutrition diary')} onClick={() => navigate('plan','Nutrition')}><ArrowRight size={18}/></button></div>
            <div className="fuel-total"><strong>{kcal.toLocaleString()}</strong><span>{t('of {value} kcal', { value: client.nutrition.kcal.toLocaleString() })}</span></div>
            <Meter value={kcal} target={client.nutrition.kcal}/>
            <div className="protein-summary"><span>{t('Protein')}</span><b>{protein} <small>{t('/ {p} g', { p: client.nutrition.p })}</small></b></div>
            <Meter value={protein} target={client.nutrition.p}/>
            <button className="nutrition-diary-link" onClick={() => navigate('plan','Nutrition')}>{t('Open food diary')} <Plus size={16}/></button>
          </section>
          {client.habits.some(h => h.id === 'water') && <Hydration date={date} compact/>}
        </div>
      </div>
    </>
  );
}


function SessionPreview({ day, next, onSelect, number }) {
  const coverUrl = useFile(day.coverFile?.id);
  return <button className="session-preview" disabled={!next} aria-label={t('Preview {name}', { name: day.name })} onClick={onSelect}>
    <img src={coverUrl || (day.exercises[0] ? exerciseImage(day.exercises[0]) : recoveryCover)} alt=""/>
    <span className="preview-number">{String(number).padStart(2,'0')}</span><span className="preview-tags"><span><Clock3 size={11}/>{day.minutes} {t('min')}</span><span>{next ? shortDate(next.date) : t('Unscheduled')}</span></span>
    <span className="preview-title">{t(day.name)}<ArrowRight size={14}/></span>
    <span className="preview-prescription">{t('{length} exercises · {sum} sets', { length: day.exercises.length, sum: sum(day.exercises, e => Number(e.sets)) })}</span>
  </button>;
}

