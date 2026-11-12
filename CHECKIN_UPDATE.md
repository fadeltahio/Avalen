# Client-specific check-ins

Coaches configure check-ins under **Clients → client → Check-ins → Check-in settings**. The same settings are available when reviewing that client from the inbox.

- Select measurements (weight, waist, body fat, chest, hips), sleep duration, reflection ratings, written answers and progress photos.
- Add custom number, rating or text questions. Numeric questions support a unit and range.
- Set included fields as required or optional. The default short form starts with weight, waist and body fat, followed by sleep, energy and a note.
- Set a first due date and repeat interval of 1–365 days. After a submission, the next date is its date plus the interval, never earlier than the configured first date.
- Configuration drafts are saved separately; changes apply only after Save check-in plan.

Clients see the schedule, requested form, submission history and trends. Due check-ins also appear on Home. Coach dashboard flags use each client's cadence rather than a fixed seven-day threshold.

Graphs offer metric selection, 30-day/90-day/all-time periods, latest value, change, entry count and a table of recorded values. Measurements from earlier progress logs are included and labelled. Check-in readings take precedence for a shared date. The horizontal axis uses elapsed time, and pointer/keyboard exploration exposes dates and values. Missing values never become zero. Separate numeric units remain separate series.

Each submitted check-in stores the actual question definitions alongside its answers. Future template changes do not rewrite old submissions. Legacy reflection check-ins remain reviewable. Submitted body measurements also update that client's measurement record for the day; correcting today's check-in updates that record instead of creating another one. Unrelated measurement fields are preserved. Existing feedback and review-to-message behaviour remain.

The existing browser workspace and media storage are reused. No records are reset and no external services have been added.

Validation: unit coverage for cadence, target-client isolation, measurement corrections, optional values, original questions, unit separation and required answers; Chrome and WebKit coverage for settings, submission, editing, feedback, photos, persistence, mobile/desktop layout and irregular-time graph exploration. Screenshot review: `output/checkin-update/index.html`.
