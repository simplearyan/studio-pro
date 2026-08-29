/**
 * WAAPI Adapter for HTML-in-Canvas
 * 
 * Bridges CSS @keyframes animations with the onFrame(time) callback.
 * When a clip uses CSS animations, this adapter provides a seekToFrame()
 * function that pauses and positions each animation at the correct time.
 * 
 * Usage in clip JS:
 *   function onFrame(time) {
 *       // This adapter auto-seeks CSS animations to `time` ms
 *       // You can also add custom JS animation logic here
 *   }
 */

/**
 * Generate an onFrame adapter script that seeks CSS animations.
 * This is injected as the clip's JS if the clip has CSS @keyframes
 * but no custom onFrame function.
 * 
 * @param {number} fps - Frames per second for frame counting
 * @returns {string} JavaScript code that defines onFrame(time)
 */
export function generateWAAPIAdapter(fps = 30) {
    return `
(function() {
    'use strict';
    
    // Seek all CSS animations to the given time
    function seekAnimations(timeMs) {
        try {
            var animations = document.getAnimations({ subtree: true });
            for (var i = 0; i < animations.length; i++) {
                animations[i].currentTime = timeMs;
                animations[i].pause();
            }
        } catch(e) {}
        
        // Update CSS custom properties for JS-driven animations
        try {
            var frame = Math.floor(timeMs / 1000 * ${fps});
            document.documentElement.style.setProperty('--t', (timeMs / 1000).toFixed(4));
            document.documentElement.style.setProperty('--frame', String(frame));
            document.documentElement.style.setProperty('--progress', (timeMs / 1000).toFixed(4));
        } catch(e) {}
    }
    
    // Expose for manual seeking
    window.seekToFrame = function(frame, framesPerSec) {
        var fps = framesPerSec || ${fps};
        var ms = (frame / fps) * 1000;
        seekAnimations(ms);
    };
    
    // Auto-seek on frame updates
    window.onFrame = function(timeMs) {
        seekAnimations(timeMs);
    };
    
    // Signal ready
    window.__waapiReady = true;
})();
`;
}

/**
 * Check if a clip's CSS contains @keyframes animations.
 * 
 * @param {string} css - CSS string
 * @returns {boolean} True if @keyframes found
 */
export function hasKeyframes(css) {
    return /@keyframes\s+\w+/.test(css || '');
}

/**
 * Check if a clip's JS already defines onFrame(time).
 * 
 * @param {string} js - JavaScript string
 * @returns {boolean} True if onFrame is defined
 */
export function hasOnFrame(js) {
    return /function\s+onFrame\s*\(|onFrame\s*=\s*function/.test(js || '');
}

/**
 * Create a clip JS string that uses WAAPI seeking.
 * If the clip already has onFrame, wraps it with seeking.
 * If not, generates a pure WAAPI adapter.
 * 
 * @param {string} existingJs - The clip's existing JS (may be empty)
 * @param {number} fps - Frames per second
 * @returns {string} JavaScript that includes WAAPI seeking
 */
export function wrapWithWAAPI(existingJs, fps = 30) {
    if (hasOnFrame(existingJs)) {
        // User has custom onFrame — prepend WAAPI seeking
        return generateWAAPIAdapter(fps) + '\n' + existingJs;
    }
    // No custom JS — pure WAAPI adapter
    return generateWAAPIAdapter(fps);
}
