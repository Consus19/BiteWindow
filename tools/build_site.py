"""Copy only deployable public files; never publish tests, tools, or repository metadata."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1]
site=ROOT/'_site';site.mkdir(exist_ok=True)
for name in ['index.html','privacy.html','app.js','forecast-model.js','health-alerts.js','community.js','community-config.js','service-worker.js','manifest.webmanifest','icon-192.png','icon-512.png']:
    shutil.copy2(ROOT/name,site/name)
(site/'data').mkdir(exist_ok=True)
for name in ['health.json','us-counties.json']:shutil.copy2(ROOT/'data'/name,site/'data'/name)
(site/'.nojekyll').touch()
print('Public website assembled in _site/')
