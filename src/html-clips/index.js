/**
 * HTML Clips Module
 * 
 * A self-contained module for rendering HTML/CSS/JS clips to Canvas.
 * 
 * Architecture:
 * - renderer.js: Core rendering (iframe → html2canvas → ImageBitmap)
 * - editor.js: UI components (HTML/CSS/JS editors, preview, templates)
 * - html2canvas.min.js: Third-party library (bundled, no CDN)
 * 
 * Usage in index.html:
 *   <script src="src/html-clips/html2canvas.min.js"></script>
 *   <script type="module" src="src/html-clips/index.js"></script>
 * 
 * Or import directly:
 *   import { renderHtmlClip, drawHtmlClip, createHtmlClip } from './src/html-clips/index.js';
 */

// ── Re-exports from renderer.js ───────────────────────────────────────────────
export {
  renderHtmlClip,
  drawHtmlClip,
  preRenderHtmlClips,
  clearCache,
  clearAllCache,
  getCacheStats,
} from './renderer.js';

// ── Re-exports from editor.js ────────────────────────────────────────────────
export {
  showHtmlEditor,
  closeEditor,
  createHtmlClip,
  HTML_CLIP_TEMPLATES,
} from './editor.js';

// ── Convenience API ───────────────────────────────────────────────────────────

/**
 * Add an HTML clip to the current project
 * 
 * @param {Object} options - Clip options (template, html, css, js, etc.)
 * @returns {Object} Created clip object
 */
export function addHtmlClip(options = {}) {
  const clip = createHtmlClip(options);
  
  if (typeof State === 'undefined') {
    console.error('[HTMLClips] State not available');
    return null;
  }
  
  // Add to clips array
  State.clips.push(clip);
  
  // Extend duration if needed
  if (clip.start + clip.duration > State.duration) {
    State.duration = Math.ceil(clip.start + clip.duration + 10);
    if (typeof updateTimelineWidth === 'function') {
      updateTimelineWidth();
    }
  }
  
  // Recalculate overlaps and redraw
  if (typeof calcOverlaps === 'function') calcOverlaps();
  if (typeof renderClips === 'function') renderClips();
  if (typeof drawCanvas === 'function') drawCanvas();
  
  return clip;
}

/**
 * Open the HTML editor for a clip
 * 
 * @param {Object} clip - HTML clip to edit
 */
export function editHtmlClip(clip) {
  if (!clip || clip.type !== 'html') {
    console.error('[HTMLClips] Invalid clip:', clip);
    return;
  }
  showHtmlEditor(clip);
}

/**
 * Delete an HTML clip and clean up resources
 * 
 * @param {Object} clip - HTML clip to delete
 */
export function deleteHtmlClip(clip) {
  if (!clip) return;
  
  // Clear render cache
  clearCache(clip.id);
  
  // Remove from State
  if (typeof State !== 'undefined') {
    const idx = State.clips.findIndex(c => c.id === clip.id);
    if (idx !== -1) {
      State.clips.splice(idx, 1);
    }
  }
  
  // Redraw
  if (typeof calcOverlaps === 'function') calcOverlaps();
  if (typeof renderClips === 'function') renderClips();
  if (typeof drawCanvas === 'function') drawCanvas();
}

// ── Global API Setup ──────────────────────────────────────────────────────────

/**
 * Setup global API for non-module usage
 * Called automatically when loaded as a script
 */
export function setupGlobalAPI() {
  window.HTMLClips = {
    // Rendering
    render: renderHtmlClip,
    draw: drawHtmlClip,
    preRender: preRenderHtmlClips,
    
    // Cache
    clearCache,
    clearAllCache,
    getCacheStats,
    
    // Editor
    showEditor: showHtmlEditor,
    closeEditor,
    
    // Clip management
    create: createHtmlClip,
    add: addHtmlClip,
    edit: editHtmlClip,
    delete: deleteHtmlClip,
    
    // Templates
    templates: HTML_CLIP_TEMPLATES,
  };
  
  console.log('[HTMLClips] Global API available at window.HTMLClips');
}

// Auto-setup if loaded as a script (not module)
if (typeof window !== 'undefined') {
  setupGlobalAPI();
}

// ── Default Export ────────────────────────────────────────────────────────────
export default {
  // Rendering
  renderHtmlClip,
  drawHtmlClip,
  preRenderHtmlClips,
  
  // Cache
  clearCache,
  clearAllCache,
  getCacheStats,
  
  // Editor
  showHtmlEditor,
  closeEditor,
  createHtmlClip,
  HTML_CLIP_TEMPLATES,
  
  // Clip management
  addHtmlClip,
  editHtmlClip,
  deleteHtmlClip,
  
  // Setup
  setupGlobalAPI,
};
