// The coach's nutrition prescription for one client: targets, planned meals built
// from foods with amounts, and how the day's meals compare with those targets.
import { useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { MotionDetails } from '../motion.jsx';
import { useApp } from '../context.js';
import { useEditDraft, EditSaveBar } from '../edit-draft.jsx';
import { nutritionDay, targetValues } from '../nutrition-model.js';
import { dayKey, decision } from '../store.js';
import { Button, Field, Notice, SectionHead } from '../ui.jsx';
import { t } from '../i18n.js';
import { MealFoodsEditor } from '../MealFoods.jsx';
import { dayTotals, itemsTotals } from '../portions.js';

// The day as planned, from every meal, beside the targets the coach set above.
function DayTotals({ meals, targets, structured }) {
  const rows = dayTotals(meals, targets);
  const off = rows.some((row) => row.status === 'short' || row.status === 'over');
  return <div className="plan-day-totals" role="group" aria-label={t('Day total from meals')}>
    <div className="plan-day-totals-head"><span className="eyebrow">{t('Day total from meals')}</span><small>{t('Compared with your targets')}</small></div>
    {rows.map((row) => <div key={row.key} className={`plan-day-row is-${row.status}`}>
      <span>{t(row.label)}</span>
      <b>{t('{value} of {target} {unit}', { value: row.value.toLocaleString(), target: row.target.toLocaleString(), unit: t(row.unit) })}</b>
      <small>{row.status === 'on' ? t('On target') : row.status === 'short' ? t('{amount} {unit} short', { amount: Math.abs(row.diff).toLocaleString(), unit: t(row.unit) }) : row.status === 'over' ? t('{amount} {unit} over', { amount: Math.abs(row.diff).toLocaleString(), unit: t(row.unit) }) : t('No target')}</small>
      <i aria-hidden="true"><em style={{ inlineSize: `${row.target ? Math.min(100, (row.value / row.target) * 100) : 0}%` }}/></i>
      {row.missing > 0 && row.key !== 'kcal' && <small className="plan-day-missing">{t('Not entered for {count} meals', { count: row.missing })}</small>}
    </div>)}
    {structured && off && <p className="fine-print muted">{t('Review any difference before publishing.')}</p>}
  </div>;
}


export function NutritionEditor({ client }) {
  const { update } = useApp();
  const draft = useEditDraft(`nutrition.${client.id}`, { plan: client.nutrition, reason: '' });
  const form = draft.value.plan, reason = draft.value.reason;
  const setForm = plan => draft.setValue(v => ({ ...v, plan }));
  const setReason = reason => draft.setValue(v => ({ ...v, reason }));
  const [saved, setSaved] = useState(false),[saveError,setSaveError]=useState(''),[saving,setSaving]=useState(false);
  return (
    <section className="card">
      <SectionHead title={t('Nutrition prescription')} />
      <form
        onChangeCapture={() => setSaved(false)}
        onSubmit={async(e) => {
          e.preventDefault();
          if(saving)return;setSaving(true);setSaveError('');const result=await update((d) => {
            const c = d.clients.find((c) => c.id === client.id),
              old = c.nutrition.kcal;
            c.nutrition = structuredClone(form);
            const day = nutritionDay(d,client.id,dayKey());
            if (day) { day.target = targetValues(form); day.complete = false; }
            decision(
              d,
              client.id,
              "Nutrition adjusted",
              `${old} → ${form.kcal} kcal. ${reason}`,
            );
          });
          setSaving(false);if(result?.error){setSaveError(result.error);return;}
          draft.clear({ plan: structuredClone(form), reason: '' });
          setSaved(true);
        }}
      >
        <Field label={t('Approach')}>
          <select
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value })}
          >
            <option value="Flexible">{t('Flexible')}</option>
            <option value="Structured">{t('Structured')}</option>
          </select>
        </Field>
        <div className="form-grid">
          {[
            ["kcal", "Calories"],
            ["p", "Protein (g)"],
            ["c", "Carbs (g)"],
            ["f", "Fat (g)"],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              type="number"
              required
              min="1"
              max={key === "kcal" ? 10000 : 1000}
              value={form[key]}
              onChange={(e) => {
                setForm({ ...form, [key]: Number(e.target.value) });
                setSaved(false);
              }}
            />
          ))}
        </div>
        <div className="nutrition-meal-editor"><SectionHead title={form.mode === 'Structured' ? t('Your prescribed meals') : t('Suggested meals')}/>
          <DayTotals meals={form.meals || []} targets={form} structured={form.mode === "Structured"} />
          {(form.meals || []).map((m,i)=><MotionDetails className="card coach-meal-editor" key={i} open={i===0 || !m.description || undefined}><summary><span><b>{m.name || t('New meal')}</b><small>{m.description || (m.items?.length ? m.items.map(x => t(x.name)).join(', ') : t('Add meal guidance'))}</small></span><span>{Number(m.kcal || 0).toLocaleString()} kcal<ChevronRight size={16}/></span></summary><div className="coach-meal-fields">
            <Field label={t('Meal name')} required maxLength={70} value={m.name} onChange={e=>setForm({...form,meals:form.meals.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/>
            <Field label={t('Meal guidance')} maxLength={500} value={m.description} onChange={e=>setForm({...form,meals:form.meals.map((x,j)=>j===i?{...x,description:e.target.value}:x)})}/>
            <MealFoodsEditor items={m.items || []} onChange={items=>setForm({...form,meals:form.meals.map((x,j)=>j===i?{...x,items,...(items.length?itemsTotals(items):{})}:x)})}/>
            <div className="form-grid">{[['kcal','Meal calories'],['p','Meal protein (g)'],['c','Meal carbs (g)'],['f','Meal fat (g)']].map(([key,label])=><Field key={key} label={label} type="number" min="0" step={key==='kcal'?'1':'0.1'} max={key==='kcal'?10000:1000} required={key==='kcal'} value={m[key]??''} onChange={e=>setForm({...form,meals:form.meals.map((x,j)=>j===i?{...x,[key]:e.target.value===''?null:Number(e.target.value)}:x)})}/>)}</div>
            <button type="button" className="text-link red" onClick={()=>setForm({...form,meals:form.meals.filter((_,j)=>i!==j)})}><Trash2 size={14}/>{t('Remove meal')}</button>
          </div></MotionDetails>)}
          <Button secondary onClick={()=>setForm({...form,meals:[...(form.meals||[]),{name:'Snack',description:'',kcal:0,p:null,c:null,f:null}]})}><Plus size={15}/>{t('Add planned meal')}</Button>
        </div>
        <Field label={t('Why are you making this change?')}>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
{saveError&&<p role="alert" className="error">{saveError}</p>}<EditSaveBar draft={draft} disabled={saving} label={t('Save nutrition plan')} saved={saved}/>
        {saved && (
          <Notice>{t('Updated. The client’s targets now reflect this plan.')}</Notice>
        )}
      </form>
    </section>
  );
}

