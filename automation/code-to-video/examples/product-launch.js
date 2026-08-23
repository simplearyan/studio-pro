/**
 * Product Launch Video — Example Composition
 * 
 * Creates a 15-second product launch video with:
 * - Gradient card intro
 * - Animated text reveal
 * - Logo fade-in
 * - CTA button
 * - Background music
 * 
 * Usage:
 *   node render.js examples/product-launch.js
 *   node render.js examples/product-launch.js output.mp4 --quality ultra
 * 
 * This script runs in the browser context via Puppeteer.
 * StudioPro and State are passed as arguments.
 */

module.exports = function(StudioPro, State) {
    // 1. Load fonts
    StudioPro.fonts.loadGoogleBatch(['Poppins', 'Inter']);

    // 2. Create the composition
    StudioPro.createComposition({
        id: 'product-launch',
        duration: 15,
        fps: 30,
        backgroundColor: '#0b0b0f',
        clips: [
            // ── Scene 1: Gradient Card (0-5s) ─────────────────────────────
            StudioPro.html(
                `<div class="gradient-card">
                    <div class="badge">NEW</div>
                    <h1>ProductX</h1>
                    <p class="subtitle">The Future of Productivity</p>
                </div>`,
                `.gradient-card {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 80px;
                    border-radius: 24px;
                    text-align: center;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    font-family: 'Poppins', sans-serif;
                }
                .badge {
                    background: rgba(255,255,255,0.2);
                    color: white;
                    padding: 8px 24px;
                    border-radius: 100px;
                    font-size: 24px;
                    font-weight: 600;
                    letter-spacing: 2px;
                    margin-bottom: 40px;
                }
                .gradient-card h1 {
                    color: white;
                    font-size: 96px;
                    font-weight: 700;
                    margin: 0 0 20px 0;
                }
                .subtitle {
                    color: rgba(255, 255, 255, 0.85);
                    font-size: 36px;
                    font-weight: 400;
                }`,
                '',
                { start: 0, duration: 5, fonts: ['Poppins'] }
            ),

            // ── Scene 2: Feature Text (5-10s) ─────────────────────────────
            StudioPro.text('10× Faster Workflow', {
                start: 5,
                duration: 5,
                effects: {
                    fontFamily: 'Poppins',
                    fontSize: 84,
                    fillColor: '#ffffff',
                    textAlign: 'center',
                    animIn: 'fade',
                    animInDur: 1.0
                }
            }),

            // ── Scene 3: CTA (10-15s) ─────────────────────────────────────
            StudioPro.html(
                `<div class="cta-card">
                    <h2>Ready to Start?</h2>
                    <button>Get Started Free</button>
                </div>`,
                `.cta-card {
                    background: #1a1a2e;
                    padding: 100px;
                    border-radius: 24px;
                    text-align: center;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    font-family: 'Poppins', sans-serif;
                }
                .cta-card h2 {
                    color: white;
                    font-size: 72px;
                    margin: 0 0 40px 0;
                }
                .cta-card button {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    border: none;
                    padding: 24px 64px;
                    border-radius: 100px;
                    font-size: 32px;
                    font-weight: 600;
                    cursor: pointer;
                }`,
                '',
                { start: 10, duration: 5, fonts: ['Poppins'] }
            )
        ]
    });

    // 3. Apply animations using the Animation System (M8)
    const clips = State.clips;

    // Animate the gradient card
    if (clips[0]) {
        StudioPro.keyframes(clips[0], {
            opacity: [
                { frame: 0, value: 0 },
                { frame: 15, value: 100 }
            ],
            scale: [
                { frame: 0, value: 0.9 },
                { frame: 15, value: 1.0, easing: 'easeOut' }
            ]
        });
    }

    // Animate the feature text with spring
    if (clips[1]) {
        StudioPro.keyframes(clips[1], {
            scale: [
                { frame: 0, value: 0.5 },
                { frame: 30, value: 1.0, easing: 'easeOut' }
            ]
        });
    }

    // Animate the CTA
    if (clips[2]) {
        StudioPro.keyframes(clips[2], {
            opacity: [
                { frame: 0, value: 0 },
                { frame: 20, value: 100 }
            ],
            y: [
                { frame: 0, value: 5 },
                { frame: 20, value: 0, easing: 'easeOut' }
            ]
        });
    }

    console.log('[ProductLaunch] Composition created: 3 scenes, 15s, 30fps');
    return { id: 'product-launch', clipCount: 3 };
};
