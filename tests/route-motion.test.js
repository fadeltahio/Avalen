import test from "node:test";
import assert from "node:assert/strict";
import { readRoute, routeMotion } from "../src/avalen/route-model.js";

const at = (hash) => readRoute(hash, "client");

test("tabs fade through in the direction the tab bar travels", () => {
  assert.deepEqual(routeMotion(at("#/client/today"), at("#/client/nutrition")), { kind: "tab", direction: "forward" });
  assert.deepEqual(routeMotion(at("#/client/progress"), at("#/client/plan")), { kind: "tab", direction: "back" });
  assert.deepEqual(routeMotion(at("#/coach/business"), at("#/coach/clients")), { kind: "tab", direction: "back" });
});

test("deeper pages push in and Back pulls them away", () => {
  const list = at("#/client/progress?tab=Strength"), detail = at("#/client/progress?tab=Strength&exercise=Bench+press");
  assert.deepEqual(routeMotion(list, detail), { kind: "push", direction: "forward" });
  assert.deepEqual(routeMotion(detail, list), { kind: "push", direction: "back" });
  const clients = at("#/coach/clients"), client = at("#/coach/clients?client=c1&section=Overview");
  assert.deepEqual(routeMotion(clients, client), { kind: "push", direction: "forward" });
  assert.deepEqual(routeMotion(client, clients), { kind: "push", direction: "back" });
});

test("a session expands from its photo; an exercise inside it pushes", () => {
  const home = at("#/client/today"), session = at("#/client/today?session=d1&date=2026-11-10");
  assert.deepEqual(routeMotion(home, session), { kind: "expand", direction: "forward" });
  assert.deepEqual(routeMotion(session, home), { kind: "expand", direction: "back" });
  const exercise = at("#/client/today?session=d1&date=2026-11-10&exercise=Bench+press");
  assert.deepEqual(routeMotion(session, exercise), { kind: "push", direction: "forward" });
  assert.deepEqual(routeMotion(exercise, session), { kind: "push", direction: "back" });
});

test("changes within one screen swap in place, keeping the calendar still for a new day", () => {
  assert.deepEqual(routeMotion(at("#/client/plan"), at("#/client/plan?tab=Habits")), { kind: "swap", direction: "forward", anchor: "tabs" });
  assert.deepEqual(routeMotion(at("#/client/plan?tab=Training"), at("#/client/plan?tab=Training&day=2026-11-12")), { kind: "swap", direction: "forward", anchor: "day" });
  assert.equal(routeMotion(at("#/client/today"), at("#/coach/dashboard")).kind, "swap");
});
