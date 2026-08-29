/**
 * HTML-in-Canvas Presets
 * 
 * Animated clip presets for code-to-video.
 * Each preset defines html, css, js, and duration.
 * 
 * CSS targets WRAPPER classes (not body) — SVG foreignObject has no <body>.
 * Animation uses onFrame(time) for deterministic seeking.
 */

export const PRESETS = {
    'google-clean': {
        name: 'Google Clean',
        category: 'motion',
        html: '<div class="google-container"><div class="logo"><span class="c-blue" id="l1">G</span><span class="c-red" id="l2">o</span><span class="c-yellow" id="l3">o</span><span class="c-blue" id="l4">g</span><span class="c-green" id="l5">l</span><span class="c-red" id="l6">e</span></div><div class="subtitle" id="sub">Animation Engine</div></div>',
        css: '.google-container{width:100%;height:100%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial,sans-serif}.logo{font-size:110px;font-weight:bold;letter-spacing:-4px}.c-blue{color:#4285F4}.c-red{color:#EA4335}.c-yellow{color:#FBBC05}.c-green{color:#34A853}.subtitle{font-size:26px;color:#5F6368;margin-top:15px;font-weight:300;letter-spacing:2px}',
        js: 'function onFrame(time){for(var i=1;i<=6;i++){var el=document.getElementById("l"+i);if(el){var y=Math.sin((time-i*150)/250)*20;el.style.display="inline-block";el.style.transform="translateY("+y+"px)"}}var sub=document.getElementById("sub");if(sub)sub.style.opacity=Math.abs(Math.cos(time/1000))}',
        duration: 5, fps: 30
    },

    'gradient-hero': {
        name: 'Gradient Hero',
        category: 'premium',
        html: '<div class="mesh-wrap"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="blob b4"></div><div class="content"><h1>Aura Pro</h1><p>Premium Mesh Gradients</p></div></div>',
        css: '.mesh-wrap{position:relative;width:100%;height:100%;background:#000;overflow:hidden;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif}.blob{position:absolute;border-radius:50%;filter:blur(80px);opacity:.8;mix-blend-mode:screen}.b1{width:400px;height:400px;background:#ff0080;top:-100px;left:-100px}.b2{width:500px;height:500px;background:#7928ca;bottom:-200px;right:-100px}.b3{width:450px;height:450px;background:#0070f3;bottom:-100px;left:10%}.b4{width:350px;height:350px;background:#ff4d4d;top:10%;right:20%}.content{position:relative;z-index:10;text-align:center;color:white;background:rgba(255,255,255,.05);padding:50px 70px;border-radius:40px;border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 30px 60px rgba(0,0,0,.4)}h1{font-size:72px;font-weight:700;margin:0;letter-spacing:-2px}p{font-size:20px;font-weight:300;margin:15px 0 0;color:rgba(255,255,255,.8)}',
        js: 'function onFrame(time){var b1=document.querySelector(".b1"),b2=document.querySelector(".b2"),b3=document.querySelector(".b3"),b4=document.querySelector(".b4");if(b1)b1.style.transform="translate("+Math.sin(time/2000)*100+"px,"+Math.cos(time/1500)*100+"px)scale("+(1+Math.sin(time/1000)*.2)+")";if(b2)b2.style.transform="translate("+Math.cos(time/1800)*120+"px,"+Math.sin(time/2200)*80+"px)scale("+(1+Math.cos(time/1200)*.2)+")";if(b3)b3.style.transform="translate("+Math.sin(time/2500)*-90+"px,"+Math.cos(time/1900)*110+"px)";if(b4)b4.style.transform="translate("+Math.cos(time/1700)*150+"px,"+Math.sin(time/2100)*-100+"px)"}',
        duration: 5, fps: 30
    },

    'brutal': {
        name: 'Neo-Brutal',
        category: 'motion',
        html: '<div class="brutal-wrap"><div class="brutal-card" id="bcard"><h1>NEO<br>BRUTAL</h1><p>HTML in Canvas</p><svg class="shape s1" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#FF5E5B" stroke="#000" stroke-width="6"/></svg><svg class="shape s2" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#00CECB" stroke="#000" stroke-width="6"/></svg></div></div>',
        css: '.brutal-wrap{width:100%;height:100%;background:#FFED66;display:flex;align-items:center;justify-content:center;font-family:"Courier New",monospace;overflow:hidden}.brutal-card{background:white;border:8px solid black;box-shadow:25px 25px 0 black;padding:50px;position:relative;width:500px}h1{font-size:85px;margin:0;line-height:.9;text-transform:uppercase;letter-spacing:-3px}p{font-size:32px;font-weight:bold;margin-top:20px;background:#000;color:#fff;display:inline-block;padding:5px 15px}.shape{position:absolute;width:120px;height:120px}.s1{top:-50px;right:-50px}.s2{bottom:-40px;right:60px}',
        js: 'function onFrame(time){var card=document.getElementById("bcard"),s1=document.querySelector(".s1"),s2=document.querySelector(".s2");if(card)card.style.transform="translate("+Math.cos(time/600)*10+"px,"+Math.sin(time/500)*15+"px)";if(s1)s1.style.transform="rotate("+time/15+"deg)";if(s2)s2.style.transform="scale("+(1+Math.sin(time/300)*.25)+")"}',
        duration: 5, fps: 30
    },

    'ios-glass': {
        name: 'iOS Glass',
        category: 'premium',
        html: '<div class="ios-bg"><div class="bubble b1"></div><div class="bubble b2"></div><div class="glass-card"><div class="card-icon">\uD83C\uDF4E</div><h2>iOS Glass</h2><p>Smooth blurs in Canvas</p><div class="progress-bar"><div class="progress-fill" id="fill"></div></div></div></div>',
        css: '.ios-bg{width:100%;height:100%;background:#f2f2f7;overflow:hidden;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;position:relative}.bubble{position:absolute;border-radius:50%;filter:blur(40px)}.b1{width:300px;height:300px;background:#ff3b30;top:10%;left:20%}.b2{width:400px;height:400px;background:#007aff;bottom:10%;right:15%}.glass-card{width:400px;background:rgba(255,255,255,.4);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border:1px solid rgba(255,255,255,.6);border-radius:32px;padding:40px;box-shadow:0 20px 40px rgba(0,0,0,.1);z-index:10}.card-icon{font-size:48px;margin-bottom:20px}h2{margin:0 0 10px;font-size:28px;color:#1c1c1e}p{margin:0 0 30px;color:#3a3a3c}.progress-bar{height:8px;background:rgba(0,0,0,.1);border-radius:4px;overflow:hidden}.progress-fill{width:0;height:100%;background:#007aff;border-radius:4px}',
        js: 'function onFrame(time){var fill=document.getElementById("fill"),b1=document.querySelector(".b1"),b2=document.querySelector(".b2");if(fill)fill.style.width=((Math.sin(time/1000)+1)/2*100)+"%";if(b1)b1.style.transform="translate("+Math.sin(time/1500)*50+"px,"+Math.cos(time/1200)*50+"px)";if(b2)b2.style.transform="translate("+Math.cos(time/1300)*-60+"px,"+Math.sin(time/1600)*-60+"px)"}',
        duration: 5, fps: 30
    },

    'data-chart': {
        name: 'Data Chart',
        category: 'data',
        html: '<div class="vox"><div class="eyebrow">THE NUMBERS</div><h1>Where the world\u2019s electricity<br>actually comes from</h1><div class="chart" id="chart"></div></div>',
        css: '.vox{width:100%;height:100%;background:#fff;font-family:system-ui,Helvetica,sans-serif;padding:40px 50px;box-sizing:border-box;display:flex;flex-direction:column}.eyebrow{font-weight:800;letter-spacing:2px;font-size:12px;color:#FF3B30;margin-bottom:6px}h1{font-size:27px;line-height:1.15;margin:0 0 18px;font-weight:800}.chart{display:flex;flex-direction:column;gap:10px;flex:1}.row{display:flex;align-items:center;gap:10px}.label{width:90px;font-size:12.5px;font-weight:700;text-align:right}.track{flex:1;background:#f0f0f0;border-radius:3px;height:24px;overflow:hidden}.bar{height:100%;width:0;border-radius:3px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px}.val{font-size:11.5px;font-weight:700;color:#fff}',
        js: 'var data=[{l:"Coal",v:35,c:"#2b2b2b"},{l:"Nat. Gas",v:23,c:"#6b6b6b"},{l:"Hydro",v:14,c:"#1f7a8c"},{l:"Nuclear",v:9,c:"#5551ff"},{l:"Wind",v:8,c:"#2ecc71"},{l:"Solar",v:6,c:"#f1c40f"},{l:"Other",v:5,c:"#b0b0b0"}],init=false;function onFrame(time){var chart=document.getElementById("chart");if(!init&&chart){chart.innerHTML="";data.forEach(function(d,i){var row=document.createElement("div");row.className="row";row.innerHTML="<div class=\\"label\\">"+d.l+"</div><div class=\\"track\\"><div class=\\"bar\\" style=\\"background:"+d.c+"\\"><span class=\\"val\\">0%</span></div></div>";chart.appendChild(row)});init=true}var ease=1-Math.pow(1-Math.min(time/2000,1),3);data.forEach(function(d,i){var bars=document.querySelectorAll(".bar");if(bars[i]){var p=Math.max(0,Math.min((ease-i*.08)/(1-i*.08),1));bars[i].style.width=(d.v*2.6*p)+"%";var val=bars[i].querySelector(".val");if(val)val.textContent=Math.round(d.v*p)+"%"}})}',
        duration: 5, fps: 30
    },

    'stagger': {
        name: 'Stagger Grid',
        category: 'ui',
        html: '<div class="stagger-wrap"><div class="stagger-header">FEATURED COLLECTIONS</div><div class="grid"><div class="card" id="sc0"><div class="img-box" style="background:linear-gradient(135deg,#667eea,#764ba2)"></div><span>Architecture</span></div><div class="card" id="sc1"><div class="img-box" style="background:linear-gradient(135deg,#f093fb,#f5576c)"></div><span>Gradients</span></div><div class="card" id="sc2"><div class="img-box" style="background:linear-gradient(135deg,#4facfe,#00f2fe)"></div><span>Coastal</span></div></div></div>',
        css: '.stagger-wrap{width:100%;height:100%;background:#090d16;font-family:system-ui,sans-serif;padding:60px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center}.stagger-header{color:#94a3b8;font-size:14px;font-weight:700;letter-spacing:4px;margin-bottom:25px}.grid{display:flex;gap:24px;width:100%}.card{flex:1;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.1)}.img-box{width:100%;height:260px;overflow:hidden;background:#334155}span{display:block;padding:20px;color:#fff;font-size:18px;font-weight:600}',
        js: 'function onFrame(time){for(var i=0;i<3;i++){var el=document.getElementById("sc"+i);if(el){var delay=300+i*200,p=Math.max(0,Math.min((time-delay)/800,1)),e=p===1?1:1-Math.pow(2,-10*p);el.style.opacity=e;el.style.transform="translateY("+((1-e)*50)+"px)"}}}',
        duration: 5, fps: 30
    },

    'fireship': {
        name: 'Fireship Terminal',
        category: 'code',
        html: '<div class="stage"><span class="badge">100 SECONDS</span><h1 class="grad-text">Learn any framework FAST</h1><div class="term"><div class="term-dots"><span></span><span></span><span></span></div><div class="term-line"><span class="prompt">$</span> <span id="cmd"></span><span class="cursor">|</span></div></div></div>',
        css: '.stage{width:100%;height:100%;background:#0a0a0c;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;overflow:hidden;gap:18px}.badge{font-family:monospace;font-size:11px;font-weight:700;color:#0a0a0c;background:#f5d90a;padding:4px 10px;border-radius:4px;letter-spacing:1px}.grad-text{font-size:40px;font-weight:700;margin:0;text-align:center;max-width:460px;background:linear-gradient(90deg,#ff5ec4,#7873f5,#35e2c4);-webkit-background-clip:text;background-clip:text;color:transparent}.term{width:380px;background:#131417;border:1px solid #26272c;border-radius:8px;overflow:hidden}.term-dots{display:flex;gap:6px;padding:8px 10px;background:#1b1c20}.term-dots span{width:9px;height:9px;border-radius:50%;background:#3a3b41}.term-dots span:first-child{background:#ff5f57}.term-dots span:nth-child(2){background:#febc2e}.term-dots span:nth-child(3){background:#28c840}.term-line{padding:12px 14px;font-family:monospace;font-size:13px;color:#d6d6da}.prompt{color:#35e2c4}.cursor{color:#d6d6da}',
        js: 'var _ftext="npx create-app@latest --fast";function onFrame(time){var el=document.getElementById("cmd");if(el){var chars=Math.min(_ftext.length,Math.max(0,Math.floor((time-1300)/38)));el.textContent=_ftext.slice(0,chars)}}',
        duration: 4, fps: 30
    },

    'material-you': {
        name: 'Material You',
        category: 'premium',
        html: '<div class="stage"><div class="blob blob1"></div><div class="blob blob2"></div><div class="card"><span class="chip">New</span><h1 class="title">Designed to feel alive.</h1><p class="sub">Material You adapts to you.</p></div></div>',
        css: '.stage{width:100%;height:100%;background:#101418;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;font-family:system-ui,Arial,sans-serif}.blob{position:absolute;border-radius:50%;filter:blur(40px);opacity:.55}.blob1{width:220px;height:220px;background:radial-gradient(circle,#4285F4,#8ab4f8);top:-60px;left:-60px}.blob2{width:200px;height:200px;background:radial-gradient(circle,#34A853,#FBBC05);bottom:-70px;right:-50px}.card{position:relative;z-index:2;background:rgba(255,255,255,.06);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.12);border-radius:28px;padding:34px 38px;max-width:360px}.chip{display:inline-block;background:linear-gradient(90deg,#4285F4,#34A853);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:.5px;margin-bottom:14px}.title{font-size:30px;font-weight:600;color:#e8eaed;margin:0 0 10px;line-height:1.25}.sub{color:#9aa0a6;font-size:15px;margin:0}',
        js: 'function onFrame(time){var b1=document.querySelector(".blob1"),b2=document.querySelector(".blob2");if(b1)b1.style.transform="translate("+Math.sin(time/3000)*20+"px,"+Math.cos(time/2500)*15+"px)";if(b2)b2.style.transform="translate("+Math.cos(time/2800)*-25+"px,"+Math.sin(time/3200)*20+"px)"}',
        duration: 4, fps: 30
    },

    'ios-gradient': {
        name: 'iOS Gradient',
        category: 'premium',
        html: '<div class="stage"><div class="mesh"></div><div class="content"><h1 class="headline">Beautifully simple.</h1><p class="sub">Designed for everyone.</p></div></div>',
        css: '.stage{width:100%;height:100%;position:relative;display:flex;align-items:center;justify-content:center;font-family:-apple-system,system-ui,Arial,sans-serif;overflow:hidden}.mesh{position:absolute;inset:0;background:radial-gradient(circle at 20% 30%,#ff6ec4,transparent 55%),radial-gradient(circle at 80% 20%,#7873f5,transparent 55%),radial-gradient(circle at 50% 85%,#4adede,transparent 55%),#05060a;filter:saturate(1.3)}.content{position:relative;z-index:2;text-align:center}.headline{font-size:50px;font-weight:700;letter-spacing:-1.5px;margin:0;color:#fff}.sub{margin-top:14px;font-size:19px;color:rgba(255,255,255,.75)}',
        js: 'function onFrame(time){var mesh=document.querySelector(".mesh");if(mesh)mesh.style.filter="saturate("+(1.3+Math.sin(time/4000)*.3)+") hue-rotate("+(Math.sin(time/6000)*15)+"deg)"}',
        duration: 4, fps: 30
    },

    'vox-title': {
        name: 'Vox Title',
        category: 'text',
        html: '<div class="stage"><span class="kicker" id="vkicker">THE EXPLAINER</span><div class="rule" id="vrule"></div><h1 class="title" id="vtitle">Why this actually<br>matters right now</h1><span class="tag" id="vtag">4 min read</span></div>',
        css: '.stage{width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;font-family:system-ui,Arial,sans-serif;overflow:hidden;padding:0 30px;max-width:500px;margin:0 auto}.kicker{display:inline-block;font-size:13px;font-weight:700;letter-spacing:2px;color:#FF3B30}.rule{height:6px;width:0;background:#FF3B30;margin:14px 0 16px}.title{font-weight:900;font-size:48px;line-height:.96;color:#f5f5f5;text-transform:uppercase;margin:0 0 16px;letter-spacing:-.5px}.tag{display:inline-block;font-size:13px;font-weight:600;color:#9a9a9a}',
        js: 'function onFrame(time){var kicker=document.getElementById("vkicker"),rule=document.getElementById("vrule"),title=document.getElementById("vtitle"),tag=document.getElementById("vtag");if(kicker)kicker.style.opacity=Math.min(1,time/200);if(rule)rule.style.width=Math.min(80,Math.max(0,(time-300)/600*80))+"px";if(title){var tp=Math.max(0,Math.min((time-500)/500,1));title.style.opacity=tp;title.style.transform="translateY("+(1-tp)*16+"px)"}if(tag)tag.style.opacity=Math.min(1,Math.max(0,(time-1000)/400))}',
        duration: 3, fps: 30
    },


    'reveal': {
        name: 'Text Reveal',
        category: 'text',
        html: '<div class="reveal-wrap"><h1 class="headline" id="headline">Make it clear.</h1><div class="sweep" id="sweep"></div><p class="sub" id="rsub">Simple, fast, helpful.</p></div>',
        css: '.reveal-wrap{width:100%;height:100%;background:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;text-align:center}.headline{font-size:54px;font-weight:600;margin:0;color:#1f1f1f;letter-spacing:-1px}.headline .ch{display:inline-block;opacity:0;transform:translateY(24px)}.sweep{height:6px;width:0;margin:18px auto 0;border-radius:3px;background:linear-gradient(90deg,#4285F4,#EA4335,#FBBC05,#34A853)}.sub{margin-top:22px;font-size:18px;color:#5f6368;opacity:0}',
        js: 'var _rtext="Make it clear.";function onFrame(time){var chars=document.querySelectorAll(".ch");if(!chars.length){var h=document.getElementById("headline"),html="";for(var i=0;i<_rtext.length;i++){html+="<span class=\"ch\">"+(_rtext[i]===" "?"&nbsp;":_rtext[i])+"</span>"}if(h)h.innerHTML=html;chars=document.querySelectorAll(".ch")}for(var i=0;i<chars.length;i++){var d=100+i*30,p=Math.max(0,Math.min((time-d)/400,1)),e=p===1?1:1-Math.pow(2,-10*p);chars[i].style.opacity=e;chars[i].style.transform="translateY("+(1-e)*24+"px)"}var sw=document.getElementById("sweep");if(sw)sw.style.width=Math.min(220,Math.max(0,(time-900)/800*220))+"px";var sub=document.getElementById("rsub");if(sub)sub.style.opacity=Math.max(0,Math.min((time-1400)/500,1))}',
        duration: 3, fps: 30
    },

    'gsearch': {
        name: 'Google Search',
        category: 'ui',
        html: '<div class="gs-wrap"><div class="gs-bar"><span class="gs-dot" style="background:#4285F4"></span><span class="gs-dot" style="background:#EA4335"></span><span class="gs-dot" style="background:#FBBC05"></span><span class="gs-dot" style="background:#34A853"></span><span class="gs-query" id="gq"></span><span class="gs-caret" id="gcaret">|</span></div><div class="gs-answer" id="gans"><h1>Search, simplified.</h1><p>Instant answers, right where you need them.</p></div></div>',
        css: '.gs-wrap{width:100%;height:100%;background:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui,Arial,sans-serif;flex-direction:column;gap:20px}.gs-bar{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #dfe1e5;border-radius:24px;padding:12px 20px;box-shadow:0 1px 6px rgba(32,33,36,.18)}.gs-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}.gs-query{font-family:monospace;font-size:15px;color:#202124;white-space:nowrap}.gs-caret{color:#4285F4;font-weight:700}.gs-answer{padding-left:6px;opacity:0;transform:translateY(10px)}.gs-answer h1{font-size:24px;font-weight:500;color:#202124;margin:0 0 6px}.gs-answer p{font-size:15px;color:#5f6368;margin:0}',
        js: 'var _gtext="how does it feel to search less";function onFrame(time){var el=document.getElementById("gq"),ans=document.getElementById("gans"),caret=document.getElementById("gcaret");if(el){var chars=Math.min(_gtext.length,Math.max(0,Math.floor((time-300)/45)));el.textContent=_gtext.slice(0,chars)}if(ans){var ap=Math.max(0,Math.min((time-2200)/600,1));ans.style.opacity=ap;ans.style.transform="translateY("+(1-ap)*10+"px)"}if(caret)caret.style.opacity=Math.abs(Math.sin(time/500))}',
        duration: 4, fps: 30
    }
};

/**
 * Get a preset by key
 */
export function getPreset(key) {
    return PRESETS[key] || null;
}

/**
 * Get all preset keys
 */
export function getPresetKeys() {
    return Object.keys(PRESETS);
}

/**
 * Get presets grouped by category
 */
export function getPresetsByCategory() {
    const grouped = {};
    for (const [key, preset] of Object.entries(PRESETS)) {
        const cat = preset.category || 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ key, ...preset });
    }
    return grouped;
}
