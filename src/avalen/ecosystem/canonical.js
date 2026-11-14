// JSON text with every object's keys in sorted order. Two values holding the same data
// produce the same text whatever order their keys arrived in.
//
// JSON objects have no defined key order, and the iPhone app's native HTTP layer
// (Capacitor) rebuilds server replies to sign-in and saves with keys reordered. Any
// "is this the same record?" check must therefore compare data, not key order, or every
// save after sign-in looks like a conflict. Everything else matches JSON.stringify:
// undefined and functions are left out of objects and become null in arrays, toJSON is
// honoured, and a top-level undefined gives undefined.
export function canonicalJson(value) {
  if (value && typeof value.toJSON === "function") value = value.toJSON();
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    let out = "[";
    for (let i = 0; i < value.length; i++) out += (i ? "," : "") + (canonicalJson(value[i]) ?? "null");
    return `${out}]`;
  }
  let out = "{", first = true;
  for (const key of Object.keys(value).sort()) {
    const text = canonicalJson(value[key]);
    if (text === undefined) continue;
    out += `${first ? "" : ","}${JSON.stringify(key)}:${text}`;
    first = false;
  }
  return `${out}}`;
}

// True when a and b would serialise to the same JSON apart from key order. It compares
// structurally and stops at the first difference, so it is much cheaper than building
// canonical text for large workspaces.
const asJson = (value) => (value && typeof value.toJSON === "function" ? value.toJSON() : value);
const omitted = (value) => value === undefined || typeof value === "function" || typeof value === "symbol";
export function sameData(a, b) {
  a = asJson(a);
  b = asJson(b);
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return JSON.stringify(a) === JSON.stringify(b);
  const list = Array.isArray(a);
  if (list !== Array.isArray(b)) return false;
  if (list) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameData(omitted(a[i]) ? null : a[i], omitted(b[i]) ? null : b[i])) return false;
    return true;
  }
  let keys = 0;
  for (const key of Object.keys(a)) {
    if (omitted(a[key])) continue;
    keys++;
    if (!Object.hasOwn(b, key) || omitted(b[key]) || !sameData(a[key], b[key])) return false;
  }
  for (const key of Object.keys(b)) if (!omitted(b[key])) keys--;
  return keys === 0;
}
