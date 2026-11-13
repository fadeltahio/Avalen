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
