import base from "./playwright.config.js";

// Same suite, but against this copy's own dev server. The default config reuses
// whatever answers on 5173, which on the owner's Mac is the live install.
export default {
  ...base,
  fullyParallel: false,
  workers: 1,
  reporter: [["line"], ["json", { outputFile: process.env.AUDIT_REPORT || "/dev/null" }]],
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:5199",
    ...(process.env.AUDIT_TZ ? { timezoneId: process.env.AUDIT_TZ } : {}),
  },
  projects: base.projects.filter((project) => project.name === "chrome"),
  webServer: undefined,
};
