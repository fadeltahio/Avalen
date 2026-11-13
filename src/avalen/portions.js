// Portions: what a coach prescribes and a client eats, in a household unit and a
// weight ("1 egg · 50 g"). Planned meals list foods with an amount; their totals
// are the sum of those foods. Logged diary entries keep their own copied values.
import { language } from './i18n.js';

const round1 = (n) => Math.round(n * 10) / 10;
const WEIGHT = /(\d+(?:\.\d+)?)\s*(g|ml)\b/i;

// The weight in a portion, e.g. "1 cup · 195 g" → { amount: 195, unit: 'g' }.
export function weightOf(portion = '') {
  const match = String(portion).match(WEIGHT);
  return match ? { amount: Number(match[1]), unit: match[2].toLowerCase() } : null;
}

// One food on a planned meal: the library portion, how many of them, and the totals.
export function mealItem(food, servings = 1) {
  const count = Math.max(0.25, Math.round(Number(servings) * 4) / 4 || 1);
  const scaled = (key) => (food[key] == null || food[key] === '' ? null : round1(Number(food[key]) * count));
  return { name: food.name, portion: food.portion || '1 serving', servings: count, per: { kcal: food.kcal, p: food.p, c: food.c, f: food.f }, kcal: Math.round(Number(food.kcal || 0) * count), p: scaled('p'), c: scaled('c'), f: scaled('f') };
}
export const withServings = (item, servings) => mealItem({ ...item.per, name: item.name, portion: item.portion }, servings);

// "1 cup · 195 g" × 1.5 → "1½ cups · 293 g": the household amount scaled, then the
// total weight. A portion without a leading number reads "2 × 1 serving".
const FRACTIONS = [['', 0], ['¼', 0.25], ['⅓', 1 / 3], ['½', 0.5], ['⅔', 2 / 3], ['¾', 0.75], ['+', 1]];
const VALUE = Object.fromEntries(FRACTIONS.filter(([symbol]) => symbol && symbol !== '+'));
const PLURAL = { potato: 'potatoes', loaf: 'loaves', glass: 'glasses', sandwich: 'sandwiches', tbsp: 'tbsp', tsp: 'tsp' };
const countOf = (text) => {
  const match = String(text).match(/^(\d+(?:\.\d+)?)?\s*([¼⅓½⅔¾])?\s*/);
  if (!match || (!match[1] && !match[2])) return null;
  return { value: Number(match[1] || 0) + (VALUE[match[2]] || 0), rest: String(text).slice(match[0].length) };
};
export function formatCount(n) {
  const whole = Math.floor(n + 1e-9);
  const [symbol] = FRACTIONS.reduce((best, entry) => (Math.abs(entry[1] - (n - whole)) < Math.abs(best[1] - (n - whole)) ? entry : best));
  if (symbol === '+') return String(whole + 1);
  return whole ? `${whole}${symbol}` : symbol || '0';
}
const plural = (word, n) => (n <= 1 || !/^[a-z]+$/i.test(word) ? word : PLURAL[word.toLowerCase()] || `${word}s`);
export function amountLabel(item) {
  if (!item) return '';
  const portion = String(item.portion || '');
  if (!item.servings || item.servings === 1) return portion;
  const weight = weightOf(portion);
  const unit = portion.replace(/\s*·?\s*\d+(?:\.\d+)?\s*(g|ml)\b/i, '').trim();
  const count = countOf(unit);
  const total = weight ? ` · ${Math.round(weight.amount * item.servings)} ${weight.unit}` : '';
  if (!unit && weight) return `${Math.round(weight.amount * item.servings)} ${weight.unit}`;
  if (!count || !count.rest) return `${formatCount(item.servings)} × ${unit || portion}${unit ? total : ''}`;
  const amount = count.value * item.servings;
  const [word, ...more] = count.rest.split(' ');
  return `${formatCount(amount)} ${[plural(word, amount), ...more].join(' ')}${total}`;
}

// Meal totals from its foods. Missing protein, carbs or fat stays missing, never zero.
export function itemsTotals(items = []) {
  const total = (key) => (items.some((item) => item[key] == null) ? null : round1(items.reduce((sum, item) => sum + Number(item[key] || 0), 0)));
  return { kcal: Math.round(items.reduce((sum, item) => sum + Number(item.kcal || 0), 0)), p: total('p'), c: total('c'), f: total('f') };
}

// What gets written in the diary portion when a planned meal is logged.
export const itemsSummary = (items = [], name = (text) => text) => items.map((item) => `${name(item.name)} ${portionLabel(amountLabel(item))}`).join(language() === 'ar' ? '، ' : ', ');

// Portion words in the app language. Numbers and anything unknown (a client's own
// words) stay as written.
const AR = {
  g: 'غ', ml: 'مل', cup: 'كوب', cups: 'أكواب', tbsp: 'ملعقة كبيرة', tsp: 'ملعقة صغيرة', egg: 'بيضة', eggs: 'بيض',
  banana: 'موزة', fillet: 'فيليه', piece: 'قطعة', pieces: 'قطع', loaf: 'رغيف', roll: 'رغيف', plate: 'طبق', bowl: 'سلطانية',
  slice: 'شريحة', slices: 'شرائح', sandwich: 'ساندوتش', can: 'علبة', drained: 'مصفّاة', dates: 'تمرات', glass: 'كوب',
  serving: 'حصة', servings: 'حصص', fillets: 'فيليه', bananas: 'موز', potatoes: 'حبات بطاطس', loaves: 'أرغفة', rolls: 'أرغفة', plates: 'أطباق', bowls: 'سلطانيات', sandwiches: 'ساندوتشات', cans: 'علب', glasses: 'أكواب', avocados: 'ثمرات أفوكادو', sugar: 'سكر', skewers: 'أسياخ', planned: 'مخطّطة', medium: 'متوسطة', large: 'كبيرة', small: 'صغيرة', half: 'نصف', potato: 'حبة بطاطس', avocado: 'ثمرة أفوكادو',
};
export function portionLabel(text) {
  if (text == null || language() === 'en') return text ?? '';
  return String(text).replace(/[A-Za-z]+/g, (word) => AR[word.toLowerCase()] ?? word);
}

// The day as planned: every meal added up and compared with the targets the coach
// set. Targets are never changed here. Within 5% of a target counts as on target.
export const DAY_KEYS = [['kcal', 'Calories', 'kcal'], ['p', 'Protein', 'g'], ['c', 'Carbs', 'g'], ['f', 'Fat', 'g']];
export function dayTotals(meals = [], targets = {}) {
  return DAY_KEYS.map(([key, label, unit]) => {
    const missing = meals.filter((meal) => meal[key] == null || meal[key] === '').length;
    const value = Math.round(meals.reduce((sum, meal) => sum + Number(meal[key] || 0), 0));
    const target = Math.round(Number(targets[key] || 0));
    const diff = value - target;
    const status = !target ? 'none' : Math.abs(diff) <= target * 0.05 ? 'on' : diff < 0 ? 'short' : 'over';
    return { key, label, unit, value, target, diff, status, missing };
  });
}
