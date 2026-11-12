# Avalen functional review

27 October 2026. Scope: the current client and coach web app, device preview and authenticated connected accounts. This continues the premium and signature-flow reviews.

## Assessment

The main coaching journeys are implemented. This review found real gaps in secondary saves, travel-session navigation and authenticated session bookmarks, and repaired them. Avalen still needs a deployment and account-lifecycle pass before a public beta. Browser checks do not establish physical iPhone behavior or App Store readiness.

At the 27 October inspection, the local device preview ran on port 5173 and the connected service responded on port 5180, but its owner account was not set up. This historical observation does not establish that either process is currently running. The next step for a real pilot is creating the owner’s own credentials, then inviting a test client. Automated account checks use separate temporary services and do not configure the user’s owner account.

## Problems repaired

| Action | Previous behavior | Current behavior |
| --- | --- | --- |
| Save session star in a connected client account | The server rejected the personal bookmark as a coach-managed plan change; bookmarks were also omitted from the client projection. | Clients can save/unsave their own session IDs and find them through Saved sessions after reload. Input is bounded and validated; programme changes and other profiles remain protected. |
| Travel workout → Session details | The route looked only in regular programme days, so a travel session could leave the current screen in place. | Details resolve the actual prescription for the chosen date. Upcoming cards also respect the travel plan. |
| Save profile | The editor closed before save acknowledgement, including after a failed save. | Keeps edited values and an inline retryable error; closes after success. Fields and dismissal are guarded while saving. |
| Save manual wearable readings / preferred device | Dialogs closed or displayed success even when the change failed. | Retains inputs/preferences until a confirmed save. Manual readings remain labelled manual; choosing a device still does not establish a wearable connection. |
| Create client / assign programme | The dialog closed and navigation continued before persistence succeeded. | The reviewed form remains open on failure and is guarded while saving. Client creation navigates only after acknowledgement. |
| Save brand / membership / habit targets | Success text could appear when records had not changed. | Success appears only after persistence; failed input stays available and duplicate submission is guarded. |
| Save verified report measurements | Inputs cleared and success appeared even if the write failed. | The form retains all verified readings on failure and clears them after confirmation. |
| Add PDF/image report | File bytes could be prepared but the report entry could fail without a working retry. | The prepared file is retained in the open view with Retry adding report. Repeated metadata saves use the same record ID. |
| Create custom exercise | A failed library save could still close the form and add the movement to a programme draft. | The library save must succeed before the movement is added to the draft. |
| Account-service outage | Users were told to retry while Sign in remained disabled, with no retry action. | Retry connection rechecks availability without clearing typed account details. |
| Sign out during a connection failure | The request could fail without visible feedback. | Displays an explicit failure and permits retry; other account actions and dismissal are guarded while busy. |
| Connected-account explanations | Some labels incorrectly described connected clients, files and branding as device-only. Welcome privacy also referred to a nonexistent clear-workspace action. | These explanations now match the active mode; fresh test profiles are correctly described as preserving existing records. |

The shared form-save helper handles persistence acknowledgement and repeated submission. Changes preserve the current visual design and existing records.

## What still needs doing

| Priority | Finding | Recommended next work |
| --- | --- | --- |
| Before public beta | Connected mode defaults to the service only on port 5180 or with `?connected=1`. A normal HTTPS deployment on port 443, or a home-screen launch using the current manifest’s `/` start URL, can open device preview instead. | Make deployment mode explicit in server-delivered configuration. Verify the public root URL, invitation URL, sign-out return and installed-app relaunch all open authenticated mode. Keep the preview an explicit option. |
| Before public beta | No self-service forgotten-password, password-change, login-email-change or account-deletion flow is implemented. Profile email edits update coaching contact details, not authentication credentials. | Define the account lifecycle and recovery method. Label contact email clearly. Add authenticated credential management, session revocation and the chosen account removal/export flow with recovery tests. |
| Before public beta | The connected service exists, but this workspace is not a deployed, monitored service with verified recovery. | Configure HTTPS, secure cookies, persistent private storage and process supervision. Exercise restoring both the database and media from backups, then run the coach/client checks against the actual deployment. |
| Next usability pass | The client list includes Paused and the review engine understands a coaching pause, but no client pause/resume control is exposed. Membership status is a separate field. | Add an explicit Pause coaching / Resume coaching action with clear effects on reminders and review queues, or remove the unreachable filter until that flow exists. Do not silently equate billing status with coaching state. |
| Next usability pass | Train contains a Nutrition tab in addition to the main Nutrition navigation item. The client calendar strip also lacks a persistent visible month/year label. | Keep a single primary nutrition destination, or explain the cross-link. Add the selected month/year above the date strip, especially around month changes. |
| Physical device check | Simulated viewport and WebKit tests cannot confirm the actual iPhone keyboard, camera, microphone, permission prompts, touch response or returning after backgrounding. | Walk through one workout, one meal photo, one voice check-in and one form-video review on a real iPhone, including locking/reopening during a rest timer and retrying after a network interruption. |
| Product scope decision | Wearable syncing, charging cards, external push/email delivery, food-photo recognition and PDF extraction are not live integrations. Some are intentionally deferred. | Pick only the services required for beta. Keep their manual or unavailable states clear until real end-to-end delivery is configured and tested. |
| Before App Store release | This is a web implementation with an install manifest; a native distribution and submission process is not implemented here. | Choose the native delivery approach, complete device and release review, and prepare the store assets and disclosures after the beta workflows are stable. |

## Suggested sequence

1. Resolve deployment mode and account recovery; establish a restorable connected staging service.
2. Finish coaching pause/resume and clarify contact versus sign-in email.
3. Run a small coach/client pilot on physical phones and fix observed friction.
4. Add the integrations the pilot actually needs, then prepare native distribution.

## Verification

The broad browser review and focused rerun were interrupted across environment restarts; their final reports were not retained. Do not treat this review as a completed browser release gate. The 1 November handoff checks passed all 52 unit/API tests and the production build; see `HANDOFF_VALIDATION.md`. Tests use isolated browser profiles, temporary service accounts and temporary databases. The user’s saved client records and media are not test fixtures.
