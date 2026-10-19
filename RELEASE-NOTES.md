# BiteWindow v0.8 — changes and validation

Prepared October 19, 2026 from main commit `95402302bb5ab98c2db3bdd41ff5eeb526020838`. Changes were developed locally on `v0.8-dynamic-forecast-alerts`. No remote branch, live deployment, paid service, public community endpoint, or push notification service was activated.

## Changes

- Shared relative-risk calculation drives the five requested headlines, supporting messages, compact score, gauge, classification, hourly forecast and recommendation. Contextual exposure explanations update immediately. Bug zappers receive no protective adjustment. The experimental heuristic remains unvalidated; model coefficients are not represented as product-effectiveness percentages.
- Restored focus to the selected hourly button and added its accessible pressed state. Corrected the recommendation's weather values to use its own hour. Weather/location updates now commit together only after successful validation and ignore superseded requests. Weather refreshes while the app is in use at a 30-minute interval.
- Alerts uses the selected location, resolves jurisdictions, displays dated official information, groups bordering-county entries, and provides expandable disease information and source links. Source dates, source retrieval and app refresh are distinguished. Unavailable and old data never become a no-risk claim.
- Daily GitHub Actions workflow retrieves and publishes public snapshots after parser and browser checks. No Cloudflare deployment or paid API key is required.
- Privacy wording discloses unpublished GitHub request text transmission, local export behavior, coordinate recipients and public snapshot caching. Disabled community submissions stay disabled. Original icon artwork, five destinations, sharing, feature requests, local reports, export and PWA manifest are retained.

## Automated verification

12 Python parser tests passed. These cover source dates; separation of advisory and alert county lists; local versus travel-associated cases; sentinel versus human evidence; combined confirmed/probable status; malformed, historical and future source rejection; CDC small-count ranges; latest report discovery; and county adjacency.

18 Chrome browser checks passed:

- Shared headline and gauge score; all five category boundaries.
- Every exposure control redraws immediately and uses the shared model.
- All five headline messages render through draw().
- Hourly keyboard focus and selected accessibility state.
- Sweet spot weather matches recommended hour.
- All five destinations hide unrelated sections.
- Mobile reflow at 320, 360, 390, 780 and 1100 pixels.
- Default county, local travel status and bordering counties.
- City search changes both forecast and health jurisdiction.
- Consented GPS shares one location with weather and alerts (mocked GPS service).
- Failed weather load preserves a coherent previous location and report grid.
- Overlapping location loads accept only the newest response.
- Unsupported international coverage never means no risk.
- Unavailable feed displays the required unavailable message.
- Stale official dates suppress activity cards.
- Submission gate remains closed; local reports and export remain available.
- No script errors, notification requests or persisted precise coordinates.
- PWA manifest and offline service-worker shell.

Mobile widths checked: 320, 360, 390, 780 and 1100 CSS pixels. Screenshots were visually reviewed. The service-worker/offline test used the `/BiteWindow/` subpath to exercise GitHub Pages-relative paths.

## Live retrieval

- fl-weekly: available; 107 public source entries. Reporting date: 2026-10-10. Source successfully retrieved: 2026-10-19T18:40:50.070478+00:00.
- cdc-dengue: available; 103 public source entries. Reporting date: 2026 year to date; precise surveillance as-of date is not supplied by this source. Source successfully retrieved: 2026-10-19T18:40:50.070478+00:00.

A separate browser run against the actual services loaded a weather score of 36 for GROVELAND, FLORIDA, resolved Lake County, Florida, United States, and showed 1 local source entry. It recorded 0 script errors. This score is a test-time observation, not a current forecast supplied with this report.

## Limits still requiring attention

- Physical Android Chrome and installed Android PWA testing was not available. Device emulation, manifest checks and real service-worker offline behavior passed; complete the phone checklist in DEPLOY.md.
- The GitHub Actions deployment itself has not run in your account. The package contains the workflow, but its first GitHub run and environment permissions must be verified before release.
- Automated health coverage is selected Florida surveillance narratives and advisories plus US CDC dengue county data. Florida PDF tables are not comprehensively ingested. There is no comprehensive national or worldwide multi-disease local-alert feed in this package. Other locations receive official links and unavailable states.
- CDC's exact surveillance as-of date is absent from the county CSV. The file modification date is labeled separately; suppressed small-count ranges remain ranges. Florida data older than 21 days and CDC source files older than 35 days are excluded from current activity cards.
- GPS reverse-geocoding responses were mocked in automated testing to avoid sending invented GPS fixes to BigDataCloud. The actual US county lookup and weather retrieval were separately tested. BigDataCloud should also be checked with a real, consented phone fix during the Android smoke test.
- The risk index and illustrative protection multipliers were retained from v0.7. This work does not validate them against mosquito observations or infection outcomes.

Read DEPLOY.md for backup, upload, deployment, daily-refresh operations, source references and rollback instructions.
