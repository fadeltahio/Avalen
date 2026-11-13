// The coach's inbox: client conversations, pending check-ins and the activity feed.
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MotionList } from '../motion.jsx';
import { CheckinQueue } from '../checkins.jsx';
import { useApp } from '../context.js';
import { shortDate } from '../store.js';
import { Avatar, Heading, Tabs } from '../ui.jsx';
import { Feed, Messages } from '../communication.jsx';
import { t } from '../i18n.js';

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

