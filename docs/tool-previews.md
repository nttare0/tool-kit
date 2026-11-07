# Tool screenshot fallback

Public tool cards and detail previews use a saved asset (if present), Microlink,
Thum.io, and WordPress mShots. The generated requests strip website credentials,
queries, and fragments. Screenshot providers receive the public origin/path and
may log it; image requests set `referrerPolicy=no-referrer`.

The loader starts near the viewport, starts a backup after 2.5 seconds, and shows
the first successful image. A slow primary remains eligible to win. Errors or
images smaller than 16 pixels advance immediately. Each attempt has a 7-second
limit, with at most four attempts per card (saved asset plus three services).
Outstanding timers/image handlers are cleaned up on success or unmount. Browser
request cancellation remains best-effort. Successful source URLs are prioritized
in a bounded, in-memory cache (up to 300 entries); no browser storage is written.

A local branded tool/name/category placeholder is always available if the
services fail. It is not represented as a screenshot. Retry clears the successful
source preference for that tool. Rate limits, anti-bot restrictions, and provider
placeholder images can still prevent a real screenshot. Free third-party
services have no availability guarantee; automated tests use mocked images and
do not claim live vendor verification.

```sh
node --experimental-strip-types artifacts/toolstack/tests/tool-previews.mjs
pnpm run typecheck
pnpm --filter @workspace/toolstack run build
```
