import { MotionList, MotionDetails } from './motion.jsx';
import { FormLab } from "./formlab-entry.jsx";
import { SmartSchedule } from "./ecosystem/scheduling.jsx";
import React, { useRef, useState } from "react";
import { recordFood, ensureNutritionDay, nutritionDay } from './nutrition-model.js';
import { consistencyState, latestMeasurement } from "./validation.js";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Dumbbell,
  Footprints,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Share2,
  Target,
  TrendingUp,
  User,
  Settings,
  Bell,
  Link,
  Download,
  Bookmark,
  Send,
  Lock,
  FileText,
  Upload,
  Trash2,
  Search,
  Camera,
  Utensils,
  Clock3,
  Flame,
  ScanBarcode,
} from "lucide-react";
import { useApp } from "./context.js";
import {
  uid,
  dayKey,
  offsetDay,
  dateOf,
  shortDate,
  sum,
  round,
  metrics,
  scheduleDay,
  saveFile,
  useFile,
  getFile,
  download,
} from "./store.js";
import { CoachMealPlan } from "./nutrition-home.jsx";
import { PhotoMealLogger } from "./meal-photo.jsx";
import { ALL_FOODS, searchFoods } from "./food-library.js";
import { BarcodeScan } from "./BarcodeScan.jsx";
import trainingPortrait from "../assets/campaign-athlete.webp";
import recoveryCover from "../assets/share-recovery-v2.jpg";
import { Hydration } from './ReferenceMotion.jsx';
import { ExerciseMedia, exerciseImage } from './ExerciseMedia.jsx';
import { RecoveryMap } from './RecoveryMap.jsx';
import { ResumeWorkout } from "./resume.jsx";
import {
  Avatar,
  Bars,
  Button,
  Calendar,
  Empty,
  Field,
  Heading,
  IconButton,
  LineChart,
  Media,
  Meter,
  Modal,
  Notice,
  Quote,
  Ring,
  SectionHead,
  Stat,
  Tabs,
} from "./ui.jsx";

import { language, t } from './i18n.js';
import { groupLabel } from './exercise-catalogue.js';
import { portionLabel } from './portions.js';
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

export function Plan() {
  const { subtab, setSubtab, client } = useApp();
  const tab = ["Training", "Habits", "FormLab"].includes(subtab)
    ? subtab
    : "Training";
  return (
    <>
      <Heading title={t('Your plan.')} />
      <Tabs
        items={["Training", "Habits", "FormLab"]}
        value={tab}
        onChange={setSubtab}
      />
      {tab === "Training" ? (
        <Training />
      ) : tab==='FormLab'?<FormLab client={client}/>: (
        <Habits />
      )}
    </>
  );
}
function Training() {
  const { data, client, openWorkout, openShare, ask, viewSession, viewDate, setViewDate, openExercise } = useApp();
  const date = viewDate || dayKey(), setDate = setViewDate;
  const day = scheduleDay(client, date);
  const draft = data.drafts[client.id];
  const [detail, setDetail] = useState(null);
  const done = data.sessions.find(
    (s) => s.clientId === client.id && s.date === date,
  );
  return (
    <>
      <Calendar
        selected={date}
        onChange={setDate}
        client={client}
        sessions={data.sessions}
      />
      {day ? (
        <>
          <SectionHead
            title={day.name}
            action={
              <span className="muted">{t('{length} exercises', { length: day.exercises.length })}</span>
            }
          />
          <div className="training-start-action">
            <Button
              aria-label={draft && date === dayKey() ? t('Resume workout: {title}', { title: draft.title }) : undefined} disabled={!done && date !== dayKey()}
              onClick={() => (done ? openShare(done) : openWorkout(day, date))}
            >
              {done
                ? t('View workout result')
                : date > dayKey()
                  ? "Available on " + shortDate(date)
                  : date < dayKey()
                    ? t('Workout not logged')
                    : draft ? t('Resume workout') : t('Start Workout')}
              <ArrowRight size={16} />
            </Button>
          </div>
          <button className="training-detail-link" onClick={() => viewSession(day,date)}><span>{t('View session details')}</span><ArrowRight size={17}/></button>
          <div className="card list training-exercise-list">
            {day.exercises.map((e, i) => (
              <button
                className="exercise-row"
                key={e.id}
                onClick={() => setDetail(e)}
              >
                <span className="exercise-photo-number"><ExerciseThumbnail exercise={e}/><i>{String(i + 1).padStart(2,'0')}</i></span>
                <span className="exercise-row-copy">
                  <span className="exercise-group">{e.group ? groupLabel(e.group) : t('Training')}{e.videoFile && <span className="coach-demo-label"> {t('· Coach video')}</span>}</span>
                  <b>{t(e.name)}</b>
                  <small className="exercise-prescription"><strong>{e.sets} × {e.reps} {e.kind === 'Duration' ? 'sec' : 'reps'}</strong><span><Clock3 size={11}/>{e.rest}{t('s rest')}</span></small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>

        </>
      ) : (
        <Empty
          icon={Dumbbell}
          title={t('A planned rest day')}
          detail={t('Recovery is part of the programme. Your habits are still here for you.')}
        />
      )}
      <MotionDetails className="programme-overview"><summary><span>{t('About your programme')}<small>{t(client.program.name)} · {client.program.phase}</small></span><ChevronRight size={18}/></summary>
      <div className="card program-title">
        <span className="eyebrow">{client.program.phase}</span>
        <h2>{t(client.program.name)}</h2>
        <p>
          {client.program.weeks}{t('-week programme · through')}{" "}
          {shortDate(client.programEnd)}
        </p>
        {client.program.progression && <p className="program-progression"><TrendingUp size={15}/>{client.program.progression}</p>}
        {client.travel &&
          date >= client.travel.start &&
          date <= client.travel.end && (
            <Notice>
              {t('Travel plan active. Your regular plan resumes')}{" "}
              {shortDate(offsetDay(1, client.travel.end))}.
            </Notice>
          )}
      </div>
      </MotionDetails>
      <SmartSchedule client={client}/>
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <ExerciseMedia exercise={detail}/>
          <FormLab client={client} exercise={detail} compact/>
          <p className="exercise-coach-cue"><span>{t('COACH’S CUE')}</span>{detail.notes || t('Ask your coach for technique guidance.')}</p>
          <div className="three-stats">
            <Stat
              label={detail.kind === 'Duration' ? t('Sets × seconds') : t('Sets × reps')}
              value={`${detail.sets} × ${detail.reps}`}
            />
            <Stat label={t('Tempo')} value={detail.tempo || "—"} />
            <Stat label={t('Reps in reserve')} value={detail.rir ?? "—"} />
          </div>
          <div className="exercise-sheet-actions">
            <Button
              onClick={() => {
                const name = detail.name;
                setDetail(null);
                openExercise(name);
              }}
            >
              {t('Progress & history')} <ArrowRight size={16} />
            </Button>
            <Button
              secondary
              onClick={() => {
                setDetail(null);
                ask(`${detail.name} · ${day.name}`);
              }}
            >
              {t('Ask coach')} <MessageCircle size={16} />
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function ExerciseThumbnail({ exercise }) {
  const url = useFile(exercise.imageFile?.id);
  return <img className="exercise-thumb" src={url || exerciseImage(exercise)} alt={t('{name} exercise', { name: exercise.name })} loading="lazy" decoding="async"/>;
}

function DailyUpdates({ date, foods }) {
  const { data, client } = useApp();
  const [tab, setTab] = useState('Recommendations');
  const targets = nutritionDay(data,client.id,date)?.target || client.nutrition;
  const habits = data.habitLogs.find(h => h.clientId === client.id && h.date === date)?.values || {};
  const rows = [
    {title:'Reach your protein target',value:sum(foods,'p'),target:targets.p,unit:'g',tone:'green'},
    ...(client.habits.some(h => h.id === 'water') ? [{title:'Drink more water',value:habits.water || 0,target:client.habits.find(h => h.id === 'water').target,unit:'L',tone:'blue'}] : []),
    ...(client.habits.some(h => h.id === 'steps') ? [{title:'Move a little more',value:habits.steps || 0,target:client.habits.find(h => h.id === 'steps').target,unit:'steps',tone:'amber'}] : []),
  ];
  return <section className="daily-updates"><h2>{t('Daily updates')}</h2><Tabs label={t('Daily updates')} items={['Meals','Recommendations','Water']} value={tab} onChange={setTab}/>
    {tab === 'Recommendations' ? rows.map(r => <div className="recommendation" key={r.title}><div><h3>{r.value >= r.target ? r.unit === 'g' ? t('Protein target reached') : r.unit === 'L' ? t('Water target reached') : t('Step target reached') : r.title}</h3><strong>{r.value.toLocaleString()}<small> {r.unit}</small></strong></div><Meter value={r.value} target={r.target} tone={r.tone}/><p>{r.value >= r.target ? t('Your coach’s daily target is complete.') : t('{value} {unit} away from your coach’s target', { value: round(r.target - r.value).toLocaleString(), unit: r.unit })}</p></div>) : tab === 'Water' ? <Hydration date={date}/> : <div className="daily-meals">{['Breakfast','Lunch','Dinner','Snack'].map(meal => { const entries = foods.filter(f => f.meal === meal); return <div className="recommendation" key={meal}><div><h3>{meal}</h3><strong>{sum(entries,'kcal')}<small> kcal</small></strong></div><p>{entries.map(f => f.name).join(' · ') || t('No food logged yet')}</p></div>; })}</div>}
  </section>;
}

export function Nutrition() {
  const { data, client, update, ask, notify, viewDate, setViewDate, subtab } = useApp();
  const [planOpen, setPlanOpen] = useState(subtab === 'Coach plan');
  const [editingFood, setEditingFood] = useState(null);
  const date = viewDate || dayKey(), setDate = setViewDate;
  const [add, setAdd] = useState(false);
  const [detail, setDetail] = useState(null);
  const [removing, setRemoving] = useState(false), [removalError, setRemovalError] = useState('');
  const [plannedMeal,setPlannedMeal] = useState(null);
  const [completing, setCompleting] = useState(false), [completionError, setCompletionError] = useState('');
  const foods = data.foodLogs.filter(
    (x) => x.clientId === client.id && x.date === date,
  );
  const dayRecord = nutritionDay(data, client.id, date);
  const targets = dayRecord?.target || client.nutrition;
  return (
    <>
      <div className="date-select">
        <IconButton
          label={t('Previous nutrition day')}
          onClick={() => setDate(offsetDay(-1, date))}
        >
          <ChevronLeft size={16} />
        </IconButton>
        <span>{date === dayKey() ? t('Today') : shortDate(date)}</span>
        <IconButton
          label={t('Next nutrition day')}
          disabled={date === dayKey()}
          onClick={() => setDate(offsetDay(1, date))}
        >
          <ChevronRight size={16} />
        </IconButton>
      </div>
      <section className="card nutrition-card">
        <SectionHead
          title={t('Your daily targets')}
          action={<span className="pill">{client.nutrition.mode}</span>}
        />
        <div className="rings">
          <Ring
            motionKey={date}
            value={sum(foods, "kcal")}
            target={targets.kcal}
            label={t('Calories')} tone="macro-calories"
          />
          <Ring
            motionKey={date}
            value={sum(foods, "p")}
            target={targets.p}
            unit="g"
            label={t('Protein')}
            tone="macro-protein"
          />
          <Ring
            motionKey={date}
            value={sum(foods, "c")}
            target={targets.c}
            unit="g"
            label={t('Carbs')}
            tone="macro-carbs"
          />
          <Ring
            motionKey={date}
            value={sum(foods, "f")}
            target={targets.f}
            unit="g"
            label={t('Fat')}
            tone="macro-fat"
          />
        </div>
        <div className="nutrition-target-context"><span>{Math.abs(targets.kcal - sum(foods, 'kcal')).toLocaleString()} kcal {sum(foods, 'kcal') <= targets.kcal ? 'remaining' : t('above target')}</span><small>{foods.length} {foods.length === 1 ? 'entry' : 'entries'} {t('logged')}</small></div>
      </section>
      <div className="nutrition-quick-actions"><Button onClick={() => setAdd(true)}><Plus size={18}/>{t('Log food')}</Button><Button secondary onClick={() => setAdd('Photo')}><Camera size={18}/>{t('Photo meal')}</Button></div>
      <MotionDetails className="nutrition-plan-disclosure" open={planOpen} onToggle={event => setPlanOpen(event.currentTarget.open)}><summary><span>{t('Your coach’s meal plan')}<small>{client.nutrition.meals?.length || 0} {client.nutrition.mode === 'Structured' ? 'prescribed' : 'suggested'} {t('meals · quick log')}</small></span><ChevronRight size={18}/></summary><CoachMealPlan onLog={setPlannedMeal}/></MotionDetails>
      <SectionHead
        title={t('Food diary')}
        action={
          <button className="text-link" onClick={() => setAdd(true)}>
            <Plus size={16} /> {t('Add food')}
          </button>
        }
      />
      <MotionList className="card list">
        {foods.length ? (
          foods.map((f) => (
            <button
              className="simple-row"
              key={f.id}
              onClick={() => { setRemovalError(''); setDetail(f); }}
            >
              <span className="food-icon">
                <Utensils size={18} />
              </span>
              <span>
                <b>{t(f.name)}</b>
                <small>
                  {t(f.meal)} · {portionLabel(f.portion)} · {f.p == null ? t('Protein not entered') : t('{p}g protein', { p: f.p })}
                </small>
              </span>
              <b>
                {f.kcal}
                <small>kcal</small>
              </b>
              <ChevronRight size={15} />
            </button>
          ))
        ) : (
          <Empty
            icon={Utensils}
            title={t('A fresh page for today')}
            detail={t('Add a food or meal photo to start your diary.')}
            action={
              <Button small onClick={() => setAdd(true)}>
                {t('Log your first meal')}
              </Button>
            }
          />
        )}
      </MotionList>
      {foods.length > 0 && <div className="nutrition-day-status"><span><b>{dayRecord?.complete ? t('Day complete') : t('Logging in progress')}</b><small>{dayRecord?.complete ? t('Included in your nutrition trend. Editing reopens the day.') : date < dayKey() && !dayRecord ? t('No historical target was saved. Completing this day compares it with the current {value} kcal target.', { value: targets.kcal.toLocaleString() }) : t('Finish logging to include this day in your nutrition trend.')}</small></span><button disabled={completing} onClick={async () => { if (completing) return; setCompleting(true); setCompletionError(''); const result = await update(d => { const day = ensureNutritionDay(d, client, date); day.complete = !day.complete; }); setCompleting(false); if (result?.error) {setCompletionError(result.error); return;} notify?.(dayRecord?.complete ? t('Day reopened') : t('Day marked complete')); }}>{completing ? t('Saving…') : dayRecord?.complete ? t('Reopen day') : t('Finish logging')}<Check size={16}/></button></div>}
      {completionError && <p className="error" role="alert">{completionError}</p>}
      <MotionDetails className="nutrition-updates"><summary><span>{t('Water, steps and recommendations')}<small>{t('How today compares with your coach’s targets')}</small></span><ChevronRight size={18}/></summary><DailyUpdates date={date} foods={foods}/></MotionDetails>
      {editingFood && <PhotoMealLogger initialEntry={editingFood} date={date} onClose={() => setEditingFood(null)}/>}
      {add && (add === 'Photo' ? <PhotoMealLogger date={date} onClose={()=>setAdd(false)}/> : <FoodLogger date={date} onClose={()=>setAdd(false)}/>)}
      {plannedMeal && <PhotoMealLogger date={date} initialMeal={plannedMeal} requirePhoto={false} onClose={()=>setPlannedMeal(null)}/>}
      {detail && (
        <Modal title={detail.name} onClose={() => !removing && setDetail(null)}>
          {detail.photo && (
            <Media
              fileId={detail.photo.id}
              alt={detail.name}
              className="food-photo"
            />
          )}
          <p>
            {portionLabel(detail.portion)} · {t(detail.meal)}
          </p>
          <div className="three-stats">
            <Stat label={t('Protein')} value={detail.p == null ? '—' : `${detail.p}g`} />
            <Stat label={t('Carbs')} value={detail.c == null ? '—' : `${detail.c}g`} />
            <Stat label={t('Fat')} value={detail.f == null ? '—' : `${detail.f}g`} />
          </div>
          <p className="big-number">
            {detail.kcal} <small>kcal</small>
          </p>
          {removalError && <p role="alert" className="error">{removalError}</p>}
          <div className="button-row">
            <Button disabled={removing} onClick={() => { setEditingFood(detail); setDetail(null); }}>{t('Edit entry')}</Button>
            <Button
              secondary
              onClick={() => {
                ask(
                  `${t(detail.name)} · ${detail.kcal} ${t('kcal')} · ${shortDate(detail.date)}`,
                );
                setDetail(null);
              }}
            >
              {t('Ask coach')}
            </Button>
            <Button
              secondary
              disabled={removing}
              onClick={async () => {
                if (removing) return;
                setRemoving(true); setRemovalError('');
                const result = await update((d) => {
                  d.foodLogs = d.foodLogs.filter((f) => f.id !== detail.id);
                  if (nutritionDay(d,client.id,date)) nutritionDay(d,client.id,date).complete = false;
                });
                setRemoving(false);
                if (result?.error) { setRemovalError(result.error); return; }
                notify?.(t('Entry removed'), () => update(d => recordFood(d,client,detail)));
                setDetail(null);
              }}
            >
              {removing ? t('Removing…') : t('Remove entry')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function FoodLogger({ date, onClose, initialTab = 'Search' }) {
  const { data, client, update, notify } = useApp();
  const [review, setReview] = useState(null);
  const recent = [...new Map(data.foodLogs.filter(f => f.clientId === client.id).slice().reverse().map(f => [f.name, f])).values()].slice(0,5);
  const [tab, setTab] = useState(initialTab),
    [query, setQuery] = useState(""),
    [photo, setPhoto] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const uploadLock = useRef(false);
  const [food, setFood] = useState({
    name: "",
    portion: "1 serving",
    kcal: "",
    p: "",
    c: "",
    f: "",
    meal: "Lunch",
  });
  const [scanning, setScanning] = useState(false);
  const foods = searchFoods(
    tab === "Favourites"
      ? ALL_FOODS.filter((f) => data.favorites.includes(f.name))
      : ALL_FOODS,
    query,
  );
  const reviewFood = ({ ar, tags, source, ...f }) => setReview(f);
  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file || uploadLock.current) return;
    const input = e.currentTarget;
    uploadLock.current = true;
    setBusy(true);
    try {
      setPhoto(await saveFile(file));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      uploadLock.current = false;
      setBusy(false);
      input.value = "";
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (uploadLock.current || busy) return;
    if (!food.name.trim()) {
      setError(t('Give this food a name.'));
      return;
    }
    if (food.kcal === "" || ["kcal", "p", "c", "f"].some((key) => !Number.isFinite(Number(food[key])) || Number(food[key]) < 0 || Number(food[key]) > 10000)) {
      setError(t('Enter nutrition values between 0 and 10,000.'));
      return;
    }
    const entry = { ...food, name: food.name.trim(), portion: food.portion.trim() || '1 serving', id: uid(), clientId: client.id, date, photo,
      ...Object.fromEntries(['kcal','p','c','f'].map(k => [k,food[k] === '' ? null : Number(food[k])])), missingMacros:['p','c','f'].filter(k => food[k] === '') };
    setBusy(true);
    const result = await update(d => recordFood(d,client,entry));
    setBusy(false);
    if (result?.error) { setError(result.error); return; }
    notify?.(t('Food added to diary'), () => update(d => { d.foodLogs = d.foodLogs.filter(f => f.id !== entry.id); }));
    onClose();
  }
  if (review) return <PhotoMealLogger key={review.name} initialFood={review} date={date} requirePhoto={false} onBack={() => setReview(null)} onClose={onClose}/>;
  if (tab === 'Photo') return <PhotoMealLogger date={date} onBack={() => setTab('Search')} onClose={onClose}/>;
  return (
    <Modal title={t('Add food')} className="food-logger-modal" canClose={!busy} onClose={onClose}>
      <Tabs
        items={["Search", "Favourites", "Manual", "Photo"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Search" && scanning && (
        <BarcodeScan
          onFound={(f) => { setScanning(false); reviewFood(f); }}
          onManual={() => { setScanning(false); setTab("Manual"); }}
          onCancel={() => setScanning(false)}
        />
      )}
      {["Search", "Favourites"].includes(tab) && !(tab === "Search" && scanning) && (
        <>
          {tab === "Search" && <button type="button" className="food-scan-entry" onClick={() => setScanning(true)}><ScanBarcode size={22}/><span><b>{t('Scan a barcode')}</b><small>{t('Packaged foods from the supermarket')}</small></span><ChevronRight size={18}/></button>}
          <label className="search">
            <Search size={16} />
            <input
              aria-label={t('Search food library')}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search your food library')}
            />
          </label>
          {tab === 'Search' && !query && recent.length > 0 && <div className="recent-foods"><span className="eyebrow">{t('LOG AGAIN')}</span>{recent.map(f => <button key={f.id} onClick={() => setReview(f)}><span><b>{t(f.name)}</b><small>{t('{kcal} kcal · {portion}', { kcal: f.kcal, portion: f.portion })}</small></span><Plus size={18}/></button>)}</div>}
          <div className="food-search-results">
            {foods.map((f) => (
              <div className="food-option" key={f.name}>
                <button
                  onClick={() => reviewFood(f)}
                >
                  <b>{t(f.name)}{f.ar && language() === 'en' && <span className="food-ar" lang="ar" dir="rtl">{f.ar}</span>}</b>
                  <small>{t('{portion} · {kcal} kcal', { portion: portionLabel(f.portion), kcal: f.kcal })}</small>
                </button>
                <IconButton
                  label={t('Favourite {name}', { name: f.name })}
                  onClick={() =>
                    update((d) => {
                      d.favorites = d.favorites.includes(f.name)
                        ? d.favorites.filter((n) => n !== f.name)
                        : [...d.favorites, f.name];
                    })
                  }
                >
                  <Heart
                    size={17}
                    fill={
                      data.favorites.includes(f.name) ? "currentColor" : "none"
                    }
                  />
                </IconButton>
              </div>
            ))}
            {!foods.length && (
              <Empty
                title={tab === 'Favourites' && !query ? t('Your favourites, one tap away') : t('No matching foods')}
                detail={tab === 'Favourites' && !query ? t('Save foods with the heart beside each entry.') : t('Add the values from your meal or food label.')}
                action={<Button secondary onClick={() => {setFood(previous => ({...previous, name:query.trim()}));setTab('Manual');}}>{t('Add a food manually')} <Plus size={16}/></Button>}
              />
            )}
          </div>
          <small className="muted">
            {t('Everyday and Egyptian foods with typical values per portion. For packaged products, scan the barcode to use the label values.')}
          </small>
        </>
      )}
      {["Manual", "Photo"].includes(tab) && (
        <form onSubmit={submit}>
          {tab === "Photo" && (
            <>
              <label className="upload-zone">
                <Camera size={24} />
                <b>
                  {photo ? t('Change meal photo') : t('Choose or take a meal photo')}
                </b>
                <input
                  type="file"
                  disabled={busy}
                  accept="image/*"
                  capture="environment"
                  onChange={upload}
                />
              </label>
              {photo && (
                <Media
                  fileId={photo.id}
                  alt={t('Meal preview')}
                  className="food-photo"
                />
              )}
              <Notice>
                {t('Photo diary: enter the nutrition values below. Automatic food recognition is not connected.')}
              </Notice>
            </>
          )}
          <Field
            label={t('Food / meal name')}
            value={food.name}
            required
            maxLength={120}
            onChange={(e) => setFood({ ...food, name: e.target.value })}
          />
          <Field
            label={t('Portion')}
            maxLength={120}
            value={food.portion}
            onChange={(e) => setFood({ ...food, portion: e.target.value })}
          />
          <Field label={t('Meal')}>
            <select
              value={food.meal}
              onChange={(e) => setFood({ ...food, meal: e.target.value })}
            >
              {["Breakfast", "Lunch", "Dinner", "Snack"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            {[
              ["kcal", "Calories"],
              ["p", "Protein (g)"],
              ["c", "Carbs (g)"],
              ["f", "Fat (g)"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                type="number"
                required={key === "kcal"}
                placeholder={key === "kcal" ? t('Enter calories') : t('Optional')}
                min="0"
                max="10000"
                step="1"
                value={food[key]}
                onChange={(e) =>
                  setFood({
                    ...food,
                    [key]: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                  })
                }
              />
            ))}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? t('Saving photo…') : t('Add to diary')} <Check size={16} />
          </Button>
        </form>
      )}
    </Modal>
  );
}

export function Habits() {
  const { data, client, update } = useApp();
  const today = dayKey();
  const [edits, setEdits] = useState({});
  const [errors, setErrors] = useState({});
  const values =
    data.habitLogs.find((x) => x.clientId === client.id && x.date === today)
      ?.values || {};
  function change(h, value) {
    if (value === "" || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100000) {
      setErrors((previous) => ({ ...previous, [h.id]: "Enter a number between 0 and 100,000." }));
      return;
    }
    setErrors((previous) => ({ ...previous, [h.id]: "" }));
    setEdits((previous) => ({ ...previous, [h.id]: String(Number(Number(value).toFixed(3))) }));
    update((d) => {
      let row = d.habitLogs.find(
        (x) => x.clientId === client.id && x.date === today,
      );
      if (!row) {
        row = { clientId: client.id, date: today, values: {} };
        d.habitLogs.push(row);
      }
      row.values[h.id] = Number(Number(value).toFixed(3));
    });
  }
  return (
    <>
      <p className="muted intro-copy">
        {t('Small actions, repeated. Your coach sets the targets; you make them happen.')}
      </p>
      {client.habits.some(h => h.id === 'water') && <Hydration/>}
      <div className="habit-grid">
        {client.habits.map((h, i) => (
          <section className="card habit-card" key={h.id}>
            <SectionHead
              title={h.name}
              action={
                (values[h.id] || 0) >= h.target ? (
                  <CheckCircle2 className="green" size={19} />
                ) : (
                  <span className="muted">{t('Daily')}</span>
                )
              }
            />
            <strong>
              {(values[h.id] || 0).toLocaleString()}{" "}
              <small>
                / {h.target.toLocaleString()} {h.unit}
              </small>
            </strong>
            <Meter
              value={values[h.id] || 0}
              target={h.target}
              tone={i % 2 ? "blue" : "green"}
            />
            <div className="stepper">
              <button
                aria-label={t('Decrease {name}', { name: h.name })}
                onClick={() => change(h, Math.max(0, (values[h.id] || 0) - h.step))}
              >
                −
              </button>
              <input
                aria-label={h.name}
                type="number"
                min="0"
                max="100000"
                step={h.step}
                value={edits[h.id] ?? values[h.id] ?? 0}
                aria-invalid={Boolean(errors[h.id])}
                aria-describedby={errors[h.id] ? `habit-error-${h.id}` : undefined}
                onChange={(e) => {
                  const value = e.target.value;
                  setEdits((previous) => ({ ...previous, [h.id]: value }));
                  setErrors(previous => ({ ...previous, [h.id]: '' }));
                  // Preserve save-as-you-go, including an immediate refresh.
                  if (value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100000) change(h, value);
                }}
                onBlur={(e) => change(h, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); change(h, e.currentTarget.value); } }}
              />
              <button
                aria-label={t('Increase {name}', { name: h.name })}
                onClick={() => change(h, (values[h.id] || 0) + h.step)}
              >
                +
              </button>
            </div>
            {errors[h.id] && <p className="error" role="alert" id={`habit-error-${h.id}`}>{errors[h.id]}</p>}
          </section>
        ))}
      </div>
    </>
  );
}

const PROGRESS_TABS = ["Overview", "Recovery", "Strength", "Body", "Consistency", "Photos"];
export function Progress({ clientOverride, startTab = "Overview" }) {
  const { data, client: active, subtab, setSubtab, openShare, ask, openExercise } = useApp();
  const client = clientOverride || active;
  const [ownTab, setOwnTab] = useState(startTab);
  const tab = clientOverride
    ? ownTab
    : PROGRESS_TABS.includes(subtab)
      ? subtab
      : "Overview";
  const change = clientOverride ? setOwnTab : setSubtab;
  const coachView = Boolean(clientOverride);
  const m = metrics(data, client.id);
  const sessionWord = m.sessions.length === 1 ? 'session' : 'sessions';
  const [measure, setMeasure] = useState(false);
  const last = m.lastWeight,
    delta = m.weights.length ? round(last - m.weights[0].weight) : null;
  const lifts = Object.entries(m.exerciseMax);
  const bodyRecords = data.measurements.filter(row => row.clientId === client.id && row.date <= dayKey());
  const sessions = data.sessions
    .filter((s) => s.clientId === client.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      {!clientOverride && (
        <Heading
          title={t('Progress')}
          subtitle={t('The work you put in. The change you can see.')}
        />
      )}
      <Tabs
        items={PROGRESS_TABS}
        value={tab}
        onChange={change}
      />
      {tab === "Recovery" && <RecoveryMap clientId={client.id} coach={coachView} day={sessions.some(s => s.date === dayKey()) ? null : scheduleDay(client, dayKey())}/>}
      {(tab === "Body" || tab === "Overview" && /body|weight|fat/i.test(client.goal) && !/strength/i.test(client.goal)) && (
        <section className="card">
          <SectionHead
            title={t('Body Weight')}
            action={
              <button className="text-link" onClick={() => setMeasure(true)}>
                <Plus size={14} /> {t('Log')}
              </button>
            }
          />
          <div className="weight-summary">
            <div>
              <strong>
                {delta !== null ? t('{value}{delta} kg', { value: delta > 0 ? "+" : "", delta }) : "—"}
              </strong>
              <small>{coachView ? t('since first log') : t('since your first log')}</small>
            </div>
            <div>
              <b>
                {last || "—"} <small>kg</small>
              </b>
              <span className="green">{t('{length} measurements', { length: m.weights.length })}</span>
            </div>
          </div>
          <LineChart records={m.weights} />
        </section>
      )}
      {tab === "Overview" && (
        <>
          <section className="progress-snapshot" aria-label={t('Your progress snapshot')}><button onClick={() => change('Strength')}><small>{t('Training · 28 days')}</small><b>{m.sessions.length}<em> {sessionWord}</em></b><span>{coachView ? t('View lifts') : t('View your lifts')} <ChevronRight size={13}/></span></button><button onClick={() => change('Body')}><small>{t('Latest weight')}</small><b>{m.lastWeight ?? '—'}<em> kg</em></b><span>{m.weights.at(-1) ? shortDate(m.weights.at(-1).date) : t('Add a measurement')} <ChevronRight size={13}/></span></button></section>
          <section className="progress-focus"><span className="eyebrow">{coachView ? t('FOCUS') : t('YOUR FOCUS')}</span><h2>{client.goal}</h2><p>{m.sessions.length ? `${t('{count} sessions in the last 28 days.', { count: m.sessions.length })} ${coachView ? t('Open Strength to review how lifts are progressing.') : t('Explore Strength to see how your lifts are progressing.')}` : coachView ? t('No sessions logged in the last 28 days.') : t('Start with your next session. Your progress will build here.')}</p><Button secondary small onClick={() => change(/body|weight|fat/i.test(client.goal) && !/strength/i.test(client.goal) ? 'Body' : 'Strength')}>{coachView ? t('Explore progress') : t('Explore your progress')} <ArrowRight size={16}/></Button></section>
          <div className="two-stats">
            <Stat
              label={t('Training adherence')}
              value={m.training === null ? "—" : `${m.training}%`}
              note={t('Scheduled sessions · last 28 days')}
            >
              <Bars values={sessions.slice(0, 7).map((s) => s.sets.length)} />
            </Stat>
            <Stat
              label={t('Nutrition adherence')}
              value={m.nutrition === null ? "—" : `${m.nutrition}%`}
              note={t('{nutritionDays} completed days · within 15% of saved targets', { nutritionDays: m.nutritionDays })}
            >
              <Bars
                tone="blue"
                values={Array.from({ length: 7 }, (_, i) =>
                  sum(
                    data.foodLogs.filter(
                      (f) =>
                        f.clientId === client.id && f.date === offsetDay(i - 6),
                    ),
                    "kcal",
                  ),
                )}
              />
            </Stat>
          </div>
          <Photos clientId={client.id} compact onAll={() => change("Photos")} />
          <SectionHead
            title={t('Recent sessions')}
            action={
              <button
                className="text-link"
                disabled={!sessions.length}
                onClick={() => openShare({ story: true, clientId: client.id })}
              >
                {t('Progress story')} <Share2 size={14} />
              </button>
            }
          />
          <div className="card list">
            {sessions.slice(0, 5).map((s) => (
              <button
                className="simple-row"
                key={s.id}
                onClick={() => openShare(s)}
              >
                <span className="status-icon green">
                  <Check size={16} />
                </span>
                <span>
                  <b>{t(s.title)}</b>
                  <small>
                    {shortDate(s.date)} ·{" "}
                    {s.sets.filter((x) => !x.skipped).length} {t('sets ·')}{" "}
                    {Math.round(s.duration / 60)} {t('min')}
                  </small>
                </span>
                <Share2 size={16} />
              </button>
            ))}
            {!sessions.length && (
              <Empty
                title={t('Your first session awaits')}
                detail={t('Completed workouts and shareable results will appear here.')}
              />
            )}
          </div>
          <Milestones client={client} />
        </>
      )}
      {tab === "Strength" && (
        <div className="strength-list">
          {lifts.length ? (
            lifts.map(([name, value]) => {
              const records = sessions
                .filter((s) =>
                  s.sets.some((x) => x.name === name && !x.skipped),
                )
                .map((s) => ({
                  date: s.date,
                  weight: Math.max(
                    ...s.sets
                      .filter((x) => x.name === name && !x.skipped)
                      .map((x) => x.weight * (1 + x.reps / 30)),
                  ),
                }))
                .reverse();
              return (
                <section className="card" key={name}>
                  <SectionHead
                    title={name}
                    action={<span className="green">{t('{round} kg', { round: round(value) })}</span>}
                  />
                  <p className="muted">{t('Estimated one-rep max · Epley formula')}</p>
                  <LineChart records={records} />
                  <div className="strength-actions">
                    <button className="text-link" onClick={() => openExercise(name)}>
                      {t('Exercise details')} <ChevronRight size={14} />
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        ask(t('{name} · estimated 1RM {value} kg', { name, value: round(value) }), "", client.id)
                      }
                    >
                      {clientOverride ? t('Message client') : t('Ask coach')} <MessageCircle size={14} />
                    </button>
                  </div>
                </section>
              );
            })
          ) : (
            <Empty
              icon={Dumbbell}
              title={t('Build your strength history')}
              detail={t('Log a weighted workout to start tracking your lifts.')}
            />
          )}
        </div>
      )}
      {tab === "Body" && (
        <>
          <div className="three-stats">
            {[
              ["waist", "Waist", "cm"],
              ["chest", "Chest", "cm"],
              ["bodyFat", "Body fat", "%"],
            ].map(([key, label, unit]) => (
              <Stat
                key={key}
                label={label}
                value={`${latestMeasurement(bodyRecords, key)?.[key] ?? "—"} ${unit}`} note={latestMeasurement(bodyRecords, key) ? shortDate(latestMeasurement(bodyRecords, key).date) : t('Not recorded')}
              />
            ))}
          </div>
          <InBodyPanel client={client} />
        </>
      )}
      {tab === "Consistency" && <Consistency client={client} />}{" "}
      {tab === "Photos" && <Photos clientId={client.id} />}{" "}
      {measure && (
        <MeasurementForm client={client} onClose={() => setMeasure(false)} />
      )}
    </>
  );
}

function MeasurementForm({ client, onClose }) {
  const { data, update } = useApp();
  const records = data.measurements.filter((x) => x.clientId === client.id).sort((a, b) => a.date.localeCompare(b.date));
  const last = records.at(-1);
  function valuesFor(date) {
    const existing = records.find(record => record.date === date);
    return { date, weight: existing?.weight ?? last?.weight ?? '', waist: existing?.waist ?? '', chest: existing?.chest ?? '', bodyFat: existing?.bodyFat ?? '' };
  }
  const [form, setForm] = useState(() => valuesFor(dayKey()));
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const saveLock = useRef(false);
  const existing = records.find(record => record.date === form.date);
  return (
    <Modal title={t('Log measurements')} onClose={onClose} canClose={!saving}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (saveLock.current) return;
          saveLock.current = true; setSaving(true); setError('');
          const result = await update((d) => {
            const record = { ...form, id: existing?.id || uid(), clientId: client.id };
            for (const key of ["weight", "waist", "chest", "bodyFat"])
              record[key] = form[key] === "" ? existing?.[key] ?? null : Number(form[key]);
            d.measurements = d.measurements.filter(
              (m) => !(m.clientId === client.id && m.date === form.date),
            );
            d.measurements.push(record);
          });
          saveLock.current = false; setSaving(false);
          if (result?.error) {setError(result.error); return;}
          onClose();
        }}
      >
        <Field
          label={t('Date')}
          type="date"
          max={dayKey()}
          required
          value={form.date}
          onChange={(e) => setForm(valuesFor(e.target.value))}
        />
        {[
          ["weight", "Weight (kg)", 20, 400],
          ["waist", "Waist (cm)", 20, 250],
          ["chest", "Chest (cm)", 20, 250],
          ["bodyFat", "Body fat (%)", 1, 70],
        ].map(([key, label, min, max]) => (
          <Field
            key={key}
            label={label}
            required={key === "weight"}
            type="number"
            step="0.1"
            min={min}
            max={max}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        ))}
        {existing && <Notice>{t('You’re updating this date’s entry. Blank optional fields keep the saved value.')}</Notice>}
        {error && <p className="error" role="alert">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? t('Saving…') : existing ? t('Update measurement') : t('Save measurement')} <Check size={16} />
        </Button>
      </form>
    </Modal>
  );
}

export function Consistency({ client }) {
  const { data } = useApp();
  const [mode, setMode] = useState("Training + nutrition");
  const days = Array.from({ length: 84 }, (_, i) => offsetDay(i - 83));
  const [selected, setSelected] = useState(null);
  function state(date) {
    const workout = data.sessions.some(
      (s) => s.clientId === client.id && s.date === date,
    );
    const foods = data.foodLogs.filter(
      (f) => f.clientId === client.id && f.date === date,
    );
    const nutrition =
      foods.length &&
      Math.abs(sum(foods, "kcal") - client.nutrition.kcal) /
        client.nutrition.kcal <=
        0.15;
    const h =
      data.habitLogs.find((h) => h.clientId === client.id && h.date === date)
        ?.values || {};
    return consistencyState({ workout, scheduled: client.schedule.some(item => item.date === date), foodLogged: foods.length > 0, nutrition: Boolean(nutrition), habits: client.habits, values: h, mode });
  }
  return (
    <section className="card">
      <SectionHead title={t('Your consistency')} />
      <Field label={t('Show')}>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {["Training + nutrition", "Training", "Nutrition", "Habits"].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>
      </Field>
      <div className="heatmap">
        {days.map((date) => (
          <button
            key={date}
            className={state(date)}
            title={`${shortDate(date)}: ${state(date)}`}
            aria-label={t('View consistency for {shortDate}', { shortDate: shortDate(date) })}
            onClick={() => setSelected(date)}
          />
        ))}
      </div>
      <div className="heatmap-key">
        <span>
          <i className="both" />
          {t('Targets hit')}
        </span>
        <span>
          <i className="partial" />
          {t('Partial')}
        </span>
        <span>
          <i className="nutrition" />
          {t('Nutrition only')}
        </span>
        <span>
          <i className="none" />
          {t('No log')}
        </span>
      </div>
      <p className="muted">
        {t('Last 12 weeks. Unlogged days are not treated as failure.')}
      </p>
      {selected && (
        <Notice>
          {shortDate(selected)} ·{" "}
          {state(selected) === "both"
            ? t('Targets hit')
            : state(selected) === "partial"
              ? t('Partially completed')
              : state(selected) === "nutrition"
                ? t('Nutrition target hit')
                : t('Nothing logged')}
          .
        </Notice>
      )}
    </section>
  );
}

export function Photos({ clientId, compact = false, onAll }) {
  const { data, update } = useApp();
  const photos = data.photos
    .filter((p) => p.clientId === clientId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const [error, setError] = useState(""),
    [compare, setCompare] = useState(false),
    [position, setPosition] = useState(50);
  const [left, setLeft] = useState(""),
    [right, setRight] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e) {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    try {
      const media = await saveFile(file);
      const result = await update((d) =>
        d.photos.push({ id: uid(), clientId, date: dayKey(), file: media }),
      );
      if (result?.error) throw new Error(result.error);
      setError("");
    } catch (e) {
      setError(
        e?.message || t('Your photo could not be saved. Please try again.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <SectionHead
        title={t('Progress photos')}
        action={
          compact ? (
            <button className="text-link" onClick={onAll}>
              {t('See all')}
            </button>
          ) : (
            <button
              className="text-link"
              disabled={photos.length < 2}
              onClick={() => setCompare(true)}
            >
              {t('Compare')}
            </button>
          )
        }
      />
      <div className="photo-grid">
        {(compact ? photos.slice(-3) : photos).map((p) => (
          <div key={p.id}>
            <Media fileId={p.file.id} alt={t('Progress {date}', { date: p.date })} />
            <small>{shortDate(p.date)}</small>
          </div>
        ))}
        <label className="photo-add">
          <Plus size={23} />
          <span>{busy ? t('Saving…') : t('Add photo')}</span>
          <input
            aria-label={t('Add photo')}
            disabled={busy}
            type="file"
            accept="image/*"
            onChange={add}
          />
        </label>
      </div>
      {!photos.length && (
        <p className="muted">
          {t('Your photos, your pace. Only photos you upload appear here.')}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {compare && (
        <Modal
          title={t('See how far you’ve come')}
          onClose={() => setCompare(false)}
        >
          <div className="form-grid">
            <Field label={t('Before')}>
              <select
                value={left || photos[0].id}
                onChange={(e) => setLeft(e.target.value)}
              >
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {shortDate(p.date)} · {t(p.file.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('After')}>
              <select
                value={right || photos.at(-1).id}
                onChange={(e) => setRight(e.target.value)}
              >
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {shortDate(p.date)} · {t(p.file.name)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="photo-compare">
            <Media
              fileId={
                (photos.find((p) => p.id === right) || photos.at(-1)).file.id
              }
              alt={t('After')}
            />
            <div
              className="photo-before"
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            >
              <Media
                fileId={
                  (photos.find((p) => p.id === left) || photos[0]).file.id
                }
                alt={t('Before')}
              />
            </div>
            <div className="compare-divider" style={{ left: `${position}%` }} />
            <span>{t('Before')}</span>
            <b>{t('After')}</b>
          </div>
          <input
            className="compare-range"
            aria-label={t('Slide to compare photos')}
            type="range"
            min="0"
            max="100"
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
          />
        </Modal>
      )}
    </section>
  );
}

function Milestones({ client }) {
  const { data } = useApp();
  const sessions = data.sessions.filter((s) => s.clientId === client.id),
    m = metrics(data, client.id);
  const items = [
    ["First workout", sessions.length >= 1],
    ["10 workouts completed", sessions.length >= 10],
    ["20 workouts completed", sessions.length >= 20],
    ["90% training adherence", m.training >= 90],
    ["First strength PR", sessions.some((s) => s.prs?.length)],
  ];
  return (
    <section className="card">
      <SectionHead title={t('Milestones')} />
      {items.map(([title, done]) => (
        <div className="simple-row milestone-row" key={title}>
          <span className={done ? "green" : "muted"}>
            <CheckCircle2 size={19} />
          </span>
          <b>{title}</b>
          <span className={done ? "green" : "muted"}>
            {done ? t('Achieved') : t('In progress')}
          </span>
        </div>
      ))}
    </section>
  );
}

export function InBodyPanel({ client }) {
  const { data } = useApp();
  const records = data.inbodies
    .filter((x) => x.clientId === client.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="card">
      <SectionHead title={t('Body composition')} />
      {records.length ? (
        <>
          <p className="muted">{t('Coach-verified values from your reports.')}</p>
          <LineChart records={records} field="bodyFat" unit="%" />
          <LineChart
            records={records}
            field="muscle"
            unit="kg muscle"
            color="blue"
          />
        </>
      ) : (
        <Empty
          icon={FileText}
          title={t('Your InBody timeline')}
          detail={t('Your coach can attach reports and enter verified values in your client profile.')}
        />
      )}
    </section>
  );
}
