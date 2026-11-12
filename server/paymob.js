// Paymob: each coach connects their own merchant account, so money goes straight
// to the coach. Keys are sealed at rest and never leave the server. A payment is
// marked paid only by Paymob's server-to-server callback, signed with the coach's
// HMAC secret; the browser redirect after checkout changes nothing.
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGIONS, toMinor } from '../src/avalen/payments-model.js';
import { fail } from './permissions.js';

// Transaction processed callback: values from `obj`, in this order, concatenated.
// Source: Paymob's HMAC guide as quoted in Paymob's official integration skill
// (github.com/PaymobAccept) and the independent Paymob.Net SDK, which agree.
export const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id',
  'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
  'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan', 'source_data.sub_type',
  'source_data.type', 'success',
];
const pick = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
// Paymob does not document how a missing value is written; the empty string is what
// the reference implementations use. Booleans are written as true/false.
const asText = (value) => (value === null || value === undefined ? '' : String(value));
export function callbackHmac(obj, secret) {
  return createHmac('sha512', secret).update(HMAC_FIELDS.map((field) => asText(pick(obj, field))).join('')).digest('hex');
}
export function validCallback(obj, hmac, secret) {
  if (typeof hmac !== 'string' || !/^[0-9a-f]{128}$/i.test(hmac) || !obj || typeof obj !== 'object') return false;
  const given = Buffer.from(hmac.toLowerCase(), 'hex'), expected = Buffer.from(callbackHmac(obj, secret), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// AES-256-GCM with a server key: AVALEN_SECRETS_KEY (32 bytes, base64), or one
// generated once into the data folder, readable only by the server's user.
export function secretBox(root, configured = process.env.AVALEN_SECRETS_KEY) {
  let key;
  if (configured) {
    key = Buffer.from(configured, 'base64');
    if (key.length !== 32) throw new Error('AVALEN_SECRETS_KEY must be 32 random bytes, base64-encoded.');
  } else {
    const file = join(root, 'secrets.key');
    if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('base64'), { mode: 0o600, flag: 'wx' });
    key = Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
  }
  return {
    seal(value) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      const body = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
      return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64')).join('.');
    },
    open(sealed) {
      const [iv, tag, body] = String(sealed).split('.').map((part) => Buffer.from(part, 'base64'));
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    },
  };
}

const keyText = (value, label, min = 8) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min || text.length > 600 || /\s/.test(text)) fail(400, `Paste your Paymob ${label} exactly as shown in the Paymob dashboard.`);
  return text;
};
function integrationIds(value) {
  const list = (Array.isArray(value) ? value : String(value || '').split(/[\s,]+/)).filter((item) => item !== '').map(Number);
  if (!list.length || list.length > 10 || list.some((id) => !Number.isInteger(id) || id <= 0 || id > 1e12))
    fail(400, 'Add at least one Paymob integration ID (numbers, separated by commas).');
  return [...new Set(list)];
}
export const validPhone = (value) => typeof value === 'string' && /^\+?[0-9][0-9 ()-]{6,19}$/.test(value.trim());

export function paymobService({ db, root, fetchImpl = globalThis.fetch, publicUrl = process.env.AVALEN_PUBLIC_URL, secretsKey } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS payment_accounts(
    workspace_id TEXT PRIMARY KEY, region TEXT NOT NULL, public_key TEXT NOT NULL,
    secret_key TEXT NOT NULL, hmac_secret TEXT NOT NULL, integration_ids TEXT NOT NULL, connected_at TEXT NOT NULL)`);
  const box = secretBox(root, secretsKey ?? process.env.AVALEN_SECRETS_KEY);
  const base = publicUrl ? String(publicUrl).replace(/\/+$/, '') : '';
  const account = (workspace) => db.prepare('SELECT * FROM payment_accounts WHERE workspace_id=?').get(workspace);

  function status(workspace) {
    const row = account(workspace);
    const ready = Boolean(base);
    if (!row) return { connected: false, publicAddress: ready };
    return { connected: true, publicAddress: ready, region: row.region, currency: REGIONS[row.region].currency, publicKey: row.public_key, integrations: JSON.parse(row.integration_ids), connectedAt: row.connected_at };
  }
  function connect(workspace, input = {}) {
    if (!REGIONS[input.region]) fail(400, 'Choose the country your Paymob account is in.');
    const publicKey = keyText(input.publicKey, 'public key'), secretKey = keyText(input.secretKey, 'secret key'), hmacSecret = keyText(input.hmacSecret, 'HMAC secret');
    if (publicKey === secretKey) fail(400, 'The public key and the secret key are different values. Check both.');
    const ids = integrationIds(input.integrationIds);
    db.prepare('INSERT OR REPLACE INTO payment_accounts VALUES(?,?,?,?,?,?,?)')
      .run(workspace, input.region, publicKey, box.seal(secretKey), box.seal(hmacSecret), JSON.stringify(ids), new Date().toISOString());
    return status(workspace);
  }
  function disconnect(workspace) {
    db.prepare('DELETE FROM payment_accounts WHERE workspace_id=?').run(workspace);
    return status(workspace);
  }
  async function createIntention(workspace, { payment, client, reference, phone }) {
    const row = account(workspace);
    if (!row) fail(409, 'Your coach hasn’t connected Paymob yet.');
    if (!base) fail(503, 'Online payment isn’t available yet: the server’s public address isn’t set (AVALEN_PUBLIC_URL).');
    const region = REGIONS[row.region];
    if (payment.currency !== region.currency) fail(409, `This request is in ${payment.currency}, but your coach’s Paymob account takes ${region.currency}. Ask your coach to resend it.`);
    const amount = toMinor(payment.amount, payment.currency);
    const [first, ...rest] = String(client.name || 'Avalen client').trim().split(/\s+/);
    const body = {
      amount,
      currency: payment.currency,
      payment_methods: JSON.parse(row.integration_ids),
      items: [{ name: payment.label.slice(0, 50), amount, description: payment.label.slice(0, 120), quantity: 1 }],
      billing_data: {
        first_name: first, last_name: rest.join(' ') || first, email: client.email || 'NA', phone_number: phone.trim(),
        apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA', city: 'NA', state: 'NA', country: 'NA',
      },
      special_reference: reference,
      notification_url: `${base}/api/paymob/callback`,
      redirection_url: `${base}/api/paymob/return?payment=${encodeURIComponent(payment.id)}`,
      expiration: 3600,
    };
    let response;
    try {
      response = await fetchImpl(`${region.host}/v1/intention/`, {
        method: 'POST',
        headers: { Authorization: `Token ${box.open(row.secret_key)}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      fail(502, 'Paymob couldn’t be reached. Try again in a moment.');
    }
    const json = await response.json().catch(() => ({}));
    if (!response.ok || typeof json.client_secret !== 'string')
      fail(502, 'Paymob didn’t accept this payment. Your coach may need to check their Paymob settings.');
    return {
      url: `${region.host}/unifiedcheckout/?publicKey=${encodeURIComponent(row.public_key)}&clientSecret=${encodeURIComponent(json.client_secret)}`,
      intentionId: json.id ?? null,
      orderId: json.intention_order_id ?? null,
    };
  }
  function verify(workspace, obj, hmac) {
    const row = account(workspace);
    return Boolean(row) && validCallback(obj, hmac, box.open(row.hmac_secret));
  }
  return { status, connect, disconnect, createIntention, verify };
}

// What a verified callback means for the matching payment. Pure, so it can be tested.
// Returns the change to apply, or null when nothing should change.
export function settle(payment, obj, now = new Date().toISOString()) {
  const transactionId = obj.id == null ? null : String(obj.id);
  if (!transactionId) return null;
  if (payment.paymob?.transactionId === transactionId) return null; // retried callback
  const succeeded = obj.success === true && obj.pending === false && !obj.is_voided && !obj.is_refunded && !obj.error_occured;
  if (!succeeded) return { kind: 'failed', transactionId, at: now };
  if (Number(obj.amount_cents) !== toMinor(payment.amount, payment.currency) || obj.currency !== payment.currency)
    return { kind: 'mismatch', transactionId, at: now };
  return {
    kind: 'paid', transactionId, at: now,
    orderId: obj.order?.id == null ? null : String(obj.order.id),
    cardLast4: typeof obj.source_data?.pan === 'string' ? obj.source_data.pan.replace(/\D/g, '').slice(-4) || null : null,
    previousStatus: payment.status,
  };
}
