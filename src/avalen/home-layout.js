// Home screen widgets. A saved layout is { order: [ids], hidden: [ids] }.
// Widgets added in a later version appear in their default place until the
// person moves or hides them, so an old layout never hides something new.

export const CLIENT_WIDGETS = [
  { id: 'session', label: 'Today’s session', detail: 'Your workout or recovery day' },
  { id: 'essentials', label: 'Check-in & habits', detail: 'Next check-in and daily targets' },
  { id: 'wearables', label: 'Last night', detail: 'Sleep, recovery and strain from your wearable' },
  { id: 'recovery', label: 'Live recovery', detail: 'Which muscles are ready to train' },
  { id: 'nutrition', label: 'Nutrition', detail: 'Today’s food and your coach’s meals' },
  { id: 'updates', label: 'Coaching updates', detail: 'Recent changes from your coach' },
  { id: 'training', label: 'Up next', detail: 'This week and your next sessions' },
  { id: 'coach', label: 'Your coach', detail: 'Latest note from your coach' },
];
export const COACH_WIDGETS = [
  { id: 'summary', label: 'At a glance', detail: 'Active clients and check-ins to review' },
  { id: 'queue', label: 'Review queue', detail: 'What needs your attention, in order' },
  { id: 'recovery', label: 'Client recovery', detail: 'Wearable recovery and sleep, lowest first' },
  { id: 'insights', label: 'Coaching insights', detail: 'Suggestions from training trends' },
  { id: 'progress', label: 'Client progress', detail: 'Shortcuts to progress views' },
];
// Widgets that start hidden; everything else starts visible.
const HIDDEN_BY_DEFAULT = {};
const MAX = 40;

export function resolveLayout(saved, widgets, role = 'client') {
  const ids = widgets.map((w) => w.id);
  const order = Array.isArray(saved?.order) ? saved.order.filter((id, i, a) => ids.includes(id) && a.indexOf(id) === i) : [];
  // Place widgets the saved order doesn't know about after the known widget
  // that precedes them in the default order.
  for (const [index, id] of ids.entries()) {
    if (order.includes(id)) continue;
    const before = ids.slice(0, index).reverse().find((x) => order.includes(x));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  }
  const hidden = Array.isArray(saved?.hidden) ? saved.hidden.filter((id) => ids.includes(id)) : saved ? [] : HIDDEN_BY_DEFAULT[role] || [];
  return order.map((id) => ({ ...widgets.find((w) => w.id === id), visible: !hidden.includes(id) }));
}
export const layoutFrom = (rows) => ({ order: rows.map((r) => r.id), hidden: rows.filter((r) => !r.visible).map((r) => r.id) });

// Validates a layout sent by a client; returns a clean copy or throws.
export function cleanLayout(input) {
  if (input == null) return null;
  const list = (value) => {
    if (!Array.isArray(value) || value.length > MAX || value.some((id) => typeof id !== 'string' || !/^[a-z-]{1,30}$/.test(id))) throw new Error('Invalid home layout.');
    return [...new Set(value)];
  };
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid home layout.');
  return { order: list(input.order), hidden: list(input.hidden ?? []) };
}
