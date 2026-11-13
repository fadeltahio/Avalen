import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { CATALOGUE, catalogueExercise, groupLabel, libraryWithCatalogue, planExercise, regionOf } from "../src/avalen/exercise-catalogue.js";
import { LIBRARY } from "../src/avalen/seed.js";
import { MUSCLES, musclesFor, recoveryMap } from "../src/avalen/recovery.js";
import { matchesSearch, t, useLanguageForTests } from "../src/avalen/i18n.js";
import { findExercise } from "../src/avalen/exercise-stats.js";
import ar from "../src/avalen/locales/ar.js";

const muscleIds = new Set(MUSCLES.map((m) => m.id));

test("the catalogue has about 300 distinct movements that never clash with the original library", () => {
  assert.ok(CATALOGUE.length >= 300, `${CATALOGUE.length} movements`);
  assert.equal(new Set(CATALOGUE.map((e) => e.id)).size, CATALOGUE.length);
  assert.equal(new Set(CATALOGUE.map((e) => e.name.toLowerCase())).size, CATALOGUE.length);
  for (const e of LIBRARY) assert.equal(catalogueExercise(e.name), null, e.name);
});

test("every movement has a prescription, a region, known muscles and both photos on disk", () => {
  for (const e of CATALOGUE) {
    assert.ok(e.sets > 0 && e.reps > 0 && e.rest > 0, e.name);
    assert.ok(["Standard", "Duration"].includes(e.kind), e.name);
    assert.ok(regionOf(e.group), `${e.name}: ${e.group} has no region`);
    for (const id of [...e.muscles.primary, ...e.muscles.secondary]) assert.ok(muscleIds.has(id), `${e.name}: ${id}`);
    if (e.group !== "Cardio") assert.ok(e.muscles.primary.length, `${e.name} has no primary muscle`);
    for (const frame of e.frames) assert.ok(existsSync(new URL(`../public${frame}`, import.meta.url)), frame);
  }
  for (const e of LIBRARY) assert.ok(regionOf(e.group), e.group);
});

test("every movement, muscle group and piece of equipment has an Arabic name", () => {
  for (const e of CATALOGUE) {
    assert.equal(typeof ar[e.name], "string", `${e.name} has no Arabic name`);
    assert.equal(typeof ar[e.group === "Back" ? "Back (muscle)" : e.group], "string", e.group);
    assert.equal(typeof ar[e.equipment], "string", e.equipment);
  }
  useLanguageForTests("ar");
  try {
    assert.equal(groupLabel("Back"), "الظهر");
    assert.equal(t("Back"), "رجوع");
    assert.equal(t("Pec deck"), "بيك ديك");
  } finally { useLanguageForTests("en"); }
  assert.equal(groupLabel("Back"), "Back");
});

test("a coach's library comes first and hides a catalogue movement with the same name", () => {
  const own = { id: "x", name: "Barbell curl", group: "Arms", sets: 4, reps: 6 };
  const list = libraryWithCatalogue([...LIBRARY, own]);
  assert.equal(list[LIBRARY.length], own);
  assert.equal(list.filter((e) => e.name === "Barbell curl").length, 1);
  assert.equal(list.length, LIBRARY.length + CATALOGUE.length);
});

test("a programme stores the prescription only; photos and muscles are looked up by name", () => {
  const stored = planExercise(catalogueExercise("Hammer curl"));
  assert.equal(stored.frames, undefined);
  assert.equal(stored.muscles, undefined);
  assert.equal(stored.name, "Hammer curl");
  const data = { library: LIBRARY, sessions: [] };
  assert.equal(findExercise(data, { id: "c", program: { days: [] } }, "Hammer curl").group, "Biceps");
});

test("the recovery map uses each movement's own muscles; cardio loads none", () => {
  assert.deepEqual(musclesFor({ name: "Hammer curl", muscles: catalogueExercise("Hammer curl").muscles }).primary, ["biceps"]);
  assert.deepEqual(musclesFor({ name: "Treadmill run", muscles: catalogueExercise("Treadmill run").muscles }), { primary: [], secondary: [] });
  const now = Date.parse("2026-11-13T12:00:00");
  const sets = [1, 2, 3].map((n) => ({ name: "Leg press", reps: 10, weight: 100, set: n, effort: "Good" }));
  const map = recoveryMap({ library: LIBRARY, sessions: [{ clientId: "c", date: "2026-11-13", finishedAt: "2026-11-13T09:00:00", sets }] }, "c", now);
  const loaded = map.muscles.filter((m) => m.state !== "idle").map((m) => m.id);
  assert.ok(loaded.includes("quads"), `quads not loaded: ${loaded}`);
  assert.equal(loaded.includes("biceps"), false);
});

test("Arabic search finds catalogue movements by gym-style name, plain Arabic or English", () => {
  useLanguageForTests("ar");
  try {
    assert.ok(matchesSearch("بيك ديك", ["Pec deck"]));
    assert.ok(matchesSearch("ضغط مائل", ["Incline cable chest press"]));
    assert.ok(matchesSearch("ثني", ["Hammer curl"]));
    assert.ok(matchesSearch("hammer", ["Hammer curl"]));
    assert.equal(matchesSearch("قرفصاء", ["Hammer curl"]), false);
  } finally { useLanguageForTests("en"); }
});
