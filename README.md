# BiteWindow
Weather-based mosquito bite risk forecasting and prevention
# BiteWindow v0.8

Dynamic weather-based exposure guidance and dated official public-health awareness.

The five destinations, artwork, local outing reports, export, prevention links, sharing, feature requests and Android PWA manifest are preserved. Public community submissions remain disabled.

Read [DEPLOY.md](DEPLOY.md) before uploading or deploying. It includes the backup commit, development-branch workflow, GitHub Pages setup, Android checks, rollback and explicit surveillance coverage limits.

## Local development

Use Python 3.12+ and Node 24+.

```sh
python -m pip install -r requirements.txt
python -m unittest discover -s tests -p 'test_*.py'
npm install --ignore-scripts
npx playwright install chromium
npm test
python tools/update_health.py
python tools/build_site.py
python -m http.server 8000 --directory _site
```

For a locally installed Chrome executable, set `BITEWINDOW_CHROME` to its path before running browser tests. Test weather, city lookup and device GPS responses are mocked; live source retrieval is a separate operation. The browser checks run at a fixed date against public-data fixtures for repeatability.

Only `_site/` is deployed by the workflow. Tests, build tools, repository metadata and documentation are excluded from the hosted artifact.
