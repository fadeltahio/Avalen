import React, { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";
import { useApp } from "./context.js";
import { MotionDetails } from "./motion.jsx";
import { shortDate, uid } from "./store.js";
import { Button, Notice } from "./ui.jsx";
import { useWorkspaceSave } from "./workspace-save.js";
import "./intake.css";

import { t } from './i18n.js';
// One question per screen. The health question is a safety prompt for the coach, not
// a medical screen: a yes is flagged for review and never blocks the client.
export const INTAKE_QUESTIONS = [
  { id: "experience", label: "Experience", title: "How long have you been training?", options: ["Just starting", "Under a year", "1 to 3 years", "3 years or more"] },
  { id: "days", label: "Days a week", title: "How many days a week can you train?", options: ["2", "3", "4", "5", "6"], row: true },
  { id: "length", label: "Session length", title: "How long is a good session?", options: ["30 minutes", "45 minutes", "60 minutes", "75 minutes or more"] },
  { id: "place", label: "Where", title: "Where will you train?", options: ["Full gym", "Home gym", "Both"] },
  { id: "injuries", label: "Injuries", title: "Any injuries or areas to protect?", multi: true, options: ["None", "Shoulder", "Back", "Knee", "Hip", "Wrist or elbow", "Other"] },
  { id: "health", label: "Health check", title: "Has a doctor told you to limit exercise, or do you get chest pain or dizziness when active?", options: ["No", "Yes"] },
  { id: "food", label: "Food", title: "Any allergies or foods you avoid?", text: "Nuts, dairy, vegetarian…" },
  { id: "notes", label: "Notes", title: "Anything else your coach should know?", text: "Your schedule, what has worked before, how you want to feel…" },
];

export function intakeRows(answers = {}) {
  return INTAKE_QUESTIONS.map(({ id, label, multi }) => {
    const value = multi ? (answers[id] || []).join(", ") : answers[id];
    const note = id === "injuries" && answers.injuryNote ? ` · ${answers.injuryNote}` : "";
    return value ? [label, `${value}${note}`] : null;
  }).filter(Boolean);
}

export function IntakeFlow({ onClose }) {
  const { data, client } = useApp();
  const { save, saving, error } = useWorkspaceSave();
  const [step, setStep] = useState(0), [direction, setDirection] = useState(1), [answers, setAnswers] = useState({ injuries: [] }), [sent, setSent] = useState(false);
  const advancing = useRef(false);
  const coach = data.coach.name.split(" ")[0];
  const question = INTAKE_QUESTIONS[step], last = step === INTAKE_QUESTIONS.length - 1;
  function go(next) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }
  function choose(value) {
    if (advancing.current) return;
    setAnswers((current) => ({ ...current, [question.id]: value }));
    if (question.id === "health" && value === "Yes") return;
    advancing.current = true;
    setTimeout(() => { advancing.current = false; go(step + 1); }, 240);
  }
  function toggle(value) {
    setAnswers((current) => {
      const rest = current.injuries.filter((item) => item !== "None");
      if (value === "None") return { ...current, injuries: ["None"] };
      return { ...current, injuries: rest.includes(value) ? rest.filter((item) => item !== value) : [...rest, value] };
    });
  }
  async function send() {
    const at = new Date().toISOString();
    const flagged = answers.health === "Yes";
    const stored = await save((d) => {
      d.clients.find((row) => row.id === client.id).intake = { answers, flagged, submittedAt: at, reviewedAt: null };
      d.messages.push({ id: uid(), clientId: client.id, from: "client", read: false, at, text: `My intake is in. ${intakeRows(answers).map(([label, value]) => `${label}: ${value}`).join(". ")}.` });
    });
    if (stored) setSent(true);
  }
  if (sent) return (
    <section className="intake-flow is-sent" role="dialog" aria-modal="true" aria-label={t('Intake sent')}>
      <span className="intake-sent-mark"><Check size={34} /></span>
      <h1>{t('Sent to {coach}.', { coach })}</h1>
      <p>{t('{coach} will read this before shaping your plan.', { coach })}</p>
      <Button onClick={onClose}>{t('Let’s go')} <ArrowRight size={18} /></Button>
    </section>
  );
  return (
    <section className="intake-flow" role="dialog" aria-modal="true" aria-label={t('Tell your coach about you')}>
      <header>
        <button type="button" className="intake-back" aria-label={t('Previous question')} disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft size={20} /></button>
        <span className="intake-count">{step + 1} {t('of')} {INTAKE_QUESTIONS.length}</span>
        <button type="button" className="intake-skip" onClick={onClose}>{t('Skip for now')}</button>
      </header>
      <div className="intake-progress" aria-hidden="true"><i style={{ transform: `scaleX(${(step + 1) / INTAKE_QUESTIONS.length})` }} /></div>
      <div className="intake-step" key={step} style={{ "--from": `${direction * 28}px` }}>
        <h1>{t(question.title)}</h1>
        {question.options && <div className={`intake-options ${question.row ? "is-row" : ""}`} style={{ "--count": question.options.length }}>
          {question.options.map((option, index) => {
            const on = question.multi ? answers.injuries.includes(option) : answers[question.id] === option;
            return <button type="button" key={option} style={{ "--i": index }} className={on ? "is-on" : ""} aria-pressed={on} onClick={() => (question.multi ? toggle(option) : choose(option))}>{option}{on && !question.row && <Check size={18} />}</button>;
          })}
        </div>}
        {question.multi && answers.injuries.some((item) => item !== "None") && <textarea aria-label={t('Tell your coach more')} maxLength={500} placeholder={t('Tell your coach more (optional)')} value={answers.injuryNote || ""} onChange={(event) => setAnswers({ ...answers, injuryNote: event.target.value })} />}
        {question.text && <textarea aria-label={question.title} maxLength={1000} placeholder={question.text} value={answers[question.id] || ""} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} />}
        {question.id === "health" && answers.health === "Yes" && <Notice>{t('Thanks for telling us. {coach} will see this first. Please check with your doctor before you start training.', { coach })}</Notice>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      {(question.multi || question.text || (question.id === "health" && answers.health === "Yes")) && <div className="intake-actions">
        {last
          ? <Button disabled={saving} onClick={send}>{saving ? t('Sending…') : t('Send to {coach}', { coach })} <ArrowRight size={18} /></Button>
          : <Button disabled={question.multi && !answers.injuries.length} onClick={() => go(step + 1)}>{t('Continue')} <ArrowRight size={18} /></Button>}
      </div>}
    </section>
  );
}

export function IntakeCard({ client }) {
  const { save, saving, error } = useWorkspaceSave();
  const intake = client.intake;
  if (!intake) return null;
  const rows = <dl className="intake-answers">{intakeRows(intake.answers).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
  if (intake.reviewedAt) return <MotionDetails className="nutrition-updates"><summary><span>{t('Intake answers')}<small>{t('Sent {shortDate}', { shortDate: shortDate(intake.submittedAt.slice(0, 10)) })}</small></span><ChevronRight size={18} /></summary>{rows}</MotionDetails>;
  return (
    <section className={`card intake-card ${intake.flagged ? "is-flagged" : ""}`}>
      <h2>{t('New client intake')}</h2>
      {intake.flagged && <p className="intake-flag">{t('Health answer needs a look before training starts.')}</p>}
      {rows}
      {error && <p className="error" role="alert">{error}</p>}
      <Button small disabled={saving} onClick={() => save((d) => { d.clients.find((row) => row.id === client.id).intake.reviewedAt = new Date().toISOString(); })}>{saving ? t('Saving…') : t('Mark reviewed')}</Button>
    </section>
  );
}
