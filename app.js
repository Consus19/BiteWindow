
'use strict';
const $=id=>document.getElementById(id);const C={lat:28.5581,lon:-81.8512,name:'Groveland, Florida'};let selected=0, forecast=[],place=C.name, tz='America/New_York',lastUpdated='';const params=['duration','repellent','yard','placeType','water','activity','clothes','fan','spatial'];
function bound(x,a,b){return Math.min(b,Math.max(a,x))}function parseLocal(s){return new Date(s+'Z')}function hr(s){const p=s.split('T')[1]||'00:00';let h=+p.slice(0,2);return `${h%12||12} ${h>=12?'PM':'AM'}`}
function settings(){return Object.fromEntries(params.map(id=>[id,$(id).value]))}
function scoreFor(x){return BiteWindowModel.score(x,settings())}
function level(n){const c=BiteWindowModel.category(n);return [c.name,c.color]}
function setStatus(s){$('status').textContent=s}function hourNum(s){let m=/(\d\d):(\d\d)/.exec(s||'');return m?+m[1]+(+m[2])/60:6}
function draw(){$('durationText').textContent=$('duration').value+' min';$('outlookDuration').textContent=$('duration').value+'-MINUTE OUTLOOK';if(!forecast.length)return;const x=forecast[selected],n=scoreFor(x),[label,color]=level(n);const message=BiteWindowModel.category(n);$('forecastHeadline').textContent=message.headline;$('forecastSupport').textContent=message.support;$('headlineScore').textContent=`${n}/100 · ${label} relative risk · ${hr(x.time)}`;$('score').textContent=n;$('ring').style.stroke=color;$('ring').setAttribute('stroke-dasharray',`${n/100*515.2} 515.2`);$('riskName').textContent=label+' relative risk';$('riskName').style.color=color;$('riskDetail').textContent=`For ${$('duration').value} minutes outside at ${hr(x.time).toLowerCase()}, using your selected conditions.`;$('riskDrivers').textContent=`Drivers: ${Math.round(x.temp)}°F · ${Math.round(x.humid)}% humidity · ${Math.round(x.wind)} mph wind · ${x.rain.toFixed(1)} mm hourly rain. Adjustments: ${$('duration').value} minutes, ${$('placeType').selectedOptions[0].textContent.toLowerCase()}, ${$('repellent').selectedOptions[0].textContent.toLowerCase()}, ${$('spatial').selectedOptions[0].textContent.toLowerCase()}. `;$('summary').textContent=n<40?'Conditions look relatively favorable.':n<70?'Consider repellent and protective clothing.':'Mosquito-friendly conditions. Take precautions.';$('forecastDate').textContent=x.time.slice(0,10);updateSeason(x.time);updateReports();$('hours').replaceChildren();forecast.slice(0,24).forEach((h,i)=>{let sc=scoreFor(h),[name,c]=level(sc);let b=document.createElement('button');b.className='hour'+(selected===i?' selected':'');b.type='button';b.setAttribute('aria-label',`${hr(h.time)}: relative risk ${sc} out of 100`);b.innerHTML=`<span class="hourtime">${hr(h.time)}</span><span class="hourval">${sc}</span><div class="hourbar"><div style="width:${sc}%;background:${c}"></div></div><span class="level">${name}</span>`;b.setAttribute('aria-pressed',String(selected===i));b.onclick=()=>{const restoreFocus=document.activeElement===b;selected=i;draw();if(restoreFocus)$('hours').children[i]?.focus({preventScroll:true})};$('hours').appendChild(b)});const ranked=forecast.slice(0,24).map((p,i)=>({i,s:scoreFor(p)})).filter(q=>q.i>=0).sort((a,b)=>a.s-b.s);let best=ranked[0];const bestWeather=best?forecast[best.i]:null;$('temp').textContent=bestWeather?Math.round(bestWeather.temp)+'°':'--°';$('humid').textContent=bestWeather?Math.round(bestWeather.humid)+'%':'--%';$('wind').textContent=bestWeather?Math.round(bestWeather.wind):'--';$('best').textContent=best?`${hr(forecast[best.i].time)} · ${level(best.s)[0]} risk`:'No forecast';$('bestDetail').textContent=best?`Lowest modeled risk among the next 24 hourly forecast points. Score ${best.s}/100. Forecast conditions can change.`:'Forecast unavailable';}
let latestWeatherRequest=0, weatherController=null, loadedAt=0;
let selectedLocation={...C,countryCode:'US',country:'United States',state:'Florida',county:'Lake County'};
async function load(lat,lon,name,meta={},refreshOnly=false){
 const requestId=++latestWeatherRequest;
 weatherController?.abort();const controller=new AbortController();weatherController=controller;
 const timeout=setTimeout(()=>controller.abort(),18000);
 setStatus('Fetching the latest weather…');$('live').textContent='UPDATING';
 try{
  const u=new URL('https://api.open-meteo.com/v1/forecast');
  Object.entries({latitude:lat,longitude:lon,current:'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation',hourly:'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',daily:'sunrise,sunset',temperature_unit:'fahrenheit',wind_speed_unit:'mph',timezone:'auto',forecast_days:3}).forEach(([k,v])=>u.searchParams.set(k,v));
  const res=await fetch(u,{signal:controller.signal});if(!res.ok)throw Error('Weather API returned '+res.status);
  const d=await res.json();if(requestId!==latestWeatherRequest)return;
  if(!d.hourly?.time?.length||!d.daily?.time?.length)throw Error('Missing weather data');
  const nextTz=d.timezone||'UTC';
  const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:nextTz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(' ','T');
  const start=d.hourly.time.findIndex(t=>t.slice(0,13)>=fmt.slice(0,13));
  if(start<0)throw Error('Forecast has expired');
  const nextForecast=d.hourly.time.slice(start,start+24).map((time,k)=>{
   const i=k+start;let day=d.daily.time.indexOf(time.slice(0,10));if(day<0)day=0;
   const row={time,temp:d.hourly.temperature_2m[i],humid:d.hourly.relative_humidity_2m[i],rain:d.hourly.precipitation[i],wind:d.hourly.wind_speed_10m[i],hour:hourNum(time),sunrise:hourNum(d.daily.sunrise?.[day]),sunset:hourNum(d.daily.sunset?.[day])};
   if(!['temp','humid','rain','wind'].every(key=>Number.isFinite(row[key])))throw Error('Incomplete forecast');
   return row;
  });
  if(!nextForecast.length)throw Error('Missing forecast hours');
  // Commit one coherent location/weather snapshot only after validation succeeds.
  currentLat=lat;currentLon=lon;tz=nextTz;forecast=nextForecast;selected=0;place=name;
  selectedLocation={lat,lon,name,...meta};$('place').textContent=name.toUpperCase();
  $('live').textContent='LATEST FORECAST';loadedAt=Date.now();lastUpdated=new Date().toLocaleString();
  $('updated').textContent=' Weather fetched '+lastUpdated+'.';
  if(d.current){const c=d.current;const put=(id,v)=>$(id).textContent=Number.isFinite(v)?Math.round(v):'--';
   put('wtemp',c.temperature_2m);put('wfeel',c.apparent_temperature);put('whumidity',c.relative_humidity_2m);put('wwind',c.wind_speed_10m);
   $('wrain').textContent=Number.isFinite(c.precipitation)?(c.precipitation/25.4).toFixed(2):'--';
   $('weatherStatus').textContent='LATEST MODEL';$('weatherTime').textContent='Weather model time: '+c.time+' ('+tz+'). This is not a measurement at your property.';
  }else{['wtemp','wfeel','whumidity','wwind','wrain'].forEach(id=>$(id).textContent='--');$('weatherStatus').textContent='UNAVAILABLE';$('weatherTime').textContent='Current conditions were not supplied by the provider.';}
  setStatus('');draw();
  if(!refreshOnly)BiteWindowAlerts.setLocation(selectedLocation);
 }catch(e){
  if(requestId!==latestWeatherRequest)return;
  $('live').textContent=forecast.length?'SAVED FORECAST':'UNAVAILABLE';$('weatherStatus').textContent='UNAVAILABLE';
  setStatus('Could not load live weather. '+(forecast.length?'The previous location and forecast are still displayed. ':'')+'Check your connection, then search again.');
 }finally{clearTimeout(timeout)}
}

$('searchForm').addEventListener('submit',async e=>{e.preventDefault();let q=$('search').value.trim();if(q.length<2){setStatus('Please enter a city or ZIP code.');return}setStatus('Finding '+q+'…');try{let r=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=6&language=en&format=json');if(!r.ok)throw Error('City search is unavailable');let d=await r.json();if(!d.results?.length)throw Error('No matching locations. Try a city and state, or a ZIP code.');$('choice').style.display='flex';$('choice').replaceChildren();d.results.forEach(item=>{const b=document.createElement('button');b.textContent=[item.name,item.admin1,item.country].filter(Boolean).join(', ');b.type='button';b.onclick=()=>{$('choice').style.display='none';$('search').value=b.textContent;load(item.latitude,item.longitude,b.textContent,{countryCode:item.country_code,country:item.country,state:item.admin1,county:item.admin2})};$('choice').append(b)});setStatus('Choose the matching location below the search box.')}catch(e){setStatus(e.message)}});
$('geo').onclick=()=>{if(!navigator.geolocation){setStatus('Geolocation not supported in this browser.');return}setStatus('Requesting permission to use your location…');navigator.geolocation.getCurrentPosition(p=>{let {latitude,longitude}=p.coords;$('search').value='My location';$('choice').style.display='none';load(latitude,longitude,'Your current location',{isGps:true})},e=>setStatus('Could not use location: '+e.message+'. Search for a city instead.'),{timeout:12000,enableHighAccuracy:false})};params.forEach(id=>$(id).addEventListener('input',()=>{
 const displayed=Number($('score').textContent);draw();
 const messages={duration:'Longer outdoor exposure increases opportunities for mosquito encounters.',repellent:'Repellent protection depends on the product, coverage and label-directed use.',yard:'Your surroundings can affect mosquito access and activity.',placeType:$('placeType').value==='screened'?'A screened enclosure may reduce mosquito access.':'Shade and vegetation can provide mosquito resting sites.',water:'Standing water can support mosquito breeding over time. Removing water does not immediately remove existing mosquitoes.',activity:'Activity changes exposure in this experimental model.',clothes:'Clothing can reduce exposed skin; follow labels for treated clothing.',fan:'Airflow across seating may affect mosquito activity; protection varies.',spatial:$('spatial').value==='zapper'?'UV bug zappers are not reliable bite protection; this choice receives no protective adjustment.':'Spatial repellent performance depends on the device, label, coverage and wind.'};
 const after=forecast.length?scoreFor(forecast[selected]):null;
 $('exposureExplanation').textContent=(after!==null&&Number.isFinite(displayed)&&after<displayed?'Your updated settings lowered the relative exposure score. ':'')+messages[id];
}));
let currentLat=null,currentLon=null;
function coarseGrid(v){return Number.isFinite(v)?Math.round(v*10)/10:null}
function seasonalContext(time){
  const month=Number((time||'').slice(5,7))||new Date().getMonth()+1;
  const north=(currentLat??28)>=0;
  const warmMonths=north?[4,5,6,7,8,9,10]:[10,11,12,1,2,3,4];
  const warm=warmMonths.includes(month);
  return {month,season:warm?'Typically warmer-season conditions':'Typically cooler-season conditions',hint:warm?'Many regions experience increased mosquito activity in warm months.':'Some regions experience fewer mosquitoes in cooler months, but activity can continue locally.'};
}
function updateSeason(time){const info=seasonalContext(time);$('seasonNote').textContent=info.season+' · '+info.hint+' Local species and weather can differ.'}
function reports(){try{const data=JSON.parse(localStorage.getItem('bitewindowReports')||'[]');return Array.isArray(data)?data.filter(r=>r&&typeof r==='object'):[]}catch{return []}}function updateReports(){const all=reports();const locKey=[coarseGrid(currentLat),coarseGrid(currentLon)].join(',');const month=new Date().getMonth()+1;const local=all.filter(r=>r.locationGrid===locKey && Number(r.month)===month);const bites=local.reduce((n,r)=>n+(Number(r.biteCount)||0),0);$('reportCount').textContent=all.length?`${all.length} outing reports saved on this device (${all.filter(r=>r.bitten).length} with bites).`:'No reports yet.';$('localReportStats').textContent=`This month, near this selected location: ${local.length} locally saved outing reports, ${bites} bites reported. These are your own reports, not a community count or a measured probability.`;}
function log(bitten){if(!forecast.length){$('reportStatus').textContent='Load a forecast on Forecast before logging a report.';return}const a=reports();const when=new Date();const count=bitten?bound(Math.floor(Number($('biteNumber').value)||1),1,99):0;a.push({timestamp:when.toISOString(),month:when.getMonth()+1,location:place,locationGrid:[coarseGrid(currentLat),coarseGrid(currentLon)].join(','),weatherHour:forecast[selected].time,temperatureF:forecast[selected].temp,humidity:forecast[selected].humid,windMph:forecast[selected].wind,modeledScore:scoreFor(forecast[selected]),durationMinutes:+$('duration').value,repellent:$('repellent').value,setting:$('yard').value,water:$('water').value,placeType:$('placeType').value,clothes:$('clothes').value,fan:$('fan').value,spatial:$('spatial').value,activity:$('activity').value,bitten,biteCount:count});try{localStorage.setItem('bitewindowReports',JSON.stringify(a));updateReports();$('reportStatus').textContent='Outing recorded on this device. Thanks!'}catch{$('reportStatus').textContent='Your browser did not allow saving a report.'}}
$('bitten').onclick=()=>log(true);$('safe').onclick=()=>log(false);$('export').onclick=()=>{const blob=new Blob([JSON.stringify(reports(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bitewindow-bite-reports.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};$('featureForm').addEventListener('submit',e=>{e.preventDefault();const title=$('featureTitle').value.trim();if(!title)return;const body=$('featureDetails').value.trim();const url='https://github.com/Consus19/BiteWindow/issues/new?'+new URLSearchParams({title:'Feature request: '+title,body:'## Request\n'+body+'\n\nSubmitted from BiteWindow.'}).toString();window.open(url,'_blank','noopener,noreferrer');});
$('shareApp').onclick=async()=>{const data={title:'BiteWindow',text:'Check mosquito exposure conditions before going outside with BiteWindow.',url:'https://consus19.github.io/BiteWindow/'};try{if(navigator.share)await navigator.share(data);else if(navigator.clipboard){await navigator.clipboard.writeText(data.url);$('shareStatus').textContent='Link copied — paste it into your favorite social app.';}else{$('shareStatus').textContent='Share this link: '+data.url;}}catch(e){if(e.name!=='AbortError')$('shareStatus').textContent='Could not share. Use: '+data.url;}};
function switchTab(tab){document.querySelectorAll('[data-page]').forEach(el=>el.hidden=el.dataset.page!==tab);document.querySelectorAll('[data-tab]').forEach(el=>{const on=el.dataset.tab===tab;el.classList.toggle('active',on);el.setAttribute('aria-current',on?'page':'false')});window.scrollTo(0,0)}document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>switchTab(el.dataset.tab)));switchTab('forecast');updateReports();BiteWindowAlerts.setLocation({...selectedLocation,stateCode:'FL'});load(C.lat,C.lon,C.name,{countryCode:'US',country:'United States',state:'Florida',stateCode:'FL',county:'Lake County'},true);

// Refresh weather while the app is in use; no location permission is requested here.
function refreshWeatherIfDue(){if(document.hidden||!navigator.onLine||!loadedAt||Date.now()-loadedAt<30*60*1000)return;const {lat,lon,name,...meta}=selectedLocation;load(lat,lon,name,meta,true)}
setInterval(refreshWeatherIfDue,60*1000);
document.addEventListener('visibilitychange',refreshWeatherIfDue);
window.addEventListener('online',refreshWeatherIfDue);
