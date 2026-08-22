/**
 * HTML Clip Editor
 * 
 * Provides UI components for editing HTML/CSS/JS clips:
 * - HTML/CSS/JS text editors with syntax highlighting
 * - Live preview panel
 * - Apply/reset buttons
 * - Clip creation dialog
 * 
 * Usage:
 *   import { showHtmlEditor, createHtmlClip } from './editor.js';
 *   showHtmlEditor(clip); // Opens editor for existing clip
 *   const clip = createHtmlClip(); // Creates new HTML clip
 */

// ── State ─────────────────────────────────────────────────────────────────────
let currentClip = null;
let editorOverlay = null;

// ── Default Templates ─────────────────────────────────────────────────────────

export const HTML_CLIP_TEMPLATES = {
  gradientCard: {
    name: 'Gradient Card',
    html: `<div class="gradient-card">
  <h1>Title Here</h1>
  <p>Subtitle text</p>
</div>`,
    css: `.gradient-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60px;
  border-radius: 20px;
  text-align: center;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.gradient-card h1 {
  color: white;
  font-size: 48px;
  font-weight: 700;
  margin-bottom: 20px;
}

.gradient-card p {
  color: rgba(255, 255, 255, 0.9);
  font-size: 24px;
}`,
  },
  
  glassmorphism: {
    name: 'Glassmorphism',
    html: `<div class="glass-card">
  <h2>Glass Effect</h2>
  <p>Frosted glass look</p>
</div>`,
    css: `body {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.glass-card h2 {
  color: white;
  font-size: 36px;
  margin-bottom: 15px;
}

.glass-card p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 18px;
}`,
  },
  
  minimal: {
    name: 'Minimal Text',
    html: `<div class="minimal">
  <h1>Clean & Simple</h1>
</div>`,
    css: `.minimal {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #111;
}

.minimal h1 {
  color: white;
  font-size: 64px;
  font-weight: 300;
  letter-spacing: 8px;
  text-transform: uppercase;
}`,
  },
  
  dataViz: {
    name: 'Data Visualization',
    html: `<div class="chart">
  <div class="bar" style="height: 60%; background: #3b82f6;"></div>
  <div class="bar" style="height: 80%; background: #10b981;"></div>
  <div class="bar" style="height: 40%; background: #f59e0b;"></div>
  <div class="bar" style="height: 90%; background: #ef4444;"></div>
  <div class="bar" style="height: 70%; background: #8b5cf6;"></div>
</div>`,
    css: `.chart {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 20px;
  padding: 40px;
  background: #1f2937;
}

.bar {
  width: 60px;
  border-radius: 8px 8px 0 0;
  transition: height 0.3s ease;
}`,
  },
};

// ── Editor UI ─────────────────────────────────────────────────────────────────

/**
 * Create the editor overlay HTML
 * @returns {string} HTML string
 */
function createEditorHTML() {
  return `
    <div id="htmlClipEditorOverlay" class="fixed inset-0 bg-surface-950/70 backdrop-blur-sm z-[150] hidden items-center justify-center p-4">
      <div class="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-surface-200 dark:border-surface-700">
          <div class="flex items-center gap-2">
            <i data-lucide="code" class="w-5 h-5 text-brand-600"></i>
            <span class="font-bold text-surface-900 dark:text-white">HTML Clip Editor</span>
          </div>
          <button onclick="window.htmlClipEditor.close()" class="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
            <i data-lucide="x" class="w-4 h-4 text-surface-500"></i>
          </button>
        </div>
        
        <!-- Template Selector -->
        <div class="px-5 py-3 border-b border-surface-200 dark:border-surface-700">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs text-surface-500">Templates:</span>
            <button onclick="window.htmlClipEditor.applyTemplate('gradientCard')" class="px-3 py-1 text-xs rounded-full bg-surface-100 dark:bg-surface-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">Gradient Card</button>
            <button onclick="window.htmlClipEditor.applyTemplate('glassmorphism')" class="px-3 py-1 text-xs rounded-full bg-surface-100 dark:bg-surface-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">Glassmorphism</button>
            <button onclick="window.htmlClipEditor.applyTemplate('minimal')" class="px-3 py-1 text-xs rounded-full bg-surface-100 dark:bg-surface-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">Minimal</button>
            <button onclick="window.htmlClipEditor.applyTemplate('dataViz')" class="px-3 py-1 text-xs rounded-full bg-surface-100 dark:bg-surface-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">Data Viz</button>
          </div>
        </div>
        
        <!-- Content (Split View) -->
        <div class="flex-1 flex overflow-hidden">
          
          <!-- Left: Editors -->
          <div class="flex-1 flex flex-col border-r border-surface-200 dark:border-surface-700 overflow-y-auto">
            
            <!-- HTML Editor -->
            <div class="p-4 border-b border-surface-200 dark:border-surface-700">
              <label class="block text-xs font-bold text-surface-500 mb-2">HTML</label>
              <textarea 
                id="htmlClipHtmlEditor" 
                class="w-full h-32 p-3 text-sm font-mono bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder="<div>Your HTML here</div>"
                spellcheck="false"
              ></textarea>
            </div>
            
            <!-- CSS Editor -->
            <div class="p-4 border-b border-surface-200 dark:border-surface-700">
              <label class="block text-xs font-bold text-surface-500 mb-2">CSS</label>
              <textarea 
                id="htmlClipCssEditor" 
                class="w-full h-24 p-3 text-sm font-mono bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder=".class { color: red; }"
                spellcheck="false"
              ></textarea>
            </div>
            
            <!-- JS Editor (Optional) -->
            <div class="p-4">
              <label class="block text-xs font-bold text-surface-500 mb-2">JavaScript (optional)</label>
              <textarea 
                id="htmlClipJsEditor" 
                class="w-full h-20 p-3 text-sm font-mono bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder="/* Animation logic */"
                spellcheck="false"
              ></textarea>
            </div>
            
          </div>
          
          <!-- Right: Preview -->
          <div class="w-80 flex flex-col bg-surface-100 dark:bg-surface-800">
            <div class="px-4 py-2 border-b border-surface-200 dark:border-surface-700">
              <span class="text-xs font-bold text-surface-500">Preview</span>
            </div>
            <div class="flex-1 p-4 flex items-center justify-center">
              <div 
                id="htmlClipPreview" 
                class="w-full h-48 bg-white dark:bg-surface-900 rounded-lg shadow-inner overflow-hidden border border-surface-200 dark:border-surface-700"
                style="aspect-ratio: 16/9;"
              ></div>
            </div>
            <div class="px-4 py-2 border-t border-surface-200 dark:border-surface-700">
              <button 
                onclick="window.htmlClipEditor.updatePreview()"
                class="w-full py-2 text-xs font-bold bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 rounded-lg transition-colors"
              >
                Refresh Preview
              </button>
            </div>
          </div>
          
        </div>
        
        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 px-5 py-3 border-t border-surface-200 dark:border-surface-700">
          <button 
            onclick="window.htmlClipEditor.close()"
            class="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onclick="window.htmlClipEditor.apply()"
            class="px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
          >
            Apply
          </button>
        </div>
        
      </div>
    </div>
  `;
}

/**
 * Initialize the editor (inject HTML, setup global)
 */
function initEditor() {
  if (document.getElementById('htmlClipEditorOverlay')) return;
  
  const div = document.createElement('div');
  div.innerHTML = createEditorHTML();
  document.body.appendChild(div.firstElementChild);
  
  // Setup global API
  window.htmlClipEditor = {
    open: openEditor,
    close: closeEditor,
    apply: applyChanges,
    applyTemplate: applyTemplate,
    updatePreview: updatePreview,
  };
}

/**
 * Open editor for a clip
 * @param {Object} clip - HTML clip object
 */
export function showHtmlEditor(clip) {
  initEditor();
  
  currentClip = clip;
  
  // Populate editors
  document.getElementById('htmlClipHtmlEditor').value = clip.html || '';
  document.getElementById('htmlClipCssEditor').value = clip.css || '';
  document.getElementById('htmlClipJsEditor').value = clip.js || '';
  
  // Show overlay
  const overlay = document.getElementById('htmlClipEditorOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  
  // Initial preview
  updatePreview();
  
  // Focus HTML editor
  document.getElementById('htmlClipHtmlEditor').focus();
}

/**
 * Close the editor
 */
export function closeEditor() {
  const overlay = document.getElementById('htmlClipEditorOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }
  currentClip = null;
}

/**
 * Apply changes to clip
 */
function applyChanges() {
  if (!currentClip) return;
  
  currentClip.html = document.getElementById('htmlClipHtmlEditor').value;
  currentClip.css = document.getElementById('htmlClipCssEditor').value;
  currentClip.js = document.getElementById('htmlClipJsEditor').value;
  
  // Clear render cache for this clip
  if (typeof clearCache === 'function') {
    clearCache(currentClip.id);
  }
  
  // Trigger redraw
  if (typeof drawCanvas === 'function') {
    drawCanvas();
  }
  if (typeof renderClips === 'function') {
    renderClips();
  }
  
  closeEditor();
}

/**
 * Apply a template to the editor
 * @param {string} templateKey - Template key from HTML_CLIP_TEMPLATES
 */
function applyTemplate(templateKey) {
  const template = HTML_CLIP_TEMPLATES[templateKey];
  if (!template) return;
  
  document.getElementById('htmlClipHtmlEditor').value = template.html;
  document.getElementById('htmlClipCssEditor').value = template.css;
  document.getElementById('htmlClipJsEditor').value = template.js || '';
  
  updatePreview();
}

/**
 * Update the live preview
 */
function updatePreview() {
  const preview = document.getElementById('htmlClipPreview');
  if (!preview) return;
  
  const html = document.getElementById('htmlClipHtmlEditor').value;
  const css = document.getElementById('htmlClipCssEditor').value;
  const js = document.getElementById('htmlClipJsEditor').value;
  
  // Clear and write new content
  preview.innerHTML = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${css}
    </style>
    ${html}
    ${js ? `<script>${js}<\/script>` : ''}
  `;
}

// ── Clip Creation ─────────────────────────────────────────────────────────────

/**
 * Create a new HTML clip with default values
 * @param {Object} options - Override options
 * @returns {Object} New HTML clip object
 */
export function createHtmlClip(options = {}) {
  const template = options.template || 'gradientCard';
  const tmpl = HTML_CLIP_TEMPLATES[template] || HTML_CLIP_TEMPLATES.gradientCard;
  
  return {
    // Identity
    id: 'html_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    type: 'html',
    title: tmpl.name || 'HTML Clip',
    trackId: options.trackId || (typeof State !== 'undefined' && State.tracks[0]?.id) || 't1',
    sceneId: options.sceneId || (typeof State !== 'undefined' ? State.activeSceneId : null),
    colorIndex: 5, // Purple for HTML clips
    zIndex: 0,
    hidden: false,
    locked: false,
    
    // Timing
    start: options.start || (typeof State !== 'undefined' ? State.currentTime : 0),
    duration: options.duration || 5,
    
    // HTML Content
    html: options.html || tmpl.html,
    css: options.css || tmpl.css,
    js: options.js || tmpl.js || '',
    
    // Rendering
    renderWidth: options.renderWidth || 1920,
    renderHeight: options.renderHeight || 1080,
    backgroundColor: options.backgroundColor || 'transparent',
    
    // Effects (same as other clips)
    effects: {
      scale: 1,
      rotate: 0,
      offsetX: 0,
      offsetY: 0,
      opacity: 100,
      
      strokeEnable: false,
      strokeColor: '#ffffff',
      strokeWidth: 4,
      
      shadowEnable: false,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowBlur: 20,
      shadowX: 0,
      shadowY: 10,
      
      borderRadius: 0,
      
      animIn: 'none',
      animInDur: 1.0,
      animInDelay: 0,
      animInEase: 'easeOut',
      animSlideDir: 'up',
      animSlideOffCanvas: true,
      
      animOut: 'none',
      animOutDur: 1.0,
      animOutDelay: 0,
      
      animLoop: 'none',
      
      blendMode: 'source-over',
      
      ...options.effects,
    },
    
    // Keyframes
    keyframes: options.keyframes || {},
  };
}

// ── Export ────────────────────────────────────────────────────────────────────
export default {
  showHtmlEditor,
  closeEditor,
  createHtmlClip,
  HTML_CLIP_TEMPLATES,
};
