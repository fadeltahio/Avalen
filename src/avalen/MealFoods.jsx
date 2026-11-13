// The foods on a planned meal, each with a clear amount. Coaches add them from the
// food library and set how many portions; clients see exactly what goes on the plate.
import React, { useMemo, useState } from 'react';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { ALL_FOODS, searchFoods } from './food-library.js';
import { amountLabel, mealItem, portionLabel, withServings } from './portions.js';
import { t } from './i18n.js';

export function MealFoodsList({ items = [] }) {
  if (!items.length) return null;
  return <ul className="planned-meal-foods" aria-label={t('Foods in this meal')}>
    {items.map((item, i) => <li key={`${item.name}-${i}`}><span>{t(item.name)}</span><b>{portionLabel(amountLabel(item))}</b></li>)}
  </ul>;
}

export function MealFoodsEditor({ items = [], onChange }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query.trim() ? searchFoods(ALL_FOODS, query).slice(0, 6) : []), [query]);
  const change = (i, servings) => onChange(items.map((item, j) => (j === i ? withServings(item, servings) : item)));
  return <div className="meal-foods-editor">
    <span className="eyebrow">{t('Foods and amounts')}</span>
    {items.length ? <ul>{items.map((item, i) => <li key={`${item.name}-${i}`}>
      <span><b>{t(item.name)}</b><small>{portionLabel(amountLabel(item))} · {t('{kcal} kcal', { kcal: item.kcal })}</small></span>
      <span className="meal-food-stepper">
        <button type="button" aria-label={t('Less {name}', { name: t(item.name) })} disabled={item.servings <= 0.5} onClick={() => change(i, item.servings - 0.5)}><Minus size={15}/></button>
        <output aria-live="polite">{item.servings}×</output>
        <button type="button" aria-label={t('More {name}', { name: t(item.name) })} disabled={item.servings >= 10} onClick={() => change(i, item.servings + 0.5)}><Plus size={15}/></button>
        <button type="button" aria-label={t('Remove {name}', { name: t(item.name) })} onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={15}/></button>
      </span>
    </li>)}</ul> : <p className="fine-print muted">{t('Add foods so your client knows exactly what and how much to eat. The meal totals add up for you.')}</p>}
    <label className="search meal-food-search"><Search size={16}/><input type="search" placeholder={t('Add a food…')} aria-label={t('Add a food to this meal')} value={query} onChange={(e) => setQuery(e.target.value)}/></label>
    {results.length > 0 && <div className="meal-food-results">{results.map((food) => <button type="button" key={food.name} onClick={() => { onChange([...items, mealItem(food, 1)]); setQuery(''); }}>
      <span><b>{t(food.name)}</b><small>{portionLabel(food.portion)} · {t('{kcal} kcal', { kcal: food.kcal })}</small></span><Plus size={15}/>
    </button>)}</div>}
  </div>;
}
