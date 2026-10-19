'use strict';
window.BiteWindowAlerts=(()=>{
 const el=id=>document.getElementById(id), FL='https://www.floridahealth.gov/statistics-data/population-surveillance/arbovirus-surveillance/';
 const CDC='https://www.cdc.gov/vector-borne-diseases/php/arbonet/';
 const state={version:0,location:null,geo:null,data:null,lastFetch:0,lastSuccess:null,pending:null};
 const diseases=[
  ['West Nile virus','Most infections cause no symptoms. Some cause fever; severe illness can affect the nervous system.','https://www.cdc.gov/west-nile-virus/'],
  ['Dengue','Can cause fever, aches and rash; severe dengue can require urgent care.','https://www.cdc.gov/dengue/'],
  ['Eastern equine encephalitis','A rare infection that can cause severe inflammation of the brain.','https://www.cdc.gov/eastern-equine-encephalitis/'],
  ['St. Louis encephalitis','Often causes no symptoms, but can cause fever or inflammation of the brain.','https://www.cdc.gov/sle/'],
  ['Chikungunya','Can cause fever and substantial joint pain that may persist.','https://www.cdc.gov/chikungunya/'],
  ['Zika','Often mild or without symptoms; infection during pregnancy can cause serious birth defects.','https://www.cdc.gov/zika/'],
  ['Malaria','A mosquito-borne parasitic infection that can cause fever and serious illness. Seek medical care for fever after travel to an affected area.','https://www.cdc.gov/malaria/']
 ];
 function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
 function link(text,url){const a=node('a',text);try{const u=new URL(url);if(u.protocol!=='https:')return node('span',text);a.href=u.href}catch{return node('span',text)}a.target='_blank';a.rel='noopener noreferrer';return a}
 function date(s){if(!s)return 'not supplied';const d=new Date(s.length===10?s+'T12:00:00Z':s);return Number.isFinite(+d)?d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):'unavailable'}
 async function getJSON(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);try{const r=await fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!r.ok)throw Error('Source unavailable');return await r.json()}finally{clearTimeout(timer)}}
 async function geo(){if(!state.geo){const d=await getJSON('./data/us-counties.json');if(!d.counties)throw Error('County reference unavailable');state.geo=d.counties}return state.geo}
 function normalizedName(s){return (s||'').toLowerCase().replace(/\b(county|parish|borough)\b/g,'').replace(/[^a-z]/g,'')}
 async function jurisdiction(location){
  let j={name:location.name,countryCode:location.countryCode||'',country:location.country||'',state:location.state||'',county:location.county||'',stateCode:location.stateCode||'',countyFips:''};
  // This keyless service is used only for a fresh, consented device fix, never searched/stored coordinates.
  if(location.isGps){
   const u=new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');u.search=new URLSearchParams({latitude:location.lat,longitude:location.lon,localityLanguage:'en'});
   const r=await getJSON(u);const a=r.localityInfo?.administrative||[];
   j={...j,countryCode:r.countryCode||'',country:r.countryName||'',state:r.principalSubdivision||'',stateCode:(r.principalSubdivisionCode||'').split('-').pop(),county:a.find(x=>x.adminLevel===6)?.name||''};
  }
  if(j.countryCode==='US'){
   try{
    const u=new URL('https://geo.fcc.gov/api/census/block/find');u.search=new URLSearchParams({latitude:location.lat,longitude:location.lon,format:'json'});
    const r=await getJSON(u);
    if(r.status==='OK'&&/^\d{5}$/.test(r.County?.FIPS||''))j={...j,country:'United States',state:r.State.name,stateCode:r.State.code,county:r.County.name,countyFips:r.County.FIPS};
   }catch{/* Use the searched place's administrative metadata only when its county matches the reference. */}
   if(!j.countyFips&&j.county){const counties=await geo();const match=Object.entries(counties).find(([,c])=>normalizedName(c.name)===normalizedName(j.county)&&(j.stateCode?c.stateCode===j.stateCode:j.state==='Florida'&&c.stateCode==='FL'));if(match)j.countyFips=match[0]}
  }
  return j;
 }
 function label(j){return [j.county||j.name,j.state,j.country||j.countryCode].filter(Boolean).join(', ')}
 function sourceFresh(s){if(s.status!=='available')return false;const value=s.dataAsOf?s.dataAsOf+'T23:59:59Z':s.sourceModifiedAt;const t=Date.parse(value);const now=Date.now();return Number.isFinite(t)&&t<=now+86400000&&now-t<=(s.maxAgeDays||21)*86400000}
 function relevant(s,j){return s.id==='cdc-dengue'&&j.countryCode==='US'||s.id==='fl-weekly'&&j.stateCode==='FL'&&j.countryCode==='US'}
 function renderRecord(r){
  const c=node('article',undefined,'health-record');c.dataset.status=r.advisoryStatus||'';
  c.append(node('h3',r.disease));const county=state.geo?.[r.countyFips];c.append(node('p',county?`${county.name}, ${county.stateCode}`:r.countyFips));
  for(const v of [r.evidence,r.acquisition])c.append(node('span',v,'pill'));
  c.append(node('p',r.summary),node('p',r.classification,'mini'));
  c.append(node('p',`${r.agency} · ${r.reportingPeriod} · Surveillance as of: ${date(r.dataAsOf)}`,'mini'));
  c.append(link('Official source ↗',r.sourceUrl));return c;
 }
 function officialLinks(j){
  const links=[['WHO disease outbreak news','https://www.who.int/emergencies/disease-outbreak-news']];
  if(j.countryCode==='US'){
   links.unshift(['CDC ArboNET',CDC],['CDC West Nile surveillance','https://www.cdc.gov/west-nile-virus/data-maps/current-year-data.html'],['CDC dengue surveillance','https://www.cdc.gov/dengue/data-research/facts-stats/current-data.html'],['State & territorial health departments','https://www.cdc.gov/public-health-gateway/php/communications-resources/health-department-directories.html']);
   if(j.stateCode==='FL'){links.unshift(['Florida weekly surveillance reports',FL]);const slug=(j.county||'').toLowerCase().replace(/ county$/,'').replace(/[^a-z]/g,'');if(slug)links.unshift([`${j.county} health department`,`https://${slug}.floridahealth.gov/`]);}
  }else{
   const agencies={GB:['UK Health Security Agency','https://www.gov.uk/government/organisations/uk-health-security-agency'],CA:['Public Health Agency of Canada','https://www.canada.ca/en/public-health.html'],AU:['Australian Department of Health','https://www.health.gov.au/'],NZ:['Health New Zealand','https://www.tewhatuora.govt.nz/'],SG:['Singapore Ministry of Health','https://www.moh.gov.sg/'],BR:['Brazil Ministry of Health','https://www.gov.br/saude/'],IN:['India National Centre for Vector Borne Diseases Control','https://ncvbdc.mohfw.gov.in/']};
   if(agencies[j.countryCode])links.unshift(agencies[j.countryCode]);
  }
  return links;
 }
 function render(){
  const j=state.location;if(!j)return;
  el('alertsLocation').textContent=label(j);
  const sources=(state.data?.sources||[]).filter(s=>relevant(s,j));const fresh=sources.filter(sourceFresh);
  const records=fresh.flatMap(s=>s.records||[]),local=records.filter(r=>r.countyFips===j.countyFips);
  const neighbors=new Set(state.geo?.[j.countyFips]?.neighbors||[]);const nearby=records.filter(r=>neighbors.has(r.countyFips));
  el('localAlerts').replaceChildren(...local.map(renderRecord));el('nearbyAlerts').replaceChildren();
  // Keep surrounding-county reports available without making the dashboard an unbroken list.
  const groups=new Map();for(const r of nearby){if(!groups.has(r.countyFips))groups.set(r.countyFips,[]);groups.get(r.countyFips).push(r)}
  for(const [fips,rows]of groups){const c=state.geo?.[fips],d=node('details',undefined,'nearby-county');const status=[...new Set(rows.map(r=>r.advisoryStatus).filter(Boolean))].join(', ');d.append(node('summary',`${c?.name||fips}, ${c?.stateCode||''} · ${rows.length} source entries${status?' · '+status+' listed':''}`));const list=node('div',undefined,'alert-list');list.append(...rows.map(renderRecord));d.append(list);el('nearbyAlerts').append(d)}
  if(!local.length)el('localAlerts').append(node('p','No county entry is available from the sources shown below. This is not a complete case count or evidence that disease is absent.','advice'));
  if(!nearby.length)el('nearbyAlerts').append(node('p','No bordering-county entries are available from these sources. Check the official authorities for other nearby activity.','advice'));
  const unavailable=!j.countyFips||!fresh.length||sources.some(s=>!sourceFresh(s));el('alertsUnavailable').hidden=!unavailable;
  el('alertsStatus').textContent=!j.countyFips?'County-level surveillance could not be matched for this location.':fresh.length?'Dated official reports retrieved. Coverage is limited to the sources listed below.':'Current local surveillance information is unavailable. Check the official public-health source.';
  el('alertsDataDate').textContent='Official surveillance reporting dates: '+(sources.length?sources.map(s=>s.dataAsOf?`${s.agency}: ${date(s.dataAsOf)}`:s.reportingPeriod?`${s.agency}: ${s.reportingPeriod}`:s.id+': unavailable').join(' · '):'unavailable');
  el('alertsRefreshDate').textContent='Most recent successful app refresh: '+(state.lastSuccess?new Date(state.lastSuccess).toLocaleString():'none');
  el('healthSources').replaceChildren();
  for(const s of sources){const c=node('div',undefined,'source-card');c.append(link(s.agency||s.id,s.sourceUrl));c.append(node('p',sourceFresh(s)?'Source available': 'Source unavailable or outdated'));
   if(s.reportingPeriod)c.append(node('p',s.reportingPeriod));
   if(s.sourceModifiedAt)c.append(node('p','Official source file modified: '+date(s.sourceModifiedAt)+'. This is a file date, not an exact surveillance as-of date.','mini'));
   if(s.retrievedAt)c.append(node('p','Source successfully retrieved: '+new Date(s.retrievedAt).toLocaleString(),'mini'));
   if(s.coverage)c.append(node('p',s.coverage,'mini'));if(s.dataUrl)c.append(link('Official structured data ↗',s.dataUrl));el('healthSources').append(c);
  }
  const links=node('div',undefined,'linkrow');for(const [name,url]of officialLinks(j))links.append(link(name+' ↗',url));el('healthSources').append(links);
 }
 async function refresh(force=false){
  if(!state.location)return;
  if(state.pending)return state.pending;
  if(!force&&state.data&&Date.now()-state.lastFetch<15*60*1000){render();return}
  el('alertsStatus').textContent='Refreshing official surveillance information…';
  state.pending=(async()=>{try{const [d]=await Promise.all([getJSON('./data/health.json'),geo()]);
   if(d.schemaVersion!==1||!Array.isArray(d.sources)||!d.sources.every(s=>typeof s.id==='string'&&Array.isArray(s.records)))throw Error('Invalid feed');
   state.data=d;state.lastFetch=Date.now();if(d.sources.some(sourceFresh))state.lastSuccess=new Date().toISOString();render();
  }catch{state.data=null;render();el('alertsStatus').textContent='Current local surveillance information is unavailable. Check the official public-health source.';el('alertsUnavailable').hidden=false}finally{state.pending=null}})();return state.pending;
 }
 async function setLocation(location){
  const version=++state.version;state.location={name:location.name,countryCode:location.countryCode||'',country:location.country||'',state:location.state||'',county:location.county||'',stateCode:location.stateCode||''};
  el('alertsLocation').textContent=location.name;el('localAlerts').replaceChildren();el('nearbyAlerts').replaceChildren();el('healthSources').replaceChildren();el('alertsDataDate').textContent='Official surveillance reporting dates: resolving jurisdiction…';el('alertsStatus').textContent='Resolving the selected jurisdiction…';el('alertsUnavailable').hidden=true;
  try{const j=await jurisdiction(location);if(version!==state.version)return;state.location=j;await refresh(true)}catch{if(version!==state.version)return;render();el('alertsStatus').textContent='The selected jurisdiction could not be resolved. Search for a city on Forecast or check the official source.';el('alertsUnavailable').hidden=false}
 }
 for(const [name,description,url]of diseases){const d=node('details',undefined,'disease');d.append(node('summary',name),node('p',description),node('p','Spread through infected mosquito bites. Use EPA-registered repellent as labeled, protective clothing and intact screens.'));d.append(link('Official disease information ↗',url));el('diseaseInformation').append(d)}
 el('alertsRefresh').addEventListener('click',()=>refresh(true));
 document.querySelector('[data-tab="alerts"]').addEventListener('click',()=>refresh());
 // No background monitoring or notification permission requests.
 return {setLocation,refresh};
})();
