export function zonedParts(date = new Date(), timezone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}
export function zonedDay(timezone = "UTC", date = new Date()) {
  const p = zonedParts(date, timezone);
  return `${p.year}-${p.month}-${p.day}`;
}
export function validTimezone(zone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
export function utcAdd(date, n) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + Number(n) * 86400000)
    .toISOString()
    .slice(0, 10);
}
export const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const dateKey = (date) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date || "") &&
  Number.isFinite(Date.parse(`${date}T12:00:00Z`)) &&
  new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
