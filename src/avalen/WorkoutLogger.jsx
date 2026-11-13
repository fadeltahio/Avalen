import { RestTimer } from './RestTimer.jsx';
import { changeRest } from './rest-timer.js';
import { MotionDetails, animate, motionReduced } from './motion.jsx';
import { FormLab } from './formlab-entry.jsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Clock, List, Minus, Plus, MessageCircle, Undo2 } from 'lucide-react';
import { useApp } from './context.js';
import { uid, historyFor, finishSession, sum, round } from './store.js';
import { readWorkoutInput, writeWorkoutInput, clearWorkoutInput } from './workout-input.js';
import { Button, Field, Modal, Tabs } from './ui.jsx';
import { ExerciseMedia } from './ExerciseMedia.jsx';
import { libraryWithCatalogue, planExercise, regionOf } from './exercise-catalogue.js';
import { useEditDraft } from './edit-draft.jsx';

import { t } from './i18n.js';
function SetEditor({initial, onChange, onSubmit, number, total, previous, editing, cancel, duration = false, busy = false, justLogged = false, pips = [], ready = false}) {
  const [values, setValues] = useState(initial);
  const inputs = useRef({});
  const validWeight = values.weight !== '' && Number.isFinite(Number(values.weight)) && Number(values.weight) >= 0 && Number(values.weight) <= 1000;
  const validReps = values.reps !== '' && Number.isInteger(Number(values.reps)) && Number(values.reps) >= 1 && Number(values.reps) <= (duration ? 3600 : 500);
  const valid = validWeight && validReps;
  function change(key, value) {
    const next = {...values, [key]: value};
    setValues(next);
    onChange?.(next);
  }
  function step(key, direction, amount, min, max) {
    change(key, round(Math.min(max, Math.max(min, Number(values[key]) + direction * amount))));
    animate(inputs.current[key], [{transform: `translateY(${direction * -12}px)`, opacity: .2}, {transform: 'translateY(0)', opacity: 1}], {duration: 220});
  }
  return <form className={`set-editor focused-set-editor ${ready ? 'is-ready' : ''}`} aria-label={editing ? t('Edit set {number}', { number }) : t('Current set')} onSubmit={e => {
    e.preventDefault();
    if (valid && !busy) { document.activeElement?.blur(); onSubmit({weight: Number(values.weight), reps: Number(values.reps), effort: values.effort}); }
  }}>
    <div className="set-editor-heading"><b>{editing ? t('Edit set {number}', { number }) : t('Set {number} of {total}', { number, total })}</b>{!editing && pips.length > 1 && <span className="set-pips" aria-hidden="true">{pips.map((state, index) => <i key={index} className={`is-${state}`}/>)}</span>}<span>{previous ? t('Last time: {round} kg × {reps}{value}', { round: round(previous.weight), reps: previous.reps, value: duration ? ' sec' : '' }) : t('Use your coach’s target')}</span></div>
    <div className="set-controls">
      {[['weight', 'Weight (kg)', 'Weight', 'kg', validWeight, 2.5, 0, 1000], ['reps', duration ? 'Duration (seconds)' : 'Reps', duration ? 'Duration' : 'Reps', duration ? 'sec' : 'reps', validReps, duration ? 5 : 1, 1, duration ? 3600 : 500]].map(([key, label, text, unit, isValid, amount, min, max]) => <div className="set-control" key={key}>
        <label><span>{text}<small>{unit}</small></span><input ref={node => { inputs.current[key] = node; }} aria-label={label} type="number" inputMode={key === 'weight' ? 'decimal' : 'numeric'} enterKeyHint={key === 'weight' ? 'next' : 'done'} disabled={busy} min={min} max={max} step={key === 'weight' ? 'any' : 1} value={values[key]} aria-invalid={!isValid} aria-describedby={!valid ? 'set-input-error' : undefined} onFocus={e => e.target.select()} onKeyDown={event => {if(event.key === 'Enter' && key === 'weight'){event.preventDefault();event.currentTarget.form.querySelectorAll('.set-control input')[1]?.focus();}}} onChange={e => change(key, e.target.value)}/></label>
        <div className="set-adjust"><button type="button" aria-label={t('Decrease {label}', { label })} disabled={busy || Number(values[key]) <= min} onClick={() => step(key, -1, amount, min, max)}><Minus size={18}/></button><span>{amount} {unit === 'reps' && amount === 1 ? 'rep' : unit}</span><button type="button" aria-label={t('Increase {label}', { label })} disabled={busy || Number(values[key]) >= max} onClick={() => step(key, 1, amount, min, max)}><Plus size={18}/></button></div>
      </div>)}
    </div>
    {!valid && <p id="set-input-error" className="set-input-error" role="alert">{!validWeight ? t('Enter a weight from 0 to 1,000 kg.') : duration ? t('Enter whole seconds from 1 to 3,600.') : t('Enter a whole number of reps from 1 to 500.')}</p>}
    <div className="set-action-area"><Button type="submit" className={justLogged ? 'set-just-logged' : ''} disabled={!valid || busy} aria-label={editing ? t('Save changes') : t('Log set {number}', { number })}><Check size={19}/>{busy ? t('Saving…') : editing ? t('Save changes') : t('Log set {number}', { number })}</Button></div>
    <MotionDetails className="set-effort"><summary>{t('How did it feel?')}<span>{values.effort}</span></summary><Tabs items={['Easy', 'Good', 'Hard']} value={values.effort} onChange={value => change('effort', value)} label={t('Set effort')}/></MotionDetails>
    {editing && <button type="button" className="logger-cancel" onClick={cancel}>{t('Cancel edit')}</button>}
  </form>;
}

const slotsFor = exercise => Array.from({length: exercise.sets}, (_, i) => i + 1);
export function Workout({onClose, onFinish}) {
  const {data, client, update, ask} = useApp();
  const draft = data.drafts[client.id];
  const noteDraft = useEditDraft(`workout-note.${client.id}.${draft?.id || 'none'}`, {note:draft?.note || ''});
  const [now, setNow] = useState(Date.now());
  const [editId, setEditId] = useState(null), [swap, setSwap] = useState(false), [exerciseList, setExerciseList] = useState(false);
  const [confirm, setConfirm] = useState(false), [finishing, setFinishing] = useState(false);
  const [announcement, setAnnouncement] = useState(''), [error, setError] = useState(''), [inputWarning, setInputWarning] = useState(false);
  const [saved, setSaved] = useState(null), [savingSet, setSavingSet] = useState(false);
  const exerciseHeading = useRef(null), exerciseBody = useRef(null), exerciseRail = useRef(null), priorIndex = useRef(draft?.index);
  const lastSaved = useRef(null), operationLock = useRef(false), finishLock = useRef(false), pendingInputs = useRef({});
  useEffect(() => {
    if (!draft || draft.index === priorIndex.current) return;
    const direction = draft.index > priorIndex.current ? 1 : -1; priorIndex.current = draft.index;
    const animations = [exerciseHeading.current, exerciseBody.current].map(el => animate(el, [{opacity: .5, transform: `translateX(${direction * 12}px)`}, {opacity: 1, transform: 'translateX(0)'}]));
    const scroll = requestAnimationFrame(() => { const modal = exerciseHeading.current?.closest('dialog'); if (modal) modal.scrollTop = 0; });
    return () => {cancelAnimationFrame(scroll); animations.forEach(a => a?.cancel());};
  }, [draft?.index]);
  useEffect(() => {if (saved) {const timer = setTimeout(() => setSaved(null), 1700); return () => clearTimeout(timer);}}, [saved]);
  const [ready, setReady] = useState(false);
  useEffect(() => {if (ready) {const timer = setTimeout(() => setReady(false), 1400); return () => clearTimeout(timer);}}, [ready]);
  // Keep the screen awake while a workout is open, where the browser allows it.
  useEffect(() => {
    let lock = null, live = true;
    async function hold() {
      if (!navigator.wakeLock || document.visibilityState !== 'visible') return;
      try { const next = await navigator.wakeLock.request('screen'); if (live) lock = next; else next.release().catch(() => {}); } catch {}
    }
    hold();
    document.addEventListener('visibilitychange', hold);
    return () => {live = false; document.removeEventListener('visibilitychange', hold); lock?.release().catch(() => {});};
  }, []);
  useEffect(() => {
    const rail=exerciseRail.current, selected=rail?.querySelector('[aria-current="step"]');
    if(rail && selected)rail.scrollTo({left:selected.offsetLeft - rail.offsetLeft - (rail.clientWidth-selected.clientWidth)/2,behavior:'instant'});
  }, [draft?.index]);
  const exerciseName = draft?.exercises[draft.index]?.name;
  const prior = useMemo(() => historyFor(data, client.id, exerciseName), [data.sessions, client.id, exerciseName]);
  useEffect(() => {const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer);}, []);
  if (!draft) return null;
  const ex = draft.exercises[draft.index];
  if (!ex) return null;
  const prescribed = client.program?.days.flatMap(day => day.exercises).find(item => item.id === ex.id && item.name === ex.name);
  const mediaExercise = prescribed ? {...ex, imageFile: prescribed.imageFile, videoFile: prescribed.videoFile} : ex;
  const logged = draft.sets.filter(s => s.exerciseId === ex.id), slots = slotsFor(ex);
  const next = slots.find(n => !logged.some(s => s.set === n)), complete = next === undefined;
  const editing = logged.find(s => s.id === editId), last = logged.filter(s => !s.skipped).at(-1);
  const previous = prior[(editing?.set ?? next ?? 1) - 1];
  const initial = editing || readWorkoutInput(draft.id, ex.id, next) || draft.inputs?.[ex.id] || {
    weight: last?.weight ?? ex.weight ?? previous?.weight ?? 0,
    reps: last?.reps ?? ex.reps ?? previous?.reps ?? 10,
    effort: last?.effort || 'Good',
  };
  const remaining = draft.exercises.filter(e => slotsFor(e).some(n => !draft.sets.some(s => s.exerciseId === e.id && s.set === n)));
  const nextExercise = remaining.find(e => draft.exercises.indexOf(e) > draft.index) || remaining[0];
  const totalSets = sum(draft.exercises, 'sets'), handled = draft.sets.length;
  const completedSets = draft.sets.filter(set => !set.skipped).length;
  const pips = slots.map(n => {const s = logged.find(x => x.set === n); return s ? (s.skipped ? 'skipped' : 'done') : n === next ? 'current' : 'planned';});
  const resting = draft.restUntil > 0 || draft.restRemainingMs > 0;
  async function restDone() {
    lastSaved.current = null;
    const result = await patch(s => changeRest(s, 'skip'));
    if (result?.error) {setError(result.error); return;}
    if (!complete) {setReady(true); exerciseBody.current?.scrollIntoView({block: 'nearest', behavior: motionReduced() ? 'instant' : 'smooth'});}
  }
  function patch(fn) {return update(d => {if (d.drafts[client.id]) {d.drafts[client.id].note=noteDraft.value.note;fn(d.drafts[client.id]);}});}
  function keepInputs(values) {
    pendingInputs.current[ex.id] = values;
    setInputWarning(!writeWorkoutInput(draft.id, ex.id, next, values));
  }
  async function pause() {
    const inputs = {...pendingInputs.current};
    const result = await patch(s => {s.inputs = {...s.inputs, ...inputs};});
    if (result?.error) {setError(result.error); return false;}
    if((await onClose()) === false){setError(t('Your workout could not be paused. Keep it open and try again.'));return false;}
    return true;
  }
  async function log(values, skipped = false) {
    if (operationLock.current || complete || (lastSaved.current && performance.now() - lastSaved.current.at < 400)) return;
    operationLock.current = true;
    const recordId = uid();
    setSavingSet(true); setError(''); lastSaved.current = {id: recordId, at: performance.now()};
    setAnnouncement(`Saving set ${next}…`);
    try {
      const result = await patch(s => {
        if (s.sets.some(x => x.exerciseId === ex.id && x.set === next)) return;
        s.sets.push({id: recordId, name: ex.name, exerciseId: ex.id, set: next, ...values, kind: ex.kind, skipped});
        s.sets.sort((a, b) => s.exercises.findIndex(e => e.id === a.exerciseId) - s.exercises.findIndex(e => e.id === b.exerciseId) || a.set - b.set);
        s.restTotalMs = Number(ex.rest || 0) * 1000;
        delete s.restRemainingMs;
        s.restUntil = skipped || !s.restTotalMs ? 0 : Date.now() + s.restTotalMs;
        if (s.inputs) delete s.inputs[ex.id];
      });
      if (result?.error) throw new Error(result.error);
      delete pendingInputs.current[ex.id]; clearWorkoutInput(draft.id, ex.id);
      setNow(Date.now()); lastSaved.current = {id: recordId, at: performance.now()};
      setAnnouncement(`Set ${next} ${skipped ? 'skipped' : 'saved'}.`);
      if (!skipped) setSaved({id: recordId, number: next});
      navigator.vibrate?.(15);
    } catch (e) {setError(e.message); lastSaved.current = null;}
    finally {operationLock.current = false; setSavingSet(false);}
  }
  async function saveEdit(values) {
    if (operationLock.current) return;
    operationLock.current = true; setSavingSet(true); setError('');
    try {
      const result = await patch(s => {const record = s.sets.find(x => x.id === editing.id); if (record) Object.assign(record, values, {skipped: false});});
      if (result?.error) throw new Error(result.error);
      setEditId(null); setAnnouncement(`Set ${editing.set} updated.`);
    } catch (e) {setError(e.message);}
    finally {operationLock.current = false; setSavingSet(false);}
  }
  async function chooseExercise(index) {
    const inputs = {...pendingInputs.current};
    const result = await patch(s => {s.inputs = {...s.inputs, ...inputs}; s.index = index;});
    if (result?.error) {setError(result.error); return;}
    setEditId(null); setSwap(false); setExerciseList(false); setSaved(null); setError('');
    return true;
  }
  return <Modal title={draft.title} canClose={!savingSet && !finishing} onClose={pause} className="workout-modal focused-workout">
    <div className="logger-session-progress" aria-label={t('Session progress: {handled} of {totalSets} sets completed or skipped', { handled, totalSets })}><span><i style={{transform: `scaleX(${Math.min(1, handled / (totalSets || 1))})`}}/></span><small>{completedSets} {completedSets === 1 ? 'set' : 'sets'} {t('logged ·')} {Math.max(0, Math.floor((now - draft.startedAt) / 60000))} {t('min')}</small></div>
    <nav className="logger-exercise-rail" aria-label={t('Workout exercises')} ref={exerciseRail}>{draft.exercises.map((exercise,index)=>{
      const sets=draft.sets.filter(set=>set.exerciseId===exercise.id), done=slotsFor(exercise).every(number=>sets.some(set=>set.set===number)), fullyLogged=done && !sets.some(set=>set.skipped);
      return <button key={exercise.id} disabled={savingSet || finishing} aria-label={t('Exercise {value}: {name}', { value: index+1, name: exercise.name })} aria-current={index===draft.index?'step':undefined} title={t('{name} · {length}/{sets} logged', { name: exercise.name, length: sets.filter(set=>!set.skipped).length, sets: exercise.sets })} className={fullyLogged?'is-logged':done?'is-handled':''} onClick={()=>chooseExercise(index)}><span>{fullyLogged?<Check size={13}/>:String(index+1).padStart(2,'0')}</span><i aria-hidden="true" style={{transform:`scaleX(${Math.min(1,sets.length/exercise.sets)})`}}/></button>;
    })}</nav>
    <div ref={exerciseHeading} className="logger-workout-heading"><span>{t('EXERCISE {value} / {value2}', { value: String(draft.index + 1).padStart(2, '0'), value2: String(draft.exercises.length).padStart(2, '0') })}</span><h2>{t(ex.name)}</h2></div>
    <div className="logger-target-line" aria-label={t('Exercise prescription')}><span>{ex.sets} × {ex.reps} {ex.kind === 'Duration' ? 'sec' : 'reps'}</span><span><Clock size={13}/>{ex.rest || 0}{t('s rest')}</span>{ex.rir != null && <span>{t('{rir} reps in reserve', { rir: ex.rir })}</span>}</div>
    {ex.notes && <p className="logger-quick-cue">{ex.notes}</p>}
    <details className="logger-demo" key={ex.id}><summary>{t('View demonstration')} <span>{mediaExercise.videoFile ? t('Coach video') : t('Exercise reference')}</span></summary><ExerciseMedia exercise={mediaExercise} live className="logger-background"/></details>
    <div ref={exerciseBody} className="logger-working-area">
      {(!complete || editing) && <SetEditor busy={savingSet || finishing} key={`${ex.id}-${ex.name}-${editing?.id || next}`} initial={initial} justLogged={Boolean(saved) && !editing} pips={pips} ready={ready && !editing} duration={ex.kind === 'Duration'} number={editing?.set || next} total={ex.sets} previous={previous} editing={Boolean(editing)} cancel={() => setEditId(null)} onChange={editing ? undefined : keepInputs} onSubmit={editing ? saveEdit : log}/>}
      {complete && !editing && <div className="logger-complete"><svg className="logger-complete-mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" pathLength="1"/><path pathLength="1" d="M21 33.5l7.5 7.5L44 25"/></svg><span>{t('Exercise complete')}</span><p>{logged.filter(s => !s.skipped).length} {t('of')} {ex.sets} {t('sets logged')}{logged.some(s => s.skipped) ? t(' · {length} skipped', { length: logged.filter(s => s.skipped).length }) : ''}.</p>{nextExercise && <div className="logger-up-next"><small>{t('UP NEXT')}</small><b>{t(nextExercise.name)}</b><span>{nextExercise.sets} × {nextExercise.reps} {nextExercise.kind === 'Duration' ? 'sec' : 'reps'}</span></div>}<Button onClick={() => nextExercise ? chooseExercise(draft.exercises.indexOf(nextExercise)) : setConfirm(true)}>{nextExercise ? t('Next exercise') : t('Review & finish')}<ArrowRight size={18}/></Button></div>}
      <div className="logger-feedback" role="status">{savingSet ? t('Saving set…') : saved ? <><Check size={14}/>{t('Set')} {saved.number} {t('saved')}{!complete ? t(' · Set {next} is ready', { next }) : ''}</> : null}</div>
      <span className="sr-only" role="status">{announcement}</span>
      {error && <p className="error" role="alert">{error}</p>}
      {inputWarning && <p className="error" role="alert">{t('These unlogged values couldn’t be saved on this device. Keep this screen open and log the set before leaving.')}</p>}
    </div>
    <div className="logger-set-list" aria-label={t('Set history')}>
      <div className="logger-set-labels"><span>{t('Set')}</span><span>{t('Weight ·')} {ex.kind === 'Duration' ? 'seconds' : 'reps'}</span><span>{t('Status')}</span></div>
      {slots.map(n => {const s = logged.find(x => x.set === n); return <div key={n} className={`logger-set-row ${s ? 'done' : n === next ? 'current' : ''} ${s?.id === saved?.id ? 'just-saved' : ''}`}><span className="set-number">{n}</span>{s ? <button className="set-result" aria-label={t('Edit set {n}', { n })} disabled={savingSet} onClick={() => {setEditId(s.id); exerciseBody.current?.scrollIntoView({block: 'nearest', behavior: 'instant'});}}><span>{s.skipped ? t('Skipped') : t('{weight} kg × {reps}{value}', { weight: s.weight, reps: s.reps, value: ex.kind === 'Duration' ? ' sec' : '' })}</span><small>{s.skipped ? t('Change') : t('Edit')}</small><span className="sr-only">{s.skipped ? '' : `${s.weight} × ${s.reps}`}</span></button> : <span className="set-pending">{ex.weight || 0} {t('kg ×')} {ex.reps}{ex.kind === 'Duration' ? ' sec' : ''}</span>}{s ? <button className="set-undo" aria-label={t('Undo set {n}', { n })} disabled={savingSet} onClick={async event => {
        if (event.detail > 1 || (lastSaved.current?.id === s.id && performance.now() - lastSaved.current.at < 400)) return;
        const result = await patch(d => {d.sets = d.sets.filter(x => x.id !== s.id); changeRest(d, 'skip');});
        if (result?.error) {setError(result.error); return;}
        clearWorkoutInput(draft.id, ex.id); delete pendingInputs.current[ex.id]; setEditId(null); setSaved(null); setAnnouncement(`Set ${n} removed. Log it again when ready.`);
      }}><Undo2 size={17}/></button> : <span className="set-status" aria-label={t('Set {n} {value}', { n, value: n === next ? t('Current') : t('Planned') })}>{n === next ? t('Now') : t('Planned')}</span>}</div>;})}
    </div>
    <details className="logger-options"><summary>{t('Exercise details & options')}</summary><FormLab client={client} exercise={ex} sessionId={draft.id} setNumber={next || logged.length} compact/><p className="exercise-coach-cue"><span>{t('COACH’S CUE')}</span>{ex.notes || t('Follow the plan set by your coach.')}</p><p className="muted">{ex.rir != null ? t('{rir} reps in reserve', { rir: ex.rir }) : t('Effort target not set')}{ex.tempo ? t(' · {tempo} tempo', { tempo: ex.tempo }) : ''}</p><div className="button-row"><button className="text-link" onClick={() => setSwap(!swap)}>{t('Swap exercise')}</button><button className="text-link" disabled={complete || savingSet} onClick={() => log({weight: 0, reps: 0, effort: 'Good'}, true)}>{t('Skip set')}</button><button className="text-link" onClick={async () => {if (await pause()) ask(`${ex.name} · ${draft.title}`);}}><MessageCircle size={15}/>{t('Ask coach')}</button></div>
      {swap && <div className="card list">{libraryWithCatalogue(data.library).filter(e => e.name !== ex.name && (data.library.includes(e) || (regionOf(e.group) && regionOf(e.group) === regionOf(ex.group)))).map(e => <button key={e.id} className="simple-row" onClick={async () => {
        const result = await patch(s => {const old = s.exercises[s.index]; s.exercises[s.index] = {...planExercise(e), id: old.id, sets: Math.max(e.sets, ...s.sets.filter(set => set.exerciseId === old.id).map(set => set.set))}; if (s.inputs) delete s.inputs[old.id];});
        if (result?.error) {setError(result.error); return;}
        clearWorkoutInput(draft.id, ex.id); delete pendingInputs.current[ex.id]; setEditId(null); setSwap(false);
      }}>{t(e.name)}<ArrowRight size={15}/></button>)}</div>}
      <Field label={t('Session note')}><textarea maxLength={2000} value={noteDraft.value.note} disabled={savingSet || finishing} placeholder={t('Anything your coach should know?')} onChange={e => noteDraft.setValue({note:e.target.value})}/></Field>
      {noteDraft.error && <p className="error" role="alert">{noteDraft.error}</p>}
    </details>
    <button className="logger-finish" disabled={savingSet || finishing} onClick={() => setConfirm(true)}>{t('Finish session early')}</button>
    <div className="logger-dock-stack">
      {resting ? <RestTimer key={draft.sets.length} draft={draft} nextAction={complete ? 'Continue' : 'Next set'} nextLabel={complete ? nextExercise ? `Up next: ${nextExercise.name}` : 'All working sets done' : `Set ${next} of ${ex.sets} is next`} onNext={restDone} onAction={action => {if (action === 'skip') lastSaved.current = null; patch(s => changeRest(s, action));}}/> :
      <div className="logger-exercise-dock"><button className="logger-open-exercises" disabled={savingSet || finishing} onClick={() => setExerciseList(true)}><List size={19}/><span><b>{t('Your workout')}</b><small>{t('Exercise')} {draft.index + 1} {t('of')} {draft.exercises.length}</small></span><ChevronRight size={18}/></button><button className="logger-pause" disabled={savingSet || finishing} onClick={pause}>{t('Pause & close')}</button></div>}
    </div>
    {exerciseList && <Modal title={t('Your workout')} onClose={() => setExerciseList(false)}><p className="muted">{t('Choose an exercise. Your logged sets stay saved.')}</p><div className="logger-exercise-picker">{draft.exercises.map((e, index) => {
      const rows = draft.sets.filter(s => s.exerciseId === e.id), done = slotsFor(e).every(n => rows.some(s => s.set === n));
      return <button key={e.id} aria-label={t('Go to {name}', { name: e.name })} aria-current={index === draft.index ? 'step' : undefined} onClick={() => chooseExercise(index)}><span>{done ? <Check size={18}/> : String(index + 1).padStart(2, '0')}</span><span><b>{t(e.name)}</b><small>{rows.filter(s => !s.skipped).length} {t('of')} {e.sets} {t('sets logged')}{rows.some(s => s.skipped) ? t(' · {length} skipped', { length: rows.filter(s => s.skipped).length }) : ''}{index === draft.index ? t(' · Current') : ''}</small></span><ChevronRight size={17}/></button>;
    })}</div></Modal>}
    {confirm && <Modal title={t('Ready to finish?')} className="workout-review-modal" canClose={!finishing} onClose={() => setConfirm(false)}><span className="eyebrow">{t('YOUR SESSION')}</span><h3 className="workout-review-title">{t(draft.title)}</h3><div className="workout-review-totals"><span><b>{completedSets}</b>{t('completed sets')}</span><span><b>{sum(draft.sets, s => s.skipped || s.kind === 'Duration' ? 0 : s.weight * s.reps).toLocaleString()}<small> kg</small></b>{t('volume lifted')}</span></div><div className="workout-review-list" aria-label={t('Exercise summary')}>{draft.exercises.map(exercise=>{const sets=draft.sets.filter(set=>set.exerciseId===exercise.id), logged=sets.filter(set=>!set.skipped), skipped=sets.filter(set=>set.skipped).length;return <div key={exercise.id}><span className={logged.length===exercise.sets?'review-exercise-check is-complete':'review-exercise-check'}>{logged.length===exercise.sets?<Check size={16}/>:<span/>}</span><span><b>{t(exercise.name)}</b><small>{logged.length} {t('of')} {exercise.sets} {t('sets logged')}{skipped>0?t(' · {skipped} skipped', { skipped }):''}</small></span><button className="text-link" disabled={finishing} aria-label={t('Return to {name}', { name: exercise.name })} onClick={async()=>{if(await chooseExercise(draft.exercises.indexOf(exercise)))setConfirm(false);}}>{t('Review')}<ChevronRight size={14}/></button></div>;})}</div>{remaining.length > 0 && <p className="logger-finish-warning">{remaining.length} {remaining.length === 1 ? t('exercise still has') : t('exercises still have')} {t('unlogged sets. Finish now, or keep going to complete your plan.')}</p>}<div className="button-row workout-review-actions"><Button disabled={finishing || !draft.sets.some(s => !s.skipped)} onClick={async () => {
      if (finishing || finishLock.current || operationLock.current) return; finishLock.current=true; setFinishing(true);
      const result = await update(d => {d.drafts[client.id].note=noteDraft.value.note;finishSession(d, d.drafts[client.id]);});
      if (result?.error) {setError(result.error); finishLock.current=false; setFinishing(false); return;}
      clearWorkoutInput(draft.id); noteDraft.clear({note:''}); onFinish(draft.id);
    }}>{finishing ? t('Saving workout…') : t('Finish & see results')}</Button><Button secondary disabled={finishing} onClick={() => setConfirm(false)}>{t('Keep going')}</Button>{!draft.sets.some(s => !s.skipped) && <Button secondary disabled={finishing} onClick={async () => {const result = await update(d => {delete d.drafts[client.id];}); if (result?.error) {setError(result.error); return;} clearWorkoutInput(draft.id); noteDraft.clear({note:''}); onClose();}}>{t('Discard empty workout')}</Button>}</div>{error && <p className="error" role="alert">{error}</p>}</Modal>}
  </Modal>;
}
