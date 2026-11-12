import { decideInsight } from "./intelligence.js";
import { submitForm, reviewForm } from "./formlab-service.js";
import { proposeSchedule, applyProposal, policyError } from "./scheduling.js";
import { submitCheckin, reviewCheckin } from "./checkin-service.js";
import { foundations, memory, newId } from "./memory.js";
const reject = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export const onlyCoach = (user) => {
  if (user.role !== "coach") reject(403, "Your coach must review this action.");
};
export function ownClient(data, user, id) {
  const client = data.clients.find((c) => c.id === id);
  if (!client || (user.role === "client" && user.client_id !== id))
    reject(404, "Client not found.");
  return client;
}
export function command(data, user, input, media = () => {}) {
  foundations(data);
  const client = ownClient(data, user, input.clientId),
    p = input.payload || {};
  switch (input.action) {
    case "checkin.submit": {
      submitCheckin(data, user, client, p, media);
      break;
    }
    case "checkin.review": {
      onlyCoach(user);
      reviewCheckin(data, user, client, p, media);
      break;
    }
    case "schedule.rules": {
      onlyCoach(user);
      const error = policyError(p);
      if (error) reject(400, error);
      client.scheduleRules = structuredClone(p);
      break;
    }
    case "schedule.propose": {
      const proposal = proposeSchedule(client, data.sessions, p);
      proposal.actorId = user.id;
      if (p.replaces) {
        const old = data.scheduleProposals.find(
          (r) =>
            r.id === p.replaces &&
            r.clientId === client.id &&
            ["preview", "pending"].includes(r.status),
        );
        if (!old || (user.role !== "coach" && old.actorId !== user.id))
          reject(409, "This proposal cannot be replaced.");
        old.status = "superseded";
        old.replacedBy = proposal.id;
      }
      data.scheduleProposals.push(proposal);
      if (p.confirm) applyProposal(data, user, client, proposal, p);
      break;
    }
    case "schedule.confirm": {
      const proposal = data.scheduleProposals.find(
        (r) => r.id === p.id && r.clientId === client.id,
      );
      if (!proposal || !["preview", "pending"].includes(proposal.status))
        reject(409, "This proposal is no longer open.");
      if (user.role === "client" && proposal.actorId !== user.id)
        reject(403, "Only the requester can confirm this preview.");
      applyProposal(data, user, client, proposal, p);
      break;
    }
    case "schedule.reject": {
      const proposal = data.scheduleProposals.find(
        (r) => r.id === p.id && r.clientId === client.id,
      );
      if (!proposal || !["preview", "pending"].includes(proposal.status))
        reject(409, "This proposal is no longer open.");
      if (user.role !== "coach" && proposal.actorId !== user.id)
        reject(403, "This proposal belongs to another user.");
      proposal.status = "rejected";
      proposal.reason = String(p.reason || "").slice(0, 2000);
      memory(
        data,
        client.id,
        "schedule-decision",
        "Schedule proposal declined",
        proposal.reason,
        { actorId: user.id, by: user.role, recordId: proposal.id },
      );
      break;
    }
    case "form.submit": {
      if (p.consent !== true)
        reject(
          400,
          "Confirm that you want to share this recording with your coach.",
        );
      submitForm(data, user, client, p, media);
      break;
    }
    case "form.review": {
      onlyCoach(user);
      reviewForm(data, user, client, p, media);
      break;
    }
    case "form.viewed": {
      const row = data.formSubmissions.find(
        (r) =>
          r.id === p.id && r.clientId === client.id && r.status === "reviewed",
      );
      if (!row) reject(404, "Reviewed video not found.");
      row.viewedAt = new Date().toISOString();
      break;
    }
    case "form.delete": {
      const row = data.formSubmissions.find(
        (r) => r.id === p.id && r.clientId === client.id,
      );
      if (!row) reject(404, "Video not found.");
      row.status = "deleted";
      row.deletedAt = new Date().toISOString();
      memory(
        data,
        client.id,
        "technique",
        "Technique submission removed",
        row.exerciseName,
        { actorId: user.id, by: user.role, recordId: row.id },
      );
      break;
    }
    case "insight.decide": {
      onlyCoach(user);
      decideInsight(data, user, client, p);
      break;
    }
    case "privacy.aiConsent": {
      if (user.role !== "client")
        reject(403, "Only the client can choose this privacy preference.");
      client.externalAIConsent = {
        enabled: p.enabled === true,
        at: new Date().toISOString(),
        by: user.id,
      };
      memory(
        data,
        client.id,
        "privacy",
        "AI sharing preference updated",
        p.enabled
          ? "Client allowed optional coach-requested AI explanations."
          : "Client disabled optional external AI explanations.",
        { actorId: user.id, by: "client", visibility: "client" },
      );
      break;
    }
    case "memory.note": {
      onlyCoach(user);
      if (!String(p.reason || "").trim())
        reject(400, "Write a short note or reason.");
      if (
        p.parentId &&
        !data.timeline.some(
          (e) => e.id === p.parentId && e.clientId === client.id,
        )
      )
        reject(404, "Decision not found.");
      memory(
        data,
        client.id,
        "note",
        p.parentId ? "Decision context" : "Coach note",
        String(p.reason).slice(0, 4000),
        {
          actorId: user.id,
          parentId: p.parentId || null,
          objective: String(p.objective || "").slice(0, 300),
          visibility: p.share ? "client" : "coach",
          explanation: p.share ? String(p.reason).slice(0, 2000) : null,
        },
      );
      break;
    }
    case "notification.read": {
      const row = data.notifications.find(
        (n) => n.id === p.id && n.clientId === client.id,
      );
      if (!row) reject(404, "Update not found.");
      row.read = true;
      break;
    }
    default:
      reject(400, "This coaching action is not available.");
  }
}
