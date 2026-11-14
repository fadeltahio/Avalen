// Errors that mean "the database can't be reached right now" rather than "this request
// is wrong": the server answers these with 503 so the app keeps the person's input and
// they can try again, and the process carries on serving.

// PostgreSQL SQLSTATE codes: connection exceptions (class 08), the server shutting down
// or restarting (57P01–57P03), too many connections (53300) and a statement cancelled by
// statement_timeout (57014).
const unavailableCodes = new Set(["57P01", "57P02", "57P03", "53300", "57014", "08000", "08001", "08003", "08004", "08006"]);
const networkCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);
const messages = [/not currently accepting connections/i, /connection terminated/i, /timeout exceeded when trying to connect/i, /not queryable/i, /connection.*(closed|ended)/i, /server closed the connection/i];

export function isUnavailable(error) {
  if (!error) return false;
  if (error.unavailable) return true;
  if (unavailableCodes.has(error.code) || networkCodes.has(error.code)) return true;
  return messages.some((pattern) => pattern.test(String(error.message || "")));
}

// Marks the error so the HTTP layer can answer 503 without knowing about the driver.
export function markUnavailable(error) {
  if (isUnavailable(error) && error && typeof error === "object") error.unavailable = true;
  return error;
}
