import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useApp } from './context.js';
import { ExerciseMedia, exerciseImage } from './ExerciseMedia.jsx';
import { averageValue, chartTop, datePosition, entriesBetween, entryValue, exerciseEntries, exerciseMetric, exerciseRecords, setLabel } from './exercise-stats.js';
import { motionReduced } from './motion.jsx';
import { dayKey, offsetDay, shortDate, useFile } from './store.js';
import { IconButton } from './ui.jsx';

const SECTIONS = ['Progress', 'History', 'Instructions'];
const RANGES = [['M', 'Month', -29], ['6M', 'Six months', -181]];

function VolumeBars({ entries, metric, start, end, picked, onPick }) {
  const plot = useRef(null), press = useRef(null);
  const bars = entries.map(entry => ({ entry, value: entryValue(entry, metric), at: datePosition(entry.date, start, end) }));
  const top = chartTop(Math.max(...bars.map(bar => bar.value)));
  function nearest(event) {
    const box = plot.current.getBoundingClientRect(), at = (event.clientX - box.left) / box.width;
    return bars.reduce((best, bar) => Math.abs(bar.at - at) < Math.abs(best.at - at) ? bar : best).entry.id;
  }
  return <div className="volume-chart">
    <div className="volume-axis" aria-hidden="true"><span>{top.toLocaleString()}</span><span>{(top / 2).toLocaleString()}</span><span>0</span></div>
    <div className={`volume-plot ${picked ? 'has-pick' : ''}`} ref={plot}
      onPointerDown={event => { const id = nearest(event); press.current = id === picked ? id : null; onPick(id); }}
      onPointerMove={event => { if (event.buttons) { press.current = null; onPick(nearest(event)); } }}
      onPointerUp={() => { if (press.current) onPick(null); press.current = null; }}>
      {bars.map(({ entry, value, at }, index) => <button key={entry.id} type="button" className={entry.id === picked ? 'is-picked' : ''} style={{ '--at': at, '--bar': index, height: `${value / top * 100}%` }} aria-pressed={entry.id === picked} aria-label={`${shortDate(entry.date)}: ${Math.round(value).toLocaleString()} ${metric.unit}`} onClick={event => { if (!event.detail) onPick(entry.id === picked ? null : entry.id); }}/>)}
    </div>
    <div className="volume-dates" aria-hidden="true"><span>{shortDate(start)}</span><span>{shortDate(end)}</span></div>
  </div>;
}

export function ExerciseDetail({ exercise, client, coachView, onBack }) {
  const { data } = useApp();
  const photo = useFile(exercise.imageFile?.id);
  const entries = useMemo(() => exerciseEntries(data.sessions, client.id, exercise.name), [data.sessions, client.id, exercise.name]);
  const metric = useMemo(() => exerciseMetric(entries), [entries]);
  const end = dayKey();
  const [range, setRange] = useState(() => entriesBetween(entries, offsetDay(RANGES[0][2]), end).length ? 'M' : '6M');
  const [picked, setPicked] = useState(null);
  const [active, setActive] = useState(SECTIONS[0]);
  const [stuck, setStuck] = useState(false);
  const sections = useRef({}), sentinel = useRef(null);
  const start = offsetDay(RANGES.find(([key]) => key === range)[2]);
  const visible = entriesBetween(entries, start, end);
  const pickedEntry = visible.find(entry => entry.id === picked);
  const records = useMemo(() => exerciseRecords(entries, metric), [entries, metric]);
  const average = averageValue(visible, metric);

  useEffect(() => {
    const spy = new IntersectionObserver(rows => { for (const row of rows) if (row.isIntersecting) setActive(row.target.dataset.section); }, { rootMargin: '-42% 0px -56% 0px' });
    Object.values(sections.current).forEach(section => spy.observe(section));
    const pin = new IntersectionObserver(([row]) => setStuck(!row.isIntersecting), { rootMargin: '-64px 0px 0px' });
    pin.observe(sentinel.current);
    return () => { spy.disconnect(); pin.disconnect(); };
  }, []);

  function jump(name) {
    setActive(name);
    sections.current[name].scrollIntoView({ behavior: motionReduced() ? 'instant' : 'smooth', block: 'start' });
  }
  function changeRange(key) {
    setRange(key);
    setPicked(null);
  }
  const section = name => ({ ref: node => { if (node) sections.current[name] = node; else delete sections.current[name]; }, 'data-section': name, className: 'exercise-section', 'aria-label': name });

  return <article className="exercise-detail">
    <div className="exercise-hero"><img className={photo ? '' : 'is-stock'} src={photo || exerciseImage(exercise)} alt=""/></div>
    <div className={`exercise-bar ${stuck ? 'is-stuck' : ''}`}><IconButton label="Back" onClick={onBack}><ArrowLeft size={24}/></IconButton><span>Exercise details</span></div>
    <i className="exercise-sentinel" ref={sentinel}/>
    <div className="exercise-heading">
      <h1>{exercise.name}</h1>
      <nav aria-label="Exercise sections">{SECTIONS.map(name => <button key={name} type="button" className={active === name ? 'is-active' : ''} aria-current={active === name ? 'true' : undefined} onClick={() => jump(name)}>{name}</button>)}</nav>
    </div>

    <section {...section('Progress')}>
      {entries.length ? <>
        <div className="exercise-summary">
          <div className="exercise-readout" aria-live="polite"><small>{pickedEntry ? shortDate(pickedEntry.date) : metric.label}</small><b>{pickedEntry ? Math.round(entryValue(pickedEntry, metric)).toLocaleString() : average === null ? '—' : average.toLocaleString()}<em> {metric.unit}</em></b></div>
          <div className="exercise-range" role="group" aria-label="Chart range">{RANGES.map(([key, label]) => <button key={key} type="button" aria-label={label} aria-pressed={range === key} onClick={() => changeRange(key)}>{key}</button>)}</div>
        </div>
        {visible.length ? <VolumeBars key={range} entries={visible} metric={metric} start={start} end={end} picked={pickedEntry?.id} onPick={setPicked}/> : <p className="exercise-quiet">No sessions in this range.</p>}
        <h2>Personal records</h2>
        <ol className="exercise-records">{records.map((record, index) => <li key={`${record.weight}:${record.reps}`}><span>{index + 1}</span><b>{setLabel(record, metric)}</b><small>{shortDate(record.date)}</small></li>)}</ol>
      </> : <p className="exercise-quiet">{coachView ? `${client.name} has not logged this exercise yet.` : 'No sets logged yet. Log this exercise in a workout and your progress, records and history build here.'}</p>}
    </section>

    <section {...section('History')}>
      <h2>History</h2>
      {entries.length ? <div className="exercise-history">{[...entries].reverse().map(entry => <details key={entry.id}>
        <summary><b>{setLabel(exerciseRecords([entry], metric, 1)[0] || entry.sets[0], metric)}</b><small>{shortDate(entry.date)}</small><ChevronDown size={16}/></summary>
        <ol>{entry.sets.map((set, index) => <li key={set.id || index}><span>Set {index + 1}</span><span>{setLabel({ ...set, weight: Number(set.weight || 0) }, metric)}</span></li>)}</ol>
      </details>)}</div> : <p className="exercise-quiet">Each logged session will appear here.</p>}
    </section>

    <section {...section('Instructions')}>
      <h2>Instructions</h2>
      {exercise.videoFile && <ExerciseMedia exercise={exercise} live className="exercise-demo"/>}
      <p className={exercise.notes ? 'exercise-notes' : 'exercise-quiet'}>{exercise.notes || (coachView ? 'No coaching notes on this exercise yet.' : 'Your coach has not added notes for this exercise yet.')}</p>
      <dl className="exercise-facts">
        {exercise.group && <div><dt>Muscle group</dt><dd>{exercise.group}</dd></div>}
        {exercise.sets && <div><dt>Target</dt><dd>{exercise.sets} × {exercise.reps}{exercise.kind === 'Duration' ? ' sec' : ' reps'}</dd></div>}
        {exercise.rest && <div><dt>Rest</dt><dd>{exercise.rest}s</dd></div>}
        {exercise.tempo && <div><dt>Tempo</dt><dd>{exercise.tempo}</dd></div>}
      </dl>
    </section>
  </article>;
}
