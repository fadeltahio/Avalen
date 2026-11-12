import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, CreditCard, Link2, Plus, ShieldCheck, Wallet } from 'lucide-react';
import { useApp } from './context.js';
import { dayKey, offsetDay, shortDate } from './store.js';
import { connection, refreshConnection, request } from './ecosystem/connection.js';
import { Button, Field, Modal, Notice, SectionHead } from './ui.jsx';
import {
  CURRENCIES, MANUAL_METHODS, METHODS, REGIONS, clientPayments, earningsByMonth, formatMoney, lastPeriods,
  mainCurrency, markPaid, monthSummary, paymentState, periodLabel, periodOf, recordPayment, requestPayment,
  shiftPeriod, voidPayment,
} from './payments-model.js';

const initials = (name) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const STATE_TEXT = { paid: 'Paid', due: 'Due', overdue: 'Overdue', none: 'No request yet' };
const defaultDue = (period) => { const today = dayKey(); return period < periodOf(today) ? today : offsetDay(7, today > `${period}-01` ? today : `${period}-01`); };
const methodText = (p) => (p.verified ? 'Confirmed by Paymob' : p.method ? `${METHODS[p.method]} · recorded by coach` : '');

// Runs a coach change through the shared rules first, so errors show before anything is saved.
async function apply(update, change) {
  const trial = { payments: [] };
  try { change(trial); } catch (error) { return error.message; }
  const result = await update((d) => { d.payments ||= []; change(d); });
  return result?.error || null;
}

export function CoachPayments() {
  const { data, update, selectClient, notify } = useApp();
  const today = dayKey();
  const [period, setPeriod] = useState(periodOf(today));
  const [sheet, setSheet] = useState(null);
  const [account, setAccount] = useState(null);
  const [busy, setBusy] = useState(false);
  const connected = Boolean(connection()?.user);
  useEffect(() => {
    if (!connected) return;
    let live = true;
    request('/payments/account').then((value) => live && setAccount(value)).catch(() => live && setAccount({ connected: false, failed: true }));
    return () => { live = false; };
  }, [connected]);
  const currency = account?.currency || mainCurrency(data);
  const month = useMemo(() => monthSummary(data, period, today), [data, period, today]);
  const bars = useMemo(() => earningsByMonth(data, lastPeriods(period, 6)), [data, period]);
  const top = Math.max(1, ...bars.map((bar) => bar.totals[currency] || 0));
  const others = Object.entries(month.earned).filter(([code]) => code !== currency);
  const missing = month.rows.filter((row) => row.state === 'none' && row.client.subscription?.amount > 0);

  async function requestAll() {
    if (busy) return;
    setBusy(true);
    const label = `${periodLabel(period)} coaching`, dueDate = defaultDue(period);
    const error = await apply(update, (d) => missing.forEach(({ client }) => requestPayment(d, { clientId: client.id, amount: client.subscription.amount, currency: client.subscription.currency, label, period, dueDate })));
    setBusy(false);
    if (error) notify?.(error); else notify?.(`${missing.length} payment ${missing.length === 1 ? 'request' : 'requests'} sent`);
  }

  return <div className="payments">
    <section className="pay-hero">
      <div className="pay-month">
        <button type="button" aria-label="Previous month" onClick={() => setPeriod(shiftPeriod(period, -1))}><ChevronLeft size={20}/></button>
        <span aria-live="polite">{periodLabel(period)}</span>
        <button type="button" aria-label="Next month" disabled={period >= periodOf(today)} onClick={() => setPeriod(shiftPeriod(period, 1))}><ChevronRight size={20}/></button>
      </div>
      <small className="eyebrow">EARNED</small>
      <b className="pay-total">{formatMoney(month.earned[currency] || 0, currency)}</b>
      {others.length > 0 && <small className="pay-others">+ {others.map(([code, value]) => formatMoney(value, code)).join(' · ')}</small>}
      <div className="pay-facts">
        <span><b>{month.paid}</b> paid</span>
        <span className={month.overdue ? 'is-alert' : ''}><b>{month.unpaid}</b> unpaid{month.overdue ? ` · ${month.overdue} overdue` : ''}</span>
        <span><b>{formatMoney(month.outstanding[currency] || 0, currency)}</b> outstanding</span>
      </div>
      <div className="pay-bars" role="group" aria-label="Earnings, last six months">
        {bars.map((bar) => <button type="button" key={bar.period} className={bar.period === period ? 'is-current' : ''} aria-pressed={bar.period === period} aria-label={`${periodLabel(bar.period)}: ${formatMoney(bar.totals[currency] || 0, currency)}`} onClick={() => setPeriod(bar.period)}>
          <i style={{ '--h': `${Math.max(4, ((bar.totals[currency] || 0) / top) * 100)}%` }}/>
          <small>{periodLabel(bar.period, 'short').split(' ')[0]}</small>
        </button>)}
      </div>
    </section>

    {missing.length > 0 && <button type="button" className="pay-request-all" disabled={busy} onClick={requestAll}>
      <Plus size={18}/><span><b>Request {periodLabel(period, 'long').split(' ')[0]} from {missing.length} {missing.length === 1 ? 'client' : 'clients'}</b><small>Each uses the amount on their plan</small></span><ArrowRight size={18}/>
    </button>}

    <SectionHead title="Clients this month"/>
    <div className="pay-list">
      {month.rows.map(({ client, state, payments }) => {
        const shown = payments.find((p) => paymentState(p, today) === state) || payments[0];
        const amount = payments.length ? payments.reduce((n, p) => n + Number(p.amount), 0) : client.subscription?.amount;
        const code = shown?.currency || client.subscription?.currency || currency;
        return <button type="button" key={client.id} className={`pay-row is-${state}`} onClick={() => setSheet({ client, state, payments })}>
          <span className="avatar">{initials(client.name)}</span>
          <span className="pay-row-copy"><b>{client.name}</b><small>
            {state === 'paid' ? `${shown.verified ? 'Paymob' : METHODS[shown.method]} · ${shortDate(shown.paidAt.slice(0, 10))}` : state === 'none' ? 'No request yet' : `${STATE_TEXT[state]} · ${shortDate(shown.dueDate)}`}
          </small></span>
          <span className="pay-row-end"><b>{amount ? formatMoney(amount, code) : '—'}</b><i className={`pay-pill is-${state}`}>{state === 'paid' && shown.verified ? <><ShieldCheck size={12}/>Paid</> : STATE_TEXT[state]}</i></span>
        </button>;
      })}
      {!month.rows.length && <p className="muted">Add a client to start tracking payments.</p>}
    </div>

    <PaymobCard connected={connected} account={account} onChange={setAccount}/>

    {sheet && <ClientSheet {...sheet} period={period} account={account} onClose={() => setSheet(null)} onOpenClient={() => { setSheet(null); selectClient(sheet.client.id, 'Billing'); }}/>}
  </div>;
}

function ClientSheet({ client, payments, period, account, onClose, onOpenClient }) {
  const { update, notify } = useApp();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = dayKey();
  async function run(change, done) {
    if (busy) return;
    setBusy(true); setError('');
    const issue = await apply(update, change);
    setBusy(false);
    if (issue) { setError(issue); return; }
    notify?.(done);
    onClose();
  }
  if (form) return <PaymentForm client={client} period={period} account={account} payment={form.payment} mode={form.mode} onClose={onClose} onBack={() => setForm(null)}/>;
  return <Modal title={client.name} onClose={onClose} canClose={!busy}>
    <p className="pay-sheet-period">{periodLabel(period)}</p>
    {payments.length ? <div className="pay-records">{payments.map((p) => {
      const state = paymentState(p, today);
      return <article key={p.id} className={`pay-record is-${state}`}>
        <header><b>{formatMoney(p.amount, p.currency)}</b><i className={`pay-pill is-${state}`}>{state === 'paid' && p.verified ? <><ShieldCheck size={12}/>Paid</> : STATE_TEXT[state]}</i></header>
        <p>{p.label}</p>
        <small>{state === 'paid' ? `${methodText(p)} · ${shortDate(p.paidAt.slice(0, 10))}${p.paymob?.cardLast4 ? ` · card •••• ${p.paymob.cardLast4}` : ''}` : `Due ${shortDate(p.dueDate)}${p.paymob?.attempts?.length ? ' · client opened Paymob checkout' : ''}`}</small>
        {p.note && <small>{p.note}</small>}
        {state !== 'paid' && <div className="pay-record-actions">
          <Button small onClick={() => setForm({ mode: 'settle', payment: p })}>Mark as paid</Button>
          <Button small secondary disabled={busy} onClick={() => run((d) => voidPayment(d, p.id), 'Request cancelled')}>Cancel request</Button>
        </div>}
        {state === 'paid' && !p.verified && <button type="button" className="text-link" disabled={busy} onClick={() => run((d) => voidPayment(d, p.id), 'Record removed from totals')}>Remove this record</button>}
      </article>;
    })}</div> : <p className="muted">Nothing requested or recorded for this month yet.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="pay-sheet-actions">
      <Button onClick={() => setForm({ mode: 'request' })}><CreditCard size={17}/>Request payment</Button>
      <Button secondary onClick={() => setForm({ mode: 'record' })}><Wallet size={17}/>Record a payment</Button>
      <button type="button" className="text-link" onClick={onOpenClient}>Open {client.name.split(' ')[0]}’s profile<ArrowRight size={14}/></button>
    </div>
  </Modal>;
}

function PaymentForm({ client, period, account, payment, mode, onClose, onBack }) {
  const { update, notify } = useApp();
  const plan = client.subscription || {};
  const [values, setValues] = useState({
    amount: payment?.amount ?? plan.amount ?? '',
    currency: payment?.currency || plan.currency || account?.currency || 'EGP',
    label: payment?.label || `${periodLabel(period)} coaching`,
    dueDate: defaultDue(period),
    method: 'instapay',
    paidOn: dayKey(),
    note: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));
  const title = mode === 'request' ? 'Request payment' : mode === 'record' ? 'Record a payment' : 'Mark as paid';
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    const change = mode === 'request'
      ? (d) => requestPayment(d, { clientId: client.id, amount: values.amount, currency: values.currency, label: values.label, dueDate: values.dueDate, period })
      : mode === 'record'
        ? (d) => recordPayment(d, { clientId: client.id, amount: values.amount, currency: values.currency, label: values.label, period, method: values.method, paidOn: values.paidOn, note: values.note })
        : (d) => markPaid(d, payment.id, values.method, values.paidOn);
    const trial = mode === 'settle' ? { payments: [structuredClone(payment)] } : { payments: [] };
    let issue = null;
    try { change(trial); } catch (e) { issue = e.message; }
    if (!issue) issue = (await update((d) => { d.payments ||= []; change(d); }))?.error || null;
    setBusy(false);
    if (issue) { setError(issue); return; }
    notify?.(mode === 'request' ? `Request sent to ${client.name.split(' ')[0]}` : 'Payment recorded');
    onClose();
  }
  const paymobReady = account?.connected && account.publicAddress && account.currency === values.currency;
  return <Modal title={title} onClose={onClose} canClose={!busy}>
    <button type="button" className="text-link pay-back" onClick={onBack}><ChevronLeft size={15}/>{client.name}</button>
    <form className="pay-form" onSubmit={submit}>
      {mode !== 'settle' && <div className="pay-amount">
        <Field label="Amount"><input type="number" inputMode="decimal" min="0" step="any" required value={values.amount} onChange={set('amount')}/></Field>
        <Field label="Currency"><select value={values.currency} onChange={set('currency')}>{Object.keys(CURRENCIES).map((code) => <option key={code}>{code}</option>)}</select></Field>
      </div>}
      {mode === 'settle' && <p className="pay-settle">{formatMoney(payment.amount, payment.currency)} · {payment.label}</p>}
      {mode !== 'settle' && <Field label="Description"><input required maxLength={120} value={values.label} onChange={set('label')}/></Field>}
      {mode === 'request' && <Field label="Due date"><input type="date" required value={values.dueDate} onChange={set('dueDate')}/></Field>}
      {mode !== 'request' && <>
        <Field label="Paid by"><select value={values.method} onChange={set('method')}>{MANUAL_METHODS.map((m) => <option key={m} value={m}>{METHODS[m]}</option>)}</select></Field>
        <Field label="Date paid"><input type="date" required max={dayKey()} value={values.paidOn} onChange={set('paidOn')}/></Field>
      </>}
      {mode === 'record' && <Field label="Note (optional)"><input maxLength={500} value={values.note} onChange={set('note')} placeholder="e.g. Transfer reference"/></Field>}
      {mode === 'request' && <p className="pay-hint">{paymobReady ? `${client.name.split(' ')[0]} sees this in their app and can pay with Paymob.` : `${client.name.split(' ')[0]} sees this in their app. Online payment needs Paymob connected for ${values.currency}; until then, record what they pay you.`}</p>}
      {mode !== 'request' && <p className="pay-hint">Counted in your earnings as “recorded by you”. Only Paymob can mark a payment as confirmed.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Saving…' : mode === 'request' ? 'Send request' : 'Save payment'}</Button>
    </form>
  </Modal>;
}

function PaymobCard({ connected, account, onChange }) {
  const [open, setOpen] = useState(false);
  if (!connected) return <section className="card pay-connect">
    <div className="pay-connect-head"><Link2 size={20}/><div><b>Paymob</b><small>Get paid by card and mobile wallet, straight to your own Paymob account.</small></div></div>
    <p className="muted">Online payment works in your connected Avalen workspace. In this preview you can request and record payments to try the tracking.</p>
  </section>;
  return <section className="card pay-connect">
    <div className="pay-connect-head"><Link2 size={20}/><div><b>Paymob</b><small>{account?.connected ? `Connected · ${REGIONS[account.region].label} · ${account.currency}` : 'Get paid by card and mobile wallet, straight to your own Paymob account. Avalen takes no cut.'}</small></div>{account?.connected && <i className="pay-pill is-paid"><Check size={12}/>On</i>}</div>
    {account?.connected && !account.publicAddress && <Notice>Clients can’t pay online yet: the server’s public address (AVALEN_PUBLIC_URL) isn’t set.</Notice>}
    <Button small secondary={account?.connected} onClick={() => setOpen(true)}>{account?.connected ? 'Manage Paymob' : 'Connect Paymob'}</Button>
    {open && <PaymobForm account={account} onClose={() => setOpen(false)} onChange={onChange}/>}
  </section>;
}

function PaymobForm({ account, onClose, onChange }) {
  const [values, setValues] = useState({ region: account?.region || 'egypt', publicKey: account?.publicKey || '', secretKey: '', hmacSecret: '', integrationIds: (account?.integrations || []).join(', ') });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));
  async function send(method, body) {
    if (busy) return;
    setBusy(true); setError('');
    try { onChange(await request('/payments/account', { method, body })); onClose(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <Modal title={account?.connected ? 'Manage Paymob' : 'Connect Paymob'} onClose={onClose} canClose={!busy}>
    <p className="pay-hint">Money goes straight from your clients to your Paymob account. Your keys are encrypted on your Avalen server and never shown to clients.</p>
    <form className="pay-form" onSubmit={(event) => { event.preventDefault(); send('PUT', values); }}>
      <Field label="Paymob country"><select value={values.region} onChange={set('region')}>{Object.entries(REGIONS).map(([key, r]) => <option key={key} value={key}>{r.label} ({r.currency})</option>)}</select></Field>
      <Field label="Public key"><input required autoComplete="off" spellCheck={false} value={values.publicKey} onChange={set('publicKey')} placeholder="egy_pk_…"/></Field>
      <Field label="Secret key"><input required type="password" autoComplete="off" value={values.secretKey} onChange={set('secretKey')} placeholder={account?.connected ? 'Enter again to save changes' : 'egy_sk_…'}/></Field>
      <Field label="HMAC secret"><input required type="password" autoComplete="off" value={values.hmacSecret} onChange={set('hmacSecret')}/></Field>
      <Field label="Integration IDs"><input required inputMode="numeric" value={values.integrationIds} onChange={set('integrationIds')} placeholder="e.g. 4567890, 4567891"/></Field>
      <p className="pay-hint">All of these are in your Paymob dashboard: the three keys under your API key settings, and one integration ID for each payment method you turned on (card, wallet). Use test keys first to try a payment.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Saving…' : account?.connected ? 'Save changes' : 'Connect Paymob'}</Button>
      {account?.connected && <button type="button" className="text-link pay-disconnect" disabled={busy} onClick={() => send('DELETE')}>Disconnect Paymob</button>}
    </form>
  </Modal>;
}

// ---- Client ----
const returned = () => new URLSearchParams(location.hash.split('?')[1] || '').get('returned');

export function ClientPayments() {
  const { data, client, subtab } = useApp();
  const section = useRef(null);
  const today = dayKey();
  const mine = clientPayments(data, client.id);
  const due = mine.filter((p) => p.status === 'due').sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const paid = mine.filter((p) => p.status === 'paid').sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const [confirming, setConfirming] = useState(() => returned());
  useEffect(() => { if (subtab === 'Payments' || confirming) section.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, []);
  if (!mine.length && !confirming) return null;
  return <section className="card client-payments" id="payments" ref={section}>
    <SectionHead title="Payments"/>
    {confirming && <Confirming id={confirming} onDone={() => setConfirming(null)}/>}
    {due.map((p) => <DuePayment key={p.id} payment={p} state={paymentState(p, today)}/>)}
    {paid.length > 0 && <div className="client-pay-history">
      <small className="eyebrow">PAID</small>
      {paid.slice(0, 12).map((p) => <div key={p.id} className="client-pay-paid">
        <span><b>{p.label}</b><small>{shortDate(p.paidAt.slice(0, 10))} · {p.verified ? 'Paid with Paymob' : `${METHODS[p.method]} · recorded by your coach`}</small></span>
        <b>{formatMoney(p.amount, p.currency)}</b>
      </div>)}
    </div>}
  </section>;
}

function DuePayment({ payment, state }) {
  const live = Boolean(connection()?.user);
  const [phone, setPhone] = useState('');
  const [askPhone, setAskPhone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function pay(event) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { url } = await request(`/payments/${payment.id}/checkout`, { method: 'POST', body: askPhone ? { phone } : {} });
      location.assign(url);
    } catch (e) {
      if (/mobile number/i.test(e.message)) setAskPhone(true);
      setError(e.message);
      setBusy(false);
    }
  }
  return <article className={`client-pay-due is-${state}`}>
    <header><span><b>{payment.label}</b><small>{state === 'overdue' ? `Overdue · was due ${shortDate(payment.dueDate)}` : `Due ${shortDate(payment.dueDate)}`}</small></span><b>{formatMoney(payment.amount, payment.currency)}</b></header>
    {live ? <form onSubmit={pay}>
      {askPhone && <Field label="Mobile number"><input type="tel" required autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+20 100 123 4567"/></Field>}
      <Button type="submit" disabled={busy}><CreditCard size={17}/>{busy ? 'Opening Paymob…' : 'Pay with Paymob'}</Button>
      <small className="muted">Secure checkout by Paymob. Card or mobile wallet.</small>
    </form> : <p className="muted">Pay your coach directly for now. Online payment with Paymob works once your coaching account is connected.</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </article>;
}

// Back from Paymob: wait for Paymob's own confirmation to reach the server.
function Confirming({ id, onDone }) {
  const { data } = useApp();
  const payment = (data.payments || []).find((p) => p.id === id);
  const [timedOut, setTimedOut] = useState(false);
  const done = payment?.status === 'paid';
  useEffect(() => {
    if (done || !connection()?.user) return;
    let tries = 0;
    const timer = setInterval(() => { tries++; refreshConnection().catch(() => {}); if (tries >= 20) { clearInterval(timer); setTimedOut(true); } }, 3000);
    return () => clearInterval(timer);
  }, [done]);
  useEffect(() => { history.replaceState(history.state, '', location.hash.replace(/[?&]returned=[^&]*/, '')); }, []);
  if (!payment) return null;
  return <div className={`pay-confirm ${done ? 'is-done' : ''}`} role="status">
    {done ? <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" pathLength="1"/><path pathLength="1" d="M21 33.5l7.5 7.5L44 25"/></svg> : <i className="pay-spinner" aria-hidden="true"/>}
    <span><b>{done ? 'Paid. Thank you.' : timedOut ? 'Paymob is still confirming' : 'Confirming your payment…'}</b>
      <small>{done ? `${formatMoney(payment.amount, payment.currency)} · confirmed by Paymob` : timedOut ? 'Your coach will see it as soon as Paymob confirms. You don’t need to pay again.' : 'This usually takes a few seconds.'}</small></span>
    {(done || timedOut) && <button type="button" className="text-link" onClick={onDone}>Close</button>}
  </div>;
}

// Home: a quiet line when something is due, so it never gets forgotten.
export function PaymentDueNotice() {
  const { data, client, navigate } = useApp();
  const due = clientPayments(data, client.id).filter((p) => p.status === 'due');
  if (!due.length) return null;
  const today = dayKey();
  const overdue = due.some((p) => paymentState(p, today) === 'overdue');
  const first = due.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))[0];
  return <button type="button" className={`pay-home-notice ${overdue ? 'is-overdue' : ''}`} onClick={() => navigate('you', 'Payments')}>
    <CreditCard size={19}/><span><b>{overdue ? 'Payment overdue' : 'Payment due'} · {formatMoney(first.amount, first.currency)}</b><small>{first.label} · {overdue ? 'was due' : 'due'} {shortDate(first.dueDate)}</small></span><ChevronRight size={18}/>
  </button>;
}
