// Coach payments: shared by the app and the server, so both apply the same rules.
// Money goes from the client to the coach's own Paymob account. Avalen only keeps
// the record, and only Paymob's signed confirmation can mark a payment verified.
import { uid } from './id.js';

export const REGIONS = {
  egypt: { label: 'Egypt', host: 'https://accept.paymob.com', currency: 'EGP' },
  ksa: { label: 'Saudi Arabia', host: 'https://ksa.paymob.com', currency: 'SAR' },
  uae: { label: 'United Arab Emirates', host: 'https://uae.paymob.com', currency: 'AED' },
  oman: { label: 'Oman', host: 'https://oman.paymob.com', currency: 'OMR' },
};
// Minor units per major unit (Paymob amounts are sent in minor units).
export const CURRENCIES = { EGP: 100, SAR: 100, AED: 100, OMR: 1000 };
export const METHODS = { paymob: 'Paymob', cash: 'Cash', instapay: 'InstaPay', bank: 'Bank transfer', wallet: 'Mobile wallet', other: 'Other' };
export const MANUAL_METHODS = ['cash', 'instapay', 'bank', 'wallet', 'other'];
const STATUSES = ['due', 'paid', 'void'];

export const toMinor = (amount, currency) => Math.round(Number(amount) * (CURRENCIES[currency] || 100));
export const fromMinor = (minor, currency) => Number(minor) / (CURRENCIES[currency] || 100);
export const periodOf = (day) => String(day).slice(0, 7);
export function periodLabel(period, style = 'long') {
  return new Date(`${period}-01T12:00:00`).toLocaleDateString('en', { month: style, year: 'numeric' });
}
export function shiftPeriod(period, months) {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
export const lastPeriods = (period, count = 6) => Array.from({ length: count }, (_, i) => shiftPeriod(period, i - count + 1));
export function formatMoney(amount, currency) {
  const digits = CURRENCIES[currency] === 1000 ? 3 : 2;
  const value = Number(amount || 0);
  return `${value.toLocaleString('en', { minimumFractionDigits: Number.isInteger(value) ? 0 : digits, maximumFractionDigits: digits })} ${currency}`;
}

const day = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime());

export function paymentState(payment, today) {
  if (payment.status === 'paid' || payment.status === 'void') return payment.status;
  return payment.dueDate && payment.dueDate < today ? 'overdue' : 'due';
}

// One record's own shape. Returns a sentence a coach can act on, or null.
export function paymentError(p) {
  if (!p || typeof p !== 'object') return 'Invalid payment.';
  if (typeof p.id !== 'string' || !p.id || p.id.length > 100) return 'Invalid payment.';
  if (typeof p.clientId !== 'string' || !p.clientId) return 'Choose a client.';
  if (!CURRENCIES[p.currency]) return 'Choose a supported currency.';
  const amount = Number(p.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return 'Enter an amount above zero.';
  if (Math.abs(toMinor(amount, p.currency) - amount * CURRENCIES[p.currency]) > 1e-6) return 'That amount has too many decimal places.';
  if (typeof p.label !== 'string' || !p.label.trim() || p.label.length > 120) return 'Add a short description (up to 120 characters).';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.period || '')) return 'Choose the month this payment is for.';
  if (p.dueDate != null && !day(p.dueDate)) return 'Choose a valid due date.';
  if (!STATUSES.includes(p.status)) return 'Invalid payment status.';
  if (p.method != null && !METHODS[p.method]) return 'Choose how it was paid.';
  if (p.status === 'paid' && (!p.method || !p.paidAt || !Number.isFinite(Date.parse(p.paidAt)))) return 'A paid record needs a method and a date.';
  if (p.note != null && (typeof p.note !== 'string' || p.note.length > 500)) return 'Keep the note under 500 characters.';
  return null;
}

const frozen = (p) => Boolean(p.verified || p.paymob?.transactionId);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const without = (p, keys) => Object.fromEntries(Object.entries(p).filter(([k]) => !keys.includes(k)));

// Who may change what. Clients never edit payments; coaches add requests and manual
// records, mark requests paid by hand, void, and add notes. Paymob-confirmed records
// and server-written Paymob details are untouchable. Returns an error or null.
export function paymentChangeError(previous = [], next, role) {
  if (same(previous, next)) return null;
  if (role !== 'coach') return 'Payments are managed by your coach and Paymob.';
  if (!Array.isArray(next) || next.length > 20000) return 'Invalid payments.';
  const ids = new Set();
  for (const row of next) {
    if (ids.has(row?.id)) return 'Duplicate payment.';
    ids.add(row?.id);
  }
  if (previous.some((row) => !ids.has(row.id))) return 'Void a payment instead of deleting it.';
  for (const row of next) {
    const old = previous.find((p) => p.id === row.id);
    if (old && same(old, row)) continue;
    if (old && frozen(old)) return 'Paymob-confirmed payments cannot be changed.';
    const issue = paymentError(row);
    if (issue) return issue;
    if (row.verified) return 'Only Paymob can confirm a payment.';
    if (!old) {
      if (row.paymob?.transactionId || row.paymob?.attempts?.length) return 'Only Paymob can confirm a payment.';
      if (row.status === 'void') return 'Invalid payment status.';
      if (row.status === 'paid' && !MANUAL_METHODS.includes(row.method)) return 'Record how it was paid: cash, InstaPay, bank, wallet or other.';
      continue;
    }
    if (frozen(old)) return 'Paymob-confirmed payments cannot be changed.';
    if (old.status === 'void') return 'A voided payment cannot be changed.';
    if (!same(old.paymob, row.paymob)) return 'Only Paymob can confirm a payment.';
    for (const key of ['clientId', 'createdAt']) if (!same(old[key], row[key])) return 'This part of a payment cannot change.';
    if (old.status === 'paid') {
      if (!same(without(old, ['status', 'note']), without(row, ['status', 'note'])) || !['paid', 'void'].includes(row.status))
        return 'A recorded payment can only get a note or be voided.';
      continue;
    }
    // old.status === 'due'
    if (row.status === 'paid' && !MANUAL_METHODS.includes(row.method)) return 'Record how it was paid: cash, InstaPay, bank, wallet or other.';
    if (old.paymob?.attempts?.length && (!same(old.amount, row.amount) || old.currency !== row.currency))
      return 'The client has started paying this request. Void it and send a new one to change the amount.';
  }
  return null;
}

// ---- Workspace changes the coach makes (used with update(d => ...)) ----
const now = () => new Date().toISOString();
const clean = (value) => String(value || '').trim();
export function requestPayment(d, { clientId, amount, currency, label, dueDate, period }) {
  d.payments ||= [];
  const record = { id: uid(), clientId, amount: Number(amount), currency, label: clean(label), period, dueDate, status: 'due', method: null, verified: false, paidAt: null, createdAt: now() };
  const issue = paymentError(record);
  if (issue) throw new Error(issue);
  d.payments.push(record);
  return record;
}
export function recordPayment(d, { clientId, amount, currency, label, period, method, paidOn, note }) {
  d.payments ||= [];
  const record = { id: uid(), clientId, amount: Number(amount), currency, label: clean(label), period, dueDate: null, status: 'paid', method, verified: false, paidAt: new Date(`${paidOn}T12:00:00`).toISOString(), createdAt: now(), ...(clean(note) ? { note: clean(note) } : {}) };
  const issue = paymentError(record) || (MANUAL_METHODS.includes(method) ? null : 'Choose how it was paid.');
  if (issue) throw new Error(issue);
  d.payments.push(record);
  return record;
}
export function markPaid(d, id, method, paidOn) {
  const record = d.payments.find((p) => p.id === id);
  if (!record || record.status !== 'due') throw new Error('This payment is no longer due.');
  if (!MANUAL_METHODS.includes(method)) throw new Error('Choose how it was paid.');
  Object.assign(record, { status: 'paid', method, paidAt: new Date(`${paidOn}T12:00:00`).toISOString() });
}
export function voidPayment(d, id) {
  const record = d.payments.find((p) => p.id === id);
  if (!record || frozen(record) || record.status === 'void') throw new Error('This payment cannot be voided.');
  record.status = 'void';
}

// ---- What the coach sees ----
const add = (totals, currency, amount) => { totals[currency] = Math.round(((totals[currency] || 0) + Number(amount)) * 1000) / 1000; return totals; };
const ORDER = { overdue: 0, due: 1, none: 2, paid: 3 };
// Paid money counts toward the month it is for (its period).
export function monthSummary(data, period, today) {
  const payments = (data.payments || []).filter((p) => p.period === period && p.status !== 'void');
  const earned = {}, outstanding = {};
  for (const p of payments) {
    if (p.status === 'paid') add(earned, p.currency, p.amount);
    else add(outstanding, p.currency, p.amount);
  }
  const rows = data.clients.filter((c) => !c.paused).map((client) => {
    const mine = payments.filter((p) => p.clientId === client.id);
    const states = mine.map((p) => paymentState(p, today));
    const state = states.includes('overdue') ? 'overdue' : states.includes('due') ? 'due' : states.includes('paid') ? 'paid' : 'none';
    return { client, state, payments: mine };
  }).sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.client.name.localeCompare(b.client.name));
  return {
    period, earned, outstanding, rows,
    paid: rows.filter((r) => r.state === 'paid').length,
    unpaid: rows.filter((r) => r.state === 'due' || r.state === 'overdue').length,
    overdue: rows.filter((r) => r.state === 'overdue').length,
    unrequested: rows.filter((r) => r.state === 'none').length,
  };
}
export function earningsByMonth(data, periods) {
  return periods.map((period) => ({ period, totals: (data.payments || []).filter((p) => p.period === period && p.status === 'paid').reduce((t, p) => add(t, p.currency, p.amount), {}) }));
}
// The currency most of the coach's money is in, for headline figures.
export function mainCurrency(data, fallback = 'EGP') {
  const counts = {};
  for (const p of data.payments || []) counts[p.currency] = (counts[p.currency] || 0) + 1;
  for (const c of data.clients || []) if (c.subscription?.currency) counts[c.subscription.currency] = (counts[c.subscription.currency] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
}
export const clientPayments = (data, clientId) => (data.payments || []).filter((p) => p.clientId === clientId && p.status !== 'void');
