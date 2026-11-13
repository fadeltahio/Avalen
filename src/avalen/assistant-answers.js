import { t } from './i18n.js';
// Avalen assistant: answers built only from records saved in Avalen.
// Nothing here guesses. When the data is missing, the answer says so.
import { attentionFor, dayKey, metrics, offsetDay, round, scheduleDay, shortDate } from './store.js';
import { analyzeClient } from './ecosystem/intelligence.js';
import { formatMoney, paymentState } from './payments-model.js';

export const PROMPTS = {
  client: [
    ['week', 'How did my week go?'],
    ['next', 'What’s my next workout?'],
    ['protein', 'Am I hitting my protein?'],
    ['lifts', 'What are my best lifts?'],
    ['focus', 'What should I focus on?'],
  ],
  coach: [
    ['attention', 'Who needs attention?'],
    ['checkins', 'Which check-ins are due?'],
    ['missed', 'Who missed workouts?'],
    ['summary', 'How is my client doing?'],
    ['billing', 'Any payments overdue?'],
  ],
};

const ROUTES = {
  client: [
    // Topic words come before time words, so "protein today" is about protein.
    ['protein', /protein|macro|calorie|kcal|eat|food|nutrition|diet/i],
    ['lifts', /best|record|\bprs?\b|strong|heaviest|lift/i],
    ['next', /next|today|tomorrow|upcoming|session|workout\b(?!s? missed)/i],
    ['week', /week|how am i|how did|progress|doing/i],
    ['focus', /focus|improve|work on|advice|tip|should i/i],
  ],
  coach: [
    ['checkins', /check.?in/i],
    ['missed', /miss|skipp|absent|didn.?t train/i],
    ['billing', /pay|bill|overdue|invoice|money/i],
    ['summary', /how is|summary|summari[sz]e|overview|doing/i],
    ['attention', /attention|who needs|flag|risk|priority|urgent|today/i],
  ],
};

export function intentFor(role, question) {
  return ROUTES[role]?.find(([, pattern]) => pattern.test(question))?.[0] || null;
}

const sessionsOf = (data, clientId) => data.sessions.filter(s => s.clientId === clientId);
const loggedSets = session => session.sets.filter(set => !set.skipped);
const estimate = set => set.weight * (1 + set.reps / 30);

function week(data, client, today) {
  const start = offsetDay(-6, today);
  const sessions = sessionsOf(data, client.id).filter(s => s.date >= start && s.date <= today);
  const planned = client.schedule.filter(s => s.date >= start && s.date <= today);
  const done = planned.filter(p => sessions.some(s => s.date === p.date)).length;
  const foodDays = new Set(data.foodLogs.filter(f => f.clientId === client.id && f.date >= start && f.date <= today).map(f => f.date)).size;
  const volume = sessions.reduce((n, s) => n + loggedSets(s).reduce((m, x) => m + (x.kind === 'Duration' ? 0 : x.weight * x.reps), 0), 0);
  if (!sessions.length && !planned.length && !foodDays) return { text: t('Nothing is logged for the last 7 days yet. Log a workout or a meal and your week builds here.') };
  return {
    text: planned.length ? t('You completed {done} of {count} planned workouts in the last 7 days.', { done, count: planned.length }) : t('You logged {count} workouts in the last 7 days.', { count: sessions.length }),
    points: [
      ['Workouts logged', String(sessions.length)],
      [t('Volume lifted'), `${Math.round(volume).toLocaleString()} ${t('kg')}`],
      ['Days with food logged', `${foodDays} of 7`],
    ],
  };
}

function next(data, client, today) {
  const trainedToday = sessionsOf(data, client.id).some(s => s.date === today);
  const upcoming = [...client.schedule].filter(s => s.date > today || (s.date === today && !trainedToday)).sort((a, b) => a.date.localeCompare(b.date));
  for (const slot of upcoming) {
    const day = scheduleDay(client, slot.date);
    if (!day) continue;
    const when = slot.date === today ? 'Today' : slot.date === offsetDay(1, today) ? 'Tomorrow' : shortDate(slot.date);
    return {
      text: `${when}: ${day.name}.`,
      points: day.exercises.slice(0, 4).map(e => [e.name, `${e.sets} × ${e.reps}${e.kind === 'Duration' ? ' sec' : ''}`]),
      more: day.exercises.length > 4 ? `+ ${day.exercises.length - 4} more` : null,
      action: { label: t('Open training'), screen: 'plan', tab: 'Training' },
    };
  }
  return { text: t('No upcoming workout is scheduled yet. Your coach adds sessions to your plan.') };
}

function protein(data, client, today) {
  const target = Number(client.nutrition?.p) || 0;
  if (!target) return { text: t('Your coach hasn’t set a protein target yet.') };
  const logs = data.foodLogs.filter(f => f.clientId === client.id);
  const eaten = round(logs.filter(f => f.date === today).reduce((n, f) => n + Number(f.p || 0), 0));
  const start = offsetDay(-6, today);
  const days = {};
  logs.filter(f => f.date >= start && f.date < today).forEach(f => { days[f.date] = (days[f.date] || 0) + Number(f.p || 0); });
  const values = Object.values(days);
  const average = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const left = Math.max(0, round(target - eaten));
  return {
    text: eaten >= target ? t('Yes. You’ve logged {eaten} g of your {target} g protein today.', { eaten, target }) : eaten ? t('You’ve logged {eaten} g of {target} g today. {left} g to go.', { eaten, target, left }) : t('No protein logged today yet. Your target is {target} g.', { target }),
    points: [['Today', `${eaten} / ${target} g`], ...(average !== null ? [[`Daily average · ${values.length} logged ${values.length === 1 ? 'day' : 'days'}`, `${average} g`]] : [])],
    action: { label: t('Open nutrition'), screen: 'nutrition' },
  };
}

function lifts(data, client) {
  const best = {};
  sessionsOf(data, client.id).forEach(s => loggedSets(s).filter(x => x.kind !== 'Duration' && x.weight > 0).forEach(x => {
    if (!best[x.name] || estimate(x) > estimate(best[x.name].set)) best[x.name] = { set: x, date: s.date };
  }));
  const top = Object.entries(best).sort((a, b) => estimate(b[1].set) - estimate(a[1].set)).slice(0, 3);
  if (!top.length) return { text: t('No weighted sets are logged yet. Your best lifts appear here after your first workout.') };
  return {
    text: t('Your strongest logged sets, by estimated one-rep max:'),
    points: top.map(([name, { set, date }]) => [t(name), `${round(set.weight)} ${t('kg')} × ${set.reps} · ${shortDate(date)}`]),
    action: { label: t('Open progress'), screen: 'progress' },
  };
}

function focus(data, client) {
  let found = [];
  try { found = analyzeClient(data, client).sort((a, b) => a.priority - b.priority).slice(0, 3); } catch { found = []; }
  if (!found.length) return { text: t('Nothing stands out in your recent records. Keep logging so your coach sees the full picture.') };
  return { text: t('From your last four weeks of records:'), points: found.map(i => [i.title, '']), note: t('These are observations from saved data, not a diagnosis. Talk them through with your coach.') };
}

const activeClients = data => data.clients.filter(c => !c.paused);
function flagged(data, key) {
  return activeClients(data).map(c => ({ client: c, flag: attentionFor(data, c).find(f => !key || f.key === key) })).filter(row => row.flag);
}

function attention(data) {
  const rows = activeClients(data).map(c => ({ client: c, flags: attentionFor(data, c) })).filter(r => r.flags.length).sort((a, b) => b.flags.length - a.flags.length);
  if (!rows.length) return { text: t('No client needs attention right now. Every active client is on track in their saved records.') };
  return {
    text: t('{count} clients need attention:', { count: rows.length }),
    points: rows.slice(0, 5).map(r => [r.client.name, r.flags[0].title + (r.flags.length > 1 ? ` · +${r.flags.length - 1} more` : ''), r.client.id]),
  };
}

function byFlag(data, key, empty, heading) {
  const rows = flagged(data, key);
  if (!rows.length) return { text: empty };
  return { text: heading(rows.length), points: rows.slice(0, 6).map(r => [r.client.name, r.flag.title, r.client.id]) };
}

function summary(data, selectedId, today) {
  const client = data.clients.find(c => c.id === selectedId);
  if (!client) {
    const active = activeClients(data), needs = active.filter(c => attentionFor(data, c).length).length;
    return { text: t('You coach {count} active clients. {needs} need attention. Open a client and ask again for a full summary.', { count: active.length, needs }) };
  }
  const m = metrics(data, client.id, today, 28);
  return {
    text: t('{name}, last 28 days:', { name: client.name }),
    points: [
      ['Training completed', m.training === null ? 'No sessions planned' : `${m.training}%`],
      ['Nutrition on target', m.nutrition === null ? 'Not enough logged days' : `${m.nutrition}% of ${m.nutritionDays} days`],
      [t('Weight change'), m.change === null ? t('Not enough weigh-ins') : `${m.change > 0 ? '+' : ''}${m.change} ${t('kg')}`],
      ['Last check-in', m.lastCheckin ? shortDate(m.lastCheckin.date) : 'None yet'],
    ],
    clientId: client.id,
  };
}

// role: 'client' | 'coach'. Returns { text, points?: [label, value, clientId?][], action?, note? }.
export function answer(intent, { data, client, role, selectedClientId, today = dayKey() }) {
  if (role === 'coach') {
    if (intent === 'attention') return attention(data);
    if (intent === 'checkins') return byFlag(data, 'checkin', 'No check-ins are due or overdue.', n => `${n} ${n === 1 ? 'check-in is' : 'check-ins are'} due:`);
    if (intent === 'missed') return byFlag(data, 'training', 'No client has missed two or more planned workouts in the last 3 weeks.', n => `${n} ${n === 1 ? 'client has' : 'clients have'} missed workouts:`);
    if (intent === 'billing') {
      const overdue = (data.payments || []).filter(p => paymentState(p, today) === 'overdue');
      if (data.payments?.length) {
        if (!overdue.length) return { text: t('No payments are overdue.'), action: { label: t('Open payments'), screen: 'business', tab: 'Payments' } };
        return { text: t('{count} payments overdue:', { count: overdue.length }), points: overdue.slice(0, 6).map(p => [data.clients.find(c => c.id === p.clientId)?.name || 'Client', `${formatMoney(p.amount, p.currency)} · due ${shortDate(p.dueDate)}`, p.clientId]), action: { label: t('Open payments'), screen: 'business', tab: 'Payments' } };
      }
      return byFlag(data, 'billing', 'No payments are overdue.', n => `${n} ${n === 1 ? 'payment is' : 'payments are'} overdue:`);
    }
    if (intent === 'summary') return summary(data, selectedClientId, today);
  } else {
    if (intent === 'week') return week(data, client, today);
    if (intent === 'next') return next(data, client, today);
    if (intent === 'protein') return protein(data, client, today);
    if (intent === 'lifts') return lifts(data, client);
    if (intent === 'focus') return focus(data, client);
  }
  return {
    text: role === 'coach'
      ? t('I can answer from your saved Avalen records, like the questions above. Open-ended answers need Avalen AI to be connected, and it isn’t set up yet.')
      : t('I can answer from your saved Avalen records, like the questions above. For anything else, message your coach. Open-ended answers need Avalen AI to be connected, and it isn’t set up yet.'),
    fallback: true,
  };
}
