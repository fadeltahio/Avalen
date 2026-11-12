// Food library: the starter foods plus everyday Egyptian dishes and staples.
// Values are typical, home-style estimates per stated portion. Packaged
// supermarket products come from their barcode instead (Open Food Facts).
import { FOODS } from './seed.js';

const egypt = (name, ar, portion, kcal, p, c, f, tags = '') => ({ name, ar, portion, kcal, p, c, f, tags, source: 'Typical values' });

export const EGYPT_FOODS = [
  egypt('Baladi bread', 'عيش بلدي', '1 loaf · 100 g', 250, 9, 52, 1, 'aish eish pita'),
  egypt('Fino bread roll', 'عيش فينو', '1 roll · 70 g', 190, 6, 37, 2, 'feno'),
  egypt('Ful medames with oil', 'فول مدمس', '1 cup · 250 g', 395, 19, 49, 15, 'foul fava beans'),
  egypt('Ful medames, plain', 'فول مدمس سادة', '1 cup · 250 g', 275, 19, 49, 1, 'foul fava beans'),
  egypt('Ta’meya', 'طعمية', '1 piece · 30 g', 100, 4, 10, 5, 'tameya taameya falafel'),
  egypt('Koshari', 'كشري', '1 plate · 400 g', 640, 20, 115, 12, 'koshary kushari'),
  egypt('Molokhia', 'ملوخية', '1 bowl · 250 g', 120, 5, 8, 8, 'molokheya mulukhiyah'),
  egypt('Mahshi', 'محشي', '5 pieces · 150 g', 230, 4, 32, 10, 'stuffed vine leaves wara enab'),
  egypt('Rice with vermicelli', 'رز بالشعرية', '1 cup · 160 g', 230, 4, 42, 5, 'roz rice'),
  egypt('Macarona béchamel', 'مكرونة بشاميل', '1 slice · 200 g', 420, 18, 38, 21, 'macaroni bechamel pasta'),
  egypt('Lentil soup', 'شوربة عدس', '1 bowl · 250 g', 180, 10, 28, 3, 'shorbet ads'),
  egypt('Grilled kofta', 'كفتة مشوية', '4 pieces · 120 g', 300, 22, 3, 22, 'kofta kebab'),
  egypt('Shish tawook', 'شيش طاووق', '200 g', 330, 50, 4, 12, 'chicken skewers'),
  egypt('Chicken shawarma sandwich', 'ساندوتش شاورما فراخ', '1 sandwich', 450, 25, 45, 18, 'shawerma'),
  egypt('Hawawshi', 'حواوشي', '1 loaf', 600, 28, 50, 32, 'hawawshy'),
  egypt('Alexandrian liver sandwich', 'ساندوتش كبدة', '1 sandwich', 380, 20, 40, 15, 'kebda'),
  egypt('Fried eggplant', 'بتنجان مقلي', '100 g', 180, 2, 9, 16, 'betengan aubergine'),
  egypt('Feteer meshaltet', 'فطير مشلتت', '1 slice · 100 g', 400, 7, 40, 24, 'fetir'),
  egypt('White cheese (Domiati)', 'جبنة بيضاء', '30 g', 80, 4, 1, 6, 'gebna domty feta'),
  egypt('Roumi cheese', 'جبنة رومي', '30 g', 115, 8, 0, 9, 'gebna romy'),
  egypt('Labneh', 'لبنة', '2 tbsp · 30 g', 50, 2, 1, 4.5, 'labna'),
  egypt('Plain yogurt', 'زبادي', '1 cup · 105 g', 65, 4, 5, 3, 'zabadi'),
  egypt('Full-fat milk', 'لبن كامل الدسم', '1 cup · 240 ml', 150, 8, 12, 8, 'laban'),
  egypt('Skimmed milk', 'لبن خالي الدسم', '1 cup · 240 ml', 85, 8, 12, 0, 'laban'),
  egypt('Tahini', 'طحينة', '1 tbsp · 15 g', 89, 2.5, 3, 8, 'tahina'),
  egypt('Hummus', 'حمص', '2 tbsp · 30 g', 50, 2.4, 4, 3, 'homos'),
  egypt('Baba ghanoush', 'بابا غنوج', '2 tbsp · 60 g', 80, 1.5, 5, 6, 'baba ghanough'),
  egypt('Halawa tahiniya', 'حلاوة طحينية', '30 g', 160, 4, 15, 9.5, 'halva halawa'),
  egypt('Canned tuna in water', 'تونة مياه', '1 can drained · 120 g', 130, 29, 0, 1, 'tuna'),
  egypt('Canned tuna in oil', 'تونة زيت', '1 can drained · 120 g', 240, 30, 0, 13, 'tuna'),
  egypt('Dates', 'بلح', '3 dates · 24 g', 70, 0.6, 18, 0, 'balah tamr'),
  egypt('Guava', 'جوافة', '1 medium · 100 g', 68, 2.6, 14, 1, 'gawafa'),
  egypt('Mango', 'مانجو', '1 cup · 165 g', 99, 1.4, 25, 0.6, 'manga'),
  egypt('Sugarcane juice', 'عصير قصب', '1 glass · 250 ml', 180, 0, 45, 0, 'asab'),
  egypt('Sahlab', 'سحلب', '1 cup · 250 ml', 230, 8, 35, 7, 'sahlep'),
  egypt('Tea with sugar', 'شاي بسكر', '1 cup · 2 tsp sugar', 32, 0, 8, 0, 'shai chai'),
  egypt('Basbousa', 'بسبوسة', '1 piece · 60 g', 230, 3, 35, 9, 'basbosa'),
  egypt('Konafa', 'كنافة', '1 piece · 80 g', 300, 4, 38, 15, 'kunafa kanafeh'),
  egypt('Om Ali', 'أم علي', '1 bowl · 200 g', 450, 10, 50, 23, 'umm ali'),
];

export const ALL_FOODS = [...FOODS.map(food => ({ ...food, source: 'Typical values' })), ...EGYPT_FOODS];

const plain = text => String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ’']/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');

// Every word of the query must appear in the name, Arabic name or alternative spellings.
export function searchFoods(list, query) {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter(food => {
    const text = plain(`${food.name} ${food.ar || ''} ${food.tags || ''}`);
    return words.every(word => text.includes(word));
  });
}

export const validBarcode = code => /^\d{8,14}$/.test(String(code || '').trim());

const num = value => (value != null && value !== '' && Number.isFinite(Number(value)) ? Math.round(Number(value) * 10) / 10 : null);

// Open Food Facts product → a food ready for review. Per serving when the label
// gives one, otherwise per 100 g / 100 ml. Missing values stay empty, never zero.
export function productToFood(json, code) {
  const product = json?.status === 1 || json?.product ? json.product : null;
  if (!product) return null;
  const n = product.nutriments || {};
  const servingKcal = n['energy-kcal_serving'] ?? (n.energy_serving ? n.energy_serving / 4.184 : undefined);
  const perServing = servingKcal != null && Boolean(product.serving_size);
  const pick = key => num(perServing ? n[`${key}_serving`] : n[`${key}_100g`]);
  const kcal = num(perServing ? servingKcal : n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : undefined));
  const brand = product.brands?.split(',')[0]?.trim(), title = (product.product_name || product.generic_name || '').trim();
  const name = brand && title.toLowerCase().includes(brand.toLowerCase()) ? title : [brand, title].filter(Boolean).join(' · ');
  if (!name && kcal == null) return null;
  const unit = /\d\s*(ml|cl|l)\b/i.test(product.quantity || '') ? '100 ml' : '100 g';
  return {
    name: (name || `Product ${code}`).slice(0, 120),
    portion: perServing ? String(product.serving_size).slice(0, 60) : unit,
    kcal: kcal == null ? '' : Math.round(kcal),
    p: pick('proteins') ?? '',
    c: pick('carbohydrates') ?? '',
    f: pick('fat') ?? '',
    barcode: code,
    source: 'Open Food Facts',
  };
}

export async function lookupBarcode(code, { signal } = {}) {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,generic_name,brands,quantity,serving_size,nutriments`, { signal, headers: { Accept: 'application/json' } }).catch(error => { if (error.name === 'AbortError') throw error; throw new Error('The food database couldn’t be reached. Check your connection and try again.'); });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('The food database didn’t respond. Check your connection and try again.');
  return productToFood(await response.json(), code);
}
