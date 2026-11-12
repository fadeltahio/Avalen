import {recordChanges} from './ecosystem/memory.js';

// Publish UI state only after the complete new snapshot is stored successfully.
export function commitLocalWorkspace(previous, mutate, actor, storage, key) {
  const next = structuredClone(previous);
  mutate(next);
  recordChanges(previous, next, actor);
  next.updatedAt = new Date().toISOString();
  storage.setItem(key, JSON.stringify(next));
  return next;
}
