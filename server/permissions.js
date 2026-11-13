import { cleanLayout } from "../src/avalen/home-layout.js";
import { zonedDay, dateKey, validTimezone } from "../src/avalen/ecosystem/time.js";
import { programError } from "../src/avalen/validation.js";
import { checkinPlanError } from "../src/avalen/checkin-model.js";
import { policyError } from "../src/avalen/ecosystem/scheduling.js";
import { equal, foundations } from "../src/avalen/ecosystem/memory.js";
import { paymentChangeError } from "../src/avalen/payments-model.js";
export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
export const coachOnly = (user) => {
  if (user.role !== "coach") fail(403, "This action requires your coach.");
};
export function requireClient(user, data, id) {
  if (
    !data.clients.some((c) => c.id === id) ||
    (user.role === "client" && user.client_id !== id)
  )
    fail(404, "Client not found.");
  return data.clients.find((c) => c.id === id);
}
const clientKeys = new Set([
  "id",
  "name",
  "email",
  "goal",
  "program",
  "programEnd",
  "created",
  "paused",
  "nutrition",
  "habits",
  "schedule",
  "subscription",
  "travel",
  "checkinPlan",
  "scheduleRules",
  "preferredWearable",
  "savedSessions",
  "integrations",
  "wearables",
  "externalAIConsent",
  "intake",
  "phone",
  "homeLayout",
  "timezone",
]);
export function projection(source, user) {
  const data = foundations(structuredClone(source));
  if (user.role === "coach") return data;
  const id = user.client_id;
  data.clients = data.clients
    .filter((c) => c.id === id)
    .map((c) => {
      for (const key of Object.keys(c)) if (!clientKeys.has(key)) delete c[key];
      return c;
    });
  data.activeClientId = id;
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value) || key === "clients") continue;
    if (["library", "posts"].includes(key)) {
      if (key === "posts")
        data[key] = value.filter((r) => !r.clientId || r.clientId === id);
      continue;
    }
    data[key] = value.filter((r) => r.clientId === id);
  }
  data.timeline = data.timeline
    .filter(
      (e) => e.visibility === "client" || e.by === "client" || e.explanation,
    )
    .map((e) => ({
      id: e.id,
      clientId: e.clientId,
      at: e.at,
      by: e.by,
      title: e.title,
      type: e.type,
      detail: e.explanation || (e.visibility === "client" ? e.detail : ""),
      visibility: "client",
    }));
  data.revisions = [];
  data.insightDecisions = [];
  data.favorites =
    data.clientPreferences.find((p) => p.clientId === id)?.favorites || [];
  data.drafts = data.drafts[id] ? { [id]: data.drafts[id] } : {};
  data.savedReplies = [];
  data.savedViews = [];
  data.leads = [];
  data.forms = [];
  data.automations = [];
  data.templates = [];
  data.dismissed = [];
  return data;
}
const protectedRoots = new Set([
  "version",
  "ecosystemVersion",
  "revisions",
  "scheduleProposals",
  "formSubmissions",
  "insightDecisions",
  "notifications",
  "clientPreferences",
]);
const clientRows = new Set([
  "foodLogs",
  "nutritionDays",
  "measurements",
  "habitLogs",
  "activityLogs",
  "photos",
  "inbodies",
]);
export function mergeEdit(source, next, user) {
  if (!next || typeof next !== "object" || Array.isArray(next))
    fail(400, "Invalid workspace.");
  const previous = projection(source, user),
    result = structuredClone(source);
  for (const key of Object.keys(next)) {
    if (equal(previous[key], next[key]) || key === "updatedAt") continue;
    if (protectedRoots.has(key))
      fail(403, "Use the dedicated review action for this change.");
    if (key === "sessions") {
      if (
        !Array.isArray(next[key]) ||
        previous.sessions.some(
          (row) => !next.sessions.some((r) => equal(r, row)),
        )
      )
        fail(409, "Completed workouts cannot be rewritten.");
      const added = next.sessions.filter(
        (row) => !previous.sessions.some((r) => r.id === row.id),
      );
      for (const row of added) {
        const person = requireClient(user, source, row.clientId);
        if (
          !dateKey(row.date) ||
          // The workout date is the client's own calendar day, which can already be
          // tomorrow in the plan's timezone. Reject only a day no timezone has reached.
          row.date > zonedDay("Pacific/Kiritimati") ||
          !Array.isArray(row.sets) ||
          row.sets.some(
            (s) =>
              !s.skipped &&
              (!Number.isFinite(s.weight) ||
                s.weight < 0 ||
                s.weight > 1000 ||
                !Number.isInteger(s.reps) ||
                s.reps < 1 ||
                s.reps > (s.kind === "Duration" ? 3600 : 500)),
          )
        )
          fail(
            400,
            "The completed workout contains invalid dates or set values.",
          );
        if (
          !row.id ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
          !Array.isArray(row.sets) ||
          !row.sets.length ||
          source.sessions.some(
            (s) => s.clientId === row.clientId && s.date === row.date,
          )
        )
          fail(
            409,
            "A valid completed workout already exists or this log is incomplete.",
          );
      }
      if (
        added.some((r) => source.sessions.some((s) => s.id === r.id)) ||
        new Set(added.map((r) => r.id)).size !== added.length
      )
        fail(409, "This workout identifier is already in use.");
      result.sessions.push(...added);
      continue;
    }
    if (key === "timeline") {
      // Legacy UI decision calls may append, never edit old history. Attribution is server-owned.
      if (
        !Array.isArray(next.timeline) ||
        previous.timeline.some(
          (row) => !next.timeline.some((r) => equal(r, row)),
        )
      )
        fail(403, "Coaching history is immutable.");
      const added = next.timeline.filter(
        (r) => !previous.timeline.some((x) => x.id === r.id),
      );
      for (const r of added) {
        requireClient(user, source, r.clientId);
        result.timeline.unshift({
          id: r.id,
          clientId: r.clientId,
          title: String(r.title || "").slice(0, 200),
          detail:
            user.role === "coach"
              ? String(r.detail || "").slice(0, 4000)
              : "Client activity recorded.",
          at: new Date().toISOString(),
          by: user.role,
          actorId: user.id,
          visibility: user.role === "coach" ? "coach" : "client",
        });
      }
      continue;
    }
    if (key === "payments") {
      // Only the coach edits payments, within the rules; only Paymob confirms them.
      const issue = paymentChangeError(previous.payments || [], next.payments, user.role);
      if (issue) fail(403, issue);
      for (const row of next.payments)
        if (!(previous.payments || []).some((p) => p.id === row.id))
          requireClient(user, source, row.clientId);
      result.payments = structuredClone(next.payments);
      continue;
    }
    if (user.role === "coach") {
      if (!Object.hasOwn(source, key)) fail(400, "Unknown workspace field.");
      if (
        key === "clients" &&
        (!Array.isArray(next.clients) ||
          source.clients.some((c) => !next.clients.some((x) => x.id === c.id)))
      )
        fail(409, "Archive clients instead of deleting their history.");
      if (key === "checkins") fail(403, "Use the check-in review flow.");
      if (key === "clients")
        for (const client of next.clients) {
          const old = source.clients.find((c) => c.id === client.id);
          if (!equal(old?.externalAIConsent, client.externalAIConsent))
            fail(403, "Only the client can change AI sharing preferences.");
          if (!equal(old?.program, client.program)) {
            const issue = programError(client.program);
            if (issue) fail(400, issue);
          }
          for (const session of source.sessions.filter(
            (s) => s.clientId === client.id,
          )) {
            const original = old?.schedule.find((s) => s.date === session.date),
              changed = client.schedule.find((s) => s.date === session.date);
            if (original && !equal(original, changed))
              fail(409, "Completed training dates stay in the schedule.");
          }
          if (client.checkinPlan) {
            const issue = checkinPlanError(client.checkinPlan);
            if (issue) fail(400, issue);
          }
          if (client.scheduleRules) {
            const issue = policyError(client.scheduleRules);
            if (issue) fail(400, issue);
          }
        }
      result[key] = structuredClone(next[key]);
      continue;
    }
    if (key === "clients") {
      if (next.clients.length !== 1 || next.clients[0].id !== user.client_id)
        fail(403, "Cannot change another profile.");
      const old = previous.clients[0],
        changed = next.clients[0],
        allowed = new Set([
          "name",
          "email",
          "goal",
          "integrations",
          "wearables",
          "preferredWearable",
          "savedSessions",
          "intake",
          "phone",
          "homeLayout",
          "timezone",
        ]);
      for (const field of new Set([
        ...Object.keys(old),
        ...Object.keys(changed),
      ]))
        if (!equal(old[field], changed[field])) {
          if (!allowed.has(field))
            fail(403, "Your coach manages this part of your plan.");
          if (field === 'homeLayout' && changed.homeLayout != null) {
            try { cleanLayout(changed.homeLayout); } catch (e) { fail(400, e.message); }
          }
          if (field === 'timezone' && !validTimezone(changed.timezone))
            fail(400, 'Choose a valid time zone.');
          if (field === 'phone' && changed.phone != null && (typeof changed.phone !== 'string' || !/^\+?[0-9][0-9 ()-]{6,19}$/.test(changed.phone.trim())))
            fail(400, 'Enter a valid mobile number.');
          if (field === 'savedSessions' && (!Array.isArray(changed[field]) || changed[field].length > 500 || changed[field].some(id => typeof id !== 'string' || id.length > 200)))
            fail(400, 'Invalid saved sessions.');
          if (field === 'intake') {
            const intake = changed.intake;
            if (!intake || typeof intake.answers !== 'object' || intake.answers === null || JSON.stringify(intake).length > 6000)
              fail(400, 'Invalid intake answers.');
            // The health flag and the coach's review are never the client's to set.
            result.clients.find((c) => c.id === user.client_id).intake = {...intake, flagged: intake.answers.health === 'Yes', reviewedAt: old.intake?.reviewedAt ?? null};
            continue;
          }
          result.clients.find((c) => c.id === user.client_id)[field] =
            changed[field];
        }
    } else if (key === "favorites") {
      if (
        !Array.isArray(next.favorites) ||
        next.favorites.length > 500 ||
        next.favorites.some((s) => typeof s !== "string" || s.length > 200)
      )
        fail(400, "Invalid saved foods.");
      let pref = result.clientPreferences.find(
        (p) => p.clientId === user.client_id,
      );
      if (!pref) {
        pref = { clientId: user.client_id };
        result.clientPreferences.push(pref);
      }
      pref.favorites = next.favorites;
    } else if (clientRows.has(key)) {
      if (
        !Array.isArray(next[key]) ||
        next[key].some((r) => r.clientId !== user.client_id)
      )
        fail(403, "Cannot change another client’s records.");
      const ids = next[key].filter((r) => r.id).map((r) => r.id);
      if (
        new Set(ids).size !== ids.length ||
        next[key].some(
          (r) =>
            r.id &&
            (source[key] || []).some(
              (old) => old.id === r.id && old.clientId !== user.client_id,
            ),
        )
      )
        fail(403, "Record identifiers cannot belong to another client.");
      if (key === "nutritionDays")
        for (const row of next[key]) {
          const old = (source.nutritionDays || []).find(
            (d) => d.clientId === user.client_id && d.date === row.date,
          );
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
            next[key].filter((d) => d.date === row.date).length > 1
          )
            fail(400, "Use one nutrition day per date.");
          const target =
            old?.target ||
            Object.fromEntries(
              ["kcal", "p", "c", "f"].map((k) => [
                k,
                source.clients.find((c) => c.id === user.client_id).nutrition[
                  k
                ],
              ]),
            );
          if (!equal(target, row.target))
            fail(403, "Your coach sets nutrition targets.");
        }
      result[key] = [
        ...(source[key] || []).filter((r) => r.clientId !== user.client_id),
        ...structuredClone(next[key]),
      ];
    } else if (key === "messages") {
      if (
        !Array.isArray(next.messages) ||
        previous.messages.some((r) => !next.messages.some((x) => x.id === r.id))
      )
        fail(403, "Messages cannot be removed.");
      for (const r of next.messages) {
        const old = source.messages.find((x) => x.id === r.id);
        if (old) {
          if (!equal({ ...r, read: old.read }, old))
            fail(403, "Sent messages cannot be edited.");
          if (old.from === "coach")
            result.messages.find((x) => x.id === r.id).read = Boolean(r.read);
        } else {
          if (r.clientId !== user.client_id || r.from !== "client")
            fail(403, "Invalid message sender.");
          result.messages.push({ ...r, at: new Date().toISOString() });
        }
      }
    } else if (key === "drafts") {
      if (Object.keys(next.drafts).some((id) => id !== user.client_id))
        fail(403, "Invalid workout draft.");
      if (
        next.drafts[user.client_id] &&
        next.drafts[user.client_id].clientId !== user.client_id
      )
        fail(403, "This workout draft belongs to another client.");
      if (next.drafts[user.client_id])
        result.drafts[user.client_id] = next.drafts[user.client_id];
      else delete result.drafts[user.client_id];
    } else if (key === "settings") {
      for (const field of ["theme", "reducedMotion", "designVersion"])
        if (Object.hasOwn(next.settings, field))
          result.settings[field] = next.settings[field];
    } else if (key === "activeClientId") {
      if (next[key] !== user.client_id) fail(403, "Invalid client.");
    } else if (key === "onboarded") result.onboarded = true;
    else fail(403, "This part of the workspace is managed by your coach.");
  }
  return result;
}
