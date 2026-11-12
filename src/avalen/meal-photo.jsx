import { MotionNumber, MotionDetails } from './motion.jsx';
import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, ScanLine } from 'lucide-react';
import { useApp } from './context.js';
import { saveFile, uid, dayKey, sum } from './store.js';
import { recordFood, nutritionDay } from './nutrition-model.js';
import { FOODS } from './seed.js';
import { Button, Field, Media, Modal } from './ui.jsx';

const mealNow = () => new Date().getHours() < 11 ? 'Breakfast' : new Date().getHours() < 16 ? 'Lunch' : 'Dinner';
const nutrients = [['kcal', 'Calories', 'kcal'], ['p', 'Protein', 'g'], ['c', 'Carbs', 'g'], ['f', 'Fat', 'g']];

export function PhotoMealLogger({ date = dayKey(), onClose, onBack, initialMeal = null, initialFood = null, initialEntry = null, requirePhoto = true }) {
  const { client, update, data, notify } = useApp();
  const preset = initialEntry || initialMeal || initialFood;
  const [photo, setPhoto] = useState(initialEntry?.photo || null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [step, setStep] = useState(preset ? 'review' : 'photo');
  const [food, setFood] = useState(preset ? {
    ...preset, name: initialMeal ? preset.description || preset.name : preset.name,
    meal: initialEntry?.meal || (initialMeal ? preset.name : mealNow()), portion: preset.portion || '1 serving',
    ...Object.fromEntries(nutrients.map(([k]) => [k, preset[k] ?? ''])),
  } : { name: '', meal: mealNow(), portion: '1 serving', kcal: '', p: '', c: '', f: '' });
  const [source, setSource] = useState(initialEntry?.source || (initialMeal ? 'coach-plan' : initialFood?.id ? 'recent-entry' : initialFood ? 'food-library' : 'manual'));
  const [base, setBase] = useState(preset), [portion, setPortion] = useState(1);
  const lock = useRef(false), saving = useRef(false), picker = useRef(null), library = useRef(null);
  const target = nutritionDay(data, client.id, date)?.target || client.nutrition;
  const loggedCalories = sum(data.foodLogs.filter(f => f.clientId === client.id && f.date === date && f.id !== initialEntry?.id), 'kcal');
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { setPhoto(await saveFile(file)); } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); event.target.value = ''; }
  }
  function choose(value) {
    if (!value) { setBase(null); setSource('manual'); setFood(f => ({ ...f, name: '', kcal: '', p: '', c: '', f: '' })); return; }
    const [kind, n] = value.split(':');
    const m = kind === 'plan' ? client.nutrition.meals[Number(n)] : FOODS[Number(n)];
    setBase(m); setPortion(1); setSource(kind === 'plan' ? 'coach-plan' : 'food-library');
    setFood({ ...m, name: kind === 'plan' ? m.description || m.name : m.name, meal: kind === 'plan' ? m.name : mealNow(), portion: m.portion || '1 serving', ...Object.fromEntries(nutrients.map(([k]) => [k, m[k] ?? ''])) });
  }
  function resize(value) {
    setPortion(value);
    if (base) setFood(f => ({ ...f, portion: `${value} × ${base.portion || 'planned serving'}`, ...Object.fromEntries(nutrients.map(([k]) => [k, base[k] == null || base[k] === '' ? '' : Math.round(Number(base[k]) * value * (k === 'kcal' ? 1 : 10)) / (k === 'kcal' ? 1 : 10)])) }));
  }
  function changeNutrient(key, value) {
    setFood(f => ({ ...f, [key]: value }));
    if (base) setBase(b => ({ ...b, [key]: value === '' ? null : Number(value) / portion }));
  }
  const remaining = target.kcal - loggedCalories - Number(food.kcal || 0);
  const valid = food.name.trim() && Number(food.kcal) > 0 && nutrients.every(([k]) => food[k] === '' || Number.isFinite(Number(food[k])) && Number(food[k]) >= 0 && Number(food[k]) <= 10000);
  async function log(e) {
    e.preventDefault();
    if (!valid || lock.current || saving.current) return;
    saving.current = true;
    setBusy(true);
    const previous = initialEntry;
    const entry = { ...food, name: food.name.trim(), id: previous?.id || uid(), clientId: client.id, date, photo,
      source: previous ? source : photo ? `photo-${source}` : source,
      ...Object.fromEntries(nutrients.map(([k]) => [k, food[k] === '' ? null : Number(food[k])])),
      missingMacros: ['p', 'c', 'f'].filter(k => food[k] === ''), estimate: previous ? previous.estimate : source === 'recent-entry' ? Boolean(initialFood?.estimate) : source !== 'manual', confirmed: true };
    const result = await update(d => recordFood(d, client, entry));
    saving.current = false;
    setBusy(false);
    if (result?.error) { setError(result.error); return; }
    notify?.(previous ? 'Meal updated' : `${entry.name} logged`, () => update(d => {
      if (previous) recordFood(d, client, previous);
      else d.foodLogs = d.foodLogs.filter(f => f.id !== entry.id);
    }));
    onClose();
  }
  return <Modal title={initialEntry ? 'Edit meal' : step === 'photo' ? 'Add meal photo' : 'Review your meal'} className="photo-meal-modal" canClose={!busy} onClose={() => { if (!lock.current && !saving.current) onClose(); }}>
    {onBack && <button type="button" className="flow-back" disabled={busy} onClick={onBack}><ArrowLeft size={16}/>Back to foods</button>}
    {!preset && <div className="photo-flow-steps"><span className={step === 'photo' ? 'active' : 'complete'}>01 Photo</span><i/><span className={step === 'review' ? 'active' : ''}>02 Review & log</span></div>}
    {step === 'photo' ? <>
      <h2>A picture of<br/>your progress.</h2>
      <p className="photo-flow-intro">Keep a photo with your diary. Match your meal to your coach’s plan or enter its nutrition.</p>
      <div className="photo-ai-status"><ScanLine size={19}/><span><b>Photo recognition</b><small>Coming soon. You confirm the calories for now.</small></span></div>
      <div className={`meal-photo-frame ${photo ? 'has-photo' : ''}`}>{photo ? <Media fileId={photo.id} alt="Your meal photo"/> : <><Camera size={38}/><span>Your meal photo</span><small>Include the whole plate</small></>}<span className="scan-corner tl"/><span className="scan-corner tr"/><span className="scan-corner bl"/><span className="scan-corner br"/>{busy && <div className="meal-photo-saving" role="status">Saving your photo…</div>}</div>
      <div className="photo-pick-actions"><Button disabled={busy} onClick={() => picker.current.click()}><Camera size={18}/>{photo ? 'Retake photo' : 'Take a photo'}</Button><Button secondary disabled={busy} onClick={() => library.current.click()}><ImagePlus size={18}/>Upload photo</Button></div>
      <input ref={picker} aria-label="Take a meal photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={upload}/><input ref={library} aria-label="Upload meal photo" type="file" accept="image/*" className="sr-only" onChange={upload}/>
      <Button disabled={busy || (!photo && requirePhoto)} onClick={() => setStep('review')}>Review meal <ArrowRight size={18}/></Button>
    </> : <form onSubmit={log}>
      {photo && <div className="review-photo"><Media fileId={photo.id} alt="Meal to review"/><button type="button" onClick={() => setStep('photo')}><Camera size={15}/>Change photo</button></div>}
      {!preset && <Field label="Match your meal"><select aria-label="Match your meal" defaultValue="" onChange={e => choose(e.target.value)}><option value="">Enter nutrition myself</option><optgroup label="Your coach’s meals">{(client.nutrition.meals || []).map((m, i) => <option value={`plan:${i}`} key={i}>{m.name} · {m.description}</option>)}</optgroup><optgroup label="Food library">{FOODS.map((f, i) => <option value={`library:${i}`} key={i}>{f.name} · {f.portion}</option>)}</optgroup></select></Field>}
      {base && <>
        <div className="quick-meal-summary"><span className="eyebrow">{initialEntry ? 'YOUR DIARY' : source === 'coach-plan' ? 'FROM YOUR COACH' : source === 'recent-entry' ? 'RECENT MEAL' : 'FOOD LIBRARY'}</span><h2>{food.name}</h2><p><MotionNumber value={Number(food.kcal || 0)}/> kcal · {food.p === '' ? 'Protein not entered' : `${food.p}g protein`}</p></div>
        <p className="portion-source">Adjust to what you ate</p>
        <div className="meal-portion-options" role="group" aria-label="Meal portion">{[.5, 1, 1.5, 2].map(n => <button type="button" key={n} aria-pressed={portion === n} onClick={() => resize(n)}>{n}×<small>{n === 1 ? 'Full portion' : 'portion'}</small></button>)}</div>
      </>}
      <Field label="Meal"><select value={food.meal} onChange={e => setFood({ ...food, meal: e.target.value })}>{[...new Set(['Breakfast', 'Lunch', 'Dinner', 'Snack', food.meal])].map(m => <option key={m}>{m}</option>)}</select></Field>
      <MotionDetails className="meal-edit-details" open={!base || undefined} key={base ? 'preset' : 'manual'}><summary>Edit name & nutrition</summary>
        <Field label="Meal name" required maxLength={120} value={food.name} onChange={e => setFood({ ...food, name: e.target.value })}/><Field label="Portion" value={food.portion} maxLength={120} onChange={e => setFood({ ...food, portion: e.target.value })}/>
        <div className="photo-meal-nutrients">{nutrients.map(([k, label, unit]) => <Field key={k} label={`${label} (${unit})`} type="number" min={k === 'kcal' ? 1 : 0} max="10000" step="any" required={k === 'kcal'} placeholder={k === 'kcal' ? 'Enter calories' : 'Not provided'} value={food[k]} onChange={e => changeNutrient(k, e.target.value)}/>)}</div>
        <p className="fine-print muted">Portion notes describe your meal; use the portion buttons or edit the values to change nutrition.</p>
      </MotionDetails>
      {['p', 'c', 'f'].some(k => food[k] === '') && <p className="fine-print muted">Missing macros are not estimated. Add them from the label or ask your coach.</p>}
      <div className="meal-confirm-bar"><div className="meal-goal-impact"><span>After this meal</span><b><MotionNumber value={Math.abs(remaining)}/> <small>kcal {remaining >= 0 ? 'remaining' : 'above target'}</small></b></div><Button type="submit" disabled={!valid || busy}>{busy ? 'Saving meal…' : initialEntry ? 'Save meal' : 'Log meal'} <Check size={18}/></Button></div>
      {photo && !initialEntry && <button type="button" className="text-link" onClick={() => setStep('photo')}><ArrowLeft size={15}/>Back to photo</button>}
    </form>}
    {error && <p className="error" role="alert">{error}</p>}
  </Modal>;
}
