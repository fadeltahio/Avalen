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
  if (typeof zone !== "string" || !zone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
// The time zone of the device running this code: the client's phone in the app, the
// server's own zone (normally UTC) on the server.
export function deviceTimezone() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return validTimezone(zone) ? zone : "UTC";
}
// The zone a client's days are counted in: a zone the coach set on the check-in plan,
// else the client's own (recorded from their phone), else this device's. Without the
// client's own zone, check-ins in Cairo were dated by UTC and fell on the previous day
// for two or three hours after midnight.
export function clientTimezone(client) {
  if (validTimezone(client?.checkinPlan?.timezone)) return client.checkinPlan.timezone;
  if (validTimezone(client?.timezone)) return client.timezone;
  return deviceTimezone();
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
