import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, X } from 'lucide-react';
import { useApp } from './context.js';
import { motionReduced } from './motion.jsx';
import { PROMPTS, answer, intentFor } from './assistant-answers.js';

function Mark({ className = '' }) {
  return <svg className={`assistant-mark ${className}`} viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45"/><path d="M29.5 72 50 33 70.5 72"/></svg>;
}

// A small floating Avalen mark. It opens a chat that answers from saved records,
// with preset questions for the signed-in role.
export function AvalenAssistant() {
  const { data, client, role, selectedClientId, navigate, selectClient } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState('');
  const fab = useRef(null), input = useRef(null), list = useRef(null), timer = useRef(null);
  const name = role === 'coach' ? data.coach?.name?.split(' ')[0] : client.name?.split(' ')[0];

  useEffect(() => () => clearTimeout(timer.current), []);
  // Step aside while the page scrolls down, so the button never sits on what you're reading.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = scrollY, frame = 0;
    const check = () => {
      frame = 0;
      const now = scrollY;
      if (now < 48 || now < last - 6) setTucked(false);
      else if (now > last + 6) setTucked(true);
      last = now;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    addEventListener('scroll', onScroll, { passive: true });
    return () => { removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => { setMessages([]); setThinking(false); }, [role]);
  useEffect(() => {
    if (!open) return;
    const close = event => { if (event.key === 'Escape') shut(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: motionReduced() ? 'instant' : 'smooth' }); }, [messages, thinking]);

  function shut() { setOpen(false); requestAnimationFrame(() => fab.current?.focus()); }
  function ask(question, intent = intentFor(role, question)) {
    if (thinking || !question.trim()) return;
    const reply = answer(intent, { data, client, role, selectedClientId });
    setMessages(rows => [...rows, { id: `${Date.now()}q`, from: 'you', text: question.trim() }]);
    setDraft('');
    setThinking(true);
    timer.current = setTimeout(() => {
      setThinking(false);
      setMessages(rows => [...rows, { id: `${Date.now()}a`, from: 'avalen', ...reply }]);
    }, motionReduced() ? 0 : 650);
  }
  function go(action) { shut(); navigate(action.screen, action.tab || ''); }
  function openClient(id) { shut(); selectClient(id); }

  return <>
    <button ref={fab} type="button" className={`assistant-fab ${open ? 'is-open' : ''} ${tucked && !open ? 'is-tucked' : ''}`} tabIndex={tucked && !open ? -1 : undefined} aria-label="Ask Avalen" aria-expanded={open} aria-haspopup="dialog" onClick={() => { setOpen(true); requestAnimationFrame(() => input.current?.focus({ preventScroll: true })); }}>
      <Mark/><span className="assistant-fab-halo" aria-hidden="true"/>
    </button>
    {open && <div className="assistant-layer" onClick={event => { if (event.target === event.currentTarget) shut(); }}>
      <section className="assistant-panel" role="dialog" aria-modal="true" aria-label="Avalen assistant">
        <header className="assistant-head">
          <Mark className={thinking ? 'is-live' : ''}/>
          <div><b>Avalen</b><small>Answers from your saved records</small></div>
          <button type="button" className="assistant-close" aria-label="Close assistant" onClick={shut}><X size={20}/></button>
        </header>
        <div className="assistant-thread" ref={list} aria-live="polite">
          <div className="assistant-msg from-avalen"><p>{name ? `Hi ${name}. ` : ''}{role === 'coach' ? 'Ask about your clients: who needs you, check-ins, missed sessions and payments.' : 'Ask about your training, food and progress. I answer from what you’ve logged.'}</p></div>
          {messages.map(m => <div key={m.id} className={`assistant-msg from-${m.from}`}>
            <p>{m.text}</p>
            {m.points?.length > 0 && <ul>{m.points.map(([label, value, clientId], index) => <li key={index}>{clientId ? <button type="button" onClick={() => openClient(clientId)}><span>{label}</span><small>{value}</small><ArrowRight size={14}/></button> : <><span>{label}</span>{value && <small>{value}</small>}</>}</li>)}</ul>}
            {m.more && <p className="assistant-more">{m.more}</p>}
            {m.note && <p className="assistant-note">{m.note}</p>}
            {m.action && <button type="button" className="assistant-action" onClick={() => go(m.action)}>{m.action.label}<ArrowRight size={15}/></button>}
            {m.clientId && <button type="button" className="assistant-action" onClick={() => openClient(m.clientId)}>Open client<ArrowRight size={15}/></button>}
          </div>)}
          {thinking && <div className="assistant-msg from-avalen is-thinking" role="status" aria-label="Avalen is thinking"><span/><span/><span/></div>}
        </div>
        <div className="assistant-prompts" role="group" aria-label="Suggested questions">
          {PROMPTS[role].map(([intent, label]) => <button key={intent} type="button" disabled={thinking} onClick={() => ask(label, intent)}>{label}</button>)}
        </div>
        <form className="assistant-input" onSubmit={event => { event.preventDefault(); ask(draft); }}>
          <input ref={input} value={draft} maxLength={300} onChange={event => setDraft(event.target.value)} placeholder="Ask Avalen…" aria-label="Ask Avalen a question"/>
          <button type="submit" aria-label="Send" disabled={!draft.trim() || thinking}><ArrowUp size={18}/></button>
        </form>
      </section>
    </div>}
  </>;
}
