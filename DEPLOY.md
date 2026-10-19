# BiteWindow v0.8: backup, upload, test and deploy

Prepared October 19, 2026. This package has not been pushed to GitHub or published.

## 1. Back up the existing build

The separate `BiteWindow-v0.7-backup-9540230.zip` is an exact archive of the current tracked website files at commit `95402302bb5ab98c2db3bdd41ff5eeb526020838` (October 17, 2026). It includes both original PNG icons, the HTML pages, manifest, community configuration and service worker. Keep it outside the website repository.

Also preserve the commit on GitHub before uploading:

1. Open https://github.com/Consus19/BiteWindow and select `main`.
2. Open the branch selector, enter `backup-v0.7-2026-10-19`, and create that branch from the current `main`.
3. Confirm the branch points to `9540230`. If `main` has changed since this package was prepared, download that newer build too and review its changes before replacing files.
4. Export any personal outing reports you want to protect from Community → Export reports. Repository backups do not include reports saved in individual browsers.

## 2. Upload to a development branch

1. Extract `BiteWindow-v0.8-upload.zip` on your computer. Do not upload the ZIP itself.
2. In the repository branch selector, create `v0.8-dynamic-forecast-alerts` from `main`.
3. On that branch, choose **Add file → Upload files**. Upload the extracted contents into the repository root. `index.html` must be at the top level; do not introduce a containing `BiteWindow-v0.8` folder.
4. Include the `data`, `tools`, `tests`, and `.github` folders along with the root files. If your file browser hides `.github`, enable hidden items. If the GitHub upload does not preserve it, use **Add file → Create new file**, enter `.github/workflows/pages.yml`, and paste the contents of the supplied file. The daily update depends on that workflow.
5. Commit the upload to the development branch. Leave `community-config.js` unchanged and keep `const submissionsEnabled=false` in `community.js`.
6. Open a draft pull request from the development branch into `main`. Its workflow runs parser and browser tests and creates a `bitewindow-preview` artifact. The pull-request workflow does not deploy the site.
7. In **Actions**, open the run and confirm the test and build steps passed. Download the preview artifact if you want to inspect the assembled public files. To open the artifact locally, extract it and serve that folder over HTTP, for example with `python -m http.server 8000`, then visit http://localhost:8000. Opening `index.html` directly with a `file:` URL will not exercise fetching or PWA behavior correctly.

GitHub's browser uploader may not show existing replacements clearly until the commit preview. Confirm the final changed-file list includes the new JavaScript files and the workflow before committing.

## 3. Publish when you are ready

1. Review the draft pull request and confirm the backup branch exists.
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. This package's workflow builds a public-only artifact and deploys it with the standard Pages actions. Do not select a custom paid runner or enable billing.
3. Mark the pull request ready and merge it into `main` when you approve the release. A push to `main` runs the tests, retrieves official sources, builds the website and deploys it.
4. Open **Actions → Refresh surveillance and deploy Pages**. Wait for the build and deployment jobs to succeed. The site remains https://consus19.github.io/BiteWindow/.
5. If the initial run occurred before you selected GitHub Actions as the Pages source, use **Actions → Refresh surveillance and deploy Pages → Run workflow**, selecting `main`.
6. Open the site, refresh it, and confirm **BETA · v0.8**. Close and reopen an installed app after its new service worker is installed. If a device still displays v0.7, close all BiteWindow tabs and reopen it. Export local reports before using browser site-data clearing as a last resort, because clearing site data deletes those reports.

The daily workflow is scheduled for 11:23 UTC. GitHub may delay scheduled runs. It runs from the default branch and must remain enabled. GitHub can disable scheduled workflows in inactive public repositories after 60 days; check Actions if data stops refreshing. Source errors are recorded as warnings and yield explicit unavailable states rather than fabricated data.

The schedule rebuilds and redeploys a public snapshot; it does not commit changing case counts to the repository. The dates displayed in the website are the source's reporting dates, not the repository file timestamps. The app checks the published snapshot when a location changes or Alerts opens, using a 15-minute in-memory refresh interval; Refresh bypasses that interval. It does not continually poll health providers from each device.

## 4. Android and installed-app smoke test

Physical Android installation was not available during this build. Complete these checks on an Android phone before considering device-specific validation complete. A separate staging repository with GitHub Pages can be used if you want to do this before merging into the production repository.

1. Open the HTTPS site in Android Chrome. Confirm all five navigation destinations, the detailed icon, readable text and a scrollable hourly forecast.
2. Move the duration slider and change each exposure setting. The headline, compact score, gauge and classification must agree. The bug-zapper option must not lower the score compared with None.
3. Search for Orlando and choose the result. Confirm Forecast names Orlando and Alerts names Orange County, Florida. Repeat with another state or country and verify the jurisdiction or explicit unavailable message.
4. Press Locate, review the privacy disclosure, and permit location access if desired. Confirm Forecast and Alerts refer to the same area. Denying access should leave city search available.
5. Open the browser menu and choose **Add to Home screen / Install app** if offered. Reopen it from the icon and confirm the five destinations work in standalone mode.
6. After one online load, enable airplane mode and reopen the app. The shell, privacy page and cached public snapshots should remain accessible. Live weather may be unavailable. Missing or expired surveillance must never be described as no disease risk.
7. Record a local bite-free outing, export it, and verify that the community submit button remains disabled. Updating the app should preserve the saved report because storage keys and origin are unchanged.

## 5. Roll back

1. In **Actions**, disable **Refresh surveillance and deploy Pages** so a scheduled v0.8 job cannot overwrite the rollback.
2. Revert the v0.8 merge using the pull request's **Revert** option and merge that revert. If you squash-merged or uploaded directly to main, restore the tracked website files from `backup-v0.7-2026-10-19` or the backup ZIP. Do not delete unrelated files added after the backup.
3. In **Settings → Pages**, change the source back to **Deploy from a branch**, selecting `main` and `/(root)`. Wait for the Pages deployment to finish.
4. Confirm v0.7 appears at the public URL. Close and reopen installed clients to allow the restored v0.7 service worker to replace v0.8's public cache. Keep local report storage intact.

## Coverage and operating limits

- Florida: automatically discovers the newest recognized weekly surveillance PDF from the official index. Extracts explicit county advisory/alert lists, human case-summary county lists, and sentinel-chicken narratives. PDF tables, mosquito pools and equine records are not comprehensively extracted. A changed/unrecognized source format is marked unavailable. Human case totals are not invented from prose; users can open the original report for counts and onset dates.
- United States: CDC's official dengue CSV provides county-of-residence reports split into locally acquired and travel-associated categories. Published small-count ranges are retained. It is not a comprehensive US disease-alert feed. No national county-level WNV, EEE, SLE, Zika, malaria or chikungunya count feed is claimed.
- Outside the United States: country, state and regional metadata are used when available. The dashboard displays official national links for supported countries and WHO links, plus an unavailable state for local surveillance. It does not claim an automated worldwide local-alert feed.
- Florida reports older than 21 days and CDC source files older than 35 days are not rendered as current activity. These conservative cutoffs may make data unavailable during periods when an agency publishes less frequently. Reported dates and incomplete coverage remain visible.
- The CDC county CSV does not contain an exact surveillance as-of date. The UI shows the reporting year and explicitly identifies the HTTP source-file modification date; it does not substitute the refresh time as a surveillance date.
- Location providers: existing Open-Meteo search/weather; FCC Census API for US county/state; BigDataCloud only for fresh, consented device GPS fixes. BigDataCloud is not called with manually searched or previously saved coordinates. Precise coordinates stay in memory for weather updates and are not persisted by the app. See the updated privacy policy.
- No Cloudflare deployment, database, Turnstile verification, community uploads, push permission request or background alert monitoring is enabled. No paid service or subscription has been configured. Use the public repository and standard GitHub-hosted runner; private-repository usage and storage have different account limits.

## References

- Florida report index: https://www.floridahealth.gov/statistics-data/population-surveillance/arbovirus-surveillance/
- CDC dengue county CSV: https://www.cdc.gov/wcms/vizdata/live/ncezid_dvbd/DEN/Cases_by_County_Current.csv
- CDC dengue source page: https://www.cdc.gov/dengue/data-research/facts-stats/current-data.html
- FCC geographic API documentation: https://geo.fcc.gov/api/census/
- Census county adjacency reference: https://www2.census.gov/geo/docs/reference/county_adjacency.txt
- BigDataCloud client-side fair-use explanation: https://www.bigdatacloud.com/docs/article/why-is-reverse-geocoding-api-free
- BigDataCloud privacy policy: https://www.bigdatacloud.com/privacy-and-cookie-policy
- GitHub Pages workflow documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub schedule behavior: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
