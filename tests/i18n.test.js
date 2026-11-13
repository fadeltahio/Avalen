import test from "node:test";
import assert from "node:assert/strict";
import { detectLanguage, formatDate, formatNumber, matchesSearch, t, useLanguageForTests } from "../src/avalen/i18n.js";
import aliases from "../src/avalen/locales/ar/search-aliases.js";
import { LIBRARY } from "../src/avalen/seed.js";
import ar from "../src/avalen/locales/ar.js";
import en from "../src/avalen/locales/en.js";
import { METRICS } from "../src/avalen/wearables-model.js";
import { usedKeys } from "./helpers/i18n-keys.js";

// Keys reached through variables rather than t('literal').
const DYNAMIC = [
  "Home", "Train", "Nutrition", "Progress", "More", "Dashboard", "Clients", "Programs", "Inbox", "Business",
  "Strength", "Conditioning", "Movement",
  ...Object.values(METRICS).map((m) => m.label),
];
const placeholders = (entry) => [...new Set((typeof entry === "string" ? [entry] : Object.values(entry)).flatMap((s) => s.match(/\{\w+\}/g) || []))].sort();

test("the device language decides the default; a saved choice wins", () => {
  assert.equal(detectLanguage(null, "ar-EG"), "ar");
  assert.equal(detectLanguage(null, "en-GB"), "en");
  assert.equal(detectLanguage("en", "ar-SA"), "en");
  assert.equal(detectLanguage("fr", "fr-FR"), "en");
});

test("English: keys are the text, with plurals and placeholders", () => {
  useLanguageForTests("en");
  assert.equal(t("Start Workout"), "Start Workout");
  assert.equal(t("Not translated yet"), "Not translated yet");
  assert.equal(t("Welcome {name}!", { name: "Omar" }), "Welcome Omar!");
  assert.equal(t("{count} sessions this week", { count: 1 }), "1 session this week");
  assert.equal(t("{count} sessions this week", { count: 4 }), "4 sessions this week");
  assert.equal(formatNumber(2375), "2,375");
});

test("Arabic: all six plural forms, Western digits and Gregorian dates", () => {
  useLanguageForTests("ar");
  try {
    assert.equal(t("Start Workout"), "بدء التمرين");
    assert.equal(t("Not translated yet"), "Not translated yet", "falls back to English");
    const plain = (text) => text.replace(/[\u2068\u2069]/g, "");
    const ex = (count) => plain(t("{count} exercises", { count }));
    assert.deepEqual([0, 1, 2, 3, 11, 100].map(ex), ["لا تمارين", "تمرين واحد", "تمرينان", "3 تمارين", "11 تمرينًا", "100 تمرين"]);
    assert.equal(plain(t("{count} min", { count: 45 })), "45 دقيقة");
    assert.equal(t("{count} min", { count: 45 }), "\u206845\u2069 دقيقة", "numbers are isolated inside Arabic text");
    assert.match(formatNumber(2375), /^2.?375$/, "Western digits");
    const date = formatDate("2026-11-12", { weekday: "long", day: "numeric", month: "long" });
    assert.match(date, /12/);
    assert.match(date, /نوفمبر/);
    assert.doesNotMatch(date, /[٠-٩]/, "no Eastern Arabic digits");
  } finally {
    useLanguageForTests("en");
  }
});

test("every English text in the app has an Arabic translation with the same placeholders", () => {
  const keys = [...usedKeys().keys(), ...DYNAMIC];
  const missing = keys.filter((key) => !(key in ar));
  assert.deepEqual(missing, [], `Add Arabic for:\n${missing.join("\n")}`);
  const mismatched = keys.filter((key) => placeholders(ar[key]).join() !== placeholders(en[key] ?? key).join());
  assert.deepEqual(mismatched, [], `Placeholders differ for:\n${mismatched.join("\n")}`);
  for (const [key, entry] of Object.entries(ar))
    if (typeof entry !== "string") assert.ok(entry.other, `Plural entry "${key}" needs an "other" form`);
});

test("exercise search finds a built-in exercise by its English, gym-style Arabic or plain-Arabic name", () => {
  useLanguageForTests("ar");
  try {
    assert.equal(t("Romanian deadlift"), "رومانيان ديدلفت");
    for (const query of ["romanian", "رومانيان", "ديدلفت", "رفعة ميتة", "rdl"]) assert.ok(matchesSearch(query, ["Romanian deadlift"]), query);
    assert.ok(matchesSearch("لانجز بالمشي", ["Walking lunge"]));
    assert.ok(matchesSearch("ضغط الصدر", ["Bench press"]));
    // Hamza and teh marbuta spellings both match; an unrelated word does not.
    assert.ok(matchesSearch("انكلاين", ["Incline dumbbell press"]));
    assert.ok(matchesSearch("رفعه ميته", ["Romanian deadlift"]));
    assert.equal(matchesSearch("سكوات", ["Bench press"]), false);
    // A coach's own exercise is found by exactly what they typed.
    assert.ok(matchesSearch("زوتمان", ["زوتمان كيرل"]));
    assert.ok(matchesSearch("", ["Bench press"]));
  } finally { useLanguageForTests("en"); }
  assert.ok(matchesSearch("bench", ["Bench press"]));
  assert.equal(matchesSearch("ضغط", ["Bench press"]), false);
});

test("every search alias belongs to a built-in exercise with an Arabic name", () => {
  const names = new Set(LIBRARY.map((e) => e.name));
  for (const name of Object.keys(aliases)) {
    assert.ok(names.has(name), `${name} is not a built-in exercise`);
    assert.equal(typeof ar[name], "string", `${name} has no Arabic name`);
  }
});
