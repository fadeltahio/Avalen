import React from 'react';
import { useAnimatedNumber, MotionNumber } from './motion.jsx';
import { ArrowRight, Camera, ChevronRight, Plus, Utensils } from 'lucide-react';
import { useApp } from './context.js';
import { dayKey, sum } from './store.js';

import { t } from './i18n.js';
import { MealFoodsList } from './MealFoods.jsx';
export function MacroRing({value, target, label, unit, color}) {
  const shown = useAnimatedNumber(value, `macro:${label}`);
  const ratio = target > 0 ? Math.min(1,Math.max(0,shown / target)) : 0;
  return <div className="home-macro" aria-label={t('{label}: {value} of {target} {unit}', { label, value, target, unit })} style={{'--ring-color':color}}><div className="home-macro-ring" aria-hidden="true"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" className="macro-track"/><circle cx="40" cy="40" r="34" strokeDasharray={`${ratio*213.63} 213.63`} transform="rotate(-90 40 40)"/></svg><span><b>{Math.round(shown).toLocaleString()}</b><small>{unit}</small></span></div><b>{label}</b><small>{t('of')} {target > 0 ? target.toLocaleString() : '—'} {unit}</small></div>;
}

export function CoachNutritionHome({onPhoto, onAdd, onPlanMeal}) {
  const {data,client,navigate} = useApp();
  const foods=data.foodLogs.filter(f=>f.clientId===client.id && f.date===dayKey());
  const kcal=sum(foods,'kcal');
  const remaining=client.nutrition.kcal-kcal;
  const target=client.nutrition;
  const meal = new Date().getHours() < 11 ? 'Breakfast' : new Date().getHours() < 16 ? 'Lunch' : 'Dinner';
  const nextMeal=(target.meals||[]).find(m=>m.name===meal && !foods.some(f=>f.meal===m.name)) || (target.meals||[]).find(m=>!foods.some(f=>f.meal===m.name));
  return <section className="home-nutrition" aria-label={t('Today’s nutrition')}>
    <div className="home-section-label"><span>{t('NUTRITION')}</span><button onClick={()=>navigate('nutrition')}>{t('Your diary')} <ArrowRight size={15}/></button></div>
    <div className="nutrition-home-title"><div><h2>{t('Fuel your progress.')}</h2><p>{t('Your coach’s daily targets')}</p></div><span className="nutrition-target-badge">{target.mode === 'Structured' ? t('Meal plan') : t('Macro plan')}</span></div>
    <div className="home-macro-rings" aria-label={t('Daily nutrition progress')}>{[[kcal,target.kcal,'Calories','kcal','var(--macro-calories)'],[sum(foods,'p'),target.p,'Protein','g','var(--macro-protein)'],[sum(foods,'c'),target.c,'Carbs','g','var(--macro-carbs)'],[sum(foods,'f'),target.f,'Fat','g','var(--macro-fat)']].map(([value,target,label,unit,color])=><MacroRing key={label} {...{value,target,label,unit,color}}/>)}</div>
    {foods.some(f=>f.missingMacros?.length) && <p className="home-missing-macros">{t('Some logged meals still need macro values.')}</p>}
    <div className="nutrition-home-remaining"><span><b><MotionNumber value={Math.abs(remaining)} identity="calories-remaining"/></b> kcal {remaining >= 0 ? 'remaining' : t('above target')}</span><span>{foods.length} {foods.length===1?'entry':'entries'} {t('today')}</span></div>
    <div className="nutrition-home-actions"><button onClick={onPhoto}><Camera size={18}/>{t('Photo meal')}</button><button onClick={onAdd}><Plus size={18}/>{t('Log food')}</button></div>
    <div className="home-planned-meal"><button className="coach-plan-link" aria-label={t('Open coach meal plan')} onClick={()=>navigate('nutrition', 'Coach plan')}><span className="coach-plan-symbol"><Utensils size={18}/></span><span><small className="plan-preview-label">{target.mode==='Structured'?t('YOUR COACH’S MEAL PLAN'):t('YOUR COACH’S MEAL IDEA')}</small><b>{nextMeal?.description || t('Your nutrition plan')}</b><small>{nextMeal ? t('{name} · {kcal} kcal', { name: nextMeal.name, kcal: nextMeal.kcal }) : t('Set by {name}', { name: data.coach.name })}</small></span><ChevronRight size={18}/></button>{nextMeal && onPlanMeal && <button className="home-log-planned" aria-label={t('Quick log planned {name}', { name: nextMeal.name })} onClick={() => onPlanMeal(nextMeal)}><Plus size={16}/>{t('Log this meal')}</button>}</div>
  </section>;
}

export function CoachMealPlan({onLog}) {
  const {data,client}=useApp();
  const meals=client.nutrition.meals || [];
  return <section className="coach-meal-plan" aria-label={t('Coach nutrition plan')}><div className="home-section-label"><span>{t('FROM YOUR COACH')}</span><span>{client.nutrition.mode==='Structured'?t('Prescribed meals'):t('Suggested meals')}</span></div><h2>{t('Your plan, on a plate.')}</h2><p>{client.nutrition.mode==='Structured' ? t('Follow the meals set by your coach. Adjust the logged portion to what you ate.') : t('Your daily macro targets come first. These meal ideas are from your coach.')}</p>{meals.length ? meals.map((m,i)=><div className="planned-meal" key={`${m.name}-${i}`}><span className="planned-meal-number">{String(i+1).padStart(2,'0')}</span><div><span>{t(m.name)}</span><h3>{m.description || m.name}</h3><MealFoodsList items={m.items}/><p>{Number(m.kcal || 0).toLocaleString()} kcal{m.p != null && t(' · {p}g protein', { p: m.p })}</p></div><button aria-label={t('Log planned {name}', { name: m.name })} onClick={()=>onLog(m)}><Plus size={20}/></button></div>) : <div className="meal-plan-empty"><Utensils size={23}/><p>{t('Your coach has set your daily targets. Meal suggestions will appear here when added.')}</p></div>}<div className="coach-plan-attribution"><span className="plan-coach-initials">{data.coach.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span>{t(data.coach.name)}<small>{t('Your coach · personalised nutrition')}</small></span></div></section>;
}
