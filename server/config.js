// Startup checks for a production server (NODE_ENV=production). Every problem is
// listed at once, by variable name only: values are never printed, so the message is
// safe to show in a host's logs. Outside production nothing is required and the server
// keeps its development defaults (SQLite, local files).

const isHttpsUrl = (value, { originOnly = false } = {}) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && (!originOnly || (url.pathname === "/" && !url.search && !url.hash));
  } catch {
    return false;
  }
};

export const isProduction = (env = process.env) => env.NODE_ENV === "production";

export function configProblems(env = process.env) {
  if (!isProduction(env)) return [];
  const problems = [];
  const need = (name, check, message) => {
    if (!env[name] || !String(env[name]).trim()) problems.push(`${name} is not set. ${message}`);
    else if (check && !check(String(env[name]).trim())) problems.push(`${name} is not valid. ${message}`);
  };

  need(
    "DATABASE_URL",
    (value) => {
      try {
        const url = new URL(value);
        return ["postgres:", "postgresql:"].includes(url.protocol) && Boolean(url.hostname) && Boolean(url.username) && Boolean(url.password) && url.pathname.length > 1;
      } catch {
        return false;
      }
    },
    "Production records must be kept in PostgreSQL: use postgresql://user:password@host:port/database (on Render, the database's internal URL).",
  );
  need("AVALEN_SECRETS_KEY", (value) => Buffer.from(value, "base64").length === 32, "It encrypts stored payment and wearable tokens: 32 random bytes, base64 (openssl rand -base64 32).");
  need("AVALEN_R2_BUCKET", null, "Uploaded photos, videos, voice notes and PDFs must be kept in private object storage.");
  need("AVALEN_R2_ENDPOINT", (value) => isHttpsUrl(value), "Use the bucket account's https endpoint, e.g. https://<account id>.r2.cloudflarestorage.com.");
  need("AVALEN_R2_ACCESS_KEY_ID", null, "Use an access key limited to this bucket.");
  need("AVALEN_R2_SECRET_ACCESS_KEY", null, "Use the secret for that access key.");
  need("AVALEN_PUBLIC_URL", (value) => isHttpsUrl(value, { originOnly: true }), "The service's public https address with no path, e.g. https://api.example.com.");
  need("AVALEN_SETUP_TOKEN", (value) => value.length >= 32, "A long random owner setup token (at least 32 characters) instead of one printed in the logs.");

  if (env.AVALEN_SECURE_COOKIE === "false") problems.push("AVALEN_SECURE_COOKIE is false. Sign-in cookies must only travel over HTTPS in production.");
  if (!env.AVALEN_CLIENT_IP_HEADER && env.AVALEN_TRUST_PROXY !== "true")
    problems.push("AVALEN_CLIENT_IP_HEADER is not set. Behind a host's proxy every request looks like the same address, so sign-in limits would lock everyone out together (on Render: cf-connecting-ip).");
  // Email (password reset) is optional, but half a configuration is a mistake.
  if (Boolean(env.AVALEN_EMAIL_API_KEY) !== Boolean(env.AVALEN_EMAIL_FROM))
    problems.push(`${env.AVALEN_EMAIL_API_KEY ? "AVALEN_EMAIL_FROM" : "AVALEN_EMAIL_API_KEY"} is not set. Password reset emails need both AVALEN_EMAIL_API_KEY and AVALEN_EMAIL_FROM.`);
  else if (env.AVALEN_EMAIL_FROM && !/^[^<>]*<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$|^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.AVALEN_EMAIL_FROM.trim()))
    problems.push("AVALEN_EMAIL_FROM is not valid. Use an address on your verified domain, e.g. Avalen <no-reply@yourdomain.com>.");
  if (env.AVALEN_DB_POOL_MAX && !/^([1-9]|[1-9]\d)$/.test(env.AVALEN_DB_POOL_MAX))
    problems.push("AVALEN_DB_POOL_MAX is not valid. Use a whole number from 1 to 99 that fits the database plan's connection limit.");
  return problems;
}

// Throws one readable error listing every problem; the server exits before listening.
export function assertProductionConfig(env = process.env) {
  const problems = configProblems(env);
  if (problems.length)
    throw Object.assign(new Error(`Avalen can't start: the production configuration is incomplete.\n${problems.map((p) => `  - ${p}`).join("\n")}`), { problems });
}
