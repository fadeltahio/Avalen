// The coach side of the app, re-exported from one file so it can still be loaded
// as a single lazy-loaded bundle (see coachPage() in main.jsx). Each screen's own
// code lives in src/avalen/coach/*.jsx — start there for any specific screen.
export { Dashboard } from "./coach/Dashboard.jsx";
export { Clients } from "./coach/Clients.jsx";
export { Programs } from "./coach/Programs.jsx";
export { Inbox } from "./coach/Inbox.jsx";
export { Business } from "./coach/Business.jsx";
