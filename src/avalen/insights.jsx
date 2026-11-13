import React, { useEffect, useState } from "react";
import { ArrowRight, Check, Plus, TrendingUp } from "lucide-react";
import { useApp } from "./context.js";
import { useWorkspaceSave } from "./workspace-save.js";
import {
  dayKey,
  decision,
  historyFor,
  metrics,
  offsetDay,
  round,
  uid,
} from "./store.js";
import { Button, Empty, Field, Modal, Notice, SectionHead } from "./ui.jsx";

import { t } from './i18n.js';
export function ClientChanges({ client }) {
  const { data, update } = useApp();
  const [hadPrevious] = useState(Boolean(client.lastViewedAt));
  const [since] = useState(client.lastViewedAt || offsetDay(-7) + "T00:00:00");
  useEffect(() => {
    update((d) => {
      d.clients.find((c) => c.id === client.id).lastViewedAt =
        new Date().toISOString();
    });
  }, [client.id]);
  const date = since.slice(0, 10),
    sessions = data.sessions.filter(
      (s) => s.clientId === client.id && s.finishedAt > since,
    ),
    weights = data.measurements
      .filter((m) => m.clientId === client.id && m.date >= date)
      .sort((a, b) => a.date.localeCompare(b.date)),
    messages = data.messages.filter(
      (m) => m.clientId === client.id && m.from === "client" && m.at > since,
    ),
    checkins = data.checkins.filter(
      (c) => c.clientId === client.id && c.date >= date,
    );
  return (
    <section className="card">
      <SectionHead
        title={
          hadPrevious
            ? t('Since your last review')
            : t('Your first review · last 7 days')
        }
      />
      <div className="changes-grid">
        <span>
          <b>{sessions.length}</b>{t('completed workouts')}
        </span>
        <span>
          <b>{messages.length}</b>{t('client messages')}
        </span>
        <span>
          <b>{checkins.length}</b>{t('check-ins submitted')}
        </span>
      </div>
      {weights.length > 1 && (
        <p className="muted">{t('Weight trend: {weight} → {weight2} kg ({round} kg).', { weight: weights[0].weight, weight2: weights.at(-1).weight, round: round(weights.at(-1).weight - weights[0].weight) })}</p>
      )}
      <small className="muted">{t('Review window began {value}.', { value: new Date(since).toLocaleDateString() })}</small>
    </section>
  );
}

export function ProgressionSuggestions({ client }) {
  const { data, update } = useApp();
  const [edit, setEdit] = useState(null),
    [weight, setWeight] = useState(0);
  const suggestions = client.program.days
    .flatMap((day) =>
      day.exercises
        .filter((ex) => {
          const last = historyFor(data, client.id, ex.name);
          return (
            ex.weight > 0 &&
            last.length >= ex.sets &&
            last
              .slice(0, ex.sets)
              .every((s) => s.reps >= ex.reps && s.weight >= ex.weight) &&
            !data.dismissed.some(
              (d) =>
                d.key === "load-" + ex.id &&
                d.clientId === client.id &&
                d.until >= dayKey(),
            )
          );
        })
        .map((ex) => ({ day, ex, last: historyFor(data, client.id, ex.name) })),
    )
    .slice(0, 3);
  function apply(item, load) {
    update((d) => {
      const c = d.clients.find((c) => c.id === client.id),
        ex = c.program.days
          .find((x) => x.id === item.day.id)
          .exercises.find((x) => x.id === item.ex.id);
      const prior = ex.weight;
      ex.weight = load;
      decision(
        d,
        client.id,
        "Progression approved",
        `${ex.name}: ${prior} → ${load} kg. Coach-approved after all prescribed reps were completed.`,
      );
    });
    setEdit(null);
  }
  if (!suggestions.length) return null;
  return (
    <section className="card">
      <SectionHead
        title={t('A possible next step')}
        action={<TrendingUp size={18} className="green" />}
      />
      <p className="muted">
        {t('Simple rules, not automatic coaching. Review readiness and technique before increasing load.')}
      </p>
      {suggestions.map((item) => (
        <div className="suggestion" key={item.ex.id}>
          <h3>{t(item.ex.name)}</h3>
          <p>
            {item.ex.sets} {t('prescribed sets reached')} {item.ex.reps} {t('reps at')}{" "}
            {item.ex.weight} {t('kg or more. Consider')} {item.ex.weight + 2.5} {t('kg next session.')}
          </p>
          <div className="button-row">
            <Button
              small
              secondary
              onClick={() => apply(item, item.ex.weight + 2.5)}
            >
              {t('Accept +2.5 kg')}
            </Button>
            <button
              className="text-link"
              onClick={() => {
                setEdit(item);
                setWeight(item.ex.weight + 2.5);
              }}
            >
              {t('Edit')}
            </button>
            <button
              className="text-link muted"
              onClick={() =>
                update((d) => {
                  d.dismissed.push({
                    clientId: client.id,
                    key: "load-" + item.ex.id,
                    until: offsetDay(7),
                  });
                  decision(
                    d,
                    client.id,
                    "Progression held",
                    `${item.ex.name}: coach kept current load for now.`,
                  );
                })
              }
            >
              {t('Keep current')}
            </button>
          </div>
        </div>
      ))}
      {edit && (
        <Modal title={t('Adjust the suggested load')} onClose={() => setEdit(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              apply(edit, weight);
            }}
          >
            <Field
              label={t('Next load (kg)')}
              type="number"
              required
              min="0"
              max="500"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
            />
            <Button type="submit">{t('Approve adjustment')}</Button>
          </form>
        </Modal>
      )}
    </section>
  );
}

export function HabitEditor({ client }) {
  const { update } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [form, setForm] = useState(structuredClone(client.habits)),
    [saved, setSaved] = useState(false);
  function change(i, key, value) {
    setForm((prev) =>
      prev.map((h, j) => (j === i ? { ...h, [key]: value } : h)),
    );
    setSaved(false);
  }
  return (
    <section className="card">
      <SectionHead title={t('Daily foundations')} />
      <p className="muted">
        {t('Set practical targets. These appear in the client’s Plan → Habits.')}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaved(false);
          if (!await save((d) => {
            d.clients.find((c) => c.id === client.id).habits = form.map(habit => ({ ...habit, name: habit.name.trim(), unit: habit.unit.trim() }));
            decision(
              d,
              client.id,
              "Habit targets updated",
              form.map((h) => `${h.name}: ${h.target} ${h.unit}`).join(" · "),
            );
          })) return;
          setSaved(true);
        }}
      >
        <fieldset className="save-fields" disabled={saving}>
        {form.map((h, i) => (
          <div className="habit-editor" key={h.id}>
            <Field
              label={t('Habit')}
              required
              value={h.name}
              onChange={(e) => change(i, "name", e.target.value)}
            />
            <div className="form-grid">
              <Field
                label={t('Daily target')}
                type="number"
                min="0.1"
                step="0.1"
                max="100000"
                required
                value={h.target}
                onChange={(e) => change(i, "target", Number(e.target.value))}
              />
              <Field
                label={t('Unit')}
                required
                value={h.unit}
                onChange={(e) => change(i, "unit", e.target.value)}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setSaved(false);
            setForm([
              ...form,
              {
                id: uid(),
                name: "New habit",
                target: 1,
                unit: "times",
                step: 1,
              },
            ]);
          }}
        >
          <Plus size={15} />
          {t('Add custom habit')}
        </button>
        {saveError && <p className="error" role="alert">{saveError}</p>}
        <Button type="submit">{saving ? t('Saving targets…') : t('Save habit targets')}</Button>
        {saved && <Notice>{t('Habit targets updated.')}</Notice>}
        </fieldset>
      </form>
    </section>
  );
}

export function CustomExercise({ onAdded }) {
  const { update } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-link" onClick={() => setOpen(true)}>
        <Plus size={15} />
        {t('Create a custom exercise')}
      </button>
      {open && (
        <Modal
          title={t('Add to your exercise library')}
          onClose={() => setOpen(false)}
          canClose={!saving}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fields = new FormData(e.currentTarget);
              const ex = {
                id: uid(),
                name: fields.get("name"),
                group: fields.get("group"),
                sets: 3,
                reps: 10,
                weight: 0,
                rest: 60,
                rpe: 8,
                rir: 2,
                tempo: "2-0-1",
                notes: fields.get("notes"),
                kind: "Standard",
              };
              if (!await save((d) => d.library.push(ex))) return;
              onAdded?.(ex);
              setOpen(false);
            }}
          >
            <fieldset className="save-fields" disabled={saving}>
            <Field label={t('Exercise name')} name="name" required maxLength={80} />
            <Field label={t('Muscle group')} name="group" required maxLength={40} />
            <Field label={t('Technique cues')}>
              <textarea name="notes" maxLength={1000} />
            </Field>
            {saveError && <p className="error" role="alert">{saveError}</p>}
            <Button type="submit">{saving ? t('Creating exercise…') : t('Create exercise')}</Button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}
