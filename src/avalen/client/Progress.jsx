// A client's progress tab and every screen reached from it: recovery, body
// weight, strength history, consistency, photos, milestones and InBody results.
import { useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronRight, Dumbbell, FileText, MessageCircle, Plus, Share2 } from 'lucide-react';
import { useApp } from '../context.js';
import { consistencyState, latestMeasurement } from '../validation.js';
import { dayKey, metrics, offsetDay, round, saveFile, scheduleDay, shortDate, sum, uid } from '../store.js';
import { RecoveryMap } from '../RecoveryMap.jsx';
import { Bars, Button, Empty, Field, Heading, LineChart, Media, Modal, Notice, SectionHead, Stat, Tabs } from '../ui.jsx';
import { t } from '../i18n.js';

const PROGRESS_TABS = ["Overview", "Recovery", "Strength", "Body", "Consistency", "Photos"];
export function Progress({ clientOverride, startTab = "Overview" }) {
  const { data, client: active, subtab, setSubtab, openShare, ask, openExercise } = useApp();
  const client = clientOverride || active;
  const [ownTab, setOwnTab] = useState(startTab);
  const tab = clientOverride
    ? ownTab
    : PROGRESS_TABS.includes(subtab)
      ? subtab
      : "Overview";
  const change = clientOverride ? setOwnTab : setSubtab;
  const coachView = Boolean(clientOverride);
  const m = metrics(data, client.id);
  const sessionWord = m.sessions.length === 1 ? 'session' : 'sessions';
  const [measure, setMeasure] = useState(false);
  const last = m.lastWeight,
    delta = m.weights.length ? round(last - m.weights[0].weight) : null;
  const lifts = Object.entries(m.exerciseMax);
  const bodyRecords = data.measurements.filter(row => row.clientId === client.id && row.date <= dayKey());
  const sessions = data.sessions
    .filter((s) => s.clientId === client.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      {!clientOverride && (
        <Heading
          title={t('Progress')}
          subtitle={t('The work you put in. The change you can see.')}
        />
      )}
      <Tabs
        items={PROGRESS_TABS}
        value={tab}
        onChange={change}
      />
      {tab === "Recovery" && <RecoveryMap clientId={client.id} coach={coachView} day={sessions.some(s => s.date === dayKey()) ? null : scheduleDay(client, dayKey())}/>}
      {(tab === "Body" || tab === "Overview" && /body|weight|fat/i.test(client.goal) && !/strength/i.test(client.goal)) && (
        <section className="card">
          <SectionHead
            title={t('Body Weight')}
            action={
              <button className="text-link" onClick={() => setMeasure(true)}>
                <Plus size={14} /> {t('Log')}
              </button>
            }
          />
          <div className="weight-summary">
            <div>
              <strong>
                {delta !== null ? t('{value}{delta} kg', { value: delta > 0 ? "+" : "", delta }) : "—"}
              </strong>
              <small>{coachView ? t('since first log') : t('since your first log')}</small>
            </div>
            <div>
              <b>
                {last || "—"} <small>kg</small>
              </b>
              <span className="green">{t('{length} measurements', { length: m.weights.length })}</span>
            </div>
          </div>
          <LineChart records={m.weights} />
        </section>
      )}
      {tab === "Overview" && (
        <>
          <section className="progress-snapshot" aria-label={t('Your progress snapshot')}><button onClick={() => change('Strength')}><small>{t('Training · 28 days')}</small><b>{m.sessions.length}<em> {sessionWord}</em></b><span>{coachView ? t('View lifts') : t('View your lifts')} <ChevronRight size={13}/></span></button><button onClick={() => change('Body')}><small>{t('Latest weight')}</small><b>{m.lastWeight ?? '—'}<em> kg</em></b><span>{m.weights.at(-1) ? shortDate(m.weights.at(-1).date) : t('Add a measurement')} <ChevronRight size={13}/></span></button></section>
          <section className="progress-focus"><span className="eyebrow">{coachView ? t('FOCUS') : t('YOUR FOCUS')}</span><h2>{client.goal}</h2><p>{m.sessions.length ? `${t('{count} sessions in the last 28 days.', { count: m.sessions.length })} ${coachView ? t('Open Strength to review how lifts are progressing.') : t('Explore Strength to see how your lifts are progressing.')}` : coachView ? t('No sessions logged in the last 28 days.') : t('Start with your next session. Your progress will build here.')}</p><Button secondary small onClick={() => change(/body|weight|fat/i.test(client.goal) && !/strength/i.test(client.goal) ? 'Body' : 'Strength')}>{coachView ? t('Explore progress') : t('Explore your progress')} <ArrowRight size={16}/></Button></section>
          <div className="two-stats">
            <Stat
              label={t('Training adherence')}
              value={m.training === null ? "—" : `${m.training}%`}
              note={t('Scheduled sessions · last 28 days')}
            >
              <Bars values={sessions.slice(0, 7).map((s) => s.sets.length)} />
            </Stat>
            <Stat
              label={t('Nutrition adherence')}
              value={m.nutrition === null ? "—" : `${m.nutrition}%`}
              note={t('{nutritionDays} completed days · within 15% of saved targets', { nutritionDays: m.nutritionDays })}
            >
              <Bars
                tone="blue"
                values={Array.from({ length: 7 }, (_, i) =>
                  sum(
                    data.foodLogs.filter(
                      (f) =>
                        f.clientId === client.id && f.date === offsetDay(i - 6),
                    ),
                    "kcal",
                  ),
                )}
              />
            </Stat>
          </div>
          <Photos clientId={client.id} compact onAll={() => change("Photos")} />
          <SectionHead
            title={t('Recent sessions')}
            action={
              <button
                className="text-link"
                disabled={!sessions.length}
                onClick={() => openShare({ story: true, clientId: client.id })}
              >
                {t('Progress story')} <Share2 size={14} />
              </button>
            }
          />
          <div className="card list">
            {sessions.slice(0, 5).map((s) => (
              <button
                className="simple-row"
                key={s.id}
                onClick={() => openShare(s)}
              >
                <span className="status-icon green">
                  <Check size={16} />
                </span>
                <span>
                  <b>{t(s.title)}</b>
                  <small>
                    {shortDate(s.date)} ·{" "}
                    {s.sets.filter((x) => !x.skipped).length} {t('sets ·')}{" "}
                    {Math.round(s.duration / 60)} {t('min')}
                  </small>
                </span>
                <Share2 size={16} />
              </button>
            ))}
            {!sessions.length && (
              <Empty
                title={t('Your first session awaits')}
                detail={t('Completed workouts and shareable results will appear here.')}
              />
            )}
          </div>
          <Milestones client={client} />
        </>
      )}
      {tab === "Strength" && (
        <div className="strength-list">
          {lifts.length ? (
            lifts.map(([name, value]) => {
              const records = sessions
                .filter((s) =>
                  s.sets.some((x) => x.name === name && !x.skipped),
                )
                .map((s) => ({
                  date: s.date,
                  weight: Math.max(
                    ...s.sets
                      .filter((x) => x.name === name && !x.skipped)
                      .map((x) => x.weight * (1 + x.reps / 30)),
                  ),
                }))
                .reverse();
              return (
                <section className="card" key={name}>
                  <SectionHead
                    title={name}
                    action={<span className="green">{t('{round} kg', { round: round(value) })}</span>}
                  />
                  <p className="muted">{t('Estimated one-rep max · Epley formula')}</p>
                  <LineChart records={records} />
                  <div className="strength-actions">
                    <button className="text-link" onClick={() => openExercise(name)}>
                      {t('Exercise details')} <ChevronRight size={14} />
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        ask(t('{name} · estimated 1RM {value} kg', { name, value: round(value) }), "", client.id)
                      }
                    >
                      {clientOverride ? t('Message client') : t('Ask coach')} <MessageCircle size={14} />
                    </button>
                  </div>
                </section>
              );
            })
          ) : (
            <Empty
              icon={Dumbbell}
              title={t('Build your strength history')}
              detail={t('Log a weighted workout to start tracking your lifts.')}
            />
          )}
        </div>
      )}
      {tab === "Body" && (
        <>
          <div className="three-stats">
            {[
              ["waist", "Waist", "cm"],
              ["chest", "Chest", "cm"],
              ["bodyFat", "Body fat", "%"],
            ].map(([key, label, unit]) => (
              <Stat
                key={key}
                label={label}
                value={`${latestMeasurement(bodyRecords, key)?.[key] ?? "—"} ${unit}`} note={latestMeasurement(bodyRecords, key) ? shortDate(latestMeasurement(bodyRecords, key).date) : t('Not recorded')}
              />
            ))}
          </div>
          <InBodyPanel client={client} />
        </>
      )}
      {tab === "Consistency" && <Consistency client={client} />}{" "}
      {tab === "Photos" && <Photos clientId={client.id} />}{" "}
      {measure && (
        <MeasurementForm client={client} onClose={() => setMeasure(false)} />
      )}
    </>
  );
}


function MeasurementForm({ client, onClose }) {
  const { data, update } = useApp();
  const records = data.measurements.filter((x) => x.clientId === client.id).sort((a, b) => a.date.localeCompare(b.date));
  const last = records.at(-1);
  function valuesFor(date) {
    const existing = records.find(record => record.date === date);
    return { date, weight: existing?.weight ?? last?.weight ?? '', waist: existing?.waist ?? '', chest: existing?.chest ?? '', bodyFat: existing?.bodyFat ?? '' };
  }
  const [form, setForm] = useState(() => valuesFor(dayKey()));
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const saveLock = useRef(false);
  const existing = records.find(record => record.date === form.date);
  return (
    <Modal title={t('Log measurements')} onClose={onClose} canClose={!saving}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (saveLock.current) return;
          saveLock.current = true; setSaving(true); setError('');
          const result = await update((d) => {
            const record = { ...form, id: existing?.id || uid(), clientId: client.id };
            for (const key of ["weight", "waist", "chest", "bodyFat"])
              record[key] = form[key] === "" ? existing?.[key] ?? null : Number(form[key]);
            d.measurements = d.measurements.filter(
              (m) => !(m.clientId === client.id && m.date === form.date),
            );
            d.measurements.push(record);
          });
          saveLock.current = false; setSaving(false);
          if (result?.error) {setError(result.error); return;}
          onClose();
        }}
      >
        <Field
          label={t('Date')}
          type="date"
          max={dayKey()}
          required
          value={form.date}
          onChange={(e) => setForm(valuesFor(e.target.value))}
        />
        {[
          ["weight", "Weight (kg)", 20, 400],
          ["waist", "Waist (cm)", 20, 250],
          ["chest", "Chest (cm)", 20, 250],
          ["bodyFat", "Body fat (%)", 1, 70],
        ].map(([key, label, min, max]) => (
          <Field
            key={key}
            label={label}
            required={key === "weight"}
            type="number"
            step="0.1"
            min={min}
            max={max}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        ))}
        {existing && <Notice>{t('You’re updating this date’s entry. Blank optional fields keep the saved value.')}</Notice>}
        {error && <p className="error" role="alert">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? t('Saving…') : existing ? t('Update measurement') : t('Save measurement')} <Check size={16} />
        </Button>
      </form>
    </Modal>
  );
}


export function Consistency({ client }) {
  const { data } = useApp();
  const [mode, setMode] = useState("Training + nutrition");
  const days = Array.from({ length: 84 }, (_, i) => offsetDay(i - 83));
  const [selected, setSelected] = useState(null);
  function state(date) {
    const workout = data.sessions.some(
      (s) => s.clientId === client.id && s.date === date,
    );
    const foods = data.foodLogs.filter(
      (f) => f.clientId === client.id && f.date === date,
    );
    const nutrition =
      foods.length &&
      Math.abs(sum(foods, "kcal") - client.nutrition.kcal) /
        client.nutrition.kcal <=
        0.15;
    const h =
      data.habitLogs.find((h) => h.clientId === client.id && h.date === date)
        ?.values || {};
    return consistencyState({ workout, scheduled: client.schedule.some(item => item.date === date), foodLogged: foods.length > 0, nutrition: Boolean(nutrition), habits: client.habits, values: h, mode });
  }
  return (
    <section className="card">
      <SectionHead title={t('Your consistency')} />
      <Field label={t('Show')}>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {["Training + nutrition", "Training", "Nutrition", "Habits"].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>
      </Field>
      <div className="heatmap">
        {days.map((date) => (
          <button
            key={date}
            className={state(date)}
            title={`${shortDate(date)}: ${state(date)}`}
            aria-label={t('View consistency for {shortDate}', { shortDate: shortDate(date) })}
            onClick={() => setSelected(date)}
          />
        ))}
      </div>
      <div className="heatmap-key">
        <span>
          <i className="both" />
          {t('Targets hit')}
        </span>
        <span>
          <i className="partial" />
          {t('Partial')}
        </span>
        <span>
          <i className="nutrition" />
          {t('Nutrition only')}
        </span>
        <span>
          <i className="none" />
          {t('No log')}
        </span>
      </div>
      <p className="muted">
        {t('Last 12 weeks. Unlogged days are not treated as failure.')}
      </p>
      {selected && (
        <Notice>
          {shortDate(selected)} ·{" "}
          {state(selected) === "both"
            ? t('Targets hit')
            : state(selected) === "partial"
              ? t('Partially completed')
              : state(selected) === "nutrition"
                ? t('Nutrition target hit')
                : t('Nothing logged')}
          .
        </Notice>
      )}
    </section>
  );
}


export function Photos({ clientId, compact = false, onAll }) {
  const { data, update } = useApp();
  const photos = data.photos
    .filter((p) => p.clientId === clientId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const [error, setError] = useState(""),
    [compare, setCompare] = useState(false),
    [position, setPosition] = useState(50);
  const [left, setLeft] = useState(""),
    [right, setRight] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e) {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    try {
      const media = await saveFile(file);
      const result = await update((d) =>
        d.photos.push({ id: uid(), clientId, date: dayKey(), file: media }),
      );
      if (result?.error) throw new Error(result.error);
      setError("");
    } catch (e) {
      setError(
        e?.message || t('Your photo could not be saved. Please try again.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <SectionHead
        title={t('Progress photos')}
        action={
          compact ? (
            <button className="text-link" onClick={onAll}>
              {t('See all')}
            </button>
          ) : (
            <button
              className="text-link"
              disabled={photos.length < 2}
              onClick={() => setCompare(true)}
            >
              {t('Compare')}
            </button>
          )
        }
      />
      <div className="photo-grid">
        {(compact ? photos.slice(-3) : photos).map((p) => (
          <div key={p.id}>
            <Media fileId={p.file.id} alt={t('Progress {date}', { date: p.date })} />
            <small>{shortDate(p.date)}</small>
          </div>
        ))}
        <label className="photo-add">
          <Plus size={23} />
          <span>{busy ? t('Saving…') : t('Add photo')}</span>
          <input
            aria-label={t('Add photo')}
            disabled={busy}
            type="file"
            accept="image/*"
            onChange={add}
          />
        </label>
      </div>
      {!photos.length && (
        <p className="muted">
          {t('Your photos, your pace. Only photos you upload appear here.')}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {compare && (
        <Modal
          title={t('See how far you’ve come')}
          onClose={() => setCompare(false)}
        >
          <div className="form-grid">
            <Field label={t('Before')}>
              <select
                value={left || photos[0].id}
                onChange={(e) => setLeft(e.target.value)}
              >
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {shortDate(p.date)} · {t(p.file.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('After')}>
              <select
                value={right || photos.at(-1).id}
                onChange={(e) => setRight(e.target.value)}
              >
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {shortDate(p.date)} · {t(p.file.name)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="photo-compare">
            <Media
              fileId={
                (photos.find((p) => p.id === right) || photos.at(-1)).file.id
              }
              alt={t('After')}
            />
            <div
              className="photo-before"
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            >
              <Media
                fileId={
                  (photos.find((p) => p.id === left) || photos[0]).file.id
                }
                alt={t('Before')}
              />
            </div>
            <div className="compare-divider" style={{ left: `${position}%` }} />
            <span>{t('Before')}</span>
            <b>{t('After')}</b>
          </div>
          <input
            className="compare-range"
            aria-label={t('Slide to compare photos')}
            type="range"
            min="0"
            max="100"
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
          />
        </Modal>
      )}
    </section>
  );
}


function Milestones({ client }) {
  const { data } = useApp();
  const sessions = data.sessions.filter((s) => s.clientId === client.id),
    m = metrics(data, client.id);
  const items = [
    ["First workout", sessions.length >= 1],
    ["10 workouts completed", sessions.length >= 10],
    ["20 workouts completed", sessions.length >= 20],
    ["90% training adherence", m.training >= 90],
    ["First strength PR", sessions.some((s) => s.prs?.length)],
  ];
  return (
    <section className="card">
      <SectionHead title={t('Milestones')} />
      {items.map(([title, done]) => (
        <div className="simple-row milestone-row" key={title}>
          <span className={done ? "green" : "muted"}>
            <CheckCircle2 size={19} />
          </span>
          <b>{title}</b>
          <span className={done ? "green" : "muted"}>
            {done ? t('Achieved') : t('In progress')}
          </span>
        </div>
      ))}
    </section>
  );
}


export function InBodyPanel({ client }) {
  const { data } = useApp();
  const records = data.inbodies
    .filter((x) => x.clientId === client.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="card">
      <SectionHead title={t('Body composition')} />
      {records.length ? (
        <>
          <p className="muted">{t('Coach-verified values from your reports.')}</p>
          <LineChart records={records} field="bodyFat" unit="%" />
          <LineChart
            records={records}
            field="muscle"
            unit="kg muscle"
            color="blue"
          />
        </>
      ) : (
        <Empty
          icon={FileText}
          title={t('Your InBody timeline')}
          detail={t('Your coach can attach reports and enter verified values in your client profile.')}
        />
      )}
    </section>
  );
}

