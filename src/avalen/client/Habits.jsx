// A client's daily habit trackers (steps, water and anything else their coach set).
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useApp } from '../context.js';
import { dayKey } from '../store.js';
import { Hydration } from '../ReferenceMotion.jsx';
import { Meter, SectionHead } from '../ui.jsx';
import { t } from '../i18n.js';

export function Habits() {
  const { data, client, update } = useApp();
  const today = dayKey();
  const [edits, setEdits] = useState({});
  const [errors, setErrors] = useState({});
  const values =
    data.habitLogs.find((x) => x.clientId === client.id && x.date === today)
      ?.values || {};
  function change(h, value) {
    if (value === "" || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100000) {
      setErrors((previous) => ({ ...previous, [h.id]: "Enter a number between 0 and 100,000." }));
      return;
    }
    setErrors((previous) => ({ ...previous, [h.id]: "" }));
    setEdits((previous) => ({ ...previous, [h.id]: String(Number(Number(value).toFixed(3))) }));
    update((d) => {
      let row = d.habitLogs.find(
        (x) => x.clientId === client.id && x.date === today,
      );
      if (!row) {
        row = { clientId: client.id, date: today, values: {} };
        d.habitLogs.push(row);
      }
      row.values[h.id] = Number(Number(value).toFixed(3));
    });
  }
  return (
    <>
      <p className="muted intro-copy">
        {t('Small actions, repeated. Your coach sets the targets; you make them happen.')}
      </p>
      {client.habits.some(h => h.id === 'water') && <Hydration/>}
      <div className="habit-grid">
        {client.habits.map((h, i) => (
          <section className="card habit-card" key={h.id}>
            <SectionHead
              title={h.name}
              action={
                (values[h.id] || 0) >= h.target ? (
                  <CheckCircle2 className="green" size={19} />
                ) : (
                  <span className="muted">{t('Daily')}</span>
                )
              }
            />
            <strong>
              {(values[h.id] || 0).toLocaleString()}{" "}
              <small>
                / {h.target.toLocaleString()} {h.unit}
              </small>
            </strong>
            <Meter
              value={values[h.id] || 0}
              target={h.target}
              tone={i % 2 ? "blue" : "green"}
            />
            <div className="stepper">
              <button
                aria-label={t('Decrease {name}', { name: h.name })}
                onClick={() => change(h, Math.max(0, (values[h.id] || 0) - h.step))}
              >
                −
              </button>
              <input
                aria-label={h.name}
                type="number"
                min="0"
                max="100000"
                step={h.step}
                value={edits[h.id] ?? values[h.id] ?? 0}
                aria-invalid={Boolean(errors[h.id])}
                aria-describedby={errors[h.id] ? `habit-error-${h.id}` : undefined}
                onChange={(e) => {
                  const value = e.target.value;
                  setEdits((previous) => ({ ...previous, [h.id]: value }));
                  setErrors(previous => ({ ...previous, [h.id]: '' }));
                  // Preserve save-as-you-go, including an immediate refresh.
                  if (value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100000) change(h, value);
                }}
                onBlur={(e) => change(h, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); change(h, e.currentTarget.value); } }}
              />
              <button
                aria-label={t('Increase {name}', { name: h.name })}
                onClick={() => change(h, (values[h.id] || 0) + h.step)}
              >
                +
              </button>
            </div>
            {errors[h.id] && <p className="error" role="alert" id={`habit-error-${h.id}`}>{errors[h.id]}</p>}
          </section>
        ))}
      </div>
    </>
  );
}

