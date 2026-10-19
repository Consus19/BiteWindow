(() => {
 const cfg=window.BITEWINDOW_COMMUNITY||{};
 const el=id=>document.getElementById(id);
 const submit=el('communitySubmit'),status=el('communityStatus'),stats=el('communityStats');
 const submissionsEnabled=false; // Release gate: enable only after backend and privacy tests.
 const ready=submissionsEnabled && !!(cfg.apiUrl&&cfg.siteKey&&cfg.apiUrl.startsWith('https://'));
 el('communityConsent').disabled=!ready;
 let token='';
 const zone=()=>{const rs=reports();const last=rs[rs.length-1];return last?.locationGrid||null};
 function safeZone(z){return /^-?\d{1,2}\.\d,-?\d{1,3}\.\d$/.test(z||'')}
 const update=()=>{submit.disabled=!(ready&&el('communityConsent').checked&&token&&safeZone(zone()))};
 el('communityConsent').addEventListener('change',update);
 window.bwTurnstileOk=t=>{token=t;update()};window.bwTurnstileReset=()=>{token='';update()};
 if(ready){
  status.textContent='Contributing is optional; complete verification and consent to submit.';
  const div=document.createElement('div');div.className='cf-turnstile';div.dataset.sitekey=cfg.siteKey;div.dataset.callback='bwTurnstileOk';div.dataset.expiredCallback='bwTurnstileReset';div.dataset.errorCallback='bwTurnstileReset';el('turnstileBox').appendChild(div);
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js';script.async=true;script.defer=true;document.head.appendChild(script);
 }
 async function refresh(){if(!ready){stats.textContent='Community Watch is not connected yet. Your own saved reports still work.';return}const z=zone();if(!safeZone(z)){stats.textContent='Save an outing near your selected location to choose a broad reporting area.';return}stats.textContent='Loading neighborhood totals…';try{const r=await fetch(cfg.apiUrl+'/community?zone='+encodeURIComponent(z));const j=await r.json();if(!r.ok)throw Error(j.error||'Unavailable');stats.textContent=j.status==='available'?`Past 30 days: ${j.outings} reported outings, ${j.bite_outings} outings with bites, ${j.bite_free} bite-free outings. Total reported outdoor exposure: ${j.exposure_hours} hours.`:'Insufficient community data (minimum 20 outings from 10 contributors).';}catch(e){stats.textContent='Community data unavailable at the moment.'}}
 el('communityRefresh').onclick=refresh;
 submit.onclick=async()=>{if(!ready||submit.disabled)return;const arr=JSON.parse(localStorage.getItem('bitewindowReports')||'[]'),r=arr[arr.length-1];if(!r||!safeZone(r.locationGrid))return;let id=localStorage.getItem('bwContributorId');if(!id){id=crypto.randomUUID();localStorage.setItem('bwContributorId',id)};submit.disabled=true;status.textContent='Submitting…';try{const response=await fetch(cfg.apiUrl+'/report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({zone:r.locationGrid,token,contributor:id,biteCount:Math.min(30,Math.max(0,Math.floor(r.biteCount||0))),durationMinutes:Math.max(5,Math.min(240,Math.round(r.durationMinutes||30))),protection:r.repellent==='none'?'none':r.repellent?'repellent':'other'})});const data=await response.json();if(!response.ok)throw Error(data.error||'Submission failed');status.textContent=data.message;await refresh();}catch(e){status.textContent=e.message||'Submission failed';}finally{token='';if(window.turnstile)window.turnstile.reset();update();}};
 document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab==='community')b.addEventListener('click',refresh)});
 refresh();
})();
