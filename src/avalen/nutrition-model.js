// Day-level targets stay with the log when a coach changes a later prescription.
export const targetValues = plan => Object.fromEntries(['kcal', 'p', 'c', 'f'].map(k => [k, Number(plan[k]) || 0]));
export function nutritionDay(data, clientId, date) {
  return (data.nutritionDays || []).find(d => d.clientId === clientId && d.date === date);
}
export function ensureNutritionDay(data, client, date) {
  data.nutritionDays ??= [];
  let day = nutritionDay(data, client.id, date);
  if (!day) {
    day = { clientId: client.id, date, target: targetValues(client.nutrition), complete: false };
    data.nutritionDays.push(day);
  }
  return day;
}
export function recordFood(data, client, entry) {
  ensureNutritionDay(data, client, entry.date).complete = false;
  const index = data.foodLogs.findIndex(f => f.id === entry.id);
  if (index < 0) data.foodLogs.push(entry);
  else data.foodLogs[index] = entry;
}
export function nutritionScore(data, clientId, start, end) {
  const days = (data.nutritionDays || []).filter(d => d.clientId === clientId && d.date >= start && d.date <= end && d.complete && d.target?.kcal > 0);
  if (!days.length) return { score: null, days: 0 };
  const within = days.filter(day => {
    const kcal = data.foodLogs.filter(f => f.clientId === clientId && f.date === day.date).reduce((n, f) => n + Number(f.kcal || 0), 0);
    return Math.abs(kcal - day.target.kcal) / day.target.kcal <= .15;
  });
  return { score: Math.round(within.length / days.length * 100), days: days.length };
}
