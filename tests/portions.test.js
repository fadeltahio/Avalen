import test from "node:test";
import assert from "node:assert/strict";
import { amountLabel, dayTotals, formatCount, itemsSummary, itemsTotals, mealItem, portionLabel, weightOf, withServings } from "../src/avalen/portions.js";
import { ALL_FOODS } from "../src/avalen/food-library.js";
import { createWorkspace } from "../src/avalen/seed.js";
import { useLanguageForTests } from "../src/avalen/i18n.js";

const egg = { name: "Eggs", portion: "1 egg · 50 g", kcal: 72, p: 6.3, c: 0.4, f: 4.8 };

test("every library food has a household amount and a weight", () => {
  for (const food of ALL_FOODS) {
    assert.ok(weightOf(food.portion), `${food.name}: ${food.portion}`);
    assert.match(food.portion, /^[\d½⅔¼¾⅓]/, food.name);
  }
});

test("amounts scale like a recipe, with the total weight", () => {
  assert.equal(amountLabel(mealItem(egg, 1)), "1 egg · 50 g");
  assert.equal(amountLabel(mealItem(egg, 2)), "2 eggs · 100 g");
  assert.equal(amountLabel(mealItem(egg, 0.5)), "½ egg · 25 g");
  assert.equal(amountLabel(mealItem({ name: "Rice", portion: "1 cup · 195 g", kcal: 216 }, 1.5)), "1½ cups · 293 g");
  assert.equal(amountLabel(mealItem({ name: "Oats", portion: "⅔ cup · 60 g", kcal: 228 }, 1.5)), "1 cup · 90 g");
  assert.equal(amountLabel(mealItem({ name: "Tawook", portion: "200 g", kcal: 330 }, 2)), "400 g");
  assert.equal(formatCount(2.75), "2¾");
});

test("a meal's totals are the sum of its foods; a missing macro stays missing", () => {
  const items = [mealItem(egg, 2), mealItem({ name: "Banana", portion: "1 banana · 118 g", kcal: 105, p: 1, c: 27, f: 0 }, 1)];
  assert.deepEqual(itemsTotals(items), { kcal: 249, p: 13.6, c: 27.8, f: 9.6 });
  assert.equal(itemsTotals([...items, mealItem({ name: "Home meal", portion: "1 plate · 300 g", kcal: 400, p: null }, 1)]).p, null);
  assert.equal(withServings(items[0], 3).kcal, 216);
  assert.equal(itemsSummary(items), "Eggs 2 eggs · 100 g, Banana 1 banana · 118 g");
});

test("the demo plan lists foods with amounts and its totals add up", () => {
  for (const meal of createWorkspace().clients[0].nutrition.meals) {
    assert.ok(meal.items.length >= 3, meal.name);
    assert.equal(meal.kcal, itemsTotals(meal.items).kcal);
  }
});

test("portions read in Arabic; a client's own words stay as written", () => {
  useLanguageForTests("ar");
  try {
    assert.equal(portionLabel("1 cup · 195 g"), "1 كوب · 195 غ");
    assert.equal(portionLabel(amountLabel(mealItem(egg, 1))), "1 بيضة · 50 غ");
    assert.equal(portionLabel("طبق صغير"), "طبق صغير");
  } finally { useLanguageForTests("en"); }
  assert.equal(portionLabel("1 cup · 195 g"), "1 cup · 195 g");
});

test("the day as planned adds up every meal and compares it with the coach's own targets", () => {
  const meals = [{ kcal: 479, p: 29, c: 73, f: 9 }, { kcal: 722, p: 56, c: 73.5, f: 22.3 }, { kcal: 617, p: 39.3, c: 55.5, f: null }];
  const targets = { kcal: 2500, p: 130, c: 180, f: 75 };
  const [kcal, p, c, f] = dayTotals(meals, targets);
  assert.deepEqual([kcal.value, kcal.target, kcal.diff, kcal.status], [1818, 2500, -682, "short"]);
  assert.equal(p.value, 124);
  assert.equal(p.status, "on");
  assert.equal(c.status, "over");
  assert.equal(f.missing, 1);
  assert.deepEqual(targets, { kcal: 2500, p: 130, c: 180, f: 75 });
  assert.equal(dayTotals([], {})[0].status, "none");
});
