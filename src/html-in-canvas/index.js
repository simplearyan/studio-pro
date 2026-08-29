/**
 * HTML-in-Canvas Module
 * 
 * Render HTML/CSS/JS directly onto <canvas> using SVG foreignObject.
 * Zero dependencies, full CSS support, deterministic animation.
 * 
 * Usage:
 *   import { HTMLCanvasRenderer, quickRender, getPreset } from './html-in-canvas/index.js';
 *   
 *   const renderer = new HTMLCanvasRenderer(1920, 1080);
 *   await renderer.setClip(html, css, js);
 *   await renderer.renderFrame(1500); // render at 1.5 seconds
 *   renderer.drawTo(mainCtx, x, y, w, h); // composite onto main canvas
 */

export { HTMLCanvasRenderer, quickRender } from './renderer.js';
export { embedWebFonts, preloadImages } from './preload.js';
export { generateWAAPIAdapter, hasKeyframes, hasOnFrame, wrapWithWAAPI } from './adapters/waapi.js';
export { PRESETS, getPreset, getPresetKeys, getPresetsByCategory } from './presets/index.js';
