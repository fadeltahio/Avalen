// Finds every literal key passed to t('...') in the app source.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? (name === "locales" ? [] : walk(path)) : /\.(jsx?|mjs)$/.test(name) ? [path] : [];
});
const LITERAL = /(?<![\w.$])t\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const unescape = (text) => text.replace(/\\n/g, "\n").replace(/\\(['"`\\])/g, "$1");

export function usedKeys(root = "src/avalen") {
  const keys = new Map();
  for (const file of walk(root)) {
    for (const match of readFileSync(file, "utf8").matchAll(LITERAL)) {
      if (match[1] === "`" && match[2].includes("${")) continue;
      const key = unescape(match[2]);
      if (!keys.has(key)) keys.set(key, file);
    }
  }
  return keys;
}
