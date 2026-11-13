import { MotionList, MotionDetails } from './motion.jsx';
import { reviewQueue, reviewAction, matchesReview } from './coach-review.js';
import { Intelligence } from "./ecosystem/intelligence.jsx";
import { FormLab } from "./formlab-entry.jsx";
import { SmartSchedule } from "./ecosystem/scheduling.jsx";
import { CheckinQueue } from "./checkins.jsx";
import { CoachingMemory } from "./ecosystem/memory.jsx";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useEditDraft, EditSaveBar } from "./edit-draft.jsx";
import { nutritionDay, targetValues } from "./nutrition-model.js";
import { programError } from './validation.js';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Download,
  FileText,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useApp } from "./context.js";
import { CoachPayments } from "./payments.jsx";
import { useWorkspaceSave } from "./workspace-save.js";
import { connection } from "./ecosystem/connection.js";
import {
  attentionFor,
  dayKey,
  decision,
  download,
  getFile,
  metrics,
  offsetDay,
  saveFile,
  scheduleDay,
  shortDate,
  sum,
  uid,
  round,
} from "./store.js";
import { defaultProgram, newClient } from "./seed.js";
import { ClientRecoveryWidget, CoachWearableCard, WearableLine, useWearableSummary } from "./wearables.jsx";
import { COACH_WIDGETS, resolveLayout } from "./home-layout.js";
import { CustomiseHome, EditHomeButton } from "./HomeEditor.jsx";
import {
  Avatar,
  Bars,
  Button,
  Empty,
  Field,
  Heading,
  IconButton,
  IMAGES,
  BACKGROUNDS,
  LineChart,
  Media,
  Modal,
  Notice,
  Quote,
  SectionHead,
  Stat,
  Tabs,
} from "./ui.jsx";
import { Progress } from "./client.jsx";
import {
  ClientChanges,
  ProgressionSuggestions,
  HabitEditor,
  CustomExercise,
} from "./insights.jsx";
import { Checkins, Feed, Messages } from "./communication.jsx";
import { RecoveryMap } from "./RecoveryMap.jsx";
import { IntakeCard } from "./IntakeFlow.jsx";

import { matchesSearch, t } from './i18n.js';
import { REGIONS, groupLabel, libraryWithCatalogue, planExercise, regionOf } from './exercise-catalogue.js';
import { MealFoodsEditor } from './MealFoods.jsx';
import { dayTotals, itemsTotals } from './portions.js';
function ReviewQueue({category = 'All'}) {
  const {data, update, selectClient, ask} = useApp();
  const wearables = useWearableSummary();
  const rows = reviewQueue(data, wearables).map(row => ({...row, flags: row.flags.filter(flag => matchesReview(flag, category))})).filter(row => row.flags.length);
  const review = (client, flag) => flag.tab === 'Messages' ? ask('', '', client.id) : selectClient(client.id, flag.tab);
  return <MotionList className="review-queue">{rows.length ? rows.map(({client, flags},index) => <article className={`review-queue-item ${index===0?'review-queue-next':''}`} key={client.id}>
    {index===0 && <span className="review-next-label">{t('UP NEXT')} <span>{rows.length} {rows.length===1?'client':'clients'} {t('in this view')}</span></span>}
    <div className="review-queue-person"><Avatar name={client.name}/><span><b>{t(client.name)}</b><small>{t(client.program.name)}</small></span><button className="icon-btn" aria-label={t('Open {name}', { name: client.name })} onClick={() => selectClient(client.id)}><ChevronRight size={18}/></button></div>
    <h3>{t(flags[0].title)}</h3><p>{t(flags[0].detail)}</p>
    <div className="button-row"><Button small onClick={() => review(client, flags[0])}>{reviewAction(flags[0])}<ArrowRight size={15}/></Button>{flags[0].key !== 'message' && <button className="text-link" onClick={() => ask('', '', client.id)}>{t('Message')}</button>}</div>
    <details><summary>{flags.length > 1 ? t('{count} more items & options', { count: flags.length - 1 }) : t('Review options')}</summary>{flags.slice(1).map(flag => <button className="simple-row" key={flag.key} onClick={() => review(client, flag)}><span>{t(flag.title)}</span><ChevronRight size={15}/></button>)}<button className="text-link muted" onClick={() => update(d => {d.dismissed.push({clientId: client.id, key: flags[0].key, until: dayKey()}); decision(d, client.id, 'Review snoozed', `${flags[0].title}. Snoozed until tomorrow.`);})}>{t('Snooze until tomorrow')}</button></details>
  </article>) : <Empty key="caught-up" icon={Check} title={t('You’re all caught up')} detail={category === 'All' ? t('No active review items across your clients.') : t('No {value} waiting. Choose All to see other coaching tasks.', { value: t(category).toLowerCase() })}/>}</MotionList>;
}

export function Dashboard() {
  const {data, navigate, selectClient} = useApp();
  const [category, setCategory] = useState('All');
  const wearables = useWearableSummary();
  const flagged = reviewQueue(data, wearables);
  const active = data.clients.filter(client => !client.paused);
  const [editingHome, setEditingHome] = useState(false);
  const homeWidgets = {
    summary: <div className="coach-day-summary" aria-label={t('Coaching overview')}><button onClick={() => navigate('clients')}><b>{active.length}</b><span>{t('Active clients')}</span><ChevronRight size={15}/></button><button onClick={() => navigate('inbox', 'Check-ins')}><b>{data.checkins.filter(row => !row.reviewed && active.some(client => client.id === row.clientId)).length}</b><span>{t('Check-ins to review')}</span><ChevronRight size={15}/></button></div>,
    queue: <>
    <section className="coach-task-workspace" aria-label={t('Your review queue')}>
      <SectionHead title={t('Your review queue')} action={<span className="muted">{flagged.length} {flagged.length === 1 ? 'client' : 'clients'}</span>}/>
      <Tabs label={t('Review type')} items={['All', 'Check-ins', 'Messages', 'Technique'].map(name => [name, <React.Fragment key={name}>{t(name)}<small>{flagged.filter(row => row.flags.some(flag => matchesReview(flag, name))).length}</small></React.Fragment>])} value={category} onChange={setCategory}/>
      <ReviewQueue category={category}/>
    </section>
    </>,
    recovery: <ClientRecoveryWidget summary={wearables}/>,
    insights: <MotionDetails className="coach-secondary-section"><summary>{t('Coaching insights')} <ChevronRight size={17}/></summary><Intelligence compact/></MotionDetails>,
    progress: <MotionDetails className="coach-secondary-section"><summary>{t('Client progress')} <ChevronRight size={17}/></summary>{data.clients.filter(client => !client.paused).slice(0, 3).map(client => <button className="simple-row" key={client.id} onClick={() => selectClient(client.id, 'Progress')}><Avatar name={client.name}/><span><b>{t(client.name)}</b><small>{t('{length} sessions completed in 28 days', { length: metrics(data, client.id).sessions.length })}</small></span><ArrowRight size={15}/></button>)}</MotionDetails>,
  };
  return <>
    <Heading title={(new Date().getHours() < 12 ? t('Good morning, {name}.', { name: data.coach.name.split(' ')[0] }) : t('Good afternoon, {name}.', { name: data.coach.name.split(' ')[0] }))} subtitle={t('Review, respond, and get your clients moving.')}/>
    {resolveLayout(data.coach.homeLayout, COACH_WIDGETS, 'coach').filter((w) => w.visible).map((w) => <React.Fragment key={w.id}>{homeWidgets[w.id]}</React.Fragment>)}
    <EditHomeButton onClick={() => setEditingHome(true)}/>
    {editingHome && <CustomiseHome widgets={COACH_WIDGETS} saved={data.coach.homeLayout} role="coach" onClose={() => setEditingHome(false)} write={(d, layout) => { if (layout) d.coach.homeLayout = layout; else delete d.coach.homeLayout; }}/>}
  </>;
}

function ClientSections({value, onChange}) {
  const secondary = ['Intelligence', 'FormLab', 'Coaching Memory', 'Billing', 'Documents'];
  const [more, setMore] = useState(secondary.includes(value));
  useEffect(() => {if (secondary.includes(value)) setMore(true);}, [value]);
  return <div className="client-sections">
    <Tabs label={t('Client essentials')} items={['Overview', 'Plan', 'Nutrition', 'Progress', 'Check-ins']} value={value} onChange={section => {setMore(false); onChange(section);}}/>
    <button className="client-more-toggle" aria-label={t('More sections')} aria-expanded={more} aria-controls="client-more-sections" onClick={() => setMore(!more)}>{secondary.includes(value) ? value : t('More')}<ChevronRight size={15}/></button>
    {more && <div id="client-more-sections" className="client-more-sections"><Tabs label={t('More client sections')} items={secondary} value={value} onChange={onChange}/></div>}
  </div>;
}

export function Clients() {
  const {save, saving, error:saveError} = useWorkspaceSave();
  const {
    data,
    update,
    selectedClientId,
    selectClient,
    clientTab,
    setClientTab,
  } = useApp();
  const wearables = useWearableSummary();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [adding, setAdding] = useState(false);
  const selected = data.clients.find((c) => c.id === selectedClientId);
  if (selected)
    return (
      <ClientDetail
        key={selected.id}
        client={selected}
        tab={clientTab}
        setTab={setClientTab}
      />
    );
  const queue = reviewQueue(data, wearables);
  const clientFlags = client => queue.find(row => row.client.id === client.id)?.flags || [];
  const rows = data.clients.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All" ||
        (filter === "Needs attention" && clientFlags(c).length) ||
        (filter === "Paused" && c.paused) ||
        (filter === "On track" && !c.paused && !clientFlags(c).length) ||
        (filter === "Check-in due" &&
          attentionFor(data, c).some((f) => f.key === "checkin")) ||
        (filter === "Ending soon" && c.programEnd <= offsetDay(7))),
  );
  return (
    <>
      <Heading
        title={t('Clients')}
        action={
          <IconButton label={t('Add client')} onClick={() => setAdding(true)}>
            <Plus size={20} />
          </IconButton>
        }
      />
      <label className="search">
        <Search size={17} />
        <input
          aria-label={t('Search clients')}
          placeholder={t('Find a client…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <Tabs
        items={[
          "All",
          "Needs attention",
          "On track",
          "Check-in due",
          "Ending soon",
          "Paused",
        ]}
        value={filter}
        onChange={setFilter}
      />
      <MotionList className="client-grid">
        {rows.map((c) => {
          const m = metrics(data, c.id),
            flags = clientFlags(c);
          return (
            <button
              className="card client-card"
              key={c.id}
              onClick={() => selectClient(c.id, "Overview")}
            >
              <div>
                <Avatar name={c.name} />
                <span>
                  <h3>{t(c.name)}</h3>
                  <small>{t(c.program.name)}</small>
                </span>
                <ChevronRight size={18} />
              </div>
              <div className="client-mini">
                <span>
                  <b>{m.training ?? "—"}%</b>{t('Training')}
                </span>
                <span>
                  <b>{m.nutrition ?? "—"}%</b>{t('Nutrition')}
                </span>
                <span>
                  <b>{m.lastWeight ?? "—"}</b>{t('Weight · kg')}
                </span>
              </div>
              <WearableLine entry={wearables[c.id]} />
              <p
                className={
                  c.paused ? "muted" : flags.length ? flags[0].tone : "green"
                }
              >
                {c.paused ? t('Coaching paused') : flags[0]?.title || t('On track')}
              </p>
            </button>
          );
        })}
      </MotionList>
      {!rows.length && (
        <Empty title={t('No clients found')} detail={t('Try another name or filter.')} />
      )}
      {adding && (
        <Modal title={t('Add a client')} onClose={() => setAdding(false)} canClose={!saving}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fields = new FormData(e.currentTarget),
                c = newClient(fields.get("name"), fields.get("email"));
              c.created = dayKey();
              c.schedule = c.schedule.filter((s) => s.date >= dayKey());
              if (!await save((d) => d.clients.push(c))) return;
              setAdding(false);
              selectClient(c.id, "Plan");
            }}
          >
            <fieldset className="save-fields" disabled={saving}>
            <Field label={t('Full name')} name="name" required maxLength={80} />
            <Field label={t('Email')} name="email" type="email" required />
            <Notice>
              {connection() ? t('This creates a client in your private workspace. Then use Account → Invite a client to create their sign-in invitation.') : t('This creates a client in this device’s workspace. Connect a private workspace to invite clients securely.')}
            </Notice>
            {saveError && <p className="error" role="alert">{saveError}</p>}
            <Button type="submit">{saving ? t('Creating client…') : t('Create client')}</Button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}

function ClientDetail({ client, tab, setTab }) {
  const { data, update, selectClient, navigate, ask, setMessageContext, notify } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [pausing, setPausing] = useState(false), [progressTab, setProgressTab] = useState("Overview");
  const wearables = useWearableSummary();
  const trainedToday = data.sessions.some(row => row.clientId === client.id && row.date === dayKey());
  const flags = reviewQueue(data, wearables).find(row => row.client.id === client.id)?.flags || [],
    m = metrics(data, client.id);
  const queue = reviewQueue(data, wearables);
  const nextReview = queue.find((row,index) => index > queue.findIndex(r => r.client.id === client.id)) || queue.find(row => row.client.id !== client.id);
  const [edit, setEdit] = useState(false);
  return (
    <>
      <div className="review-client-navigation">
        <button className="back-link" onClick={() => selectClient(null)}>
          <ArrowLeft size={16} />
          {t('All clients')}
        </button>
        {nextReview && <button aria-label={t('Next review: {name} · {reviewAction}', { name: nextReview.client.name, reviewAction: reviewAction(nextReview.flags[0]) })} onClick={() => nextReview.flags[0].tab === 'Messages' ? ask('', '', nextReview.client.id) : selectClient(nextReview.client.id,nextReview.flags[0].tab)}>{t('Next review')} <ArrowRight size={16}/></button>}
      </div>
      <Heading title={client.name} subtitle={client.goal} />
      <div className="coach-client-actions"><Button secondary small onClick={() => ask('', '', client.id)}><MessageCircle size={16}/>{t('Message')} {client.name.split(' ')[0]}</Button><span>{client.paused ? t('Coaching paused') : flags.length ? t('{count} items to review', { count: flags.length }) : t('All caught up')}</span></div>
      {pausing && <Modal title={client.paused ? t('Resume coaching for {value}?', { value: client.name.split(' ')[0] }) : t('Pause coaching for {value}?', { value: client.name.split(' ')[0] })} onClose={() => setPausing(false)} canClose={!saving}>
        <p>{client.paused ? t('Reminders, review items and coaching insights start again from today.') : t('Check-in reminders, review items and coaching insights stop until you resume. Their records, programme and access stay as they are.')}</p>
        <p className="muted">{t('Membership and billing are managed separately and do not change.')}</p>
        {saveError && <p className="error" role="alert">{saveError}</p>}
        <Button disabled={saving} onClick={async () => {
          const paused = !client.paused;
          if (await save(d => { d.clients.find(c => c.id === client.id).paused = paused; decision(d, client.id, paused ? 'Coaching paused' : 'Coaching resumed', paused ? 'Reminders and review items stopped by the coach.' : 'Reminders and review items started again.'); })) { setPausing(false); notify(paused ? t('Coaching paused') : t('Coaching resumed')); }
        }}>{saving ? t('Saving…') : client.paused ? t('Resume coaching') : t('Pause coaching')}</Button>
      </Modal>}
      <ClientSections value={tab} onChange={setTab}/>
      {tab === "Overview" && (
        <>
          <IntakeCard client={client} />
          <ClientChanges key={client.id} client={client} />
          <RecoveryMap compact coach clientId={client.id} day={trainedToday ? null : scheduleDay(client, dayKey())} onOpen={() => { setProgressTab("Recovery"); setTab("Progress"); }} />
          <CoachWearableCard key={`wearables-${client.id}`} client={client} onPlan={() => setTab("Plan")} />
          <div className="three-stats">
            <Stat
              label={t('Training')}
              value={`${m.training ?? "—"}%`}
              note={t('Last 28 days')}
            />
            <Stat
              label={t('Nutrition')}
              value={`${m.nutrition ?? "—"}%`}
              note={t('Of logged days')}
            />
            <Stat
              label={t('Latest weight')}
              value={`${m.lastWeight ?? "—"} ${t('kg')}`}
              note={t('{length} measurements', { length: m.weights.length })}
            />
          </div>
          {flags.map((f) => (
            <div className="card flag-detail" key={f.key}>
              <div>
                <span className={`status-icon ${f.tone}`}>
                  <Bell size={17} />
                </span>
                <h3>{t(f.title)}</h3>
              </div>
              <p>{t(f.detail)}</p>
              <div className="button-row">
                <button className="text-link" onClick={() => f.tab === 'Messages' ? ask('', '', client.id) : setTab(f.tab)}>
                  {reviewAction(f)} <ArrowRight size={14} />
                </button>
                <button
                  className="text-link muted"
                  onClick={() =>
                    update((d) => {
                      d.dismissed.push({
                        clientId: client.id,
                        key: f.key,
                        until: offsetDay(7),
                      });
                      decision(
                        d,
                        client.id,
                        "Attention flag snoozed",
                        `${f.title}. Snoozed for 7 days.`,
                      );
                    })
                  }
                >
                  {t('Snooze 7 days')}
                </button>
              </div>
            </div>
          ))}
          <div className="client-pause-row"><span><b>{client.paused ? t('Coaching is paused') : t('Taking a break?')}</b><small>{client.paused ? t('Reminders and review items are stopped.') : t('Pause reminders and review items for this client.')}</small></span><button className="text-link" onClick={() => setPausing(true)}>{client.paused ? t('Resume coaching') : t('Pause coaching')}</button></div>
        </>
      )}
      {tab === "Plan" && <ClientPlan client={client} onEdit={() => setEdit(true)}/>}
      {tab === "Nutrition" && <NutritionEditor client={client} />}{" "}
      {tab === "Progress" && <Progress clientOverride={client} startTab={progressTab} />}{" "}
      {tab === "Intelligence" && <Intelligence client={client}/>}
      {tab === "FormLab" && <FormLab client={client} coach/>}
      {tab === "Check-ins" && <Checkins clientId={client.id} coach />}{" "}
      {["Timeline","Coaching Memory"].includes(tab) && <CoachingMemory clientId={client.id} coach/>}{" "}
      {tab === "Billing" && <BillingEditor client={client} />}{" "}
      {tab === "Documents" && <Documents client={client} />}{" "}
      {edit && (
        <ProgramEditor
          program={client.program}
          draftKey={`client.${client.id}`}
          onClose={() => setEdit(false)}
          onSave={async(program, reason) => {
            const result=await update((d) => {
              d.clients.find((c) => c.id === client.id).program = program;
              decision(
                d,
                client.id,
                "Programme updated",
                reason || "Training plan adjusted.",
              );
            });
            if(result?.error)throw new Error(result.error);
            setEdit(false);
          }}
        />
      )}
    </>
  );
}

function ClientPlan({client, onEdit}) {
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

export function Programs() {
  const { data, update } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [editing, setEditing] = useState(null),
    [assign, setAssign] = useState(null),
    [clientId, setClientId] = useState(data.clients[0].id);
  const programs = data.templates;
  return (
    <>
      <Heading
        title={t('Programs')}
        action={
          <IconButton
            label={t('Create programme')}
            onClick={() => setEditing(defaultProgram())}
          >
            <Plus size={21} />
          </IconButton>
        }
      />
      <div className="client-grid">
        {programs.map((p) => (
          <section className="card" key={p.id}>
            <span className="eyebrow">{t('{weeks} WEEKS · {length} DAYS', { weeks: p.weeks, length: p.days.length })}</span>
            <h2>{t(p.name)}</h2>
            <p>{p.phase}</p>
            <div className="button-row">
              <Button
                small
                secondary
                onClick={() => setEditing(structuredClone(p))}
              >
                {t('Edit')}
              </Button>
              <Button small onClick={() => setAssign(p)}>
                {t('Assign')}
              </Button>
              <button
                className="text-link"
                onClick={() =>
                  setEditing({
                    ...structuredClone(p),
                    id: uid(),
                    name: p.name + " · copy",
                  })
                }
              >
                {t('Duplicate')}
              </button>
            </div>
          </section>
        ))}
      </div>
      {!programs.length && (
        <Empty
          icon={FileText}
          title={t('Your coaching method, repeatable.')}
          detail={t('Create a reusable template, then assign it to a client. Their copy can be adjusted independently.')}
          action={
            <Button onClick={() => setEditing(defaultProgram())}>
              {t('Create your first programme')} <Plus size={16} />
            </Button>
          }
        />
      )}
      <section className="card">
        <SectionHead
          title={t('Exercise library')}
          action={<span className="pill">{t('{length} movements', { length: libraryWithCatalogue(data.library).length })}</span>}
        />
        <p className="muted">
          {t('The programme builder includes sets, reps, load, rest, tempo, RPE, RIR and coaching notes for every movement.')}
        </p>
      </section>
      {editing && (
        <ProgramEditor
          program={editing}
          onClose={() => setEditing(null)}
          onSave={async(p) => {
            const result=await update((d) => {
              d.templates = d.templates.filter((t) => t.id !== p.id);
              d.templates.push(p);
            });
            if(result?.error)throw new Error(result.error);
            setEditing(null);
          }}
        />
      )}
      {assign && (
        <Modal title={t('Assign programme')} onClose={() => setAssign(null)} canClose={!saving}>
          <fieldset className="save-fields" disabled={saving}>
          <Field label={t('Client')}>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.name)}
                </option>
              ))}
            </select>
          </Field>
          <Notice>{t('This replaces the client’s current plan and schedules four sessions per week for the full {weeks}-week programme. Completed workout history is kept.', { weeks: assign.weeks })}</Notice>
          <Button
            onClick={async () => {
              if (!await save((d) => {
                const c = d.clients.find((c) => c.id === clientId);
                c.program = structuredClone(assign);
                c.schedule = c.schedule.filter((s) => s.date < dayKey() || d.sessions.some(x=>x.clientId===c.id && x.date===s.date));
                let n = 0;
                for (let i = 0; i < Number(assign.weeks) * 7; i++) {
                  const date = offsetDay(i);
                  if (
                    !d.sessions.some(x=>x.clientId===c.id && x.date===date) && [1, 2, 4, 6].includes(
                      new Date(date + "T12:00:00").getDay(),
                    )
                  )
                    c.schedule.push({
                      date,
                      dayId: c.program.days[n++ % c.program.days.length].id,
                    });
                }
                c.programEnd = offsetDay(assign.weeks * 7 - 1);
                decision(d, c.id, "Programme assigned", assign.name);
              })) return;
              setAssign(null);
            }}
          >
            {saving ? t('Assigning programme…') : t('Confirm assignment')}
          </Button>
          {saveError && <p className="error" role="alert">{saveError}</p>}
          </fieldset>
        </Modal>
      )}
    </>
  );
}

export function ProgramEditor({ program, onClose, onSave, draftKey = `template.${program.id}` }) {
  const { data } = useApp();
  const uploadLock = useRef(false);
  const [uploading, setUploading] = useState(false);
  const editor = useEditDraft(`programme.${draftKey}`, { plan: program, reason: '' });
  const draft = editor.value.plan, reason = editor.value.reason;
  const setDraft = value => editor.setValue(prev => ({ ...prev, plan: typeof value === 'function' ? value(prev.plan) : value }));
  const setReason = reason => editor.setValue(prev => ({ ...prev, reason }));
  const [dayIndex, setDayIndex] = useState(0),
    [search, setSearch] = useState(""),
    [region, setRegion] = useState("All"),
    [error, setError] = useState("");
  const day = draft.days[dayIndex];
  const choices = useMemo(() => libraryWithCatalogue(data.library).filter((e) => (region === "All" || regionOf(e.group) === region) && matchesSearch(search, [e.name, e.equipment, groupLabel(e.group)])), [data.library, region, search]);
  function change(fn) {
    setError('');
    setDraft((prev) => {
      const d = structuredClone(prev);
      fn(d);
      return d;
    });
  }
  async function attach(event, dayId, exerciseId, image = false) {
    const input = event.currentTarget;
    const selected = input.files?.[0];
    if (!selected || uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    setError('');
    try {
      const target=draftKey.startsWith('client.')?{clientId:draftKey.slice(7)}:{scope:'workspace'};const file = await saveFile(selected, exerciseId ? { types: [image ? 'image/' : 'video/'], maxMB: image ? 10 : 30,...target } : { ...target });
      change(d => {
        const targetDay = d.days.find(item => item.id === dayId);
        const target = exerciseId ? targetDay?.exercises.find(item => item.id === exerciseId) : targetDay;
        if (target) target[exerciseId ? image ? 'imageFile' : 'videoFile' : 'coverFile'] = file;
      });
    } catch (error) { setError(error.message); }
    finally { uploadLock.current = false; setUploading(false); input.value = ''; }
  }
  return (
    <Modal title={t('Programme builder')} onClose={() => { if (!uploadLock.current) onClose(); }} wide>
      <Field
        label={t('Programme name')}
        value={draft.name}
        maxLength={70}
        onChange={(e) => change((d) => (d.name = e.target.value))}
      />
      <div className="form-grid">
        <Field
          label={t('Phase')}
          value={draft.phase}
          onChange={(e) => change((d) => (d.phase = e.target.value))}
        />
        <Field
          label={t('Weeks')}
          type="number"
          min="1"
          max="52"
          value={draft.weeks}
          onChange={(e) =>
            change(
              (d) =>
                (d.weeks = e.target.value),
            )
          }
        />
      </div>
      <Tabs
        items={draft.days.map((d, i) => [i, d.name])}
        value={dayIndex}
        onChange={setDayIndex}
      />
      <div className="button-row">
        <button
          className="text-link"
          onClick={() => {
            change((d) =>
              d.days.push({
                id: uid(),
                name: `Day ${d.days.length + 1}`,
                cover: 0,
                minutes: 45,
                exercises: [],
              }),
            );
            setDayIndex(draft.days.length);
          }}
        >
          {t('+ Add day')}
        </button>
        <button
          className="text-link"
          onClick={() => {
            change((d) =>
              d.days.push({
                ...structuredClone(day),
                id: uid(),
                name: day.name + " copy",
                exercises: day.exercises.map((e) => ({ ...e, id: uid() })),
              }),
            );
            setDayIndex(draft.days.length);
          }}
        >
          {t('Duplicate day')}
        </button>
      </div>
      <div className="card">
        <Field
          label={t('Day name')}
          maxLength={70}
          value={day.name}
          onChange={(e) =>
            change((d) => (d.days[dayIndex].name = e.target.value))
          }
        />
        <div className="form-grid">
          <Field label={t('Cover')}>
            <select
              value={day.cover}
              onChange={(e) =>
                change((d) => {
                  d.days[dayIndex].cover = Number(e.target.value);
                  d.days[dayIndex].coverFile = null;
                })
              }
            >
              {BACKGROUNDS.map((n, i) => (
                <option value={i} key={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t('Estimated minutes')}
            type="number"
            min="5"
            max="180"
            value={day.minutes}
            onChange={(e) =>
              change((d) => (d.days[dayIndex].minutes = Number(e.target.value)))
            }
          />
        </div>
        <label className="upload-inline">
          {t('Upload a workout cover')}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => attach(e, day.id)}
          />
        </label>
        {day.coverFile && <p className="muted">{t(day.coverFile.name)}</p>}
      </div>
      {day.exercises.map((ex, i) => (
        <details className="card exercise-editor" key={ex.id}>
          <summary>
            <span className="exercise-number">{i + 1}</span>
            <span>
              <b>{t(ex.name)}</b>
              <small>{t('{sets} × {reps} · {weight} kg · {rest}s rest', { sets: ex.sets, reps: ex.reps, weight: ex.weight, rest: ex.rest })}</small>
            </span>
          </summary>
          <div className="form-grid">
            {[
              ["sets", "Sets", 1, 20],
              ["reps", "Reps", 1, 100],
              ["weight", "Load (kg)", 0, 1000],
              ["rest", "Rest (seconds)", 0, 600],
              ["rpe", "RPE", 1, 10],
              ["rir", "Reps in reserve", 0, 10],
            ].map(([key, label, min, max]) => (
              <Field
                key={key}
                label={label}
                type="number"
                min={min}
                max={max}
                step={key === "weight" ? 0.5 : 1}
                value={ex[key] ?? 0}
                onChange={(e) =>
                  change(
                    (d) =>
                      (d.days[dayIndex].exercises[i][key] = e.target.value),
                  )
                }
              />
            ))}
          </div>
          <Field
            label={t('Tempo')}
            value={ex.tempo}
            onChange={(e) =>
              change(
                (d) => (d.days[dayIndex].exercises[i].tempo = e.target.value),
              )
            }
          />
          <Field label={t('Coaching notes')}>
            <textarea
              value={ex.notes}
              onChange={(e) =>
                change(
                  (d) => (d.days[dayIndex].exercises[i].notes = e.target.value),
                )
              }
            />
          </Field>
          <label className="upload-inline">
            {t('Attach demonstration video')}
            <input
              type="file"
              accept="video/*"
              disabled={uploading}
              onChange={(e) => attach(e, day.id, ex.id)}
            />
          </label>
          {ex.videoFile && <div className="button-row"><p className="muted">{t(ex.videoFile.name)}</p><button className="text-link" onClick={() => change(d => delete d.days[dayIndex].exercises[i].videoFile)}>{t('Remove video')}</button></div>}
          <label className="upload-inline">{t('Attach exercise photo')}<input type="file" accept="image/*" disabled={uploading} onChange={e => attach(e, day.id, ex.id, true)}/></label>
          {ex.imageFile && <div className="button-row"><p className="muted">{t(ex.imageFile.name)}</p><button className="text-link" onClick={() => change(d => delete d.days[dayIndex].exercises[i].imageFile)}>{t('Remove photo')}</button></div>}
          <p className="muted">{t('Clients can open this photo or video from the exercise demonstration.')}</p>
          <div className="button-row">
            <button
              className="text-link"
              disabled={i === 0}
              onClick={() =>
                change((d) => {
                  const arr = d.days[dayIndex].exercises;
                  [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                })
              }
            >
              {t('Move up')}
            </button>
            <button
              className="text-link"
              onClick={() =>
                change((d) => d.days[dayIndex].exercises.splice(i, 1))
              }
            >
              {t('Remove')}
            </button>
          </div>
        </details>
      ))}
      <label className="search">
        <Search size={17} />
        <input
          placeholder={t('Add an exercise…')}
          aria-label={t('Search exercise library')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <Tabs label={t('Muscle group')} items={['All', ...REGIONS.map((name) => [name, groupLabel(name)])]} value={region} onChange={setRegion} />
      <p className="muted exercise-library-count">{t('{length} movements', { length: choices.length })}</p>
      <div className="exercise-library">
        {choices.map((ex) => (
            <button
              key={ex.id}
              onClick={() =>
                change((d) =>
                  d.days[dayIndex].exercises.push({ ...planExercise(ex), id: uid() }),
                )
              }
            >
              <span>{t(ex.name)}{ex.equipment && <small>{t(ex.equipment)}</small>}</span>
              <Plus size={14} />
            </button>
          ))}
      </div>
      <CustomExercise
        onAdded={(ex) =>
          change((d) => d.days[dayIndex].exercises.push({ ...ex, id: uid() }))
        }
      />
      <Field label={t('Reason for change (saved to client timeline)')}>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <EditSaveBar draft={editor} label={uploading ? t('Saving attachment…') : t('Save programme')}
        disabled={uploading}
        onSave={async() => {
          if (uploadLock.current) return;
          const error = programError(draft);
          if (error) { setError(error); return; }
          const result = structuredClone(draft);
          result.name = result.name.trim();
          result.weeks = Number(result.weeks);
          for (const day of result.days) {
            day.name = day.name.trim();
            day.minutes = Number(day.minutes);
            for (const exercise of day.exercises) for (const key of ['sets', 'reps', 'weight', 'rest', 'rpe', 'rir']) exercise[key] = Number(exercise[key]);
          }
          setUploading(true);try{await onSave(result, reason.trim());editor.clear({ plan: result, reason: "" });}catch(e){setError(e.message);}finally{setUploading(false);}
        }}
      />
    </Modal>
  );
}

// The day as planned, from every meal, beside the targets the coach set above.
function DayTotals({ meals, targets, structured }) {
  const rows = dayTotals(meals, targets);
  const off = rows.some((row) => row.status === 'short' || row.status === 'over');
  return <div className="plan-day-totals" role="group" aria-label={t('Day total from meals')}>
    <div className="plan-day-totals-head"><span className="eyebrow">{t('Day total from meals')}</span><small>{t('Compared with your targets')}</small></div>
    {rows.map((row) => <div key={row.key} className={`plan-day-row is-${row.status}`}>
      <span>{t(row.label)}</span>
      <b>{t('{value} of {target} {unit}', { value: row.value.toLocaleString(), target: row.target.toLocaleString(), unit: t(row.unit) })}</b>
      <small>{row.status === 'on' ? t('On target') : row.status === 'short' ? t('{amount} {unit} short', { amount: Math.abs(row.diff).toLocaleString(), unit: t(row.unit) }) : row.status === 'over' ? t('{amount} {unit} over', { amount: Math.abs(row.diff).toLocaleString(), unit: t(row.unit) }) : t('No target')}</small>
      <i aria-hidden="true"><em style={{ inlineSize: `${row.target ? Math.min(100, (row.value / row.target) * 100) : 0}%` }}/></i>
      {row.missing > 0 && row.key !== 'kcal' && <small className="plan-day-missing">{t('Not entered for {count} meals', { count: row.missing })}</small>}
    </div>)}
    {structured && off && <p className="fine-print muted">{t('Review any difference before publishing.')}</p>}
  </div>;
}

function NutritionEditor({ client }) {
  const { update } = useApp();
  const draft = useEditDraft(`nutrition.${client.id}`, { plan: client.nutrition, reason: '' });
  const form = draft.value.plan, reason = draft.value.reason;
  const setForm = plan => draft.setValue(v => ({ ...v, plan }));
  const setReason = reason => draft.setValue(v => ({ ...v, reason }));
  const [saved, setSaved] = useState(false),[saveError,setSaveError]=useState(''),[saving,setSaving]=useState(false);
  return (
    <section className="card">
      <SectionHead title={t('Nutrition prescription')} />
      <form
        onChangeCapture={() => setSaved(false)}
        onSubmit={async(e) => {
          e.preventDefault();
          if(saving)return;setSaving(true);setSaveError('');const result=await update((d) => {
            const c = d.clients.find((c) => c.id === client.id),
              old = c.nutrition.kcal;
            c.nutrition = structuredClone(form);
            const day = nutritionDay(d,client.id,dayKey());
            if (day) { day.target = targetValues(form); day.complete = false; }
            decision(
              d,
              client.id,
              "Nutrition adjusted",
              `${old} → ${form.kcal} kcal. ${reason}`,
            );
          });
          setSaving(false);if(result?.error){setSaveError(result.error);return;}
          draft.clear({ plan: structuredClone(form), reason: '' });
          setSaved(true);
        }}
      >
        <Field label={t('Approach')}>
          <select
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value })}
          >
            <option value="Flexible">{t('Flexible')}</option>
            <option value="Structured">{t('Structured')}</option>
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
              required
              min="1"
              max={key === "kcal" ? 10000 : 1000}
              value={form[key]}
              onChange={(e) => {
                setForm({ ...form, [key]: Number(e.target.value) });
                setSaved(false);
              }}
            />
          ))}
        </div>
        <div className="nutrition-meal-editor"><SectionHead title={form.mode === 'Structured' ? t('Your prescribed meals') : t('Suggested meals')}/>
          <DayTotals meals={form.meals || []} targets={form} structured={form.mode === "Structured"} />
          {(form.meals || []).map((m,i)=><MotionDetails className="card coach-meal-editor" key={i} open={i===0 || !m.description || undefined}><summary><span><b>{m.name || t('New meal')}</b><small>{m.description || (m.items?.length ? m.items.map(x => t(x.name)).join(', ') : t('Add meal guidance'))}</small></span><span>{Number(m.kcal || 0).toLocaleString()} kcal<ChevronRight size={16}/></span></summary><div className="coach-meal-fields">
            <Field label={t('Meal name')} required maxLength={70} value={m.name} onChange={e=>setForm({...form,meals:form.meals.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/>
            <Field label={t('Meal guidance')} maxLength={500} value={m.description} onChange={e=>setForm({...form,meals:form.meals.map((x,j)=>j===i?{...x,description:e.target.value}:x)})}/>
            <MealFoodsEditor items={m.items || []} onChange={items=>setForm({...form,meals:form.meals.map((x,j)=>j===i?{...x,items,...(items.length?itemsTotals(items):{})}:x)})}/>
            <div className="form-grid">{[['kcal','Meal calories'],['p','Meal protein (g)'],['c','Meal carbs (g)'],['f','Meal fat (g)']].map(([key,label])=><Field key={key} label={label} type="number" min="0" step={key==='kcal'?'1':'0.1'} max={key==='kcal'?10000:1000} required={key==='kcal'} value={m[key]??''} onChange={e=>setForm({...form,meals:form.meals.map((x,j)=>j===i?{...x,[key]:e.target.value===''?null:Number(e.target.value)}:x)})}/>)}</div>
            <button type="button" className="text-link red" onClick={()=>setForm({...form,meals:form.meals.filter((_,j)=>i!==j)})}><Trash2 size={14}/>{t('Remove meal')}</button>
          </div></MotionDetails>)}
          <Button secondary onClick={()=>setForm({...form,meals:[...(form.meals||[]),{name:'Snack',description:'',kcal:0,p:null,c:null,f:null}]})}><Plus size={15}/>{t('Add planned meal')}</Button>
        </div>
        <Field label={t('Why are you making this change?')}>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
{saveError&&<p role="alert" className="error">{saveError}</p>}<EditSaveBar draft={draft} disabled={saving} label={t('Save nutrition plan')} saved={saved}/>
        {saved && (
          <Notice>{t('Updated. The client’s targets now reflect this plan.')}</Notice>
        )}
      </form>
    </section>
  );
}

function ScheduleEditor({ client }) {
  const { update,data } = useApp();
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const saveLock = useRef(false);
  const [date, setDate] = useState(dayKey()),
    [day, setDay] = useState(client.program.days[0].id),
    [saved, setSaved] = useState(false);
  const valid = Boolean(date && !data.sessions.some(s=>s.clientId===client.id && s.date===date) && date >= dayKey() && (day === 'rest' || client.program.days.some(item => item.id === day)));
  return (
    <section className="card">
      <SectionHead title={t('Adjust the schedule')} />
      <div className="form-grid">
        <Field
          label={t('Date')}
          type="date"
          min={dayKey()}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSaved(false);
          }}
        />
        <Field label={t('Workout')}>
          <select value={day} onChange={(e) => { setDay(e.target.value); setSaved(false); }}>
            <option value="rest">{t('Rest day')}</option>
            {client.program.days.map((d) => (
              <option key={d.id} value={d.id}>
                {t(d.name)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Button
        secondary
        disabled={!valid || saving}
        onClick={async () => {
          if (!valid || saveLock.current) return;
          saveLock.current = true; setSaving(true); setError(''); setSaved(false);
          const result = await update((d) => {
            const c = d.clients.find((x) => x.id === client.id);
            c.schedule = c.schedule.filter((s) => s.date !== date);
            if (day !== "rest") c.schedule.push({ date, dayId: day });
            decision(
              d,
              client.id,
              "Schedule adjusted",
              `${date}: ${day === "rest" ? "Rest day" : c.program.days.find((x) => x.id === day).name}`,
            );
          });
          saveLock.current = false; setSaving(false);
          if (result?.error) {setError(result.error); return;}
          setSaved(true);
        }}
      >
        {saving ? t('Saving schedule…') : t('Save schedule')}
      </Button>
      {saved && <Notice>{t('Schedule updated.')}</Notice>}
      {error && <p role="alert" className="error">{error}</p>}
      {!valid && <p className="error" role="alert">{t('Choose today or a future date and an available workout.')}</p>}
    </section>
  );
}
function TravelPlan({ client }) {
  const { data, update } = useApp();
  const [start, setStart] = useState(dayKey()),
    [end, setEnd] = useState(offsetDay(7));
  return (
    <section className="card">
      <SectionHead title={t('Training, wherever life takes them')} />
      <p className="muted">
        {t('Travel mode replaces scheduled workouts with a simple bodyweight session for the dates you choose.')}
      </p>
      {client.travel ? (
        <>
          <Notice>
            {t('Active')} {shortDate(client.travel.start)} –{" "}
            {shortDate(client.travel.end)}
          </Notice>
          <Button
            secondary
            onClick={() =>
              update((d) => {
                d.clients.find((c) => c.id === client.id).travel = null;
                decision(
                  d,
                  client.id,
                  "Travel plan ended",
                  "Regular training restored.",
                );
              })
            }
          >
            {t('Restore regular plan')}
          </Button>
        </>
      ) : (
        <>
          <div className="form-grid">
            <Field
              label={t('From')}
              type="date"
              min={dayKey()}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <Field
              label={t('Through')}
              type="date"
              min={start}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          <Button
            secondary
            disabled={!start || end < start}
            onClick={() =>
              update((d) => {
                d.clients.find((c) => c.id === client.id).travel = {
                  start,
                  end,
                  days: [
                    {
                      id: "travel",
                      name: "Travel · Full Body",
                      cover: 3,
                      minutes: 25,
                      exercises: data.library
                        .filter((e) =>
                          ["Push-up", "Bodyweight squat"].includes(e.name),
                        )
                        .map((e) => ({ ...e, id: uid() })),
                    },
                  ],
                };
                decision(
                  d,
                  client.id,
                  "Travel plan activated",
                  `${start} to ${end}. Bodyweight programme.`,
                );
              })
            }
          >
            {t('Activate travel mode')}
          </Button>
        </>
      )}
    </section>
  );
}

export function Inbox() {
  const { data, update, subtab, setSubtab, messageContext, setMessageContext } = useApp();
  const tab = ["Messages", "Check-ins", "Feed"].includes(subtab)
    ? subtab
    : "Messages";
  const client =
    data.clients.find((c) => c.id === messageContext?.clientId) || data.clients.find((c) => c.id === data.activeClientId) || data.clients[0];
  // Phones show one pane at a time; arriving with a client in mind opens their thread.
  // Selection stays in messageContext: changing activeClientId remounts the whole page.
  const [threadOpen, setThreadOpen] = useState(Boolean(messageContext?.clientId));
  useEffect(() => { if (messageContext?.clientId) setThreadOpen(true); }, [messageContext?.clientId]);
  // Opening a thread marks it read, so a hidden one on a phone must stay unmounted.
  const showThread = threadOpen || matchMedia('(min-width: 761px)').matches;
  const threads = data.clients.map(c => {
    const rows = data.messages.filter(m => m.clientId === c.id).sort((a, b) => a.at.localeCompare(b.at));
    return {
      c,
      last: rows.at(-1),
      unread: rows.filter(m => m.from === 'client' && !m.read).length,
      pending: data.checkins.filter(r => r.clientId === c.id && !r.reviewed).length,
    };
  }).sort((a, b) => b.unread - a.unread || (b.last?.at || '').localeCompare(a.last?.at || ''));
  return (
    <>
      <Heading title={t('Inbox')} />
      <Tabs
        items={["Messages", "Check-ins", "Feed"]}
        value={tab}
        onChange={setSubtab}
      />
      {tab==='Check-ins' && <CheckinQueue/>}
      {tab === 'Messages' && <div className={`inbox-workspace ${threadOpen ? 'is-thread' : 'is-list'}`}><MotionList className="inbox-client-list" aria-label={t('Client conversations')}>{threads.map(({c, last, unread, pending}) => <button key={c.id} aria-label={t('Open conversation with {name}', { name: c.name })} aria-current={c.id === client.id ? 'true' : undefined} onClick={() => { setMessageContext({title:'', text:'', clientId:c.id}); setThreadOpen(true); }}><Avatar name={c.name}/><span><b>{t(c.name)}</b><small>{last ? <>{last.from === 'coach' ? t('You: ') : ''}{last.text || t('Sent a file')}</> : t('No messages yet')}</small></span><span className="inbox-thread-meta">{last && <time>{shortDate(last.at.slice(0, 10))}</time>}{unread > 0 ? <em aria-label={t('{unread} unread', { unread })}>{unread}</em> : pending > 0 ? <small>{t('Check-in')}</small> : null}</span></button>)}</MotionList><div className="inbox-thread"><button className="back-link inbox-back" onClick={() => { setMessageContext(null); setThreadOpen(false); }}><ArrowLeft size={16}/>{t('All conversations')}</button>{showThread && <Messages key={client.id} clientId={client.id} coach/>}</div></div>}
      {tab === 'Feed' && <Feed coach/>}
    </>
  );
}

export function Business() {
  const { data, selectClient, update, subtab, setSubtab } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const tab = subtab === "Brand" ? "Brand" : subtab === "Subscriptions" ? "Subscriptions" : "Payments",
    setTab = setSubtab;
  const [logoError, setLogoError] = useState("");
  const [brand, setBrand] = useState(data.coach.brand),
    [name, setName] = useState(data.coach.name),
    [saved, setSaved] = useState(false);
  const [logo, setLogo] = useState(data.coach.logo),
    [uploading, setUploading] = useState(false);
  return (
    <>
      <Heading title={t('Business')} />
      <Tabs items={["Payments", "Subscriptions", "Brand"]} value={tab} onChange={setTab} />
      {tab === "Payments" ? <CoachPayments/> : tab === "Subscriptions" ? (
        <>
          <div className="three-stats">
            <Stat
              label={t('Active memberships')}
              value={
                data.clients.filter((c) => c.subscription.status === "Active")
                  .length
              }
            />
            <Stat
              label={t('Overdue')}
              value={
                data.clients.filter((c) => c.subscription.status === "Overdue")
                  .length
              }
            />
            <Stat
              label={t('Billing method')}
              value="Manual"
              note={t('No payment processor connected')}
            />
          </div>
          <SectionHead
            title={t('Subscription records')}
            action={
              <button
                className="text-link"
                onClick={() => {
                  const csv = [
                    [
                      "Client",
                      "Plan",
                      "Amount",
                      "Currency",
                      "Status",
                      "Next due",
                    ],
                    ...data.clients.map((c) => [
                      c.name,
                      c.subscription.plan,
                      c.subscription.amount,
                      c.subscription.currency,
                      c.subscription.status,
                      c.subscription.nextDate,
                    ]),
                  ]
                    .map((r) =>
                      r
                        .map(
                          (v) =>
                            '"' +
                            String(v)
                              .replaceAll('"', '""')
                              .replace(/^[=+@-]/, "'$&") +
                            '"',
                        )
                        .join(","),
                    )
                    .join("\n");
                  download(
                    new Blob([csv], { type: "text/csv" }),
                    "avalen-subscriptions.csv",
                  );
                }}
              >
                <Download size={15} />
                {t('Export')}
              </button>
            }
          />
          <div className="card list">
            {data.clients.map((c) => (
              <button
                className="simple-row"
                key={c.id}
                onClick={() => selectClient(c.id, "Billing")}
              >
                <Avatar name={c.name} />
                <span>
                  <b>{t(c.name)}</b>
                  <small>
                    {shortDate(c.subscription.nextDate)} ·{" "}
                    {c.subscription.status}
                  </small>
                </span>
                <b>
                  {c.subscription.amount.toLocaleString()}
                  <small>{c.subscription.currency}</small>
                </b>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          <Notice>
            {t('These are coach-maintained records, not verified payments. No cards are stored and no money is collected by this preview.')}
          </Notice>
        </>
      ) : (
        <section className="card">
          <SectionHead title={t('Your coaching identity')} />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaved(false);
              if (!await save((d) => {
                d.coach.brand = brand;
                d.coach.name = name;
                d.coach.logo = logo;
              })) return;
              setSaved(true);
            }}
          >
            <fieldset className="save-fields" disabled={saving}>
            <Field
              label={t('Coaching brand')}
              required
              maxLength={35}
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setSaved(false);
              }}
            />
            <Field
              label={t('Coach name')}
              required
              maxLength={60}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
            <label className="upload-zone">
              {t('Upload your logo')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={async (e) => {
                  if (e.target.files[0]) {
                    setUploading(true);
                    setSaved(false);
                    try {
                      const file = await saveFile(e.target.files[0], {
                        types: ["image/png", "image/jpeg", "image/webp"],
                        maxMB: 5,scope:'workspace',
                      });
                      setLogo(file);
                      setLogoError("");
                    } catch (e) {
                      setLogoError(e.message);
                    } finally {
                      setUploading(false);
                    }
                  }
                }}
              />
            </label>
            {logo && (
              <>
                <Media
                  className="brand-preview"
                  fileId={logo.id}
                  alt={t('Coaching logo')}
                />
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setLogo(null);
                    setSaved(false);
                  }}
                >
                  {t('Use Avalen mark')}
                </button>
              </>
            )}
            <Notice>
              {t('Applies to all')} {data.clients.length} {t('clients connected to this coach’s workspace, including future clients. Your logo appears in their app, desktop sidebar and workout-share images. It does not change the installed iPhone or Android app icon.')} {connection() ? t('Changes are saved to your private workspace for your connected clients.') : t('This preview saves branding locally. Connect a private workspace to share changes across devices.')}
            </Notice>
            <Button type="submit" disabled={uploading}>
              {saving ? t('Saving brand…') : uploading ? t('Preparing logo…') : t('Save brand')}
            </Button>
            {saved && (
              <Notice>{t('Brand saved for all {length} connected clients.', { length: data.clients.length })}</Notice>
            )}
            {logoError && <p className="error">{logoError}</p>}
            {saveError && <p className="error" role="alert">{saveError}</p>}
            </fieldset>
          </form>
        </section>
      )}
    </>
  );
}

function BillingEditor({ client }) {
  const { update } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [form, setForm] = useState({ ...client.subscription }),
    [saved, setSaved] = useState(false);
  return (
    <section className="card">
      <SectionHead title={t('Membership & billing')} />
      <form
        onChangeCapture={() => setSaved(false)}
        onSubmit={async (e) => {
          e.preventDefault();
          setSaved(false);
          if (!await save((d) => {
            d.clients.find((c) => c.id === client.id).subscription = { ...form, plan: form.plan.trim() };
            decision(
              d,
              client.id,
              "Membership updated",
              `${form.plan} · ${form.currency} ${form.amount} · ${form.status} · next due ${form.nextDate}. Manual record.`,
            );
          })) return;
          setSaved(true);
        }}
      >
        <fieldset className="save-fields" disabled={saving}>
        <Field
          label={t('Membership')}
          required
          value={form.plan}
          onChange={(e) => setForm({ ...form, plan: e.target.value })}
        />
        <div className="form-grid">
          <Field
            label={t('Amount')}
            type="number"
            min="0"
            required
            value={form.amount}
            onChange={(e) =>
              setForm({ ...form, amount: Number(e.target.value) })
            }
          />
          <Field label={t('Currency')}>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              {["EGP", "USD", "EUR", "GBP", "AED", "SAR"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field
            label={t('Next due date')}
            type="date"
            required
            value={form.nextDate}
            onChange={(e) => setForm({ ...form, nextDate: e.target.value })}
          />
          <Field label={t('Status')}>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {["Active", "Overdue", "Paused", "Cancelled"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
        </div>
        <Notice>
          {t('Manual record only. Saving this form does not charge a client or verify a payment.')}
        </Notice>
        {saveError && <p className="error" role="alert">{saveError}</p>}
        <Button type="submit">{saving ? t('Saving membership…') : t('Save membership')}</Button>
        {saved && <Notice>{t('Membership updated.')}</Notice>}
        </fieldset>
      </form>
    </section>
  );
}

function Documents({ client }) {
  const { data, update } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [saved, setSaved] = useState(false);
  const [pendingDocument, setPendingDocument] = useState(null);
  const [error, setError] = useState(""),
    [form, setForm] = useState({
      date: dayKey(),
      weight: "",
      bodyFat: "",
      muscle: "",
    }),
    [report, setReport] = useState(null),
    [busy, setBusy] = useState(false);
  const docs = data.documents.filter((d) => d.clientId === client.id);
  async function addDocument(row) {
    const result = await update(d => {
      if (!d.documents.some(doc => doc.id === row.id)) d.documents.push(row);
    });
    if (result?.error) throw new Error(result.error);
    setPendingDocument(null);
    setError('');
  }
  return (
    <>
      <section className="card">
        <SectionHead title={t('Client files')} />
        <label className="upload-zone">
          <FileText size={25} />
          <b>{busy ? t('Saving…') : t('Add a PDF or image report')}</b>
          <span>{connection() ? t('Private workspace storage') : t('Stored on this device')} {t('· up to 15 MB')}</span>
          <input
            disabled={busy || Boolean(pendingDocument)}
            type="file"
            accept="application/pdf,image/*"
            onChange={async (e) => {
              if (!e.target.files[0]) return;
              setBusy(true);
              try {
                const file = await saveFile(e.target.files[0], {
                  types: ["application/pdf", "image/"],
                  maxMB: 15,clientId:client.id,
                });
                const row = {
                    id: uid(),
                    clientId: client.id,
                    file,
                    date: dayKey(),
                };
                setPendingDocument(row);
                await addDocument(row);
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {pendingDocument && <div><p className="muted">{t('{name} is prepared, but its report entry has not been confirmed. Retry the save to keep it in this client’s files.', { name: pendingDocument.file.name })}</p><Button secondary disabled={busy} onClick={async () => {setBusy(true);try {await addDocument(pendingDocument);} catch(cause) {setError(cause.message);} finally {setBusy(false);}}}>{busy ? t('Saving report…') : t('Retry adding report')}</Button></div>}
        {docs.map((doc) => (
          <button
            className="simple-row"
            key={doc.id}
            onClick={async () => {
              try {
                const file = await getFile(doc.file.id);
                if (!file) throw Error();
                download(file, doc.file.name);
              } catch {
                setError(t('This file is not available in this browser.'));
              }
            }}
          >
            <FileText size={18} />
            <span>
              <b>{t(doc.file.name)}</b>
              <small>{shortDate(doc.date)}</small>
            </span>
            <Download size={17} />
          </button>
        ))}
      </section>
      <section className="card">
        <SectionHead title={t('Verified InBody values')} />
        <p className="muted">
          {t('Enter values from the report. They appear in the client’s body-composition graphs. Automatic PDF extraction is not connected.')}
        </p>
        <form
          onChangeCapture={() => setSaved(false)}
          onSubmit={async (e) => {
            e.preventDefault();
            setSaved(false);
            if (!await save((d) => {
              if (d.inbodies.some(record => record.clientId === client.id && record.date === form.date && record.documentId === report && ['weight', 'bodyFat', 'muscle'].every(key => Number(record[key]) === Number(form[key])))) return;
              d.inbodies.push({
                ...form,
                id: uid(),
                clientId: client.id,
                weight: Number(form.weight),
                bodyFat: Number(form.bodyFat),
                muscle: Number(form.muscle),
                documentId: report,
              });
              decision(
                d,
                client.id,
                "InBody report verified",
                `${form.weight} kg · ${form.bodyFat}% body fat · ${form.muscle} kg skeletal muscle.`,
              );
            })) return;
            setForm({ ...form, weight: "", bodyFat: "", muscle: "" });
            setSaved(true);
          }}
        >
          <fieldset className="save-fields" disabled={saving}>
          <Field label={t('Report')}>
            <select
              value={report || ""}
              onChange={(e) => setReport(e.target.value)}
            >
              <option value="">{t('No file linked')}</option>
              {docs.map((d) => (
                <option value={d.id} key={d.id}>
                  {t(d.file.name)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t('Measurement date')}
            type="date"
            max={dayKey()}
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <div className="form-grid">
            {[
              ["weight", "Weight (kg)", 20, 400],
              ["bodyFat", "Body fat (%)", 1, 70],
              ["muscle", "Skeletal muscle (kg)", 1, 150],
            ].map(([key, label, min, max]) => (
              <Field
                key={key}
                label={label}
                type="number"
                min={min}
                max={max}
                step=".1"
                required
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            ))}
          </div>
          {saveError && <p className="error" role="alert">{saveError}</p>}
          <Button type="submit">{saving ? t('Saving measurements…') : t('Save verified measurements')}</Button>
          {saved && <Notice>{t('Verified measurements saved to this client’s body-composition history.')}</Notice>}
          </fieldset>
        </form>
        {data.inbodies
          .filter((r) => r.clientId === client.id)
          .map((r) => (
            <div className="simple-row" key={r.id}>
              <span>{shortDate(r.date)}</span>
              <b>{t('{weight} kg · {bodyFat}% · {muscle} kg muscle', { weight: r.weight, bodyFat: r.bodyFat, muscle: r.muscle })}</b>
            </div>
          ))}
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
