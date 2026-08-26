/**
 * Simple 5-second Google Clean WAAPI test
 * 
 * Usage: node html-waapi/render.js html-waapi/examples/google-clean-test.js -m mediabunny
 */

module.exports = function(StudioPro, State) {
    StudioPro.fonts.loadGoogle('Inter');

    StudioPro.createComposition({
        duration: 5,
        fps: 30,
        clearExisting: true,
        clips: [
            // Single 5-second clip with Google Clean style
            StudioPro.html(
                '<div class="scene"><div class="kicker">DESIGN SYSTEM</div><h1 class="title">Think different.</h1><div class="accent-line"></div><p class="subtitle">Building the future with clean, minimal design</p></div>',
                `@keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
                 @keyframes expandWidth { from { width: 0; } to { width: 80px; } }
                 .scene { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fafafa; font-family: 'Inter', -apple-system, sans-serif; gap: 12px; }
                 .kicker { font-size: 13px; font-weight: 600; letter-spacing: 4px; color: #a78bfa; text-transform: uppercase; opacity: 0; animation: fadeUp 0.6s ease-out 0.2s forwards; }
                 .title { font-size: 72px; font-weight: 700; color: #0f172a; letter-spacing: -2px; margin: 0; opacity: 0; animation: fadeUp 0.7s ease-out 0.4s forwards; }
                 .accent-line { width: 0; height: 4px; background: linear-gradient(90deg, #a78bfa, #ec4899); border-radius: 2px; animation: expandWidth 0.8s ease-out 0.6s forwards; }
                 .subtitle { font-size: 18px; color: #64748b; font-weight: 400; opacity: 0; animation: fadeUp 0.6s ease-out 0.8s forwards; }`,
                '',
                { start: 0, duration: 5, fonts: ['Inter'] }
            )
        ]
    });
};
