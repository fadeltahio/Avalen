// Pure route helpers: reading and writing the URL, and how one route leads to the next.
const screens = {
  client: ["today", "plan", "nutrition", "progress", "you", "coach"],
  coach: ["dashboard", "clients", "programs", "inbox", "business"],
};
const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  Number.isFinite(new Date(`${value}T12:00:00`).getTime())
    ? value
    : null;
export function readRoute(hash, fallbackRole = "client") {
  const [path, query] = hash.replace(/^#\/?/, "").split("?");
  const [requestedRole, requestedScreen] = path.split("/");
  const role = screens[requestedRole] ? requestedRole : fallbackRole;
  const params = new URLSearchParams(query);
  return {
    role,
    screen: screens[role].includes(requestedScreen)
      ? requestedScreen
      : screens[role][0],
    subtab: params.get("tab") || "",
    selectedClientId: params.get("client") || null,
    clientTab: params.get("section") || "Overview",
    sessionId: params.get("session") || null,
    exercise: params.get("exercise") || null,
    date: validDate(params.get("date")),
    viewDate: validDate(params.get("day")),
  };
}
export function routeHash(route) {
  const params = new URLSearchParams();
  for (const [key, value] of [
    ["tab", route.subtab],
    ["day", route.viewDate],
    ["client", route.selectedClientId],
    ["section", route.selectedClientId && route.clientTab],
    ["session", route.sessionId],
    ["date", route.sessionId && route.date],
    ["exercise", route.exercise],
  ])
    if (value) params.set(key, value);
  return `#/${route.role}/${route.screen}${params.size ? `?${params}` : ""}`;
}
const depth = (route) =>
  (route.selectedClientId ? 1 : 0) + (route.sessionId ? 1 : 0) + (route.exercise ? 1 : 0);
// How one route leads to the next, so each move looks like what it is:
// - push: a deeper page slides in over the one beneath, and Back pulls it away
// - expand: a session opens out of its own photo, so the page only fades through
// - tab: top-level screens fade through, nudged the way the tab bar travels
// - swap: the same screen changes in place (sub-tab, day, client section)
export function routeMotion(previous, next) {
  if (previous.role !== next.role) return { kind: "swap", direction: "forward" };
  const change = depth(next) - depth(previous);
  if (change && Boolean(previous.sessionId) !== Boolean(next.sessionId))
    return { kind: "expand", direction: change > 0 ? "forward" : "back" };
  if (change) return { kind: "push", direction: change > 0 ? "forward" : "back" };
  if (previous.screen !== next.screen) {
    const order = screens[next.role];
    return {
      kind: "tab",
      direction: order.indexOf(next.screen) < order.indexOf(previous.screen) ? "back" : "forward",
    };
  }
  // Picking another day keeps the calendar still; only what sits below it changes.
  const day = previous.viewDate !== next.viewDate && previous.subtab === next.subtab;
  return { kind: "swap", direction: "forward", anchor: day ? "day" : "tabs" };
}
