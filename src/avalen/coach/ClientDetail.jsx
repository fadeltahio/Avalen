// One client's full record from the coach's side: the overview, and every tab
// (plan, nutrition, progress, intelligence, form reviews, check-ins, memory,
// billing, documents) reached from it.
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, ChevronRight, MessageCircle } from 'lucide-react';
import { useApp } from '../context.js';
import { useWorkspaceSave } from '../workspace-save.js';
import { reviewQueue, reviewAction, dismissFlag } from '../coach-review.js';
import { useWearableSummary, CoachWearableCard } from '../wearables.jsx';
import { dayKey, decision, metrics, scheduleDay } from '../store.js';
import { Button, Heading, Modal, Stat, Tabs } from '../ui.jsx';
import { t } from '../i18n.js';
import { Progress } from '../client.jsx';
import { Intelligence } from '../ecosystem/intelligence.jsx';
import { FormLab } from '../formlab-entry.jsx';
import { Checkins } from '../communication.jsx';
import { CoachingMemory } from '../ecosystem/memory.jsx';
import { IntakeCard } from '../IntakeFlow.jsx';
import { ClientChanges } from '../insights.jsx';
import { RecoveryMap } from '../RecoveryMap.jsx';
import { ClientPlan } from './ClientPlan.jsx';
import { NutritionEditor } from './NutritionEditor.jsx';
import { BillingEditor } from './BillingEditor.jsx';
import { Documents } from './Documents.jsx';
import { ProgramEditor } from './ProgramEditor.jsx';

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


export function ClientDetail({ client, tab, setTab }) {
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
                    update((d) =>
                      dismissFlag(d, client.id, f.key, {
                        title: "Attention flag snoozed",
                        detail: `${f.title}. Snoozed for 7 days.`,
                      }),
                    )
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

