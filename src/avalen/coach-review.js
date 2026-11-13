import {attentionFor, dayKey, shortDate} from './store.js';
import {wearableFlag} from './wearables-model.js';

import { t } from './i18n.js';
const priority = {intake: -1, review: 0, recovery: 0.5, form: 1, schedule: 2, message: 3, training: 4, nutrition: 4, plateau: 5, checkin: 5, billing: 6, ending: 7};
// wearables: latest shared reading per client ({[clientId]: {latest}}), when available.
export function reviewQueue(data, wearables = {}) {
  return data.clients.filter(client => !client.paused).map(client => {
    const pending = data.checkins.filter(row => row.clientId === client.id && !row.reviewed).sort((a, b) => a.date.localeCompare(b.date));
    const unread = data.messages.filter(row => row.clientId === client.id && row.from === 'client' && !row.read);
    const videos = (data.formSubmissions || []).filter(row => row.clientId === client.id && row.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const proposals = (data.scheduleProposals || []).filter(row => row.clientId === client.id && row.status === 'pending');
    const intake = client.intake && !client.intake.reviewedAt ? [{key: 'intake', tone: client.intake.flagged ? 'red' : 'amber', title: t('New client intake'), detail: client.intake.flagged ? t('Health answer needs a look before training starts.') : t('Sent {shortDate}', { shortDate: shortDate(client.intake.submittedAt.slice(0, 10)) }), tab: 'Overview'}] : [];
    const recovery = wearableFlag(wearables[client.id]?.latest, dayKey());
    const flags = [...intake, ...attentionFor(data, client), ...(recovery ? [recovery] : []),
      ...(pending.length ? [{key: 'review', tone: 'amber', title: t('Check-in ready to review'), detail: t('{length} waiting · oldest {shortDate}', { length: pending.length, shortDate: shortDate(pending[0].date) }), tab: 'Check-ins', at: pending[0].date}] : []),
      ...(videos.length ? [{key: 'form', tone: 'amber', title: t('{count} technique videos to review', { count: videos.length }), detail: videos[0].exerciseName, tab: 'FormLab', at: videos[0].createdAt}] : []),
      ...(proposals.length ? [{key: 'schedule', tone: 'amber', title: t('Schedule change awaiting approval'), detail: t('{count} pending requests', { count: proposals.length }), tab: 'Plan', at: proposals[0].createdAt || proposals[0].created}] : []),
      ...(unread.length ? [{key: 'message', tone: 'amber', title: t('{count} unread messages', { count: unread.length }), detail: unread.at(-1).text || t('Client sent an attachment'), tab: 'Messages', at: unread[0].at}] : []),
    ].filter(flag => !(data.dismissed || []).some(row => row.clientId === client.id && row.key === flag.key && row.until >= dayKey())).sort((a, b) => (priority[a.key] ?? 5) - (priority[b.key] ?? 5));
    return {client, flags};
  }).filter(row => row.flags.length).sort((a, b) => (priority[a.flags[0].key] ?? 5) - (priority[b.flags[0].key] ?? 5) || (a.flags[0].at || a.client.created || '').localeCompare(b.flags[0].at || b.client.created || ''));
}
export const reviewAction = flag => ({intake: 'Review intake', review: 'Review check-in', message: t('Read messages'), form: 'Review technique', recovery: 'View recovery', schedule: 'Review schedule', training: 'Review training', nutrition: 'Review nutrition', plateau: 'View trend', checkin: 'View check-ins', billing: 'View billing', ending: 'Review programme'})[flag.key] || 'Review client';
export const matchesReview = (flag, category) => category === 'All' || (category === 'Check-ins' && ['review', 'checkin'].includes(flag.key)) || (category === 'Messages' && flag.key === 'message') || (category === 'Technique' && flag.key === 'form');
