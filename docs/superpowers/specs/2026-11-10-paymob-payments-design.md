# Paymob payments — design

Date: 10 November 2026. Status: awaiting approval.

## Intent

Coaches in the MENA region get paid by their clients inside Avalen, and can see at a glance who has paid, who hasn't, and what they earned each month. Money goes straight from the client to the coach's own Paymob account. Avalen never holds or touches the money and takes no cut.

Why: getting paid is the most tedious part of running a coaching business (chasing transfers, checking screenshots, tracking months in a notebook). Doing it inside the app the client already uses daily is a reason for coaches to choose Avalen.

## Goals

- A coach connects their own Paymob account once.
- A coach requests a payment from a client (prefilled from the client's plan amount); the client pays in-app through Paymob's checkout.
- Paymob-confirmed payments mark themselves paid. The coach never has to check.
- A coach can also record cash, InstaPay, bank and wallet payments, so the monthly totals are complete.
- A coach sees, per month: earned, paid clients, unpaid clients (overdue ones first), and the last six months.
- A client sees what they owe, pays, and sees their history.

## Non-goals (this version)

- Avalen's own subscription for coaches (priced by client count). The user will give pricing later; this design leaves room for it but builds none of it.
- Automatic recurring charges (saved cards charged monthly). Each month is a request the client pays.
- Refunds from inside Avalen. Refunds happen in the Paymob dashboard; the coach can note them.
- Invoices/receipts as PDFs, VAT handling.

## Anti-goals (failure even if it works)

- A client can mark themselves paid, or a coach can fake a Paymob-confirmed payment.
- Paymob secret keys reach the browser, the workspace data, a log, or an export.
- The app says "Paid" before Paymob has confirmed it.
- A failed or abandoned checkout leaves a payment looking settled.

## Constraints

- Paymob payments only work in the connected (server) workspace with a public HTTPS address, because Paymob confirms payments by calling Avalen's server. In the on-device preview, coaches can still record manual payments and see the tracking; "Pay with Paymob" explains that it needs the connected workspace.
- Each Avalen server has one coach workspace (existing design), so one Paymob account per server.
- Keep the black-and-white editorial design, light theme, reduced motion, and the "success only after persistence" rule.
- App Store: guideline 3.1.3(d) lets fitness training use outside payment; asynchronous coaching may draw questions in review.

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| A. Each coach connects their own Paymob account | Money goes straight to the coach; no licensing; each coach needs a Paymob merchant account | **Chosen by the user** |
| B. One Avalen Paymob account, payouts to coaches | Platform revenue per payment; needs company registration, payouts, possibly a payment licence | Rejected: Avalen will charge coaches a subscription instead |

Within A, two ways to confirm a payment:

| Option | Trade-off | Decision |
|---|---|---|
| Trust the browser redirect after checkout | Simple, but the redirect's signature format is not confirmed in Paymob's docs, and a redirect can be faked | Rejected |
| Trust only Paymob's server-to-server callback, signed with the coach's HMAC secret | Needs a public HTTPS server; the field list is confirmed by Paymob's official integration skill and an independent SDK | **Chosen.** The redirect only brings the client back and shows "confirming…" until the callback lands |

## Design

### Data

Payments live in the workspace as `data.payments`, so they sync, revise and project to clients like every other record (a client only sees their own, through the existing projection).

```
{
  id, clientId,
  amount,            // major units, e.g. 2500 (EGP)
  currency,          // EGP | SAR | AED | OMR
  label,             // "November coaching"
  period,            // "2026-11", the month it counts toward
  dueDate,           // "2026-11-25"
  status,            // "due" | "paid" | "void"
  method,            // null | "paymob" | "cash" | "instapay" | "bank" | "wallet" | "other"
  verified,          // true only when Paymob confirmed it (server-set)
  paidAt, createdAt, note,
  paymob: { orderId, transactionId, cardLast4, attempts: [{ ref, at }] }
}
```

The Paymob connection is **not** in the workspace. A new server table holds it:

```
payment_accounts(workspace_id PK, region, public_key, secret_key_enc, hmac_secret_enc,
                 integration_ids, connected_at)
```

Secret key and HMAC secret are encrypted at rest (AES-256-GCM) with a server key from `AVALEN_SECRETS_KEY`, or, if unset, a key generated once into the data folder with owner-only permissions. The browser only ever learns `{ connected, region, publicKey, integrations, connectedAt }`.

### Who may change what (server, `mergeEdit`)

- Client: cannot change `payments` at all.
- Coach: may add `due` requests and manual `paid` records (`verified: false`); may mark a `due` request paid manually or void it; may add a note. Cannot delete payments (void instead), cannot set `verified`, cannot change any record that has `verified: true` or a Paymob transaction.
- Server (Paymob callback): the only writer of `verified: true`, `method: "paymob"` and `paymob.transactionId`.

### Server endpoints

- `GET /api/payments/account` (coach): connection status, no secrets.
- `PUT /api/payments/account` (coach): connect or replace — region, public key, secret key, HMAC secret, integration IDs. `DELETE` disconnects.
- `POST /api/payments/:id/checkout` (the client the payment belongs to): checks it is `due`, creates a Paymob intention (`POST {region}/v1/intention/`, `Authorization: Token <secret>`, amount in minor units, `special_reference` = `<paymentId>.<attempt>`, `notification_url` = `/api/paymob/callback`, `redirection_url` = `/api/paymob/return`), records the attempt, returns the unified checkout URL `{region}/unifiedcheckout/?publicKey=…&clientSecret=…`.
- `POST /api/paymob/callback` (Paymob, no login): handled before the app-only request check. Verifies `?hmac=` as HMAC-SHA512 (lowercase hex, constant-time compare) over `obj` fields in this order: `amount_cents, created_at, currency, error_occured, has_parent_transaction, id, integration_id, is_3d_secure, is_auth, is_capture, is_refunded, is_standalone_payment, is_voided, order.id, owner, pending, source_data.pan, source_data.sub_type, source_data.type, success` (booleans as `true`/`false`). Then matches `merchant_order_id` to a recorded attempt, checks amount and currency, and only if `success && !pending && !is_voided && !is_refunded` marks the payment paid and verified. Idempotent on the transaction ID. Always answers 200 to a valid signature so Paymob stops retrying; 401 on a bad one.
- `GET /api/paymob/return` (browser): changes nothing; redirects to `#/client/you?tab=Payments&returned=<paymentId>`.

Region base URLs: Egypt `accept.paymob.com`, Saudi Arabia `ksa.paymob.com`, UAE `uae.paymob.com`, Oman `oman.paymob.com`. Minor units: 100 for EGP/SAR/AED, 1000 for OMR. A public base URL comes from `AVALEN_PUBLIC_URL`; without it, checkout refuses with a clear message.

### Coach experience (Business → Payments)

- **This month**: earned (paid this period), outstanding, and counts of paid and unpaid clients.
- **Six-month bars** of earnings.
- **Clients this month**: each active client with one state: Paid (method, date, "Confirmed by Paymob" or "Recorded by you"), Due, Overdue (past due date), or No request yet. Overdue first.
- Actions: Request payment (prefilled amount from the client's plan, label, due date), Record a payment (cash, InstaPay, bank, wallet, other), Mark paid, Void.
- **Paymob connection** card: connect form with plain guidance on where each key is in the Paymob dashboard; status once connected.
- The existing subscription records stay; the plan amount and next date feed the request form.

### Client experience (More → Payments, plus a Home notice when something is due)

- What's due, with amount, label and due date, and **Pay with Paymob** (card or wallet, whatever the coach enabled).
- After checkout: "Confirming your payment…" until Paymob's callback arrives (live refresh), then a drawn check and "Paid". If it doesn't arrive within about a minute: "Paymob is still confirming. Your coach will see it as soon as it does."
- History of paid payments, with "Confirmed by Paymob" or "Recorded by your coach".

### Avalen assistant

The coach's "Any payments overdue?" answer uses the new records (falling back to the old subscription status where there are none).

## Testing

- Unit: HMAC verification against a known vector, minor-unit conversion (including OMR), monthly summary, who-may-change-what guards.
- Server: connect account (secrets never in responses or workspace), checkout creates an intention (Paymob mocked), signed callback marks paid exactly once, bad signature rejected, mismatched amount ignored, client cannot self-mark paid, coach cannot alter a verified payment.
- Browser: coach requests and records payments, monthly view, client sees due and history; on-device preview shows the "needs connected workspace" path.
- Real end-to-end with Paymob test keys through a temporary public link once the user has a Paymob account.

## Calls made in this design (check these)

- **Monthly requests are one tap, not automatic.** The coach sees "Request this month from everyone without one" (each prefilled from that client's plan) plus per-client requests. No request is created without the coach pressing it.
- **Phone number at first payment.** Paymob requires a phone number for checkout. If the client has none on file, checkout asks for it once and saves it to their profile (clients may edit their own phone).
- **Currency follows the coach's Paymob region** (EGP, SAR, AED, OMR). A request in another currency can be recorded manually but not paid through Paymob.
- **Manual payments count fully** toward monthly earnings, labelled "Recorded by you" so the coach can tell them apart.

## Open points for the build (builder's calls)

- How null values serialise in the HMAC string is not documented; accept the empty-string form, and log a mismatch for review during the first real test payment.
- `foundations()` adds an empty `payments` list to older workspaces.
- The Paymob callback writes through the existing `commit` path as a system writer, so revisions, history and connected clients update as usual.
- After returning from checkout, the client app refreshes the connected workspace every few seconds for up to a minute.
- Exact copy and layout within the existing design system.
