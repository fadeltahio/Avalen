import test from "node:test";
import assert from "node:assert/strict";
import { ALL_FOODS, EGYPT_FOODS, productToFood, searchFoods, validBarcode } from "../src/avalen/food-library.js";

test("search finds Egyptian foods by English, Arabic and common spellings", () => {
  assert.equal(searchFoods(ALL_FOODS, "foul")[0].name, "Ful medames with oil");
  assert.ok(searchFoods(ALL_FOODS, "فول").length >= 2);
  assert.ok(searchFoods(ALL_FOODS, "tameya").some(f => f.name === "Ta’meya"));
  assert.ok(searchFoods(ALL_FOODS, "Koshary").some(f => f.name === "Koshari"));
  assert.ok(searchFoods(ALL_FOODS, "chicken").length >= 2);
  assert.equal(searchFoods(ALL_FOODS, "").length, ALL_FOODS.length);
  assert.equal(searchFoods(ALL_FOODS, "zzzz").length, 0);
});

test("every library food has a unique name and believable values", () => {
  const names = ALL_FOODS.map(f => f.name);
  assert.equal(new Set(names).size, names.length);
  for (const f of EGYPT_FOODS) {
    assert.ok(f.kcal > 0 && f.kcal < 1500, f.name);
    // Energy from macros should sit near the stated calories (alcohol and fibre aside).
    const fromMacros = f.p * 4 + f.c * 4 + f.f * 9;
    assert.ok(Math.abs(fromMacros - f.kcal) / f.kcal < 0.2, `${f.name}: ${fromMacros} vs ${f.kcal}`);
  }
});

test("a product's label values map per serving when given, else per 100 g", () => {
  const perServing = productToFood({ product: { brands: "Juhayna", product_name: "Zabado", serving_size: "440 g", nutriments: { "energy-kcal_serving": 326, proteins_serving: 12, carbohydrates_serving: 50, fat_serving: 8.8 } } }, "6222014351396");
  assert.deepEqual([perServing.name, perServing.portion, perServing.kcal, perServing.p], ["Juhayna · Zabado", "440 g", 326, 12]);
  const per100 = productToFood({ product: { brands: "Juhayna", product_name: "Cocktail", quantity: "1 l", nutriments: { "energy-kcal_100g": 48, proteins_100g: 1, carbohydrates_100g: 11, fat_100g: 0 } } }, "6222014330674");
  assert.deepEqual([per100.portion, per100.kcal, per100.f], ["100 ml", 48, 0]);
  const partial = productToFood({ product: { product_name: "Mystery", nutriments: { energy_100g: 418.4 } } }, "12345678");
  assert.equal(partial.kcal, 100);
  assert.equal(partial.p, "", "missing protein stays empty instead of becoming zero");
  assert.equal(productToFood({ status: 0 }, "12345678"), null);
});

test("barcodes must be 8 to 14 digits", () => {
  assert.ok(validBarcode("6222014330674"));
  assert.ok(validBarcode("90162602"));
  assert.ok(!validBarcode("1234"));
  assert.ok(!validBarcode("62220143306a4"));
});
