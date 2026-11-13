// Safety net for translation: in a non-English language, any text or label on
// screen that exactly matches a known English string (an exercise name, a tab, a
// built-in meal slot) is shown in that language. Sentences are translated in code
// with t(); this only catches built-in names drawn directly from data.
import { language, translateExact } from './i18n.js';

const ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'];
const LATIN = /[A-Za-z]/;

const SKIP = 'script,style,code,textarea,[data-no-translate]';

function translateText(node) {
  const value = node.nodeValue;
  if (!value || !LATIN.test(value) || node.parentElement?.closest(SKIP)) return;
  const trimmed = value.trim();
  const translated = translateExact(trimmed);
  if (!translated || translated === trimmed) return;
  // An <option> without a value submits its text: keep the English value so a
  // translated label never changes what is saved ("Breakfast", not "الفطور").
  const option = node.parentElement?.closest('option');
  if (option && !option.hasAttribute('value')) option.setAttribute('value', option.textContent);
  node.nodeValue = value.replace(trimmed, translated);
}
function translateElement(el) {
  for (const name of ATTRIBUTES) {
    const value = el.getAttribute?.(name);
    if (value && LATIN.test(value)) {
      const translated = translateExact(value.trim());
      if (translated && translated !== value.trim()) el.setAttribute(name, translated);
    }
  }
}
function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root);
  if (root.nodeType !== Node.ELEMENT_NODE || root.closest?.(SKIP)) return;
  translateElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) translateText(node);
    else if (!node.closest(SKIP)) translateElement(node);
  }
}

export function startDomTranslation(root = document.body) {
  if (language() === 'en' || typeof MutationObserver === 'undefined') return () => {};
  translateTree(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') translateText(record.target);
      else if (record.type === 'attributes') translateElement(record.target);
      else record.addedNodes.forEach(translateTree);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
  return () => observer.disconnect();
}
