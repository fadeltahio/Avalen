# Building Avalen for the App Store

## Server
The iPhone app talks to an Avalen server at a public `https://` address.
- `AVALEN_PUBLIC_URL` — the server's public address, for example `https://api.example.com`.
- `AVALEN_SECURE_COOKIE=true` — sign-in cookies over HTTPS only.
- `AVALEN_COACH_SIGNUP` — `on` (default) lets any coach create an account and get a coach code; `off` for a single-coach service.
- `ffprobe` and `ffmpeg` must be installed for video and voice uploads.
- Keep `AVALEN_DATA_DIR` on persistent, backed-up storage.

## Accounts
- Coaches create an account in the app and get a six-character coach code (shown under More).
- Clients choose "I have a coach code", enter it, and join that coach's workspace.
- A coach can replace their code; clients who already joined stay connected.
- Invitation links and the original single-owner setup still work.

## iPhone build
```
VITE_AVALEN_API_URL=https://api.example.com pnpm build
pnpm exec cap sync ios
```
Then open `ios/App/App.xcodeproj` in Xcode, choose your team under Signing, set the final bundle ID,
and use Product → Archive to upload to TestFlight. Without `VITE_AVALEN_API_URL` the app opens the
on-device demo instead.

Already set in the project: app icon and launch screen, camera / photo library / microphone
messages in English and Arabic, iPhone only, portrait, and the export-compliance answer (no
non-exempt encryption).

## Pilot build: what the iPhone app hides
The iPhone app (detected by Capacitor's `window.Capacitor.isNativePlatform()`) hides what
it doesn't support yet; the code stays in place (`src/avalen/features.js`):
- wearable connections and automatic sync (Apple Health, Health Connect, WHOOP, Google
  Health) and the demo's sample readings from them. Readings entered by hand still work.
- online payment with Paymob (the coach's Paymob card and the client's checkout).
  Payment requests and payments recorded by the coach still work.

Switch either back on for a later build with `VITE_AVALEN_WEARABLE_SYNC=on` or
`VITE_AVALEN_ONLINE_PAYMENTS=on`. The web app is unchanged. `tests/ios-pilot.spec.js`
checks both states.

## Native HTTP and record comparison
In the iPhone app, sign-in, saves and actions go through Capacitor's native HTTP layer,
which returns JSON replies with object keys reordered (GET requests pass through
unchanged). Record comparisons therefore compare data, not key order
(`src/avalen/ecosystem/canonical.js`). `tests/native-ordering.test.js` replays replies the
way iOS rebuilds them; keep it passing when changing how saves are compared.
