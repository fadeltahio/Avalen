// The coach's home screen: the review queue and the customisable widget stack.
import React, { useState } from 'react';
import { ChevronRight, ArrowRight, Check } from 'lucide-react';
import { MotionList, MotionDetails } from '../motion.jsx';
import { reviewQueue, reviewAction, matchesReview, dismissFlag } from '../coach-review.js';
import { Intelligence } from '../ecosystem/intelligence.jsx';
import { useApp } from '../context.js';
import { metrics } from '../store.js';
import { ClientRecoveryWidget, useWearableSummary } from '../wearables.jsx';
import { COACH_WIDGETS, resolveLayout } from '../home-layout.js';
import { CustomiseHome, EditHomeButton } from '../HomeEditor.jsx';
import { Avatar, Button, Empty, Heading, SectionHead, Tabs } from '../ui.jsx';
import { t } from '../i18n.js';

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
    <details><summary>{flags.length > 1 ? t('{count} more items & options', { count: flags.length - 1 }) : t('Review options')}</summary>{flags.slice(1).map(flag => <button className="simple-row" key={flag.key} onClick={() => review(client, flag)}><span>{t(flag.title)}</span><ChevronRight size={15}/></button>)}<button className="text-link muted" onClick={() => update(d => dismissFlag(d, client.id, flags[0].key, { days: 0, title: 'Review snoozed', detail: `${flags[0].title}. Snoozed until tomorrow.` }))}>{t('Snooze until tomorrow')}</button></details>
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

