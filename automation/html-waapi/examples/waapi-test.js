/**
 * WAAPI Animation Test — Renders a clip with CSS keyframe animations
 * Uses the html-waapi render pipeline
 * 
 * Usage: node html-waapi/render.js html-waapi/examples/waapi-test.js -m ftrt
 */

module.exports = function(StudioPro, State) {
    StudioPro.fonts.loadGoogle('Inter');

    // Scene 1: Title with fade-in (0-3s)
    StudioPro.html(
        '<div class="scene"><div class="title">WAAPI Animation Test</div><div class="subtitle">CSS @keyframes are now seekable</div></div>',
        `@keyframes fadeUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
         .scene { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #0f172a, #1e293b); font-family: 'Inter', system-ui; }
         .title { color: white; font-size: 64px; font-weight: 700; margin-bottom: 16px; animation: fadeUp 0.8s ease-out forwards; opacity: 0; }
         .subtitle { color: #94a3b8; font-size: 24px; animation: fadeUp 0.6s ease-out 0.4s forwards; opacity: 0; }`,
        '',
        { start: 0, duration: 3, fonts: ['Inter'] }
    );

    // Scene 2: Animated bar chart (3-7s)
    StudioPro.html(
        '<div class="scene"><h2 class="chart-title">Growth Metrics</h2><div class="bars"><div class="bar-row"><span class="label">Users</span><div class="track"><div class="bar bar1"></div></div><span class="val">85%</span></div><div class="bar-row"><span class="label">Revenue</span><div class="track"><div class="bar bar2"></div></div><span class="val">72%</span></div><div class="bar-row"><span class="label">Engagement</span><div class="track"><div class="bar bar3"></div></div><span class="val">93%</span></div></div></div>',
        `@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
         @keyframes growRight { from { width: 0%; } to { width: var(--w); } }
         @keyframes popIn { from { opacity: 0; transform: scale(0.5); } 70% { transform: scale(1.05); } to { opacity: 1; transform: scale(1); } }
         .scene { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; font-family: 'Inter', system-ui; padding: 80px; }
         .chart-title { color: white; font-size: 48px; font-weight: 700; margin-bottom: 48px; animation: fadeUp 0.5s ease-out forwards; opacity: 0; }
         .bars { width: 700px; }
         .bar-row { display: flex; align-items: center; margin-bottom: 24px; }
         .label { color: #94a3b8; width: 120px; font-size: 16px; }
         .track { flex: 1; background: #1e293b; border-radius: 8px; height: 48px; overflow: hidden; }
         .bar { height: 100%; border-radius: 8px; width: 0%; }
         .bar1 { background: linear-gradient(90deg, #667eea, #764ba2); --w: 85%; animation: growRight 0.8s ease-out 0.3s forwards; }
         .bar2 { background: linear-gradient(90deg, #f59e0b, #eab308); --w: 72%; animation: growRight 0.8s ease-out 0.5s forwards; }
         .bar3 { background: linear-gradient(90deg, #22c55e, #10b981); --w: 93%; animation: growRight 0.8s ease-out 0.7s forwards; }
         .val { color: white; width: 50px; text-align: right; font-weight: 600; font-size: 18px; animation: popIn 0.4s ease-out 1.2s forwards; opacity: 0; }`,
        '',
        { start: 3, duration: 4, fonts: ['Inter'] }
    );

    // Scene 3: CTA with pulse (7-10s)
    StudioPro.html(
        '<div class="scene"><div class="emoji">🚀</div><h1 class="cta-title">Ready to Launch?</h1><p class="cta-sub">Start building with WAAPI animations today</p><div class="cta-btn">Get Started →</div></div>',
        `@keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
         @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
         @keyframes pulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34,197,94,0.4); } 50% { transform: scale(1.05); box-shadow: 0 0 20px 10px rgba(34,197,94,0); } }
         .scene { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #0f172a, #1e293b); font-family: 'Inter', system-ui; }
         .emoji { font-size: 80px; animation: bounce 1s ease-in-out infinite; }
         .cta-title { color: white; font-size: 56px; font-weight: 700; margin: 24px 0 16px; animation: fadeUp 0.6s ease-out 0.2s forwards; opacity: 0; }
         .cta-sub { color: #94a3b8; font-size: 22px; margin-bottom: 32px; animation: fadeUp 0.5s ease-out 0.5s forwards; opacity: 0; }
         .cta-btn { background: linear-gradient(135deg, #22c55e, #10b981); color: white; padding: 16px 48px; border-radius: 12px; font-size: 20px; font-weight: 600; animation: fadeUp 0.5s ease-out 0.8s forwards, pulse 2s ease-in-out 1.5s infinite; opacity: 0; }`,
        '',
        { start: 7, duration: 3, fonts: ['Inter'] }
    );
};
