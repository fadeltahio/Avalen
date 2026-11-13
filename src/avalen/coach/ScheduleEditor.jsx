// Moving one of a client's scheduled workouts, or swapping it for a rest day.
import { useRef, useState } from 'react';
import { useApp } from '../context.js';
import { dayKey, decision } from '../store.js';
import { Button, Field, Notice, SectionHead } from '../ui.jsx';
import { t } from '../i18n.js';

export function ScheduleEditor({ client }) {
  const { update,data } = useApp();
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const saveLock = useRef(false);
  const [date, setDate] = useState(dayKey()),
    [day, setDay] = useState(client.program.days[0].id),
    [saved, setSaved] = useState(false);
  const valid = Boolean(date && !data.sessions.some(s=>s.clientId===client.id && s.date===date) && date >= dayKey() && (day === 'rest' || client.program.days.some(item => item.id === day)));
  return (
    <section className="card">
      <SectionHead title={t('Adjust the schedule')} />
      <div className="form-grid">
        <Field
          label={t('Date')}
          type="date"
          min={dayKey()}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSaved(false);
          }}
        />
        <Field label={t('Workout')}>
          <select value={day} onChange={(e) => { setDay(e.target.value); setSaved(false); }}>
            <option value="rest">{t('Rest day')}</option>
            {client.program.days.map((d) => (
              <option key={d.id} value={d.id}>
                {t(d.name)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Button
        secondary
        disabled={!valid || saving}
        onClick={async () => {
          if (!valid || saveLock.current) return;
          saveLock.current = true; setSaving(true); setError(''); setSaved(false);
          const result = await update((d) => {
            const c = d.clients.find((x) => x.id === client.id);
            c.schedule = c.schedule.filter((s) => s.date !== date);
            if (day !== "rest") c.schedule.push({ date, dayId: day });
            decision(
              d,
              client.id,
              "Schedule adjusted",
              `${date}: ${day === "rest" ? "Rest day" : c.program.days.find((x) => x.id === day).name}`,
            );
          });
          saveLock.current = false; setSaving(false);
          if (result?.error) {setError(result.error); return;}
          setSaved(true);
        }}
      >
        {saving ? t('Saving schedule…') : t('Save schedule')}
      </Button>
      {saved && <Notice>{t('Schedule updated.')}</Notice>}
      {error && <p role="alert" className="error">{error}</p>}
      {!valid && <p className="error" role="alert">{t('Choose today or a future date and an available workout.')}</p>}
    </section>
  );
}

