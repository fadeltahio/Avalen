import React from 'react';
import { useAnimatedNumber, MotionNumber } from './motion.jsx';
import { ArrowRight, Camera, ChevronRight, Plus, Utensils } from 'lucide-react';
import { useApp } from './context.js';
import { dayKey, sum } from './store.js';

export function MacroRing({value, target, label, unit, color}) {
  const shown = useAnimatedNumber(value, `macro:${label}`);
  const ratio = target > 0 ? Math.min(1,Math.max(0,shown / target)) : 0;
  return <div className="home-macro" aria-label={`${label}: ${value} of ${target} ${unit}`} style={{'--ring-color':color}}><div className="home-macro-ring" aria-hidden="true"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" className="macro-track"/><circle cx="40" cy="40" r="34" strokeDasharray={`${ratio*213.63} 213.63`} transform="rotate(-90 40 40)"/></svg><span><b>{Math.round(shown).toLocaleString()}</b><small>{unit}</small></span></div><b>{label}</b><small>of {target > 0 ? target.toLocaleString() : '—'} {unit}</small></div>;
}

export function CoachNutritionHome({onPhoto, onAdd, onPlanMeal}) {
  const {data,client,navigate} = useApp();
  const foods=data.foodLogs.filter(f=>f.clientId===client.id && f.date===dayKey());
  const kcal=sum(foods,'kcal');
  const remaining=client.nutrition.kcal-kcal;
  const target=client.nutrition;
  const meal = new Date().getHours() < 11 ? 'Breakfast' : new Date().getHours() < 16 ? 'Lunch' : 'Dinner';
  const nextMeal=(target.meals||[]).find(m=>m.name===meal && !foods.some(f=>f.meal===m.name)) || (target.meals||[]).find(m=>!foods.some(f=>f.meal===m.name));
  return <section className="home-nutrition" aria-label="Today’s nutrition">
    <div className="home-section-label"><span>NUTRITION</span><button onClick={()=>navigate('nutrition')}>Your diary <ArrowRight size={15}/></button></div>
    <div className="nutrition-home-title"><div><h2>Fuel your progress.</h2><p>Your coach’s daily targets</p></div><span className="nutrition-target-badge">{target.mode === 'Structured' ? 'Meal plan' : 'Macro plan'}</span></div>
    <div className="home-macro-rings" aria-label="Daily nutrition progress">{[[kcal,target.kcal,'Calories','kcal','var(--macro-calories)'],[sum(foods,'p'),target.p,'Protein','g','var(--macro-protein)'],[sum(foods,'c'),target.c,'Carbs','g','var(--macro-carbs)'],[sum(foods,'f'),target.f,'Fat','g','var(--macro-fat)']].map(([value,target,label,unit,color])=><MacroRing key={label} {...{value,target,label,unit,color}}/>)}</div>
    {foods.some(f=>f.missingMacros?.length) && <p className="home-missing-macros">Some logged meals still need macro values.</p>}
    <div className="nutrition-home-remaining"><span><b><MotionNumber value={Math.abs(remaining)} identity="calories-remaining"/></b> kcal {remaining >= 0 ? 'remaining' : 'above target'}</span><span>{foods.length} {foods.length===1?'entry':'entries'} today</span></div>
    <div className="nutrition-home-actions"><button onClick={onPhoto}><Camera size={18}/>Photo meal</button><button onClick={onAdd}><Plus size={18}/>Log food</button></div>
    <div className="home-planned-meal"><button className="coach-plan-link" aria-label="Open coach meal plan" onClick={()=>navigate('nutrition', 'Coach plan')}><span className="coach-plan-symbol"><Utensils size={18}/></span><span><small className="plan-preview-label">{target.mode==='Structured'?'YOUR COACH’S MEAL PLAN':'YOUR COACH’S MEAL IDEA'}</small><b>{nextMeal?.description || 'Your nutrition plan'}</b><small>{nextMeal ? `${nextMeal.name} · ${nextMeal.kcal} kcal` : `Set by ${data.coach.name}`}</small></span><ChevronRight size={18}/></button>{nextMeal && onPlanMeal && <button className="home-log-planned" aria-label={`Quick log planned ${nextMeal.name}`} onClick={() => onPlanMeal(nextMeal)}><Plus size={16}/>Log this meal</button>}</div>
  </section>;
}

export function CoachMealPlan({onLog}) {
  const {data,client}=useApp();
  const meals=client.nutrition.meals || [];
  return <section className="coach-meal-plan" aria-label="Coach nutrition plan"><div className="home-section-label"><span>FROM YOUR COACH</span><span>{client.nutrition.mode==='Structured'?'Prescribed meals':'Suggested meals'}</span></div><h2>Your plan, on a plate.</h2><p>{client.nutrition.mode==='Structured' ? 'Follow the meals set by your coach. Adjust the logged portion to what you ate.' : 'Your daily macro targets come first. These meal ideas are from your coach.'}</p>{meals.length ? meals.map((m,i)=><div className="planned-meal" key={`${m.name}-${i}`}><span className="planned-meal-number">{String(i+1).padStart(2,'0')}</span><div><span>{m.name}</span><h3>{m.description || m.name}</h3><p>{Number(m.kcal || 0).toLocaleString()} kcal{m.p != null && ` · ${m.p}g protein`}</p></div><button aria-label={`Log planned ${m.name}`} onClick={()=>onLog(m)}><Plus size={20}/></button></div>) : <div className="meal-plan-empty"><Utensils size={23}/><p>Your coach has set your daily targets. Meal suggestions will appear here when added.</p></div>}<div className="coach-plan-attribution"><span className="plan-coach-initials">{data.coach.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span>{data.coach.name}<small>Your coach · personalised nutrition</small></span></div></section>;
}
