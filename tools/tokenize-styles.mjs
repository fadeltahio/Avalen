// One-time mechanical consolidation of the active palette; archived CSS is untouched.
import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('../src/avalen/avalen.css', import.meta.url);
let css = readFileSync(path, 'utf8');
css = css.replace(/font-family:\s*Inter,[\s\S]*?sans-serif;/, 'font-family: var(--font-sans);');
css = css.replace(/^  --(?:bg|card|line|muted|green|blue|amber|purple|red):.*\n/gm, '');
css = css.replace('  color-scheme: dark;\n', '');
css = css.replace(/(?<![-\w])color: (#[a-f\d]{6});/gi, (whole, hex) => {
  const value = hex.toLowerCase();
  if (['#101613', '#09130d'].includes(value)) return 'color: var(--on-primary);';
  if (value === '#ed8290') return 'color: var(--red);';
  const channels = value.slice(1).match(/../g).map(v => parseInt(v, 16));
  return `color: var(--${Math.min(...channels) >= 190 ? 'text' : 'muted'});`;
});
const values = {
  '#0c1010': 'var(--bg)', '#0c1110': 'var(--surface-inset)',
  '#131917': 'var(--surface-inset)', '#111916': 'var(--card)',
  '#0b120e': 'var(--surface-inset)', '#ffffff04': 'var(--surface-soft)',
  '#ffffff02': 'var(--surface-soft)', '#ffffff08': 'var(--surface-raised)',
  '#ffffff17': 'var(--line)', '#ffffff20': 'var(--line)',
};
for (const [value, token] of Object.entries(values)) css = css.replace(new RegExp(value + '(?![a-f0-9])', 'gi'), token);
// Gradients/photographic overlays are deliberately handled separately in refinements.
css = css.replace(/transition:\s*background-color 0\.18s,\s*border-color 0\.18s,\s*opacity 0\.18s;/, 'transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);');
css = css.replace('filter: brightness(1.08);', 'opacity: .9;');
css = css.replace('filter: brightness(0.9);', 'transform: scale(.985);');
writeFileSync(path, css);
