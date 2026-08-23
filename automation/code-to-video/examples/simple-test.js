/**
 * Simple Test — Minimal composition for testing code-to-video workflow
 * 
 * Creates a 5-second video with one HTML clip.
 * Used for testing automation, measuring timing, and identifying issues.
 */

module.exports = function(StudioPro, State) {
    // Load fonts
    StudioPro.fonts.loadGoogle('Poppins');

    // Create simple composition
    StudioPro.createComposition({
        id: 'simple-test',
        duration: 5,
        backgroundColor: '#0a0a0f',
        clips: [
            StudioPro.html(
                `<div class="card">
                    <h1>Hello World</h1>
                    <p>Test Video</p>
                </div>`,
                `.card {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    font-family: 'Poppins', sans-serif;
                }
                .card h1 { color: white; font-size: 96px; margin: 0 0 20px 0; }
                .card p { color: rgba(255,255,255,0.8); font-size: 36px; }`,
                '',
                { start: 0, duration: 5, fonts: ['Poppins'] }
            )
        ]
    });

    console.log('[SimpleTest] Composition created');
    return { id: 'simple-test', clipCount: 1 };
};
