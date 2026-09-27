/* iOS-style OG card — about the test-renderer page.
 * Design space 800×450 (16:9). Exported at 1200×630 by render-meta.mjs.
 * Dark ultramarine gradient, frosted-glass panel, hairline separators,
 * Inter (custom font) with tight display tracking, SF-style glyphs.
 * Title/subtitle for TR's meta <title> and <meta name="description">. */

export const galleryName = 'OG Card · iOS Glass';
export const title = 'Test Renderer — HTML-in-Canvas Engine';
export const description =
    'Paste HTML · CSS · JS, preview it live, and export 8 Mbps WebM — ' +
    'storyboards, wall-clock playback, and an AI code round-trip built in.';

export const ds = '16:9';
export const dur = 4;

export const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap">
<div class="stage">
  <div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
  <div class="glass">
    <div class="nav">
      <span class="pill">◼ studio pro</span>
      <span class="crumb">html-in-canvas / test-renderer</span>
    </div>
    <h1 class="big">Test&nbsp;Renderer</h1>
    <p class="tag">HTML in. Animated video out.</p>
    <div class="rows">
      <div class="row"><span class="ic">◆</span><span class="rt">SVG foreignObject engine</span><span class="rb">DOM-perfect raster</span></div>
      <div class="row"><span class="ic">◍</span><span class="rt">Wall-clock WebM · 8 Mbps</span><span class="rb">seekable, sharp</span></div>
      <div class="row"><span class="ic">▤</span><span class="rt">Storyboard JSON → short</span><span class="rb">scenes compiled to code</span></div>
      <div class="row"><span class="ic">✦</span><span class="rt">AI paste round-trip</span><span class="rb">reply becomes the stage</span></div>
    </div>
  </div>
</div>`;

export const css = `*{margin:0;padding:0;box-sizing:border-box}
.stage{width:800px;height:450px;position:relative;overflow:hidden;
  background:radial-gradient(120% 160% at 15% 0%,#1c2f55 0%,#0d1b3d 44%,#070b18 100%);
  font-family:'Inter',-apple-system,'SF Pro Display',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased}
.glow{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5}
.g1{width:460px;height:460px;left:-140px;top:-180px;background:#2b57b4}
.g2{width:380px;height:380px;right:-120px;top:-120px;background:#5a3fb8}
.g3{width:420px;height:420px;left:34%;bottom:-260px;background:#0e6f6f}
.glass{position:absolute;left:44px;top:40px;right:44px;bottom:40px;
  border-radius:32px;background:rgba(255,255,255,.09);
  border:1px solid rgba(255,255,255,.16);
  box-shadow:0 30px 70px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.22);
  backdrop-filter:blur(6px);padding:30px 38px}
.nav{display:flex;align-items:center;justify-content:space-between}
.pill{font-size:12px;font-weight:600;letter-spacing:.02em;color:#eaf0ff;
  background:rgba(255,255,255,.14);border-radius:999px;padding:6px 14px}
.crumb{font-size:11.5px;color:rgba(234,240,255,.55);letter-spacing:.06em}
.big{font-size:58px;font-weight:800;letter-spacing:-.028em;color:#f5f8ff;margin-top:16px}
.tag{font-size:19px;font-weight:500;color:rgba(234,240,255,.78);margin-top:6px;
  letter-spacing:-.01em}
.rows{position:absolute;left:38px;right:38px;bottom:26px}
.row{display:flex;align-items:center;gap:14px;padding:9px 2px;
  border-top:1px solid rgba(255,255,255,.12)}
.ic{width:22px;text-align:center;font-size:13px;color:#9db8ff}
.rt{font-size:14.5px;font-weight:600;color:#f0f4ff;letter-spacing:-.01em;flex:0 0 auto}
.rb{font-size:12px;font-weight:400;color:rgba(234,240,255,.5);margin-left:auto;
  letter-spacing:.02em}`;

export const js = `function onFrame(t){
  var g=document.querySelectorAll('.glow'), glass=document.querySelector('.glass'),
      big=document.querySelector('.big'), tag=document.querySelector('.tag'),
      rows=document.querySelectorAll('.row'), pill=document.querySelector('.pill');
  if(g[0])g[0].style.transform='translate('+(Math.sin(t/1900)*30)+'px,'+(Math.cos(t/2300)*24)+'px)';
  if(g[1])g[1].style.transform='translate('+(Math.cos(t/1700)*-26)+'px,'+(Math.sin(t/2100)*20)+'px)';
  if(g[2])g[2].style.transform='translate('+(Math.sin(t/2500)*36)+'px,0)';
  if(glass){var p=Math.max(0,Math.min((t-80)/520,1)),e=1-Math.pow(1-p,3);
    glass.style.opacity=e;glass.style.transform='translateY('+((1-e)*30)+'px) scale('+(0.965+0.035*e)+')';}
  if(pill)pill.style.opacity=Math.max(0,Math.min((t-250)/350,1));
  if(big){var bp=Math.max(0,Math.min((t-380)/560,1)),be=1-Math.pow(1-bp,3);
    big.style.opacity=be;big.style.transform='translateY('+((1-be)*22)+'px)';}
  if(tag){var tp=Math.max(0,Math.min((t-560)/420,1));
    tag.style.opacity=tp;tag.style.transform='translateY('+((1-tp)*12)+'px)';}
  for(var i=0;i<rows.length;i++){
    var rp=Math.max(0,Math.min((t-750-i*130)/420,1));
    rows[i].style.opacity=rp;rows[i].style.transform='translateX('+((1-rp)*-18)+'px)';
  }
}`;
