// A coach's AI explanation of a flagged insight, queuing a recording for
// transcription, and checking on a background task's progress.
import { explainInsight } from "../ai.js";
import { queueTranscription, jobFor } from "../jobs.js";
import { coachOnly, fail, requireClient } from "../permissions.js";
import { NOT_HANDLED, body, safeDecode } from "../http-utils.js";

export function createCoachingRoutes(ctx) {
  const { store, load, permittedMedia } = ctx;

  return async function handleCoachingRoutes(req, res, url, user) {
    if (url.pathname === "/api/intelligence/explain" && req.method === "POST") {
      coachOnly(user);
      const input = await body(req, 10000),
        data = (await load(user)).data,
        client = requireClient(user, data, input.clientId);
      return explainInsight(data, client, input);
    }

    if (url.pathname === "/api/transcriptions" && req.method === "POST") {
      const input = await body(req, 4096);
      const { data } = await load(user);
      requireClient(user, data, input.clientId);
      const media = await permittedMedia(user, input.mediaId);
      if (user.role === "coach" && media.owner_id !== user.id && !data.clients.find((c) => c.id === input.clientId)?.externalAIConsent?.enabled)
        fail(403, "The client has not allowed their recording to be sent to an external provider.");
      if (media.client_id !== input.clientId || !media.type.startsWith("audio/")) fail(400, "Choose this client’s audio recording.");
      if (input.consent !== true) fail(400, "Transcription requires your permission.");
      if (!process.env.AVALEN_TRANSCRIPTION_URL)
        fail(503, "No transcription provider is connected. Your coach can listen to the original recording.");
      return queueTranscription({ store }, user, input.clientId, input.mediaId);
    }

    if (url.pathname.startsWith("/api/jobs/") && req.method === "GET") {
      const job = await jobFor({ store }, user, safeDecode(url.pathname.slice(10)));
      if (!job) fail(404, "Task not found.");
      return job;
    }

    return NOT_HANDLED;
  };
}
