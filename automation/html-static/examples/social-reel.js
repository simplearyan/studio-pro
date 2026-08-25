/**
 * Social Reel — Example Composition
 * 
 * Creates a 10-second vertical (9:16) social media reel with:
 * - Animated gradient background
 * - Bold text with spring animation
 * - Quick cuts between scenes
 * 
 * Usage:
 *   node render.js examples/social-reel.js
 *   node render.js examples/social-reel.js reel.mp4 --format webm
 */

module.exports = function(StudioPro, State) {
    // 1. Load fonts
    StudioPro.fonts.loadGoogle('Montserrat');

    // 2. Create vertical composition (9:16)
    StudioPro.createComposition({
        id: 'social-reel',
        duration: 10,
        fps: 30,
        backgroundColor: '#000000',
        clips: [
            // ── Scene 1: Hook (0-3s) ──────────────────────────────────────
            StudioPro.html(
                `<div class="hook">
                    <h1>Stop Scrolling</h1>
                </div>`,
                `.hook {
                    background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%);
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-family: 'Montserrat', sans-serif;
                }
                .hook h1 {
                    color: white;
                    font-size: 120px;
                    font-weight: 900;
                    text-transform: uppercase;
                    text-align: center;
                    text-shadow: 4px 4px 0px rgba(0,0,0,0.3);
                }`,
                '',
                { start: 0, duration: 3, fonts: ['Montserrat'] }
            ),

            // ── Scene 2: Value Prop (3-6s) ────────────────────────────────
            StudioPro.text('Save 10 Hours Every Week', {
                start: 3,
                duration: 3,
                effects: {
                    fontFamily: 'Montserrat',
                    fontSize: 72,
                    fillColor: '#ffffff',
                    textAlign: 'center',
                    animIn: 'slideUp',
                    animInDur: 0.5
                }
            }),

            // ── Scene 3: CTA (6-10s) ──────────────────────────────────────
            StudioPro.html(
                `<div class="cta">
                    <div class="arrow">↓</div>
                    <h2>Link in Bio</h2>
                </div>`,
                `.cta {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    font-family: 'Montserrat', sans-serif;
                }
                .arrow {
                    font-size: 120px;
                    color: white;
                    animation: bounce 0.5s infinite alternate;
                    margin-bottom: 40px;
                }
                .cta h2 {
                    color: white;
                    font-size: 96px;
                    font-weight: 900;
                    text-transform: uppercase;
                }
                @keyframes bounce {
                    from { transform: translateY(0); }
                    to { transform: translateY(20px); }
                }`,
                '',
                { start: 6, duration: 4, fonts: ['Montserrat'] }
            )
        ]
    });

    // 3. Apply animations
    const clips = State.clips;

    if (clips[0]) {
        StudioPro.keyframes(clips[0], {
            scale: [
                { frame: 0, value: 1.2 },
                { frame: 30, value: 1.0, easing: 'easeOut' }
            ]
        });
    }

    if (clips[2]) {
        StudioPro.keyframes(clips[2], {
            opacity: [
                { frame: 0, value: 0 },
                { frame: 15, value: 100 }
            ]
        });
    }

    console.log('[SocialReel] Composition created: 3 scenes, 10s, 9:16 vertical');
    return { id: 'social-reel', clipCount: 3 };
};
