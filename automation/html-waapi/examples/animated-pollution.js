/**
 * Animated Pollution Stats — WAAPI Test Composition
 * 
 * Tests CSS keyframe animations with WAAPI seeking.
 * Each scene uses @keyframes instead of custom animate(t) functions.
 * 
 * Usage:
 *   node html-waapi/render.js examples/animated-pollution.js
 * 
 * How it works:
 *   1. HTML clips contain CSS @keyframes animations
 *   2. WAAPI adapter seeks animations to exact frame before capture
 *   3. html2canvas captures the seeked state
 *   4. Export loop builds video frame by frame
 */

module.exports = function(StudioPro, State) {
    // Load fonts
    StudioPro.fonts.loadGoogleBatch(['Inter', 'Space Grotesk']);

    // ── Scene 1: Title (0-5s) ──────────────────────────────────────────────
    const titleHtml = `
        <div style="width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f172a,#1e293b);font-family:'Space Grotesk',sans-serif;">
            <div class="badge" style="background:#22c55e;color:white;padding:8px 20px;border-radius:20px;font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px;">
                Environmental Report 2024
            </div>
            <h1 class="title" style="color:white;font-size:72px;font-weight:700;text-align:center;line-height:1.1;margin:0;">
                Air Pollution<br/>Crisis
            </h1>
            <p class="subtitle" style="color:#94a3b8;font-size:24px;margin-top:16px;">
                A Growing Threat to Public Health
            </p>
        </div>
    `;

    const titleCss = `
        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
        }
        .badge { animation: scaleIn 0.6s ease-out forwards; opacity: 0; }
        .title { animation: fadeSlideUp 0.8s ease-out 0.3s forwards; opacity: 0; }
        .subtitle { animation: fadeSlideUp 0.6s ease-out 0.8s forwards; opacity: 0; }
    `;

    StudioPro.html(titleHtml, titleCss, '', {
        start: 0, duration: 5, fonts: ['Space Grotesk']
    });

    // ── Scene 2: Stats (5-10s) ─────────────────────────────────────────────
    const statsHtml = `
        <div style="width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;font-family:'Inter',sans-serif;padding:80px;">
            <h2 class="stat-title" style="color:white;font-size:48px;font-weight:700;margin-bottom:60px;">Key Statistics</h2>
            <div style="display:flex;gap:40px;">
                <div class="stat-card" style="background:#1e293b;border-radius:16px;padding:40px;text-align:center;width:280px;border:1px solid #334155;">
                    <div class="stat-number" style="color:#ef4444;font-size:64px;font-weight:700;">7M</div>
                    <div style="color:#94a3b8;font-size:16px;margin-top:8px;">Deaths per year</div>
                </div>
                <div class="stat-card" style="background:#1e293b;border-radius:16px;padding:40px;text-align:center;width:280px;border:1px solid #334155;">
                    <div class="stat-number" style="color:#f59e0b;font-size:64px;font-weight:700;">99%</div>
                    <div style="color:#94a3b8;font-size:16px;margin-top:8px;">Breathing unsafe air</div>
                </div>
                <div class="stat-card" style="background:#1e293b;border-radius:16px;padding:40px;text-align:center;width:280px;border:1px solid #334155;">
                    <div class="stat-number" style="color:#3b82f6;font-size:64px;font-weight:700;">$8.1T</div>
                    <div style="color:#94a3b8;font-size:16px;margin-top:8px;">Annual economic cost</div>
                </div>
            </div>
        </div>
    `;

    const statsCss = `
        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
            from { opacity: 0; transform: scale(0.5); }
            70% { transform: scale(1.05); }
            to { opacity: 1; transform: scale(1); }
        }
        .stat-title { animation: fadeSlideUp 0.6s ease-out forwards; opacity: 0; }
        .stat-card:nth-child(1) { animation: popIn 0.5s ease-out 0.3s forwards; opacity: 0; }
        .stat-card:nth-child(2) { animation: popIn 0.5s ease-out 0.5s forwards; opacity: 0; }
        .stat-card:nth-child(3) { animation: popIn 0.5s ease-out 0.7s forwards; opacity: 0; }
    `;

    StudioPro.html(statsHtml, statsCss, '', {
        start: 5, duration: 5, fonts: ['Inter']
    });

    // ── Scene 3: Bar Chart (10-15s) ────────────────────────────────────────
    const chartHtml = `
        <div style="width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;font-family:'Inter',sans-serif;padding:80px;">
            <h2 class="chart-title" style="color:white;font-size:48px;font-weight:700;margin-bottom:40px;">Pollution Sources</h2>
            <div style="width:800px;">
                <div class="bar-row" style="display:flex;align-items:center;margin-bottom:20px;">
                    <div style="color:#94a3b8;width:140px;font-size:16px;">Transport</div>
                    <div style="flex:1;background:#1e293b;border-radius:8px;height:40px;overflow:hidden;">
                        <div class="bar bar-1" style="background:linear-gradient(90deg,#ef4444,#f97316);height:100%;border-radius:8px;"></div>
                    </div>
                    <div style="color:white;width:60px;text-align:right;font-weight:600;">35%</div>
                </div>
                <div class="bar-row" style="display:flex;align-items:center;margin-bottom:20px;">
                    <div style="color:#94a3b8;width:140px;font-size:16px;">Industry</div>
                    <div style="flex:1;background:#1e293b;border-radius:8px;height:40px;overflow:hidden;">
                        <div class="bar bar-2" style="background:linear-gradient(90deg,#f59e0b,#eab308);height:100%;border-radius:8px;"></div>
                    </div>
                    <div style="color:white;width:60px;text-align:right;font-weight:600;">28%</div>
                </div>
                <div class="bar-row" style="display:flex;align-items:center;margin-bottom:20px;">
                    <div style="color:#94a3b8;width:140px;font-size:16px;">Energy</div>
                    <div style="flex:1;background:#1e293b;border-radius:8px;height:40px;overflow:hidden;">
                        <div class="bar bar-3" style="background:linear-gradient(90deg,#3b82f6,#6366f1);height:100%;border-radius:8px;"></div>
                    </div>
                    <div style="color:white;width:60px;text-align:right;font-weight:600;">22%</div>
                </div>
                <div class="bar-row" style="display:flex;align-items:center;margin-bottom:20px;">
                    <div style="color:#94a3b8;width:140px;font-size:16px;">Agriculture</div>
                    <div style="flex:1;background:#1e293b;border-radius:8px;height:40px;overflow:hidden;">
                        <div class="bar bar-4" style="background:linear-gradient(90deg,#22c55e,#10b981);height:100%;border-radius:8px;"></div>
                    </div>
                    <div style="color:white;width:60px;text-align:right;font-weight:600;">15%</div>
                </div>
            </div>
        </div>
    `;

    const chartCss = `
        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes growRight {
            from { width: 0%; }
            to { width: var(--target-width); }
        }
        .chart-title { animation: fadeSlideUp 0.5s ease-out forwards; opacity: 0; }
        .bar-1 { --target-width: 70%; animation: growRight 0.8s ease-out 0.3s forwards; width: 0%; }
        .bar-2 { --target-width: 56%; animation: growRight 0.8s ease-out 0.5s forwards; width: 0%; }
        .bar-3 { --target-width: 44%; animation: growRight 0.8s ease-out 0.7s forwards; width: 0%; }
        .bar-4 { --target-width: 30%; animation: growRight 0.8s ease-out 0.9s forwards; width: 0%; }
    `;

    StudioPro.html(chartHtml, chartCss, '', {
        start: 10, duration: 5, fonts: ['Inter']
    });

    // ── Scene 4: CTA (15-20s) ──────────────────────────────────────────────
    const ctaHtml = `
        <div style="width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f172a,#1e293b);font-family:'Space Grotesk',sans-serif;">
            <h1 class="cta-title" style="color:white;font-size:64px;font-weight:700;text-align:center;margin-bottom:24px;">
                Take Action Today
            </h1>
            <p class="cta-sub" style="color:#94a3b8;font-size:24px;text-align:center;max-width:600px;margin-bottom:40px;">
                Every breath matters. Support clean air initiatives in your community.
            </p>
            <div class="cta-button" style="background:linear-gradient(135deg,#22c55e,#10b981);color:white;padding:16px 48px;border-radius:12px;font-size:20px;font-weight:600;">
                Learn More →
            </div>
        </div>
    `;

    const ctaCss = `
        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        .cta-title { animation: fadeSlideUp 0.6s ease-out forwards; opacity: 0; }
        .cta-sub { animation: fadeSlideUp 0.6s ease-out 0.3s forwards; opacity: 0; }
        .cta-button { animation: fadeSlideUp 0.5s ease-out 0.6s forwards, pulse 2s ease-in-out 1.2s infinite; opacity: 0; }
    `;

    StudioPro.html(ctaHtml, ctaCss, '', {
        start: 15, duration: 5, fonts: ['Space Grotesk']
    });
};
