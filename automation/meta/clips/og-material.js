/* Google Material You OG card — about the test-renderer page.
 * Design space 800×450 (16:9). Exported at 1200×630 by render-meta.mjs.
 * Light M3 surface, elevated card, tonal assist chips, Roboto Flex.
 * Title/subtitle for TR's meta <title> and <meta name="description">. */

export const galleryName = 'OG Card · Material You';
export const title = 'Test Renderer — HTML-in-Canvas Engine';
export const description =
    'One HTML file in, animated video out: SVG-foreignObject rendering, ' +
    'wall-clock WebM export, storyboards, and an AI code round-trip.';

export const ds = '16:9';
export const dur = 4;

export const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,300..800&amp;display=swap">
<div class="stage">
  <div class="bg-orb orb-a"></div>
  <div class="bg-orb orb-b"></div>
  <div class="sheet">
    <div class="eyebrow"><span class="dot"></span>STUDIO&nbsp;PRO · HTML-IN-CANVAS</div>
    <h1 class="headline">Test&nbsp;Renderer</h1>
    <p class="sub">Paste HTML · CSS · JS — scrub it, ship it as video.</p>
    <div class="chips">
      <span class="chip c1">SVG foreignObject</span>
      <span class="chip c2">WebM · 8&nbsp;Mbps</span>
      <span class="chip c3">Storyboards</span>
      <span class="chip c4">AI round-trip</span>
    </div>
  </div>
  <div class="tonebar"><span></span><span></span><span></span><span></span></div>
</div>`;

export const css = `*{margin:0;padding:0;box-sizing:border-box}
.stage{width:800px;height:450px;position:relative;overflow:hidden;
  background:#eef1f8;font-family:'Roboto Flex',Roboto,system-ui,sans-serif}
.bg-orb{position:absolute;border-radius:50%;filter:blur(60px);opacity:.55}
.orb-a{width:420px;height:420px;left:-120px;top:-140px;background:#c8e6c9}
.orb-b{width:380px;height:380px;right:-100px;bottom:-150px;background:#d0e2ff}
.sheet{position:absolute;left:56px;top:64px;right:280px;bottom:56px;
  background:rgba(255,255,255,.82);border-radius:28px;padding:40px 44px;
  box-shadow:0 18px 44px rgba(28,42,77,.14),0 2px 6px rgba(28,42,77,.08)}
.eyebrow{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;
  letter-spacing:.14em;color:#415f91}
.dot{width:9px;height:9px;border-radius:50%;background:#4285f4}
.headline{font-size:64px;line-height:1.02;font-weight:800;letter-spacing:-.015em;
  color:#1a1c1e;margin-top:18px;font-variation-settings:'opsz' 144}
.sub{font-size:20px;line-height:1.4;color:#444746;margin-top:14px;font-weight:450}
.chips{position:absolute;left:44px;bottom:38px;display:flex;gap:10px;flex-wrap:wrap}
.chip{padding:8px 16px;border-radius:999px;font-size:13.5px;font-weight:600}
.c1{background:#d7e3ff;color:#0b57cf}.c2{background:#c9e8d2;color:#0c5132}
.c3{background:#ffe9c7;color:#7a4c00}.c4{background:#f2d9ff;color:#642685}
.tonebar{position:absolute;right:0;top:0;bottom:0;width:216px;
  display:flex;flex-direction:column}
.tonebar span{flex:1}
.tonebar span:nth-child(1){background:#0b57cf}
.tonebar span:nth-child(2){background:#4285f4}
.tonebar span:nth-child(3){background:#a8c7fa}
.tonebar span:nth-child(4){background:#d7e3ff}`;

export const js = `function onFrame(t){
  var sheet=document.querySelector('.sheet'), h=document.querySelector('.headline'),
      s=document.querySelector('.sub'), chips=document.querySelectorAll('.chip'),
      orbs=document.querySelectorAll('.bg-orb'), dots=document.querySelectorAll('.tonebar span');
  if(orbs[0])orbs[0].style.transform='translate('+(Math.sin(t/1700)*26)+'px,'+(Math.cos(t/2100)*20)+'px)';
  if(orbs[1])orbs[1].style.transform='translate('+(Math.cos(t/1900)*-24)+'px,'+(Math.sin(t/1500)*18)+'px)';
  if(sheet){var p=Math.max(0,Math.min((t-100)/500,1)),e=1-Math.pow(1-p,3);
    sheet.style.opacity=e;sheet.style.transform='translateY('+((1-e)*26)+'px)';}
  if(h){var hp=Math.max(0,Math.min((t-300)/550,1)),he=1-Math.pow(1-hp,3);
    h.style.opacity=he;h.style.transform='translateY('+((1-he)*20)+'px)';}
  if(s){var sp=Math.max(0,Math.min((t-550)/450,1));
    s.style.opacity=sp;s.style.transform='translateY('+((1-sp)*12)+'px)';}
  for(var i=0;i<chips.length;i++){
    var cp=Math.max(0,Math.min((t-750-i*110)/380,1));
    chips[i].style.opacity=cp;chips[i].style.transform='translateY('+((1-cp)*14)+'px)';
  }
  for(var j=0;j<dots.length;j++){dots[j].style.transform='scaleY('+(0.7+0.3*Math.min(1,t/900+j*0.12))+')';}
}`;
