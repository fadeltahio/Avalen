// Wall-clock deadlines remain authoritative across hidden tabs and reloads.
export function restState(draft, now = Date.now()) {
  const paused =
    Number.isFinite(draft.restRemainingMs) && draft.restRemainingMs > 0;
  const remaining = paused
    ? draft.restRemainingMs
    : Math.max(0, (draft.restUntil || 0) - now);
  const total = Math.max(
    remaining,
    draft.restTotalMs ||
      Number(draft.exercises?.[draft.index]?.rest || 0) * 1000 ||
      remaining ||
      1,
  );
  return {
    remaining,
    total,
    progress: Math.max(0, Math.min(1, remaining / total)),
    phase: paused ? "paused" : remaining > 0 ? "running" : "complete",
  };
}
export function changeRest(draft, action, now = Date.now()) {
  const rest = restState(draft, now);
  if (action === "pause" && rest.remaining > 0 && rest.phase === "running") {
    draft.restRemainingMs = rest.remaining;
    draft.restUntil = 0;
  }
  if (action === "resume" && rest.phase === "paused") {
    draft.restUntil = now + rest.remaining;
    delete draft.restRemainingMs;
  }
  if (action === "extend") {
    draft.restTotalMs = rest.total + 30000;
    if (rest.phase === "paused") draft.restRemainingMs += 30000;
    else draft.restUntil = now + rest.remaining + 30000;
  }
  if (action === "skip") {
    draft.restUntil = 0;
    delete draft.restRemainingMs;
    delete draft.restTotalMs;
  }
}
