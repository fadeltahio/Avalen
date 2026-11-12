import { analyzeClient } from "../src/avalen/ecosystem/intelligence.js";
import { fail } from "./permissions.js";
export async function explainInsight(data, client, input) {
  if (!client.externalAIConsent?.enabled)
    fail(
      403,
      "The client has not allowed optional external AI explanations. Deterministic observations remain available.",
    );
  if (input.consent !== true)
    fail(
      400,
      "Permission is required before sharing evidence with the AI provider.",
    );
  if (!process.env.AVALEN_AI_URL)
    fail(
      503,
      "No AI provider is connected. The stored-data evidence and deterministic review actions are available.",
    );
  const insight = analyzeClient(data, client, { includeSuppressed: true }).find(
    (i) => i.key === input.key,
  );
  if (!insight || insight.fingerprint !== input.fingerprint)
    fail(409, "The evidence changed. Review the current observation first.");
  const url = new URL(process.env.AVALEN_AI_URL);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    fail(503, "The configured AI provider must use HTTPS.");
  let result;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.AVALEN_AI_TOKEN
          ? { Authorization: `Bearer ${process.env.AVALEN_AI_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        instruction:
          "Explain only the supplied evidence. Distinguish facts, client reports and interpretation. Do not diagnose, invent observations or propose unreviewed changes. Return JSON {summary:string, considerations:string[], evidenceIds:string[]}.",
        evidence: insight.evidence,
        context: insight.context,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error();
    result = await response.json();
  } catch {
    fail(
      502,
      "The AI provider could not prepare an explanation. Your evidence remains available.",
    );
  }
  if (
    typeof result.summary !== "string" ||
    result.summary.length > 3000 ||
    !Array.isArray(result.considerations) ||
    result.considerations.length > 8 ||
    result.considerations.some(
      (x) => typeof x !== "string" || x.length > 1000,
    ) ||
    !Array.isArray(result.evidenceIds) ||
    result.evidenceIds.some(
      (id) => !insight.evidence.some((e) => e.recordId === id),
    )
  )
    fail(
      502,
      "The provider returned an invalid structured explanation. No plan changes were made.",
    );
  return {
    source: "AI interpretation",
    summary: result.summary,
    considerations: result.considerations,
    evidenceIds: result.evidenceIds,
    generatedAt: new Date().toISOString(),
    fingerprint: insight.fingerprint,
  };
}
