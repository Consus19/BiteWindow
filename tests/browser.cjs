const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium,devices}=require('playwright');
const root=path.resolve(__dirname,'..'),results=[];
const fixed='2026-10-19T12:00:00Z';
function weather(temp=85){
 const times=Array.from({length:72},(_,i)=>new Date(Date.parse('2026-10-19T00:00Z')+i*3600000).toISOString().slice(0,16));
 return {timezone:'UTC',hourly:{time:times,temperature_2m:times.map((_,i)=>i===12?temp:65),relative_humidity_2m:times.map(()=>80),precipitation:times.map(()=>0),wind_speed_10m:times.map(()=>3)},daily:{time:['2026-10-19','2026-10-20','2026-10-21'],sunrise:['2026-10-19T07:00','2026-10-20T07:00','2026-10-21T07:00'],sunset:['2026-10-19T19:00','2026-10-20T19:00','2026-10-21T19:00']},current:{temperature_2m:temp,apparent_temperature:temp+1,relative_humidity_2m:80,wind_speed_10m:3,precipitation:0,time:'2026-10-19T12:00'}};
}
const areas={lake:{County:{FIPS:'12069',name:'Lake County'},State:{code:'FL',name:'Florida'},status:'OK'},orange:{County:{FIPS:'12095',name:'Orange County'},State:{code:'FL',name:'Florida'},status:'OK'},newyork:{County:{FIPS:'36061',name:'New York County'},State:{code:'NY',name:'New York'},status:'OK'}};
const json=(route,obj,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj)});
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/BiteWindow\//,'');
 const file=path.resolve(root,pathname||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return}const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(data)});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/BiteWindow/`;
 const browser=await chromium.launch({headless:true,...(process.env.BITEWINDOW_CHROME?{executablePath:process.env.BITEWINDOW_CHROME}:{})});
 const context=await browser.newContext({...devices['Pixel 7'],serviceWorkers:'block'});
 const page=await context.newPage();const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 let failWeather=false,failHealth=false,staleHealth=false,delayWeather=false;
 const sourceData=JSON.parse(fs.readFileSync(path.join(root,'data/health.json')));
 await page.clock.setFixedTime(new Date(fixed));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='api.open-meteo.com'){
   if(failWeather)return json(route,{error:true},503);
   if(delayWeather&&u.searchParams.get('latitude')==='30'){await new Promise(r=>setTimeout(r,200));}
   return json(route,weather(u.searchParams.get('latitude')==='30'?95:85));
  }
  if(u.hostname==='geo.fcc.gov')return json(route,u.searchParams.get('latitude')==='40.7'?areas.newyork:u.searchParams.get('latitude')==='28.54'?areas.orange:areas.lake);
  if(u.hostname==='api.bigdatacloud.net')return json(route,{countryCode:'US',countryName:'United States',principalSubdivision:'Florida',principalSubdivisionCode:'US-FL',localityInfo:{administrative:[{adminLevel:6,name:'Orange County'}]}});
  if(u.hostname==='geocoding-api.open-meteo.com')return json(route,{results:[{name:'Orlando',latitude:28.54,longitude:-81.38,country_code:'US',country:'United States',admin1:'Florida',admin2:'Orange County'}]});
  if(u.pathname.endsWith('/data/health.json')){
   if(failHealth)return json(route,{},503);
   const d=structuredClone(sourceData);
   // Live sources are tested separately. Freeze fixture retrieval/freshness for repeatable browser tests.
   for(const s of d.sources){s.retrievedAt=fixed;if(staleHealth){s.dataAsOf='2020-01-01';s.sourceModifiedAt='2020-01-01T00:00Z'}}
   return json(route,d);
  }
  if(u.origin!==new URL(url).origin)return route.abort();return route.continue();
 });
 async function check(name,fn){await fn();results.push({test:name,status:'passed'});console.log('PASS',name)}
 try{
  await page.goto(url);await page.waitForFunction(()=>document.getElementById('score').textContent!=='--');
  await page.waitForFunction(()=>document.getElementById('alertsLocation').textContent.includes('Lake County'));
  await check('Shared headline and gauge score; all five category boundaries',async()=>{
   const out=await page.evaluate(()=>{
    const tests=[0,19,20,39,40,59,60,79,80,100].map(n=>[n,BiteWindowModel.category(n).name]);
    return {tests,score:document.getElementById('score').textContent,headline:document.getElementById('forecastHeadline').textContent,expected:BiteWindowModel.category(Number(document.getElementById('score').textContent)).headline,compact:document.getElementById('headlineScore').textContent};
   });assert.deepEqual(out.tests.map(x=>x[1]),['Very low','Very low','Low','Low','Moderate','Moderate','High','High','Very high','Very high']);assert.equal(out.headline,out.expected);assert.ok(out.compact.startsWith(out.score+'/100'));
  });
  await check('Every exposure control redraws immediately and uses the shared model',async()=>{
   for(const [id,value]of [['duration','120'],['repellent','yes'],['yard','shade'],['yard','screen'],['placeType','screened'],['water','near'],['activity','active'],['clothes','long'],['fan','yes'],['spatial','epa'],['spatial','zapper']]){
    await page.evaluate(({id,value})=>{document.getElementById(id).value=value;document.getElementById(id).dispatchEvent(new Event('input',{bubbles:true}))},{id,value});
    const match=await page.evaluate(()=>{const n=BiteWindowModel.score(forecast[selected],settings());return {n,shown:Number(document.getElementById('score').textContent),headline:document.getElementById('forecastHeadline').textContent,expected:BiteWindowModel.category(n).headline,explanation:document.getElementById('exposureExplanation').textContent}});
    assert.equal(match.n,match.shown);assert.equal(match.headline,match.expected);assert.ok(match.explanation.length>15);
   }
   const zap=await page.evaluate(()=>{const x=forecast[selected],s=settings();return [BiteWindowModel.score(x,{...s,spatial:'none'}),BiteWindowModel.score(x,{...s,spatial:'zapper'})]});assert.equal(zap[0],zap[1]);
  });
  await check('All five headline messages render through draw()',async()=>{
   const bands=await page.evaluate(()=>{
    const saved=forecast,old=settings();const found=new Map();for(const temp of [30,50,65,80,90])for(const duration of ['10','30','120'])for(const yard of ['typical','screen']){
     for(const [k,v]of Object.entries({duration,repellent:'none',yard,placeType:'open',water:'unknown',activity:'rest',clothes:'short',fan:'no',spatial:'none'}))document.getElementById(k).value=v;
     forecast=[{time:'2026-10-19T12:00',temp,humid:80,wind:3,rain:0,hour:12,sunrise:7,sunset:19}];selected=0;draw();found.set(document.getElementById('riskName').textContent,document.getElementById('forecastHeadline').textContent);
    }forecast=saved;for(const[k,v]of Object.entries(old))document.getElementById(k).value=v;draw();return [...found.keys()];
   });assert.equal(bands.length,5);
  });
  await check('Hourly keyboard focus and selected accessibility state',async()=>{
   await page.locator('.hour').nth(1).focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.hour').nth(1).evaluate(e=>document.activeElement===e),true);assert.equal(await page.locator('.hour').nth(1).getAttribute('aria-pressed'),'true');
  });
  await check('Sweet spot weather matches recommended hour',async()=>{
   const d=await page.evaluate(()=>{const best=forecast.map((x,i)=>({i,s:scoreFor(x)})).sort((a,b)=>a.s-b.s)[0];return {shown:document.getElementById('temp').textContent,expected:Math.round(forecast[best.i].temp)+'°'}});assert.equal(d.shown,d.expected);
  });
  await check('All five destinations hide unrelated sections',async()=>{
   for(const name of ['forecast','community','prevent','alerts','info']){await page.locator(`[data-tab="${name}"]`).click();assert.deepEqual(await page.locator('[data-page]:visible').evaluateAll(es=>[...new Set(es.map(e=>e.dataset.page))]),[name]);assert.equal(await page.locator(`[data-tab="${name}"]`).getAttribute('aria-current'),'page')}
  });
  await check('Mobile reflow at 320, 360, 390, 780 and 1100 pixels',async()=>{
   for(const width of [320,360,390,780,1100]){await page.setViewportSize({width,height:844});for(const name of ['forecast','community','prevent','alerts','info']){await page.locator(`[data-tab="${name}"]`).click();const dims=await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dims.scroll<=dims.inner+1,`${name} overflows at ${width}px`)}}
   await page.setViewportSize({width:390,height:844});
  });
  await check('Default county, local travel status and bordering counties',async()=>{
   await page.locator('[data-tab="alerts"]').click();await page.waitForFunction(()=>document.getElementById('localAlerts').textContent.includes('Travel-associated'));
   assert.ok((await page.locator('#localAlerts').textContent()).includes('Lake County'));assert.ok((await page.locator('#nearbyAlerts').textContent()).includes('Orange County'));assert.ok(!(await page.locator('#localAlerts').textContent()).includes('Locally acquired'));
  });
  await check('City search changes both forecast and health jurisdiction',async()=>{
   await page.locator('[data-tab="forecast"]').click();await page.locator('#search').fill('Orlando');await page.locator('#searchForm').evaluate(e=>e.requestSubmit());await page.locator('#choice button').click();await page.waitForFunction(()=>document.getElementById('place').textContent.includes('ORLANDO'));await page.waitForFunction(()=>document.getElementById('alertsLocation').textContent.includes('Orange County'));
   await page.locator('[data-tab="alerts"]').click();await page.waitForFunction(()=>document.getElementById('localAlerts').textContent.includes('Locally acquired'));assert.ok((await page.locator('#localAlerts').textContent()).includes('Sentinel chickens'));
  });
  await check('Consented GPS shares one location with weather and alerts (mocked GPS service)',async()=>{
   await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:28.54,longitude:-81.38});await page.locator('[data-tab="forecast"]').click();await page.locator('#geo').click();await page.waitForFunction(()=>document.getElementById('place').textContent==='YOUR CURRENT LOCATION');await page.waitForFunction(()=>document.getElementById('alertsLocation').textContent.includes('Orange County'));assert.ok(requests.some(u=>u.includes('api.bigdatacloud.net')));
  });
  await check('Failed weather load preserves a coherent previous location and report grid',async()=>{
   failWeather=true;const d=await page.evaluate(async()=>{const before=[currentLat,currentLon,place,forecast[0].temp];await load(40,-74,'Failed city',{countryCode:'US'});return {before,after:[currentLat,currentLon,place,forecast[0].temp]}});assert.deepEqual(d.after,d.before);failWeather=false;
  });
  await check('Overlapping location loads accept only the newest response',async()=>{
   delayWeather=true;await page.evaluate(async()=>{const a=load(30,-80,'Old request',{countryCode:'US'});await new Promise(r=>setTimeout(r,20));const b=load(40.7,-74,'New York',{countryCode:'US',state:'New York',county:'New York County'});await Promise.all([a,b])});assert.equal(await page.locator('#place').textContent(),'NEW YORK');await page.waitForFunction(()=>document.getElementById('alertsLocation').textContent.includes('New York County'));delayWeather=false;
  });
  await check('Unsupported international coverage never means no risk',async()=>{
   await page.evaluate(()=>BiteWindowAlerts.setLocation({name:'London',lat:51.5,lon:-0.1,countryCode:'GB',country:'United Kingdom',state:'England',county:'Greater London'}));await page.locator('[data-tab="alerts"]').click();await page.waitForFunction(()=>document.getElementById('alertsLocation').textContent.includes('London'));assert.equal(await page.locator('#alertsUnavailable').isVisible(),true);assert.ok((await page.locator('#healthSources').textContent()).includes('UK Health Security Agency'));
  });
  await check('Unavailable feed displays the required unavailable message',async()=>{
   failHealth=true;await page.evaluate(()=>BiteWindowAlerts.refresh(true));assert.ok((await page.locator('#alertsStatus').textContent()).includes('Current local surveillance information is unavailable'));assert.equal(await page.locator('#localAlerts .health-record').count(),0);failHealth=false;
  });
  await check('Stale official dates suppress activity cards',async()=>{
   staleHealth=true;await page.evaluate(()=>BiteWindowAlerts.setLocation({name:'Groveland',lat:28.5581,lon:-81.8512,countryCode:'US',state:'Florida',county:'Lake County'}));assert.equal(await page.locator('#localAlerts .health-record').count(),0);assert.equal(await page.locator('#alertsUnavailable').isVisible(),true);staleHealth=false;await page.evaluate(()=>BiteWindowAlerts.refresh(true));
  });
  await check('Submission gate remains closed; local reports and export remain available',async()=>{
   await page.locator('[data-tab="community"]').click();assert.equal(await page.locator('#communitySubmit').isDisabled(),true);assert.equal(await page.locator('#communityConsent').isDisabled(),true);await page.locator('#safe').click();assert.ok((await page.locator('#reportStatus').textContent()).includes('recorded on this device'));const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('bitewindowReports')));assert.equal(stored.length,1);assert.ok(!('latitude'in stored[0]));assert.ok(!('longitude'in stored[0]));assert.equal(await page.evaluate(()=>localStorage.getItem('bwContributorId')),null);assert.ok(!requests.some(u=>u.includes('challenges.cloudflare.com')||u.includes('/report?')));
   const download=page.waitForEvent('download');await page.locator('#export').click();assert.equal((await download).suggestedFilename(),'bitewindow-bite-reports.json');
  });
  await check('No script errors, notification requests or persisted precise coordinates',async()=>{
   assert.deepEqual(errors,[]);const keys=await page.evaluate(()=>Object.keys(localStorage));assert.deepEqual(keys,['bitewindowReports']);assert.ok(!fs.readFileSync(path.join(root,'health-alerts.js'),'utf8').includes('Notification.requestPermission'));
  });
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  await page.locator('[data-tab="forecast"]').click();await page.screenshot({path:path.join(root,'test-results/mobile-forecast.png'),fullPage:true});
  await page.locator('[data-tab="alerts"]').click();await page.screenshot({path:path.join(root,'test-results/mobile-alerts.png'),fullPage:true});
  await page.setViewportSize({width:1100,height:900});await page.screenshot({path:path.join(root,'test-results/desktop-alerts.png'),fullPage:true});
  // Real service worker and offline shell at the GitHub Pages subpath; external requests are blocked.
  const offlineContext=await browser.newContext();const offlinePage=await offlineContext.newPage();
  await offlinePage.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
  await offlinePage.goto(url);await offlinePage.evaluate(()=>navigator.serviceWorker.ready);await offlinePage.reload();
  await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await check('PWA manifest and offline service-worker shell',async()=>{
   const manifest=await offlinePage.evaluate(async()=>await (await fetch('./manifest.webmanifest')).json());assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');assert.ok(manifest.icons.some(i=>i.sizes==='512x512'));
   await offlineContext.setOffline(true);await offlinePage.reload();assert.equal(await offlinePage.title(),'BiteWindow • Mosquito forecast');await offlinePage.locator('[data-tab="alerts"]').click();assert.equal(await offlinePage.locator('#alertsTitle').isVisible(),true);await offlinePage.goto(url+'privacy.html');assert.ok((await offlinePage.locator('h1').textContent()).includes('Privacy Policy'));
  });
  fs.writeFileSync(path.join(root,'test-results/browser-results.json'),JSON.stringify({testedAt:new Date().toISOString(),environment:'Desktop Chrome, Pixel 7 device emulation; not a physical Android installation',results},null,2));
  console.log(`${results.length} browser checks passed`);
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
