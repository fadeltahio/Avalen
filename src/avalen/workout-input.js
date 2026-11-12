// Unlogged values are a tiny device draft: typing must not save the whole workspace.
const key = draftId => `avalen.workout-input.${draftId}`;
export function readWorkoutInput(draftId, exerciseId, set) {
  try {
    const row = JSON.parse(localStorage.getItem(key(draftId)) || '{}')[exerciseId];
    return row?.set === set && row.values && typeof row.values === 'object' ? row.values : null;
  } catch { return null; }
}
export function writeWorkoutInput(draftId, exerciseId, set, values) {
  try {
    const rows = JSON.parse(localStorage.getItem(key(draftId)) || '{}');
    rows[exerciseId] = {set, values};
    localStorage.setItem(key(draftId), JSON.stringify(rows));
    return true;
  } catch { return false; }
}
export function clearWorkoutInput(draftId, exerciseId) {
  try {
    if (!exerciseId) { localStorage.removeItem(key(draftId)); return; }
    const rows = JSON.parse(localStorage.getItem(key(draftId)) || '{}');
    delete rows[exerciseId];
    if (Object.keys(rows).length) localStorage.setItem(key(draftId), JSON.stringify(rows));
    else localStorage.removeItem(key(draftId));
  } catch {}
}
