import { MotionList, MotionDetails } from '../motion.jsx';
import React, { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useApp } from "../context.js";
import { Button, Empty, Field, Modal, Notice, SectionHead } from "../ui.jsx";
import { analyzeClient } from "./intelligence.js";
import { connection, request } from "./connection.js";
import { t } from '../i18n.js';
const actionNames = {
  conversation: "Start a conversation",
  training: "Review training prescription",
  recovery: "Review recovery and load",
  nutrition: "Review nutrition targets",
  schedule: "Review schedule",
  checkin: "Review check-in questions",
  technique: "Review technique videos",
  memory: "Review coaching decision",
};
export function Intelligence({ client = null, compact = false }) {
  const { data, runAction, selectClient, notify } = useApp();
  const [selected, setSelected] = useState(null),
    [action, setAction] = useState(""),
    [exerciseId, setExerciseId] = useState(""),
    [values, setValues] = useState({}),
    [before, setBefore] = useState({}),
    [message, setMessage] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [showHistory, setShowHistory] = useState(false),
    [ai, setAI] = useState(null),
    [aiConsent, setAIConsent] = useState(false);
  const all = (client ? [client] : data.clients)
      .flatMap((c) => analyzeClient(data, c).map((i) => ({ ...i, client: c })))
      .sort((a, b) => a.priority - b.priority),
    display = compact
      ? all
          .filter(
            (x, i, a) => a.findIndex((y) => y.clientId === x.clientId) === i,
          )
          .slice(0, 4)
      : all;
  function chooseType(type, item = selected) {
    setAction(type);
    setError("");
    const c = item.client;
    if (type === "nutrition") {
      const v = Object.fromEntries(
        ["kcal", "p", "c", "f"].map((k) => [k, c.nutrition[k]]),
      );
      setValues(v);
      setBefore(v);
    } else if (type === "training" || type === "recovery") {
      const ex =
        c.program.days
          .flatMap((d) => d.exercises)
          .find((e) => e.id === item.proposal?.exerciseId) ||
        c.program.days[0]?.exercises[0];
      setExerciseId(ex?.id || "");
      const original = { sets: ex.sets, reps: ex.reps, weight: ex.weight };
      setBefore(original);
      setValues(
        item.proposal?.exerciseId === ex.id ? item.proposal.after : original,
      );
    }
    setAI(null);
  }
  function open(item) {
    setSelected(item);
    chooseType(item.actions[0], item);
    setReason("");
    setMessage("");
    setError("");
    setAIConsent(false);
  }
  async function decide(item, decision, done) {
    setBusy(true);
    setError("");
    try {
      await runAction("insight.decide", item.clientId, {
        key: item.key,
        decision,
        fingerprint: item.fingerprint,
        type: action,
        exerciseId,
        values,
        before,
        reason,
        message,
      });
      done?.();
      notify?.(
        decision === "approve"
          ? t('Reviewed action saved')
          : t('Observation {value}', { value: decision === "snooze" ? "snoozed until tomorrow" : decision === "dismiss" ? "dismissed" : decision === "reject" ? "declined" : "recorded for review" }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function requestAI() {
    setBusy(true);
    setError("");
    try {
      const result = await request("/intelligence/explain", {
        method: "POST",
        body: {
          clientId: selected.clientId,
          key: selected.key,
          fingerprint: selected.fingerprint,
          consent: true,
        },
      });
      setAI(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const routeFor = {
    schedule: "Plan",
    technique: "FormLab",
    checkin: "Check-ins",
    memory: "Coaching Memory",
  };
  return (
    <section className="ecosystem-stack intelligence-section">
      <SectionHead
        title={t('Avalen Intelligence')}
        action={
          compact ? (
            <button
              className="text-link"
              onClick={() => {
                if (display[0])
                  selectClient(display[0].clientId, "Intelligence");
              }}
            >
              {t('Explore observations')} <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="text-link"
              onClick={() => setShowHistory((s) => !s)}
            >
              {showHistory ? t('Active observations') : t('Decision history')}
            </button>
          )
        }
      />
      <p className="muted">
        {t('Grounded in recorded progress. Reviewed by the coach.')}
      </p>
      {showHistory ? (
        <div className="ecosystem-stack">
          {(data.insightDecisions || [])
            .filter((d) => !client || d.clientId === client.id)
            .slice()
            .reverse()
            .map((d) => (
              <article className="card" key={d.id}>
                <small className="muted">
                  {new Date(d.at).toLocaleString()} · {d.decision}
                </small>
                <h3>{d.key}</h3>
                <p>{d.reason || t('No additional reason recorded.')}</p>
                <MotionDetails>
                  <summary>{t('Evidence at decision time')}</summary>
                  <ul className="evidence-list">
                    {d.evidence.map((e, i) => (
                      <li key={i}>
                        {e.date} · {e.text}
                      </li>
                    ))}
                  </ul>
                </MotionDetails>
              </article>
            ))}
        </div>
      ) : (
        <MotionList className="insight-grid">
          {display.map((item) => (
            <article className="card insight-card" key={item.id}>
              <div className="ecosystem-card-header">
                <span className="ecosystem-badge">{t(item.client.name)}</span>
                <small>
                  {item.start} – {item.end}
                </small>
              </div>
              <h3>{t(item.title)}</h3>
              <p>{t(item.detail)}</p>
              <MotionDetails>
                <summary>{t('Evidence · {length} recorded sources', { length: item.evidence.length })}</summary>
                <ul className="evidence-list">
                  {item.evidence.map((e, i) => (
                    <li key={i}>
                      <b>{e.date}</b> · {e.text}
                    </li>
                  ))}
                </ul>
                <small className="muted">{item.source}</small>
              </MotionDetails>
              {item.context.length > 0 && (
                <p className="fine-print muted">
                  {t('Recent coaching context:')}{" "}
                  {item.context.map((c) => `${c.title} (${c.date})`).join("; ")}
                  {t('. Consider the intent of these changes first.')}
                </p>
              )}
              <div className="button-row">
                <Button small onClick={() => open(item)}>
                  {t('Review next step')} <ArrowRight size={14} />
                </Button>
                <button
                  disabled={busy}
                  className="text-link muted"
                  onClick={() => decide(item, "snooze")}
                >
                  {t('Snooze')}
                </button>
                <button
                  disabled={busy}
                  className="text-link muted"
                  onClick={() => decide(item, "dismiss")}
                >
                  {t('Dismiss')}
                </button>
              </div>
            </article>
          ))}
        </MotionList>
      )}
      {!all.length && !showHistory && (
        <Empty
          title={t('Nothing needs an automatic flag')}
          detail={t('Observations appear only when stored records support them. Sparse data is not treated as poor adherence.')}
        />
      )}
      {error && !selected && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {selected && (
        <Modal
          title={selected.title}
          wide
          onClose={() => !busy && setSelected(null)}
        >
          <p>{t(selected.detail)}</p>
          <ul className="evidence-list">
            {selected.evidence.map((e, i) => (
              <li key={i}>
                {e.date} · {e.text}
              </li>
            ))}
          </ul>
          <Notice>{selected.limitations.join(" ")}</Notice>
          <Field label={t('Coach’s next step')}>
            <select value={action} onChange={(e) => chooseType(e.target.value)}>
              {selected.actions.map((a) => (
                <option key={a} value={a}>
                  {actionNames[a]}
                </option>
              ))}
            </select>
          </Field>
          {["training", "recovery"].includes(action) && (
            <>
              <Field label={t('Exercise to review')}>
                <select
                  value={exerciseId}
                  onChange={(e) => {
                    const ex = selected.client.program.days
                      .flatMap((d) => d.exercises)
                      .find((x) => x.id === e.target.value);
                    setExerciseId(ex.id);
                    const v = {
                      sets: ex.sets,
                      reps: ex.reps,
                      weight: ex.weight,
                    };
                    setValues(v);
                    setBefore(v);
                  }}
                >
                  {selected.client.program.days.map((d) => (
                    <optgroup key={d.id} label={d.name}>
                      {d.exercises.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {t(ex.name)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <ProposalFields
                keys={["sets", "reps", "weight"]}
                values={values}
                before={before}
                setValues={setValues}
              />
            </>
          )}
          {action === "nutrition" && (
            <ProposalFields
              keys={["kcal", "p", "c", "f"]}
              values={values}
              before={before}
              setValues={setValues}
            />
          )}{" "}
          {action === "conversation" && (
            <Field label={t('Message · review before sending')}>
              <textarea
                required
                maxLength={4000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('Start with what the client reported, then ask an open question…')}
              />
            </Field>
          )}
          <Field label={t('Reason / coaching context (optional)')}>
            <textarea
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('Why this next step makes sense for this client…')}
            />
          </Field>
          {connection() && (
            <MotionDetails>
              <summary>{t('Optional AI-assisted explanation')}</summary>
              <p className="fine-print muted">
                {!selected.client.externalAIConsent?.enabled
                  ? t('The client has not opted into external AI explanations. Deterministic evidence remains available. ')
                  : ""}
                {t('The configured provider receives the evidence shown above and recent coaching context. Its explanation is labelled as interpretation and cannot change a plan.')}
              </p>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={aiConsent}
                  onChange={(e) => setAIConsent(e.target.checked)}
                />
                {t('Allow this evidence to be sent to the configured AI provider')}
              </label>
              <Button
                secondary
                small
                disabled={
                  !aiConsent ||
                  busy ||
                  !selected.client.externalAIConsent?.enabled
                }
                onClick={requestAI}
              >
                {t('Prepare explanation')}
              </Button>
              {ai && (
                <Notice>
                  <b>{t('AI interpretation · coach review required')}</b>
                  <p>{ai.summary}</p>
                  <ul>
                    {ai.considerations.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </Notice>
              )}
            </MotionDetails>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="button-row">
            {routeFor[action] ? (
              <Button
                disabled={busy}
                onClick={() =>
                  decide(selected, "review", () => {
                    const id = selected.clientId;
                    setSelected(null);
                    selectClient(id, routeFor[action]);
                  })
                }
              >{t('Open {value}', { value: actionNames[action].toLowerCase() })}</Button>
            ) : (
              <Button
                disabled={
                  busy || (action === "conversation" && !message.trim())
                }
                onClick={() =>
                  decide(selected, "approve", () => setSelected(null))
                }
              >
                {busy
                  ? t('Saving…')
                  : action === "conversation"
                    ? t('Send reviewed message')
                    : t('Approve these changes')}
              </Button>
            )}
            <Button
              secondary
              disabled={busy}
              onClick={() =>
                decide(selected, "reject", () => setSelected(null))
              }
            >
              {t('Reject suggestion')}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function ProposalFields({ keys, values, before, setValues }) {
  const labels = {
    sets: "Sets",
    reps: "Reps / seconds",
    weight: "Load (kg)",
    kcal: "Calories",
    p: "Protein (g)",
    c: "Carbs (g)",
    f: "Fat (g)",
  };
  return (
    <>
      <div className="form-grid">
        {keys.map((k) => (
          <Field
            key={k}
            label={t('{value} · currently {value2}', { value: labels[k], value2: before[k] })}
            type="number"
            min="0"
            step={k === "weight" ? "any" : "1"}
            value={values[k] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
          />
        ))}
      </div>
      <table className="schedule-comparison">
        <caption>{t('Review before approving')}</caption>
        <thead>
          <tr>
            <th>{t('Prescription')}</th>
            <th>{t('Before')}</th>
            <th>{t('Proposed')}</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td>{labels[k]}</td>
              <td>{before[k]}</td>
              <td>{values[k]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
