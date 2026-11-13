import { MotionNumber, WeeklyProgress, motionReduced } from './motion.jsx';
import { PaymentDueNotice } from './payments.jsx';
import { WeekRhythm } from './WeekRhythm.jsx';
import { checkinSchedule } from './checkin-model.js';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, Dumbbell, Footprints, MessageCircle, Play, Search, Share2, Star, Target } from 'lucide-react';
import { useApp } from './context.js';
import { dayKey, download, historyFor, offsetDay, scheduleDay, shortDate, sum, useFile } from './store.js';
import { bootWait, leaveBoot, nameBoot } from './BrandMark.jsx';
import { Avatar, Button, Empty, Field, IconButton, Modal } from './ui.jsx';
import { ResumeWorkout } from './resume.jsx';
import {CoachNutritionHome} from './nutrition-home.jsx';
import {RecoveryMap} from './RecoveryMap.jsx';
import {ClientWearableHome} from './wearables.jsx';
import {CLIENT_WIDGETS, resolveLayout} from './home-layout.js';
import {formatDate, matchesSearch, t} from './i18n.js';
import {groupLabel} from './exercise-catalogue.js';
import {CustomiseHome, EditHomeButton} from './HomeEditor.jsx';
import {ExerciseThumbnail, FoodLogger} from './client.jsx';
import {PhotoMealLogger} from './meal-photo.jsx';
import {CoachingUpdates} from './ecosystem/updates.jsx';
import recovery from '../assets/cover-recovery.webp';
import lowerStrength from '../assets/cover-lower-strength.webp';
import conditioning from '../assets/cover-conditioning.webp';

let connectedHero = null;

export function sessionCategory(day) {
  const name = `${day?.category || ''} ${day?.name || ''}`.toLowerCase();
  if (/movement|pilates|yoga|mobility/.test(name)) return 'Movement';
  if (/conditioning|cardio|running/.test(name)) return 'Conditioning';
  return 'Strength';
}
export function sessionPhoto(day) {
  if (!day) return recovery;
  const category = sessionCategory(day);
  if (category === 'Movement') return '/design/campaign-movement-v2.webp';
  if (category === 'Conditioning') return conditioning;
  return day.exercises.some(e => ['Legs', 'Hamstrings', 'Calves'].includes(e.group)) ? lowerStrength : '/design/campaign-strength-v2.webp';
}

export function Splash({ onLift, onDone, preview = false }) {
  const [lifting, setLifting] = useState(false);
  function lift() {
    leaveBoot();
    if (motionReduced()) { onDone(); return; }
    setLifting(true);
    onLift();
    setTimeout(onDone, 400);
  }
  useEffect(() => {
    if (preview) return;
    document.fonts?.load('750 30px Manrope').catch(() => {});
    const timers = [setTimeout(() => {
      timers.push(nameBoot() ? setTimeout(lift, motionReduced() ? 700 : 1500) : setTimeout(lift, 0));
    }, bootWait())];
    return () => timers.forEach(clearTimeout);
  }, [preview]);
  return <button className={`brand-splash ${lifting ? 'is-lifting' : ''}`} onClick={lifting ? undefined : lift} aria-label={t('Enter Avalen')}/>;
}

function Goal({ title, value, target, unit, onClick }) {
  const n = Math.min(7, Math.max(1, target));
  return <button className="editorial-goal" onClick={onClick}>
    <span>{title}<ChevronRight size={14}/></span>
    <div className="editorial-goal-track" aria-hidden="true">{Array.from({length:n}, (_, i) => <i key={i} className={target > 0 && i < Math.floor(value / target * n) ? 'filled' : ''}/>)}</div>
    <small>{value.toLocaleString()}{target > 0 ? ` / ${target.toLocaleString()}` : ''} {unit}</small>
  </button>;
}

export function SessionCard({ day, date, index = 0, onSelect, saved = false }) {
  const cover = useFile(day.coverFile?.id);
  return <button className="editorial-session" aria-label={t('View {name}', {name: day.name})} onClick={event => { document.querySelectorAll('[data-session-hero]').forEach(el => { el.style.viewTransitionName = 'none'; }); const image = event.currentTarget.querySelector('img'); if (image) { image.style.viewTransitionName = 'session-hero'; image.dataset.sessionSource = day.id; connectedHero = `${day.id}:${date}`; } onSelect(); }}>
    <span className="session-vertical">{date === dayKey() ? t('TODAY’S SESSION') : t('YOUR PROGRAMME')}</span>
    <span className="editorial-session-photo"><img data-session-hero="" style={{viewTransitionName: connectedHero === `${day.id}:${date}` ? 'session-hero' : undefined}} src={cover || sessionPhoto(day)} alt="" loading={index ? 'lazy' : 'eager'}/>{saved && <Star className="session-saved" size={17} fill="currentColor"/>}</span>
    <span className="editorial-session-title">{t(day.name)}</span>
    <span className="editorial-session-meta"><span>{sessionCategory(day)}</span><i/> {day.exercises.length} {t('exercises')}</span>
    <span className="editorial-session-duration">{day.minutes} {t('mins')}{date && date !== dayKey() && <> · {shortDate(date)}</>}</span>
  </button>;
}

export function EditorialHome() {
  const { data, client, navigate, viewSession, openWorkout, openShare, ask, intakeDue, openIntake } = useApp();
  const [mealEntry,setMealEntry]=useState(null), [plannedMeal, setPlannedMeal] = useState(null), [editingHome, setEditingHome] = useState(false);
  const today = dayKey(), day = scheduleDay(client, today);
  const weekStart = offsetDay(-((new Date().getDay() + 6) % 7));
  const weekEnd = offsetDay(6, weekStart);
  const weekSessions = data.sessions.filter(s => s.clientId === client.id && s.date >= weekStart && s.date <= weekEnd);
  const planned = client.schedule.filter(s => s.date >= weekStart && s.date <= weekEnd && client.program.days.some(d => d.id === s.dayId)).length;
  const values = data.habitLogs.find(h => h.clientId === client.id && h.date === today)?.values || {};
  const upcoming = client.schedule.filter(s => s.date > today).sort((a,b) => a.date.localeCompare(b.date));
  const seen = new Set();
  const sessions = upcoming.flatMap(s => {
    const d = scheduleDay(client, s.date);
    if (!d || seen.has(d.id)) return [];
    seen.add(d.id); return [{ day:d, date:s.date }];
  }).slice(0, 3);
  const checkinDue = checkinSchedule(client,data.checkins);
  const habitsDone = client.habits.filter(habit => Number(habit.target) > 0 && Number(values[habit.id] || 0) >= Number(habit.target)).length;
  const todayCover = useFile(day?.coverFile?.id);
  const completedToday = data.sessions.find(s => s.clientId === client.id && s.date === today);
  const coachMessage = data.messages.filter(m => m.clientId === client.id && m.from === 'coach').at(-1);
  const homeWidgets = {
    session: <>
    {!data.drafts[client.id] && <section className={`home-today-session ${completedToday ? 'is-complete' : day ? 'is-planned' : 'is-recovery'}`} aria-label={t('Today’s plan')}>
      <img data-session-hero="" style={{viewTransitionName: connectedHero === `${day?.id}:${today}` ? 'session-hero' : undefined}} src={todayCover || sessionPhoto(day)} alt=""/>
      <div className="home-today-content"><span className="eyebrow">{completedToday ? t('TODAY · COMPLETE') : day ? t('TODAY’S SESSION') : t('TODAY · RECOVERY')}</span><h2>{day?.name || t('Room to recover.')}</h2><p>{day ? `${t('{count} min', {count: day.minutes})} · ${t('{count} exercises', {count: day.exercises.length})} · ${t(sessionCategory(day))}` : t('Your next session is coming. Keep your recovery habits in reach.')}</p>
      <div>{day ? <><Button onClick={() => completedToday ? openShare(completedToday) : openWorkout(day,today)}>{completedToday ? t('View workout result') : t('Start Workout')}<ArrowRight size={18}/></Button><button className="hero-detail" aria-label={t('View {name}', {name: day.name})} onClick={event => { document.querySelectorAll('[data-session-hero]').forEach(el => { el.style.viewTransitionName = 'none'; }); const image = event.currentTarget.closest('section').querySelector('img'); image.style.viewTransitionName = 'session-hero'; image.dataset.sessionSource = day.id; connectedHero = `${day.id}:${today}`; viewSession(day,today); }}>{t('Session details')}</button></> : <Button onClick={() => navigate('plan','Habits')}>{t('Recovery habits')} <ArrowRight size={18}/></Button>}</div></div>
    </section>}
    </>,
    essentials: <section className="home-essentials" aria-label={t('Daily essentials')}><button className={checkinDue.due ? 'is-due' : ''} onClick={() => navigate('coach', 'Check-in')}><CalendarDays size={19}/><span><b>{t('Check-in')}</b><small>{checkinDue.overdue ? t('Overdue · send your update') : checkinDue.due ? t('Due today') : t('Next {date}', {date: shortDate(checkinDue.dueDate)})}</small></span><ChevronRight size={16}/></button><button onClick={() => navigate('plan', 'Habits')}><Footprints size={19}/><span><b>{t('Daily habits')}</b><small>{client.habits.length ? t('{done} of {count} targets reached', {done: habitsDone, count: client.habits.length}) : t('View recovery habits')}</small></span><ChevronRight size={16}/></button></section>,
    wearables: <ClientWearableHome/>,
    recovery: <RecoveryMap compact clientId={client.id} day={completedToday ? null : day} onOpen={() => navigate('progress','Recovery')}/>,
    nutrition: <CoachNutritionHome onPhoto={()=>setMealEntry('photo')} onAdd={()=>setMealEntry('food')} onPlanMeal={setPlannedMeal}/>,
    updates: <div className="home-coaching-updates"><CoachingUpdates/></div>,
    training: <>
    <div className="home-training-section"><div className="home-training-heading"><div><span className="eyebrow">{t('YOUR COACH’S PROGRAMME')}</span><h2>{t('Up next.')}</h2></div><button aria-label={t('Open training plan')} onClick={()=>navigate('plan','Training')}><ArrowRight size={20}/></button></div>
    <div className="home-training-summary"><span>{t(client.program.name)}</span><span><MotionNumber value={weekSessions.length} identity="week-sessions"/> / {t('{count} sessions this week', {count: planned})}</span></div>
    <WeeklyProgress value={weekSessions.length} target={planned} identity={`weekly:${weekStart}`}/>
    <WeekRhythm start={weekStart}/>
    {sessions.length ? <section className="editorial-session-grid essential-upcoming" aria-label={t('Your training sessions')}>{sessions.slice(0,2).map((s, i) => <SessionCard key={s.day.id} {...s} index={i} saved={Boolean(client.savedSessions?.includes(s.day.id))} onSelect={() => viewSession(s.day, s.date)}/>)}</section> : <Empty icon={Dumbbell} title={t('Room for your next chapter.')} detail={t('Your coach will add your next training sessions here.')} action={<Button onClick={() => ask('My training plan')}>{t('Ask your coach')} <ArrowRight size={17}/></Button>}/>}
    </div>
    </>,
    coach: <section className="editorial-coach-note"><span className="eyebrow">{t('IN YOUR CORNER')}</span><div><Avatar name={data.coach.name}/><span><b>{t(data.coach.name)}</b><small>{t('Your coach')}</small></span><MessageCircle size={20}/></div><p>{coachMessage?.text || t('A plan built around you. Talk to your coach about your next session, your progress, or how you’re feeling.')}</p><button className="text-link" onClick={() => navigate('coach','Messages')}>{t('Open conversation')} <ArrowRight size={16}/></button></section>,
  };
  return <div className="editorial-home">
    <div className="home-greeting"><p>{formatDate(new Date(), {weekday:'long',day:'numeric',month:'long'}).toUpperCase()}</p><h1>{t('Make it count,')}<br/><span>{client.name.split(' ')[0]}.</span></h1><div><span className="home-coach-dot"/>{t('Your coach. Your plan. Your pace.')}</div></div>
    <PaymentDueNotice/>
    {intakeDue && <button className="intake-prompt" onClick={openIntake}><span><b>{t('Tell {name} about you', {name: data.coach.name.split(' ')[0]})}</b><small>{t('8 quick questions, about a minute')}</small></span><ArrowRight size={18}/></button>}
    {data.drafts[client.id] && <div className="editorial-resume home-priority"><ResumeWorkout compact/></div>}
    {resolveLayout(client.homeLayout, CLIENT_WIDGETS).filter((w) => w.visible).map((w) => <React.Fragment key={w.id}>{homeWidgets[w.id]}</React.Fragment>)}
    <EditHomeButton onClick={() => setEditingHome(true)}/>
    {editingHome && <CustomiseHome widgets={CLIENT_WIDGETS} saved={client.homeLayout} role="client" onClose={() => setEditingHome(false)} write={(d, layout) => { const c = d.clients.find((x) => x.id === client.id); if (layout) c.homeLayout = layout; else delete c.homeLayout; }}/>}
    {mealEntry === 'photo' && <PhotoMealLogger onClose={()=>setMealEntry(null)}/>}
    {mealEntry === 'food' && <FoodLogger date={today} onClose={()=>setMealEntry(null)}/>}
    {plannedMeal && <PhotoMealLogger initialMeal={plannedMeal} requirePhoto={false} onClose={() => setPlannedMeal(null)}/>}
  </div>;
}

export function SessionSearch({ onClose }) {
  const { client, viewSession } = useApp();
  const [query, setQuery] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const results = client.program.days.filter(d => (!savedOnly || client.savedSessions?.includes(d.id)) && matchesSearch(query, [d.name, ...d.exercises.flatMap(e => [e.name, e.group])]));
  return <Modal title={t('Find your next session')} onClose={onClose}>
    <Field label={t('Search sessions')}><input type="search" autoFocus placeholder={t('Workout, exercise or muscle group')} value={query} onChange={e => setQuery(e.target.value)}/></Field>
    <button className={`search-saved ${savedOnly ? 'selected' : ''}`} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}><Star size={16}/>{t('Saved sessions')}</button>
    <div className="session-search-results">{results.map(d => {
      const next = client.schedule.filter(s => s.dayId === d.id && s.date >= dayKey()).sort((a,b) => a.date.localeCompare(b.date))[0];
      return <button key={d.id} onClick={() => { onClose(); viewSession(d, next?.date); }}><img src={sessionPhoto(d)} alt=""/><span><b>{t(d.name)}</b><small>{t('{minutes} mins · {length} exercises', { minutes: d.minutes, length: d.exercises.length })}</small></span><ChevronRight size={18}/></button>;
    })}</div>
    {!results.length && <Empty icon={Search} title={savedOnly ? t('No saved sessions yet.') : t('No sessions found.')} detail={savedOnly ? t('Tap the star on a session to keep it here.') : t('Try a workout name or a muscle group.')}/>}
  </Modal>;
}

function calendarFile(day, date, coach) {
  const clean = value => String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  // A date-only event preserves the coach's scheduled day in every timezone.
  const end = offsetDay(1, date).replaceAll('-','');
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Avalen//Training//EN','BEGIN:VEVENT',`UID:${day.id}-${date}@avalen.local`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${date.replaceAll('-','')}`,`DTEND;VALUE=DATE:${end}`,`SUMMARY:${clean(day.name)}`,`DESCRIPTION:${clean(`${day.minutes} min training with ${coach}. ${day.exercises.length} exercises.`)}`,'END:VEVENT','END:VCALENDAR'];
  download(new Blob([lines.join('\r\n')+'\r\n'], { type:'text/calendar;charset=utf-8' }), 'avalen-session.ics');
}

function SessionExercise({ exercise }) {
  const { data, client, openExercise } = useApp();
  const [open, setOpen] = useState(false);
  const duration = exercise.kind === 'Duration';
  const last = open ? historyFor(data, client.id, exercise.name) : [];
  return <div className={`session-exercise ${open ? 'is-open' : ''}`}>
    <button type="button" className="session-exercise-row" aria-expanded={open} onClick={() => setOpen(!open)}><ExerciseThumbnail exercise={exercise}/><span><b>{t(exercise.name)}</b><small>{groupLabel(exercise.group)} · {t(duration ? '{sets} × {reps} sec' : '{sets} × {reps} reps', {sets: exercise.sets, reps: exercise.reps})}</small></span><ChevronDown size={18}/></button>
    <div className="session-exercise-panel" inert={!open}><div>
      <ol className="session-exercise-sets">{Array.from({length: Number(exercise.sets)}, (_, index) => <li key={index}><span>{index + 1}</span><span>{duration ? t('{count} sec', { count: exercise.reps }) : t('{count} reps', { count: exercise.reps })}</span><span>{last[index] ? (duration ? t('Last {seconds} sec', { seconds: last[index].reps }) : t('Last {weight} kg × {reps}', { weight: last[index].weight, reps: last[index].reps })) : ''}</span></li>)}</ol>
      <div className="session-exercise-more"><span><Clock3 size={13}/> {exercise.rest}{t('s rest')}</span><button type="button" className="text-link" onClick={() => openExercise(exercise.name)}>{t('Exercise details')}<ChevronRight size={14}/></button></div>
    </div></div>
  </div>;
}

export function SessionDetail({ session, onBack }) {
  const { data, client, update, openWorkout, openShare, resumeWorkout } = useApp();
  const { day, date } = session;
  const cover = useFile(day.coverFile?.id);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const completed = data.sessions.find(s => s.clientId === client.id && s.date === date);
  const saved = Boolean(client.savedSessions?.includes(day.id));
  const isToday = date === dayKey();
  const hasDraft = data.drafts[client.id]?.dayId === day.id && data.drafts[client.id]?.date === date;
  const otherDraft = Boolean(data.drafts[client.id]) && !hasDraft;
  function toggleSaved() {
    update(d => { const c = d.clients.find(c => c.id === client.id); c.savedSessions = saved ? c.savedSessions.filter(id => id !== day.id) : [...(c.savedSessions || []), day.id]; });
  }
  return <article className="session-detail">
    <div className="session-detail-image"><img style={{viewTransitionName: 'session-hero'}} src={cover || sessionPhoto(day)} alt={t('{name} training', { name: day.name })}/><div className="session-detail-toolbar"><IconButton label={t('Back to sessions')} onClick={onBack}><ArrowLeft size={26}/></IconButton><div><IconButton label={t('Share session')} onClick={() => setShareOpen(true)}><Share2 size={23}/></IconButton><IconButton label={saved ? t('Unsave session') : t('Save session')} aria-pressed={saved} onClick={toggleSaved}><Star size={24} fill={saved ? 'currentColor' : 'none'}/></IconButton></div></div><span className="session-detail-time">{String(day.minutes).padStart(2,'0')}:00</span></div>
    <div className="session-detail-copy"><p className="eyebrow">{t('YOUR COACH’S PROGRAMME')}{date ? ` · ${isToday ? 'TODAY' : shortDate(date).toUpperCase()}` : ''}</p><h1>{t(day.name)}</h1><div className="session-detail-coach"><Avatar name={data.coach.name}/><span>{t(data.coach.name)}</span></div>
      <div className="session-detail-facts"><div><Dumbbell size={23}/><span>{sessionCategory(day)}</span></div><div><Target size={23}/><span>{t('{length} exercises · {sum} working sets', { length: day.exercises.length, sum: sum(day.exercises,e => Number(e.sets)) })}</span></div></div>
      <div className="session-detail-actions"><Button secondary disabled={!date} onClick={() => { calendarFile(day,date,data.coach.name); setCalendarAdded(true); }}><CalendarDays size={19}/>{calendarAdded ? t('Downloaded') : t('Add to Cal')}</Button></div>
      {calendarAdded && <p className="session-calendar-feedback" role="status">{t('Calendar file downloaded. Open it to add your session.')}</p>}
      <p className="session-detail-description">{client.program.progression || t('A focused {minutes}-minute strength session from your coach’s programme. Follow each exercise at your own pace and log your working sets.', { minutes: day.minutes })}</p>
      <div className="session-detail-exercises"><h2>{t('In this session')} <span>{day.exercises.length}</span></h2>{day.exercises.map(e => <SessionExercise key={e.id} exercise={e}/>)}</div>
      <div className="session-start-bar"><Button aria-label={hasDraft ? t('Resume workout: {title}', { title: data.drafts[client.id].title }) : undefined} disabled={!completed && !hasDraft && !isToday} onClick={() => completed ? openShare(completed) : hasDraft ? resumeWorkout() : openWorkout(day,date)}>{completed ? <><Check size={18}/>{t('Workout complete')}</> : hasDraft ? <><Play size={18}/>{t('Resume workout')}</> : <><Play size={18}/>{isToday ? otherDraft ? t('Resume active workout') : t('Begin Workout') : date ? t('Scheduled for {shortDate}', { shortDate: shortDate(date) }) : t('Not scheduled')}</>}</Button></div>
    </div>
    {shareOpen && <Modal title={t('Share your session')} onClose={() => setShareOpen(false)}><p className="muted">{t('{name} · {minutes} mins · {brand}', { name: day.name, minutes: day.minutes, brand: data.coach.brand })}</p><Button onClick={async () => { const content = `${day.name} — ${day.minutes} mins with ${data.coach.name}. ${day.exercises.map(e=>e.name).join(', ')}.`; try { await navigator.clipboard.writeText(content); setShared(true); } catch { setShared(false); } }}><Share2 size={17}/>{shared ? t('Copied') : t('Copy session details')}</Button><p role="status" className="fine-print">{shared ? t('Session details copied to clipboard.') : t('You can also select and copy the session text above.')}</p></Modal>}
  </article>;
}
