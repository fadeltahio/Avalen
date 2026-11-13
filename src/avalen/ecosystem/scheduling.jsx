import React, { useState } from "react";
import { CalendarDays, ArrowRight, Settings } from "lucide-react";
import { useApp } from "../context.js";
import { Button, Empty, Field, Modal, Notice, SectionHead } from "../ui.jsx";
import { scheduleRules, proposeSchedule } from "./scheduling.js";
import { zonedDay, utcAdd } from "./time.js";
import { locale, t } from '../i18n.js';
// Short weekday names in the app language, Sunday first.
const dayNames = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + i))));
export function SmartSchedule({ client, coach = false }) {
  const { data, runAction, notify } = useApp();
  const [open, setOpen] = useState(false),
    [settings, setSettings] = useState(false),
    [draftRules, setDraftRules] = useState(scheduleRules(client)),
    [request, setRequest] = useState({
      mode: "move",
      from:
        client.schedule.find(
          (s) => s.date >= zonedDay(client.checkinPlan?.timezone || "UTC"),
        )?.date || "",
      to: "",
      unavailable: [],
      includeMissed: false,
    }),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [override, setOverride] = useState(false);
  const proposals = (data.scheduleProposals || []).filter(
      (p) =>
        p.clientId === client.id && ["preview", "pending"].includes(p.status),
    ),
    rules = scheduleRules(client),
    today = zonedDay(client.checkinPlan?.timezone || "UTC");
  async function act(action, payload, done) {
    setBusy(true);
    setError("");
    try {
      await runAction(action, client.id, payload);
      done?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function compare() {
    setError("");
    try {
      setPreview(proposeSchedule(client, data.sessions, request, today));
    } catch (e) {
      setError(e.message);
    }
  }
  const current = preview;
  return (
    <section className="card ecosystem-stack">
      <SectionHead
        title={t('Make your schedule fit')}
        action={
          coach ? (
            <Button
              secondary
              small
              onClick={() => {
                setDraftRules(scheduleRules(client));
                setSettings(true);
              }}
            >
              <Settings size={15} />
              {t('Flexibility rules')}
            </Button>
          ) : null
        }
      />
      <p className="muted">
        {t('Move training around life. Your coach’s exercises and prescriptions stay intact.')}
      </p>
      <Button
        secondary
        small
        onClick={() => {
          setOpen(true);
          setPreview(null);
          setError("");
        }}
      >
        <CalendarDays size={16} />
        {t('Adjust training dates')}
      </Button>
      {proposals.map((p) => (
        <div className="ecosystem-updates" key={p.id}>
          <b>
            {p.status === "pending"
              ? t('Awaiting coach approval')
              : t('Schedule preview')}
          </b>
          <p className="muted">{p.explanation}</p>
          <button
            className="text-link"
            onClick={() => {
              setPreview(p);
              setOpen(true);
              setReason("");
              setOverride(false);
              setError("");
            }}
          >
            {t('Review proposal')} <ArrowRight size={14} />
          </button>
        </div>
      ))}
      {open && (
        <Modal
          title={t('A week that works for you')}
          wide
          onClose={() => !busy && setOpen(false)}
        >
          {!current ? (
            <>
              <Field label={t('Adjustment')}>
                <select
                  value={request.mode}
                  onChange={(e) =>
                    setRequest((r) => ({ ...r, mode: e.target.value }))
                  }
                >
                  <option value="move">{t('Move one session')}</option>
                  <option value="week">
                    {t('Reorganize this week / unavailable days')}
                  </option>
                </select>
              </Field>
              {request.mode === "move" ? (
                <div className="form-grid">
                  <Field label={t('Scheduled session')}>
                    <select
                      value={request.from}
                      onChange={(e) =>
                        setRequest((r) => ({ ...r, from: e.target.value }))
                      }
                    >
                      <option value="">{t('Choose a session')}</option>
                      {client.schedule
                        .filter(
                          (s) =>
                            !data.sessions.some(
                              (x) =>
                                x.clientId === client.id && x.date === s.date,
                            ),
                        )
                        .map((s) => (
                          <option key={s.date} value={s.date}>
                            {s.date} ·{" "}
                            {client.program.days.find((d) => d.id === s.dayId)
                              ?.name || s.dayId}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field
                    label={t('New date')}
                    type="date"
                    min={today}
                    required
                    value={request.to}
                    onChange={(e) =>
                      setRequest((r) => ({ ...r, to: e.target.value }))
                    }
                  />
                  <Field
                    label={t('Training time (optional)')}
                    type="time"
                    value={request.time || ""}
                    onChange={(e) =>
                      setRequest((r) => ({ ...r, time: e.target.value }))
                    }
                  />
                </div>
              ) : (
                <>
                  <Field
                    label={t('Unavailable dates · comma separated')}
                    placeholder={`${today}, ${utcAdd(today, 1)}`}
                    value={request.unavailable.join(", ")}
                    onChange={(e) =>
                      setRequest((r) => ({
                        ...r,
                        unavailable: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                  />
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={request.includeMissed}
                      onChange={(e) =>
                        setRequest((r) => ({
                          ...r,
                          includeMissed: e.target.checked,
                        }))
                      }
                    />
                    {t('Include earlier missed sessions from this week')}
                  </label>
                  <p className="fine-print muted">
                    {t('Missed sessions stay missed unless you explicitly include them. If the week cannot fit safely, discuss priorities with your coach.')}
                  </p>
                </>
              )}
              <Notice>
                {t('At least')} {rules.minSpacingDays} {t('days between sessions · up to')}{" "}
                {rules.maxWeekly} {t('each week ·')}{" "}
                {rules.allowedDays.map((d) => dayNames[d]).join(", ")} ·{" "}
                {rules.windowStart}–{rules.windowEnd}
              </Notice>
              <Button onClick={compare}>
                {t('Preview changes')} <ArrowRight size={16} />
              </Button>
            </>
          ) : (
            <>
              <p>{current.explanation}</p>
              <ScheduleComparison proposal={current} client={client} />
              {current.issues.map((i, n) => (
                <Notice key={n}>
                  {i.text}
                  {i.hard
                    ? t(' This proposal cannot be applied.')
                    : t(' Coach approval is needed.')}
                </Notice>
              ))}
              {coach && (
                <>
                  <Field label={t('Reason (optional unless overriding a rule)')}>
                    <textarea
                      maxLength={2000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  {current.issues.some((i) => !i.hard) && (
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={override}
                        onChange={(e) => setOverride(e.target.checked)}
                      />
                      {t('Approve the listed scheduling exceptions')}
                    </label>
                  )}
                </>
              )}
              <button
                className="text-link"
                disabled={busy}
                onClick={() => {
                  setRequest({
                    ...current.request,
                    replaces: data.scheduleProposals?.some(
                      (p) => p.id === current.id,
                    )
                      ? current.id
                      : undefined,
                  });
                  setPreview(null);
                }}
              >
                {t('Adjust this proposal')}
              </button>
              <div className="button-row">
                <Button
                  disabled={
                    busy ||
                    current.issues.some((i) => i.hard) ||
                    (!coach && current.status === "pending")
                  }
                  onClick={async () => {
                    if (
                      current.status === "preview" &&
                      !(data.scheduleProposals || []).some(
                        (p) => p.id === current.id,
                      )
                    ) {
                      await act(
                        "schedule.propose",
                        { ...current.request, confirm: true, reason, override },
                        () => {
                          setPreview(null);
                          setOpen(false);
                          notify?.(
                            coach ||
                              (rules.independent &&
                                !rules.requireApproval &&
                                !current.issues.length)
                              ? t('Training dates updated')
                              : t('Sent to your coach for approval'),
                          );
                        },
                      );
                    } else
                      await act(
                        "schedule.confirm",
                        { id: current.id, reason, override },
                        () => {
                          setOpen(false);
                          setPreview(null);
                          notify?.(
                            coach ||
                              (rules.independent &&
                                !rules.requireApproval &&
                                !current.issues.length)
                              ? t('Training dates updated')
                              : t('Sent to your coach for approval'),
                          );
                        },
                      );
                  }}
                >
                  {busy
                    ? t('Saving…')
                    : !data.scheduleProposals?.some((p) => p.id === current.id)
                      ? coach
                        ? t('Approve changes')
                        : rules.independent &&
                            !rules.requireApproval &&
                            !current.issues.length
                          ? t('Confirm changes')
                          : t('Request coach approval')
                      : coach
                        ? t('Approve schedule')
                        : rules.independent &&
                            !rules.requireApproval &&
                            !current.issues.length
                          ? t('Confirm changes')
                          : t('Request coach approval')}
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => {
                    if (
                      data.scheduleProposals?.some((p) => p.id === current.id)
                    )
                      act("schedule.reject", { id: current.id, reason }, () => {
                        setPreview(null);
                        setOpen(false);
                      });
                    else setPreview(null);
                  }}
                >
                  {" "}
                  {data.scheduleProposals?.some((p) => p.id === current.id)
                    ? t('Decline proposal')
                    : t('Adjust preview')}
                </Button>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </Modal>
      )}
      {settings && (
        <Modal
          title={t('Scheduling flexibility')}
          onClose={() => !busy && setSettings(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act("schedule.rules", draftRules, () => {
                setSettings(false);
                notify?.(t('Scheduling rules saved'));
              });
            }}
          >
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={draftRules.independent}
                onChange={(e) =>
                  setDraftRules((r) => ({
                    ...r,
                    independent: e.target.checked,
                  }))
                }
              />
              {t('Client can reschedule independently')}
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={draftRules.requireApproval}
                onChange={(e) =>
                  setDraftRules((r) => ({
                    ...r,
                    requireApproval: e.target.checked,
                  }))
                }
              />
              {t('All changes require coach approval')}
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={draftRules.preserveOrder}
                onChange={(e) =>
                  setDraftRules((r) => ({
                    ...r,
                    preserveOrder: e.target.checked,
                  }))
                }
              />
              {t('Preserve prescribed workout order')}
            </label>
            <Field label={t('Allowed training days')}>
              <div className="ecosystem-toolbar">
                {dayNames.map((name, i) => (
                  <label key={name}>
                    <input
                      type="checkbox"
                      checked={draftRules.allowedDays.includes(i)}
                      onChange={(e) =>
                        setDraftRules((r) => ({
                          ...r,
                          allowedDays: e.target.checked
                            ? [...r.allowedDays, i]
                            : r.allowedDays.filter((d) => d !== i),
                        }))
                      }
                    />
                    {name}
                  </label>
                ))}
              </div>
            </Field>
            <div className="form-grid">
              <Field
                label={t('Minimum days between sessions')}
                type="number"
                min="1"
                max="7"
                value={draftRules.minSpacingDays}
                onChange={(e) =>
                  setDraftRules((r) => ({
                    ...r,
                    minSpacingDays: Number(e.target.value),
                  }))
                }
              />
              <Field
                label={t('Maximum sessions per week')}
                type="number"
                min="1"
                max="7"
                value={draftRules.maxWeekly}
                onChange={(e) =>
                  setDraftRules((r) => ({
                    ...r,
                    maxWeekly: Number(e.target.value),
                  }))
                }
              />
              <Field
                label={t('Earliest training time')}
                type="time"
                value={draftRules.windowStart}
                onChange={(e) =>
                  setDraftRules((r) => ({ ...r, windowStart: e.target.value }))
                }
              />
              <Field
                label={t('Latest training time')}
                type="time"
                value={draftRules.windowEnd}
                onChange={(e) =>
                  setDraftRules((r) => ({ ...r, windowEnd: e.target.value }))
                }
              />
            </div>
            <SectionHead title={t('Session priorities')} />
            <p className="fine-print muted">
              {t('Higher-priority sessions are placed first when workout order is flexible. Preserving order takes precedence.')}
            </p>
            {client.program.days.map((day) => (
              <Field key={day.id} label={t('Priority · {name}', { name: day.name })}>
                <select
                  value={draftRules.priorities?.[day.id] || 2}
                  onChange={(e) =>
                    setDraftRules((r) => ({
                      ...r,
                      priorities: {
                        ...r.priorities,
                        [day.id]: Number(e.target.value),
                      },
                    }))
                  }
                >
                  <option value="1">{t('Lower priority')}</option>
                  <option value="2">{t('Normal')}</option>
                  <option value="3">{t('Higher priority')}</option>
                </select>
              </Field>
            ))}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? t('Saving…') : t('Save flexibility rules')}
            </Button>
          </form>
        </Modal>
      )}
    </section>
  );
}
export function ScheduleComparison({ proposal, client }) {
  const changed = proposal.proposed.filter(
    (p) =>
      p.date !== p.originalDate ||
      (p.time || "") !==
        (proposal.original.find((s) => s.date === p.originalDate)?.time || ""),
  );
  return (
    <>
    <table className="schedule-comparison" data-state={proposal.status}>
      <caption>{t('Proposed schedule ·')} {changed.length} {t('moved sessions ·')} {proposal.status === 'pending' ? t('Awaiting approval') : proposal.status === 'confirmed' ? t('Confirmed') : t('Preview · not applied')}</caption>
      <thead>
        <tr>
          <th>{t('Session')}</th>
          <th>{t('Original')}</th>
          <th>{t('Proposed')}</th>
        </tr>
      </thead>
      <tbody>
        {proposal.proposed
          .filter(
            (p) =>
              p.date !== p.originalDate ||
              p.date >= zonedDay(client.checkinPlan?.timezone || "UTC"),
          )
          .slice(0, 14)
          .sort((a, b) => a.originalDate.localeCompare(b.originalDate))
          .map((p) => (
            <tr
              key={p.originalDate}
              className={p.date !== p.originalDate ? "schedule-moved" : ""}
            >
              <td>
                {client.program.days.find((d) => d.id === p.dayId)?.name ||
                  p.dayId}
              </td>
              <td>{p.originalDate}</td>
              <td><span className="schedule-date-destination">
                {p.date !== p.originalDate && <ArrowRight size={14} aria-hidden="true"/>}{p.date}
                {p.time ? ` · ${p.time}` : ""}
                {p.date !== p.originalDate ? t(' · moved') : ""}
              </span></td>
            </tr>
          ))}
      </tbody>
    </table>
    </>
  );
}
