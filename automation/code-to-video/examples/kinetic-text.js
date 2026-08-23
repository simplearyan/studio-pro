/**
 * Kinetic Text — Example Composition
 * 
 * Creates a 12-second kinetic typography video with:
 * - Multiple text clips with staggered animations
 * - Spring physics for natural motion
 * - Different colors and sizes
 * 
 * Usage:
 *   node render.js examples/kinetic-text.js
 *   node render.js examples/kinetic-text.js kinetic.mp4 --quality ultra
 */

module.exports = function(StudioPro, State) {
    // 1. Load fonts
    StudioPro.fonts.loadGoogleBatch(['Space Grotesk', 'Inter']);

    // 2. Create composition
    StudioPro.createComposition({
        id: 'kinetic-text',
        duration: 12,
        fps: 30,
        backgroundColor: '#0a0a0f',
        clips: [
            // ── Word 1: "Design" (0-3s) ───────────────────────────────────
            StudioPro.text('Design', {
                start: 0,
                duration: 3,
                effects: {
                    fontFamily: 'Space Grotesk',
                    fontSize: 144,
                    fillColor: '#667eea',
                    textAlign: 'center',
                    animIn: 'zoomIn',
                    animInDur: 0.8
                }
            }),

            // ── Word 2: "Build" (2-5s) ───────────────────────────────────
            StudioPro.text('Build', {
                start: 2,
                duration: 3,
                effects: {
                    fontFamily: 'Space Grotesk',
                    fontSize: 144,
                    fillColor: '#764ba2',
                    textAlign: 'center',
                    animIn: 'slideUp',
                    animInDur: 0.6
                }
            }),

            // ── Word 3: "Ship" (4-7s) ────────────────────────────────────
            StudioPro.text('Ship', {
                start: 4,
                duration: 3,
                effects: {
                    fontFamily: 'Space Grotesk',
                    fontSize: 144,
                    fillColor: '#f093fb',
                    textAlign: 'center',
                    animIn: 'pop',
                    animInDur: 0.5
                }
            }),

            // ── Tagline (7-12s) ───────────────────────────────────────────
            StudioPro.html(
                `<div class="tagline">
                    <span class="word">Fast.</span>
                    <span class="word">Beautiful.</span>
                    <span class="word">yours.</span>
                </div>`,
                `.tagline {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 40px;
                    font-family: 'Space Grotesk', sans-serif;
                    background: #0a0a0f;
                }
                .word {
                    font-size: 80px;
                    font-weight: 700;
                    color: white;
                    opacity: 0;
                    animation: fadeIn 0.5s ease-out forwards;
                }
                .word:nth-child(1) { color: #667eea; animation-delay: 0s; }
                .word:nth-child(2) { color: #764ba2; animation-delay: 0.3s; }
                .word:nth-child(3) { color: #f093fb; animation-delay: 0.6s; }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }`,
                '',
                { start: 7, duration: 5, fonts: ['Space Grotesk'] }
            )
        ]
    });

    // 3. Apply spring animations
    const clips = State.clips;

    // Word 1: Spring scale
    if (clips[0]) {
        StudioPro.keyframes(clips[0], {
            scale: [
                { frame: 0, value: 0 },
                { frame: 20, value: 1.0, easing: 'easeOut' }
            ],
            rotation: [
                { frame: 0, value: -10 },
                { frame: 20, value: 0, easing: 'easeOut' }
            ]
        });
    }

    // Word 2: Slide up with spring
    if (clips[1]) {
        StudioPro.keyframes(clips[1], {
            y: [
                { frame: 0, value: 10 },
                { frame: 18, value: 0, easing: 'easeOut' }
            ],
            opacity: [
                { frame: 0, value: 0 },
                { frame: 15, value: 100 }
            ]
        });
    }

    // Word 3: Pop scale
    if (clips[2]) {
        StudioPro.keyframes(clips[2], {
            scale: [
                { frame: 0, value: 0 },
                { frame: 10, value: 1.3 },
                { frame: 15, value: 1.0, easing: 'easeOut' }
            ]
        });
    }

    console.log('[KineticText] Composition created: 4 clips, 12s, 30fps');
    return { id: 'kinetic-text', clipCount: 4 };
};
