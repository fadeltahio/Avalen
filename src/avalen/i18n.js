// Translations. English text is the key, so source code stays readable and the
// Arabic file reads as a side-by-side list. A missing translation falls back to
// English. Plural strings map to an object of Intl.PluralRules categories
// (Arabic uses zero, one, two, few, many and other).
import { createElement } from 'react';
import ar from './locales/ar.js';
import en from './locales/en.js';
import arAliases, { termsFor as arTerms } from './locales/ar/search-aliases.js';

export const LANGUAGES = {
  en: { name: 'English', dir: 'ltr', locale: 'en' },
  // Arabic with Western digits and the Gregorian calendar.
  ar: { name: 'العربية', dir: 'rtl', locale: 'ar-u-nu-latn-ca-gregory' },
};
const DICTIONARIES = { en, ar };
const SEARCH_ALIASES = { en: {}, ar: arAliases };
const SEARCH_TERMS = { en: () => [], ar: arTerms };
export const STORAGE_KEY = 'avalen.language';

export function detectLanguage(saved, browser) {
  if (LANGUAGES[saved]) return saved;
  return String(browser || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}
function initial() {
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
  return detectLanguage(saved, typeof navigator === 'undefined' ? '' : navigator.language);
}
let current = typeof window === 'undefined' ? 'en' : initial();

export const language = () => current;
export const direction = () => LANGUAGES[current].dir;
export const locale = () => LANGUAGES[current].locale;

export function applyLanguage(lang = current) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = LANGUAGES[lang].dir;
}
// Changing language reloads, so every screen and cached string is rebuilt cleanly.
export function setLanguage(lang) {
  if (!LANGUAGES[lang] || lang === current) return;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  location.reload();
}
// For tests.
export function useLanguageForTests(lang) { current = LANGUAGES[lang] ? lang : 'en'; }

// In right-to-left text each value is a first-strong isolate (FSI … PDI): numbers
// and units such as "91%" keep their order, and an Arabic name stays right-to-left.
// Built-in names passed into a sentence (an exercise, a meal slot, a workout) are
// translated too; anything else, such as a coach's own text, is shown as written.
const known = (value) => (typeof value === 'string' && current !== 'en' && typeof DICTIONARIES[current][value] === 'string' ? DICTIONARIES[current][value] : value);
const fill = (text, vars, rtl) => String(text).replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : rtl ? `\u2068${known(vars[name])}\u2069` : known(vars[name])));
const plurals = {};
function pick(entry, count, lang) {
  if (typeof entry === 'string') return entry;
  const rules = (plurals[lang] ||= new Intl.PluralRules(LANGUAGES[lang].locale));
  // Arabic speakers write 0 with the "zero" form when one exists.
  const category = count === 0 && entry.zero ? 'zero' : rules.select(Number(count) || 0);
  return entry[category] ?? entry.other;
}
export function t(key, vars = {}) {
  if (typeof key !== 'string') return key; // numbers, elements and empty values pass through
  const entry = DICTIONARIES[current][key] ?? (current === 'en' ? undefined : en[key]) ?? key;
  const text = typeof entry === 'string' ? entry : pick(entry, vars.count, DICTIONARIES[current][key] ? current : 'en');
  return fill(text, { ...vars, count: vars.count === undefined ? undefined : formatNumber(vars.count) }, LANGUAGES[current].dir === 'rtl');
}

// The translation of an exact English string, or null (used by the screen safety net).
export function translateExact(text) {
  const entry = DICTIONARIES[current][text];
  return typeof entry === 'string' ? entry : null;
}

// Search: lower case, no accents, no Arabic vowel marks or tatweel, and one form of
// alef, teh marbuta and alef maqsura, so "أ" finds "ا" and "ة" finds "ه".
export const plainSearch = (text) => String(text ?? '').toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640’']/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
// A name as it can be searched: the stored name, its translation and any aliases.
export function searchableName(name) {
  if (typeof name !== 'string') return '';
  return [name, current === 'en' ? null : translateExact(name), ...(SEARCH_ALIASES[current][name] || []), ...SEARCH_TERMS[current](name)].filter(Boolean).join(' ');
}
// True when every word of the query appears in one of the names, in any language.
export function matchesSearch(query, names) {
  const words = plainSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = plainSearch(names.map(searchableName).join(' '));
  return words.every((word) => haystack.includes(word));
}

export function formatNumber(value, options) {
  return new Intl.NumberFormat(locale(), options).format(value);
}
export function formatDate(value, options = { day: 'numeric', month: 'short' }) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(locale(), options).format(date);
}

// Renders "\n" in a translation as a line break.
export function lines(text) {
  return String(text).split('\n').flatMap((part, i) => (i ? [createElement('br', { key: `br${i}` }), part] : [part]));
}

// Plain toLocaleString() follows the phone's region, which can mean Eastern Arabic
// digits. Without an explicit locale, numbers and dates follow the app language.
if (typeof window !== 'undefined' && !Number.prototype.toLocaleString.avalen) {
  const wrap = (proto, name) => {
    const original = proto[name];
    const patched = function (loc, options) { return original.call(this, loc ?? locale(), options); };
    patched.avalen = true;
    proto[name] = patched;
  };
  wrap(Number.prototype, 'toLocaleString');
  for (const name of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) wrap(Date.prototype, name);
}
