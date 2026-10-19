'use strict';
window.BiteWindowModel=(()=>{
function bound(x,a,b){return Math.min(b,Math.max(a,x))}
function score(x,settings){
 const t=x.temp,h=x.humid,w=x.wind,r=x.rain;
 let T=t<45?.04:t<60?.12+(t-45)/15*.42:t<80?.54+(t-60)/20*.46:t<=93?1:t<105?1-(t-93)/12*.45:.55;
 let H=.65+bound((h-40)/60,0,1)*.38;
 let W=w<4?1.14:w<9?1:w<16?.78:w<23?.56:.4;
 let R=r>=2?.62:r>.2?.85:1;
 let dusk=Math.min(Math.abs(x.hour-x.sunrise),Math.abs(x.hour-x.sunset));
 let period=dusk<=1.5?1.18:dusk<=3?1.06:(x.hour>=x.sunset||x.hour<x.sunrise)?1:.9;
 let raw=bound((7+73*T*H*W*R*period),1,98);
 let duration=+settings.duration;
 let env=settings.yard==='shade'?1.1:settings.yard==='water'?1.18:settings.yard==='screen'?.28:1;
 let water=settings.water==='near'?1.12:settings.water==='wetland'?1.18:1;
 let place=settings.placeType==='vegetation'?1.12:settings.placeType==='screened'?.25:1;
 let rep=settings.repellent==='yes'?.55:1;
 let clothes=settings.clothes==='long'?.78:settings.clothes==='treated'?.66:1;
 let fan=settings.fan==='yes'?.87:1;
 let movement=settings.activity==='active'?1.07:1;
 // Spatial repellents may help, but efficacy is device- and setting-dependent; small illustrative adjustment only.
 let spatial=settings.spatial==='epa'?.86:1;
 const exposure=bound(duration/30,.33,4)*env*water*place*rep*clothes*fan*movement*spatial;
 return Math.round(bound(100*(1-Math.pow(1-raw/100,exposure)),0,99));
}
const messages = [
 {name:'Very low',color:'#b9f4cf',headline:'The outdoors are calling!',support:'Conditions look favorable for outdoor activities. Mosquito exposure is estimated to be minimal.'},
 {name:'Low',color:'#95d7aa',headline:'Go outside. Not on the menu.',support:'Conditions are looking good! Mosquito exposure is relatively low, but basic precautions are still recommended.'},
 {name:'Moderate',color:'#ffe092',headline:'Mosquitoes might RSVP.',support:'Some mosquito activity is expected. A little protection could make your outdoor time more comfortable.'},
 {name:'High',color:'#ffbf79',headline:"You're looking like a snack!",support:'Conditions favor increased mosquito activity. Consider repellent, protective clothing, or a screened outdoor area.'},
 {name:'Very high',color:'#ff927e',headline:"Buffet’s open. You’re on the menu!",support:'Conditions strongly favor mosquito activity. Consider additional protection or choosing a lower-risk time outdoors.'}
];
function category(n){return messages[n<20?0:n<40?1:n<60?2:n<80?3:4]}
return {score,category};
})();
