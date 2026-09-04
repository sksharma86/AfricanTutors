# Operation Dumbo Drop — capture notes

## Approach
Short independent Playwright scenes (1920×1080, 30 fps), then ffmpeg concat to a silent master.
No single 10–11 minute browser recording.
No AI narration. No copyrighted music in the master.

## How to reproduce
1. `STUDY_HALL_FILM=1 npx next dev --port 3460`
2. `FILM_BASE_URL=http://localhost:3460 node film/capture.mjs` (or `node film/capture.mjs 05` for one scene)
3. `node film/assemble.mjs`

Must use `localhost`, not `127.0.0.1` — Next blocked client JS on 127.0.0.1 in this environment, which prevented booking hydration.

## Demo / fixture strategy
- Public marketing pages: real local app, no login.
- Parent / Guide / Management film surfaces: existing visual-review fixtures (`parentHomeVisualFixture`, `guideHomeVisualFixture`, `managementHomeVisualFixture`) composed on `/film/*`.
- Booking: display-only `FilmBooking` storyboard. No slot, checkout, or booking writes.
- Session chrome: presentational. No Daily iframe, no Call Parent POST.
- Finance / Guides / Customers: presentational fixture names and figures. No ledger, approve, or payout actions.
- Gate: `assertFilmCapture()` 404s unless `STUDY_HALL_FILM=1`. Blocked in `NODE_ENV=production` unless an explicit override is set.
- Film routes are `noindex`.

## What was not done
- No production users created.
- No demo-DB writes (`DEMO_DB_LOCK` respected).
- No password entry recorded.
- No real Daily Study Hall staged.
- No fabricated dual-participant live video.

## Scene 08 / 14 screenshot limitation
Approved real controlled-session screenshots of Guide + child together in a Daily room were **not available**.

Used instead:
- `/workspace/public/images/student-tutoring-session.jpg`
- `/workspace/public/images/tutor-portrait.jpg`
- `/workspace/public/images/marketing/studyhall-hero-desk.webp`
- Film session chrome stills (`/film/session`, `/film/session-call`)

If the owner has approved dual-participant session stills, recapture 08 and 14 with those files.

## Security
- Fixture first names only (Jordan, Sarah, Priya, Maya, Ethan, etc.).
- No emails, phones, auth secrets, or customer IDs on screen.
- Guide report is filled visually and is not submitted.
- Credentials never appear in source, video, or artifacts.

## Known capture issues
- First booking pass on 127.0.0.1 showed a white frame (no hydration). Fixed with localhost + `data-film-next` after `useEffect`.
- Playwright `recordVideo` includes navigation. Capture now prepares the page, then trims the load.
- Next.js dev badge hidden via `devIndicators: false` and CSS.
- `Object.keys` listed scenes 10–15 before 01–09 (integer-like keys). Capture now uses an explicit order array.
- `networkidle` can hang under Next HMR. Capture waits for `load`, then a short networkidle timeout.
- Writing large videos directly to `/opt/cursor/artifacts` hit store I/O errors. Recapture used `FILM_OUT=/tmp/operation-dumbo-drop`, then copied the finished package.
- Parent Home compared fixture August times to the real clock and showed “ended.” Film-only: `parent.next` is shifted ~22 hours forward. Not a product change.

## Recapture recommendations
- Scene 08 / 14 if approved Guide+child Daily stills become available.
- Scene 05 if you want closer to the 50s target (currently 41.5s).
- Scene 12 if you want a longer finance hold (currently 33.9s).
- Scene 04 if 11:14 PM as “next Study Hall” feels too late; shift the film-only offset.
