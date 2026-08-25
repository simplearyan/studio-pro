/**
 * WAAPI Seek Engine
 * 
 * Deterministically seeks CSS keyframe animations using the browser's native
 * Web Animations API. No libraries needed — uses getAnimations() which is
 * built into all modern browsers.
 * 
 * Usage in iframe:
 *   <script src="waapi-seek.js"></script>
 *   <style>
 *     @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
 *     .title { animation: fadeIn 0.5s ease forwards; }
 *   </style>
 *   <h1 class="title">Hello</h1>
 * 
 * Then from parent:
 *   iframe.contentWindow.seekToFrame(30, 30); // frame 30 at 30fps
 */

(function() {
    'use strict';

    const fps = 30; // default, can be overridden

    /**
     * Seek ALL animations in this document to a specific frame.
     * Works with CSS @keyframes, WAAPI animations, and inline styles.
     * 
     * @param {number} frame - Frame number (0-based)
     * @param {number} [framesPerSec=30] - Frames per second
     */
    window.seekToFrame = function(frame, framesPerSec) {
        const fps = framesPerSec || 30;
        const ms = (frame / fps) * 1000;

        // 1. Seek all WAAPI animations (CSS @keyframes + JS animations)
        try {
            const animations = document.getAnimations({ subtree: true });
            animations.forEach(function(anim) {
                anim.pause();
                anim.currentTime = ms;
            });
        } catch(e) {
            // getAnimations() not supported in older browsers
        }

        // 2. Update CSS custom properties for rules that use them
        try {
            document.documentElement.style.setProperty('--frame', frame);
            document.documentElement.style.setProperty('--progress', (ms / 1000).toFixed(4));
            document.documentElement.style.setProperty('--t', (ms / 1000).toFixed(4));
        } catch(e) {}

        // 3. Backward compat: call animate(t) if defined
        try {
            if (typeof window.animate === 'function') {
                window.animate(ms / 1000);
            }
        } catch(e) {
            console.warn('[WAAPI] animate() error:', e.message);
        }
    };

    /**
     * Get the current animation state at a given frame.
     * Useful for debugging which animations are active.
     */
    window.getAnimationState = function(frame, framesPerSec) {
        const f = framesPerSec || 30;
        const ms = (frame / f) * 1000;
        const animations = document.getAnimations({ subtree: true });
        
        return animations.map(function(anim) {
            return {
                name: anim.animationName || 'unnamed',
                duration: anim.effect ? anim.effect.getComputedTiming().duration : 0,
                currentTime: anim.currentTime,
                playState: anim.playState,
                localTime: ms
            };
        });
    };

})();
