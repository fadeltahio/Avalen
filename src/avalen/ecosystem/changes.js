// What an edit changed in a workspace, record by record, and how to apply that to the
// latest workspace. Shared by the app (which sends the changes) and the server (which
// applies them), so both identify records the same way.
//
// A save is refused only when a record it changes was changed by someone else since the
// app last loaded it. Edits to other records, other clients or other areas go through,
// so a client logging food no longer clashes with their coach editing a programme.

const json = (value) => JSON.stringify(value);
const isRecordList = (value) => Array.isArray(value) && value.every((row) => row && typeof row === "object" && !Array.isArray(row));

// A stable identity for each row: its id, or the fields that identify rows without one
// (a client's habits for a date, a dismissed flag). Repeats get #2, #3 so nothing is lost.
export function rowKeys(rows) {
  const seen = new Map();
  return rows.map((row, index) => {
    const base =
      row && typeof row === "object"
        ? typeof row.id === "string" || typeof row.id === "number"
          ? `id:${row.id}`
          : `${row.clientId ?? ""}|${row.date ?? ""}|${row.key ?? ""}|${row.until ?? ""}`
        : `value:${index}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}

// { area: { rows: [{ key, before, after, prev }] } } for lists of records, or
// { area: { value: { before, after } } } for anything else (settings, drafts, a reordered list).
export function workspaceChanges(before, after) {
  const changes = {};
  for (const area of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) {
    const was = before?.[area], now = after?.[area];
    if (json(was) === json(now)) continue;
    if (isRecordList(was ?? []) && isRecordList(now ?? [])) {
      const oldRows = was ?? [], newRows = now ?? [];
      const oldKeys = rowKeys(oldRows), newKeys = rowKeys(newRows);
      const old = new Map(oldKeys.map((key, i) => [key, oldRows[i]]));
      const rows = [];
      newKeys.forEach((key, i) => {
        const previous = old.get(key);
        if (!previous || json(previous) !== json(newRows[i])) rows.push({ key, before: previous ?? null, after: newRows[i], prev: i ? newKeys[i - 1] : null });
      });
      const kept = new Set(newKeys);
      for (const [key, row] of old) if (!kept.has(key)) rows.push({ key, before: row, after: null });
      // Same records, new order: send the whole list rather than guess the moves.
      if (rows.length) {
        changes[area] = { rows };
        continue;
      }
    }
    changes[area] = { value: { before: was ?? null, after: now ?? null } };
  }
  return changes;
}

// Applies changes to `current` (the latest workspace as this person sees it). Returns the
// merged workspace, and the areas where someone else changed what this edit changes.
export function applyChanges(current, changes) {
  const merged = { ...current }, conflicts = [];
  for (const [area, change] of Object.entries(changes || {})) {
    if (change?.value) {
      if (json(current[area] ?? null) !== json(change.value.before)) conflicts.push(area);
      else if (change.value.after === null) delete merged[area];
      else merged[area] = change.value.after;
      continue;
    }
    if (!Array.isArray(change?.rows) || !isRecordList(current[area] ?? [])) {
      conflicts.push(area);
      continue;
    }
    let rows = [...(current[area] ?? [])];
    const keyed = () => new Map(rowKeys(rows).map((key, i) => [key, i]));
    let clash = false;
    for (const op of change.rows) {
      const at = keyed().get(op.key), existing = at === undefined ? undefined : rows[at];
      if (op.before === null) {
        // A new record: fine unless someone else added a different one with the same identity.
        if (existing !== undefined) {
          if (json(existing) !== json(op.after)) clash = true;
          continue;
        }
        const after = op.prev ? keyed().get(op.prev) : undefined;
        if (after !== undefined) rows.splice(after + 1, 0, op.after);
        else if (op.prev === null) rows.unshift(op.after);
        else rows.push(op.after);
      } else if (existing === undefined || json(existing) !== json(op.before)) clash = true;
      else if (op.after === null) rows.splice(at, 1);
      else rows[at] = op.after;
    }
    if (clash) conflicts.push(area);
    else merged[area] = rows;
  }
  return { merged, conflicts };
}
