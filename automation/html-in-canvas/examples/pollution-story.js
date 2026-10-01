/**
 * A Breath of Air — global air pollution, India's crisis, and what works.
 *
 * A four-scene, ~26 s HTML-in-Canvas composition, used as the README showcase.
 * Every clip is vanilla HTML/CSS; the entrances are CSS @keyframes, which the
 * editor compiles into a deterministic onFrame(t) at clip creation, so the whole
 * piece is a pure function of the frame index.
 *
 * Usage (from automation/):
 *   node html-in-canvas/render.js html-in-canvas/examples/pollution-story.js
 *   node html-in-canvas/render.js html-in-canvas/examples/pollution-story.js -m editor -e ftrt
 */

module.exports = function (StudioPro, State) {
    StudioPro.fonts.loadGoogleBatch(['Inter', 'Space Grotesk']);

    const display = "font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;";
    const body = "font-family: 'Inter', system-ui, sans-serif;";

    StudioPro.createComposition({
        id: 'pollution-story',
        duration: 26,
        fps: 30,
        clearExisting: true,
        backgroundColor: '#05070d',
        clips: [
            // ── Scene 1 · 0–6 s — the shared problem ──────────────────────────
            StudioPro.html(
                `<div class="scene s1">
                    <div class="orb orb-a"></div>
                    <div class="orb orb-b"></div>
                    <div class="kicker">GLOBAL AIR QUALITY</div>
                    <h1 class="title">The air we share</h1>
                    <p class="sub">Air pollution is the world's largest environmental health risk.</p>
                    <div class="row">
                        <div class="stat">
                            <span class="num">7M</span>
                            <span class="lab">premature deaths a year</span>
                        </div>
                        <div class="stat">
                            <span class="num">99%</span>
                            <span class="lab">of people breathe air over WHO limits</span>
                        </div>
                    </div>
                    <div class="foot">WHO · State of Global Air</div>
                </div>`,
                `@keyframes fadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
                 @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                 @keyframes pop { 0% { opacity: 0; transform: scale(.7); } 70% { transform: scale(1.06); } 100% { opacity: 1; transform: scale(1); } }
                 @keyframes drift { 0%, 100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-26px,0); } }
                 * { margin: 0; box-sizing: border-box; }
                 .scene { width: 100%; height: 100%; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; background: radial-gradient(1200px 700px at 50% -10%, #16324f 0%, #0a1220 45%, #05070d 100%); ${display} }
                 .orb { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .55; }
                 .orb-a { width: 620px; height: 620px; left: -160px; top: -120px; background: radial-gradient(circle, #0ea5e9, transparent 65%); animation: drift 9s ease-in-out infinite; }
                 .orb-b { width: 560px; height: 560px; right: -140px; bottom: -180px; background: radial-gradient(circle, #f97316, transparent 65%); animation: drift 11s ease-in-out infinite reverse; }
                 .kicker { position: relative; font-size: 16px; letter-spacing: 6px; font-weight: 600; color: #7dd3fc; opacity: 0; animation: fadeUp .7s ease-out .3s forwards; }
                 .title { position: relative; font-size: 104px; font-weight: 700; letter-spacing: -3px; color: #f8fafc; opacity: 0; animation: fadeUp .8s ease-out .5s forwards; }
                 .sub { position: relative; font-size: 26px; color: #a9b6c9; opacity: 0; animation: fadeUp .7s ease-out .8s forwards; }
                 .row { position: relative; display: flex; gap: 72px; margin-top: 34px; }
                 .stat { display: flex; flex-direction: column; align-items: center; gap: 8px; opacity: 0; animation: pop .7s cubic-bezier(.2,.9,.3,1.2) forwards; }
                 .stat:nth-child(1) { animation-delay: 1.2s; }
                 .stat:nth-child(2) { animation-delay: 1.5s; }
                 .num { font-size: 74px; font-weight: 700; background: linear-gradient(120deg, #38bdf8, #a78bfa); -webkit-background-clip: text; background-clip: text; color: transparent; }
                 .lab { font-size: 18px; color: #8ea0b8; max-width: 240px; text-align: center; ${body} }
                 .foot { position: absolute; bottom: 46px; font-size: 14px; letter-spacing: 2px; color: #5c6b80; opacity: 0; animation: fadeIn 1s ease-out 2.2s forwards; }`,
                '',
                { start: 0, duration: 6, fonts: ['Inter', 'Space Grotesk'] }
            ),

            // ── Scene 2 · 6–13 s — India's invisible crisis ───────────────────
            StudioPro.html(
                `<div class="scene s2">
                    <div class="kicker">INDIA</div>
                    <h2 class="title">An invisible crisis</h2>
                    <p class="sub">Air pollution is among India's biggest health threats — and it is measurable.</p>
                    <div class="cards">
                        <div class="card c1"><div class="bar"></div><span class="big">400+</span><span class="small">Delhi NCR AQI on a severe winter day</span></div>
                        <div class="card c2"><div class="bar"></div><span class="big">1.67M</span><span class="small">deaths a year linked to air pollution</span></div>
                        <div class="card c3"><div class="bar"></div><span class="big">21 / 30</span><span class="small">of the world's most polluted cities are in India</span></div>
                    </div>
                    <div class="foot">Lancet Planetary Health · IQAir World Air Quality Report</div>
                </div>`,
                `@keyframes fadeUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
                 @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                 @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
                 * { margin: 0; box-sizing: border-box; }
                 .scene { width: 100%; height: 100%; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: linear-gradient(160deg, #1a0f14 0%, #2a1420 55%, #120a12 100%); ${display} }
                 .kicker { font-size: 16px; letter-spacing: 6px; font-weight: 600; color: #fb7185; opacity: 0; animation: fadeUp .6s ease-out .3s forwards; }
                 .title { font-size: 82px; font-weight: 700; letter-spacing: -2px; color: #fff1f2; opacity: 0; animation: fadeUp .8s ease-out .5s forwards; }
                 .sub { font-size: 24px; color: #d6aab6; opacity: 0; animation: fadeUp .7s ease-out .8s forwards; }
                 .cards { display: flex; gap: 34px; margin-top: 44px; }
                 .card { width: 330px; padding: 34px 30px 30px; border-radius: 20px; background: rgba(255,255,255,.05); border: 1px solid rgba(251,113,133,.28); display: flex; flex-direction: column; gap: 12px; opacity: 0; animation: fadeUp .7s ease-out forwards; }
                 .bar { height: 5px; border-radius: 3px; background: linear-gradient(90deg, #fb7185, #f59e0b); transform-origin: left; transform: scaleX(0); animation: grow .9s ease-out forwards; }
                 .c1 { animation-delay: 1.2s; } .c1 .bar { width: 92%; animation-delay: 1.4s; }
                 .c2 { animation-delay: 1.5s; } .c2 .bar { width: 74%; animation-delay: 1.7s; }
                 .c3 { animation-delay: 1.8s; } .c3 .bar { width: 64%; animation-delay: 2.0s; }
                 .big { font-size: 60px; font-weight: 700; color: #ffe4e6; }
                 .small { font-size: 18px; line-height: 1.45; color: #b98d99; ${body} }
                 .foot { position: absolute; bottom: 44px; font-size: 14px; letter-spacing: 1px; color: #7d5560; opacity: 0; animation: fadeIn 1s ease-out 2.6s forwards; }`,
                '',
                { start: 6, duration: 7, fonts: ['Inter', 'Space Grotesk'] }
            ),

            // ── Scene 3 · 13–20 s — what works ────────────────────────────────
            StudioPro.html(
                `<div class="scene s3">
                    <div class="kicker">THE WAY FORWARD</div>
                    <h2 class="title">What actually works</h2>
                    <div class="grid">
                        <div class="sol g1"><span class="ico">☀️</span><span class="h">Clean power</span><span class="p">Scale solar and wind — India's 500 GW non-fossil target.</span></div>
                        <div class="sol g2"><span class="ico">🚌</span><span class="h">Clean mobility</span><span class="p">Electric buses, metro rail, and tighter fuel standards.</span></div>
                        <div class="sol g3"><span class="ico">🌾</span><span class="h">End stubble burning</span><span class="p">Crop-residue management and alternatives for farmers.</span></div>
                        <div class="sol g4"><span class="ico">🍳</span><span class="h">Clean cooking</span><span class="p">LPG and electric cooking instead of solid fuels indoors.</span></div>
                    </div>
                    <div class="foot">Proven, affordable, and already scaling.</div>
                </div>`,
                `@keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
                 @keyframes slot { from { opacity: 0; transform: translateY(40px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
                 * { margin: 0; box-sizing: border-box; }
                 .scene { width: 100%; height: 100%; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; background: radial-gradient(1100px 620px at 50% 115%, #064e3b 0%, #071a18 55%, #05070d 100%); ${display} }
                 .kicker { font-size: 16px; letter-spacing: 6px; font-weight: 600; color: #34d399; opacity: 0; animation: fadeUp .6s ease-out .3s forwards; }
                 .title { font-size: 78px; font-weight: 700; letter-spacing: -2px; color: #ecfdf5; opacity: 0; animation: fadeUp .8s ease-out .5s forwards; }
                 .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; width: 1180px; margin-top: 34px; }
                 .sol { position: relative; padding: 30px 32px; border-radius: 20px; background: rgba(255,255,255,.05); border: 1px solid rgba(52,211,153,.25); display: flex; flex-direction: column; gap: 10px; opacity: 0; animation: slot .7s cubic-bezier(.2,.9,.3,1.1) forwards; }
                 .g1 { animation-delay: 1.1s; } .g2 { animation-delay: 1.35s; } .g3 { animation-delay: 1.6s; } .g4 { animation-delay: 1.85s; }
                 .ico { font-size: 44px; }
                 .h { font-size: 28px; font-weight: 600; color: #d1fae5; }
                 .p { font-size: 18px; line-height: 1.45; color: #86a89b; ${body} }
                 .foot { position: absolute; bottom: 46px; font-size: 16px; letter-spacing: 2px; color: #4c9c82; opacity: 0; animation: fadeUp .7s ease-out 2.5s forwards; }`,
                '',
                { start: 13, duration: 7, fonts: ['Inter', 'Space Grotesk'] }
            ),

            // ── Scene 4 · 20–26 s — hope and a call to act ────────────────────
            StudioPro.html(
                `<div class="scene s4">
                    <div class="sun"></div>
                    <div class="kicker">A BREATH OF AIR</div>
                    <h1 class="title">Clean air is possible</h1>
                    <p class="sub">It is not a mystery and it is not out of reach. It is a set of decisions.</p>
                    <div class="asks">
                        <span class="ask a1">Cut emissions</span>
                        <span class="ask a2">Invest in clean energy</span>
                        <span class="ask a3">Protect the vulnerable</span>
                    </div>
                    <div class="foot">Built with HTML-in-Canvas · Studio Pro</div>
                </div>`,
                `@keyframes fadeUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
                 @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                 @keyframes riseSun { from { opacity: 0; transform: translateY(120px) scale(.85); } to { opacity: .9; transform: translateY(0) scale(1); } }
                 * { margin: 0; box-sizing: border-box; }
                 .scene { width: 100%; height: 100%; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; background: linear-gradient(180deg, #0b1a2b 0%, #123a52 55%, #2a6f86 100%); ${display} }
                 .sun { position: absolute; top: 40%; left: 50%; width: 520px; height: 520px; margin-left: -260px; border-radius: 50%; background: radial-gradient(circle, #ffd9a0 0%, #ffb266 35%, rgba(255,178,102,0) 70%); filter: blur(2px); opacity: 0; animation: riseSun 2.2s cubic-bezier(.2,.8,.3,1) .2s forwards; }
                 .kicker { position: relative; font-size: 16px; letter-spacing: 6px; font-weight: 600; color: #7dd3fc; opacity: 0; animation: fadeUp .7s ease-out .5s forwards; }
                 .title { position: relative; font-size: 96px; font-weight: 700; letter-spacing: -3px; color: #f7fbff; opacity: 0; animation: fadeUp .8s ease-out .8s forwards; }
                 .sub { position: relative; font-size: 26px; color: #cfe3ef; max-width: 860px; text-align: center; opacity: 0; animation: fadeUp .7s ease-out 1.1s forwards; }
                 .asks { position: relative; display: flex; gap: 18px; margin-top: 26px; }
                 .ask { font-size: 20px; font-weight: 600; padding: 14px 30px; border-radius: 100px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.28); color: #ffffff; opacity: 0; animation: fadeUp .6s cubic-bezier(.2,.9,.3,1.1) forwards; ${body} }
                 .a1 { animation-delay: 1.6s; } .a2 { animation-delay: 1.8s; } .a3 { animation-delay: 2.0s; }
                 .foot { position: absolute; bottom: 44px; font-size: 14px; letter-spacing: 2px; color: #9fc4d6; opacity: 0; animation: fadeIn 1s ease-out 2.6s forwards; }`,
                '',
                { start: 20, duration: 6, fonts: ['Inter', 'Space Grotesk'] }
            )
        ]
    });

    console.log('[PollutionStory] Composition created — 4 clips, 26s');
    return { id: 'pollution-story', clipCount: 4 };
};
