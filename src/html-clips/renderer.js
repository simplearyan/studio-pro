/**
 * HTML Clip Renderer
 * 
 * Renders HTML/CSS/JS clips to Canvas using:
 * 1. Offscreen iframe (for DOM rendering)
 * 2. html2canvas (for DOM → Canvas capture)
 * 3. ImageBitmap (for fast Canvas drawing)
 * 
 * Usage:
 *   import { renderHtmlClip, drawHtmlClip } from './renderer.js';
 *   const bitmap = await renderHtmlClip(clip, 1920, 1080);
 *   ctx.drawImage(bitmap, 0, 0);
 */

// ── Cache ─────────────────────────────────────────────────────────────────────
const renderCache = new Map(); // clipId → { bitmap, signature }

/**
 * Generate a cache signature for an HTML clip
 * @param {Object} clip - The HTML clip object
 * @returns {string} Signature string
 */
function getCacheSignature(clip) {
  return `${clip.html || ''}|||${clip.css || ''}|||${clip.js || ''}|||${clip.renderWidth || 1920}|||${clip.renderHeight || 1080}`;
}

/**
 * Check if clip has changed since last render
 * @param {Object} clip - The HTML clip object
 * @param {string} currentSig - Current signature
 * @returns {boolean} True if cache is valid
 */
function isCacheValid(clip, currentSig) {
  const cached = renderCache.get(clip.id);
  return cached && cached.signature === currentSig;
}

/**
 * Store rendered bitmap in cache
 * @param {Object} clip - The HTML clip object
 * @param {string} signature - Cache signature
 * @param {ImageBitmap} bitmap - Rendered bitmap
 */
function storeInCache(clip, signature, bitmap) {
  // Evict old cache if too many entries (keep last 50)
  if (renderCache.size > 50) {
    const firstKey = renderCache.keys().next().value;
    const oldEntry = renderCache.get(firstKey);
    if (oldEntry && oldEntry.bitmap) {
      oldEntry.bitmap.close(); // Release GPU memory
    }
    renderCache.delete(firstKey);
  }
  
  renderCache.set(clip.id, { signature, bitmap });
}

/**
 * Clear cache for a specific clip
 * @param {string} clipId - Clip ID to clear
 */
export function clearCache(clipId) {
  const cached = renderCache.get(clipId);
  if (cached && cached.bitmap) {
    cached.bitmap.close();
  }
  renderCache.delete(clipId);
}

/**
 * Clear all cached renders
 */
export function clearAllCache() {
  for (const [key, value] of renderCache) {
    if (value && value.bitmap) {
      value.bitmap.close();
    }
  }
  renderCache.clear();
}

// ── Renderer ──────────────────────────────────────────────────────────────────

/**
 * Create an offscreen iframe for HTML rendering
 * @param {number} width - Iframe width
 * @param {number} height - Iframe height
 * @returns {HTMLIFrameElement} Created iframe
 */
function createOffscreenIframe(width, height) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    position: absolute;
    left: -9999px;
    top: -9999px;
    width: ${width}px;
    height: ${height}px;
    border: none;
    pointer-events: none;
    opacity: 0;
  `;
  document.body.appendChild(iframe);
  return iframe;
}

/**
 * Write HTML/CSS/JS content to iframe
 * @param {HTMLIFrameElement} iframe - Target iframe
 * @param {Object} clip - Clip with html, css, js properties
 * @param {number} width - Render width
 * @param {number} height - Render height
 */
function writeContentToIframe(iframe, clip, width, height) {
  const doc = iframe.contentDocument;
  if (!doc) throw new Error('Cannot access iframe document');
  
  const html = clip.html || '';
  const css = clip.css || '';
  const js = clip.js || '';
  const bgColor = clip.backgroundColor || 'transparent';
  
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          /* Reset */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          /* Body sizing */
          body {
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
            background: ${bgColor};
          }
          
          /* User CSS */
          ${css}
        </style>
      </head>
      <body>
        ${html}
        ${js ? `<script>${js}<\/script>` : ''}
      </body>
    </html>
  `);
  doc.close();
}

/**
 * Wait for iframe content to render
 * @param {HTMLIFrameElement} iframe - Target iframe
 * @returns {Promise<void>}
 */
function waitForRender(iframe) {
  return new Promise((resolve) => {
    // Use requestAnimationFrame for render completion
    const check = () => {
      try {
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
          // Wait one more frame for CSS/layout
          iframe.contentWindow.requestAnimationFrame(() => {
            iframe.contentWindow.requestAnimationFrame(resolve);
          });
        } else {
          setTimeout(check, 10);
        }
      } catch (e) {
        // Cross-origin or destroyed iframe
        resolve();
      }
    };
    
    // Timeout after 2 seconds
    const timeout = setTimeout(() => {
      console.warn('[HTMLClip] Render timeout, proceeding anyway');
      resolve();
    }, 2000);
    
    check().then(() => clearTimeout(timeout));
  });
}

/**
 * Capture iframe content to canvas using html2canvas
 * @param {HTMLIFrameElement} clip - Clip object with html/css/js
 * @param {number} width - Render width
 * @param {number} height - Render height
 * @returns {Promise<HTMLCanvasElement>} Rendered canvas
 */
async function captureToCanvas(iframe, width, height) {
  // Ensure html2canvas is available
  if (typeof html2canvas === 'undefined') {
    throw new Error('html2canvas not loaded. Include html2canvas.min.js');
  }
  
  const doc = iframe.contentDocument;
  if (!doc || !doc.body) {
    throw new Error('Cannot access iframe body');
  }
  
  // Use html2canvas to capture
  const canvas = await html2canvas(doc.body, {
    width: width,
    height: height,
    backgroundColor: null, // Transparent
    scale: 1, // No scaling
    useCORS: true, // Allow cross-origin images
    allowTaint: true,
    logging: false,
    // Performance options
    imageTimeout: 5000,
    removeContainer: true,
  });
  
  return canvas;
}

/**
 * Create ImageBitmap from canvas for fast drawing
 * @param {HTMLCanvasElement} canvas - Source canvas
 * @returns {Promise<ImageBitmap>} Created bitmap
 */
async function createBitmap(canvas) {
  try {
    return await createImageBitmap(canvas);
  } catch (e) {
    console.warn('[HTMLClip] createImageBitmap failed, using canvas directly');
    // Fallback: return canvas wrapped in a drawable object
    return {
      width: canvas.width,
      height: canvas.height,
      drawImage: (ctx, x, y, w, h) => ctx.drawImage(canvas, x, y, w, h),
      close: () => {},
    };
  }
}

/**
 * Main render function: HTML clip → ImageBitmap
 * 
 * @param {Object} clip - HTML clip object with html, css, js properties
 * @param {number} width - Render width (default: 1920)
 * @param {number} height - Render height (default: 1080)
 * @returns {Promise<ImageBitmap>} Rendered bitmap
 */
export async function renderHtmlClip(clip, width = 1920, height = 1080) {
  // Check cache first
  const signature = getCacheSignature(clip);
  if (isCacheValid(clip, signature)) {
    return renderCache.get(clip.id).bitmap;
  }
  
  let iframe = null;
  
  try {
    // 1. Create offscreen iframe
    iframe = createOffscreenIframe(width, height);
    
    // 2. Write HTML/CSS/JS content
    writeContentToIframe(iframe, clip, width, height);
    
    // 3. Wait for render
    await waitForRender(iframe);
    
    // 4. Capture to canvas using html2canvas
    const canvas = await captureToCanvas(iframe, width, height);
    
    // 5. Create ImageBitmap for fast drawing
    const bitmap = await createBitmap(canvas);
    
    // 6. Cache the result
    storeInCache(clip, signature, bitmap);
    
    return bitmap;
    
  } catch (error) {
    console.error('[HTMLClip] Render error:', error);
    
    // Return a placeholder bitmap (gray rectangle)
    const placeholderCanvas = document.createElement('canvas');
    placeholderCanvas.width = width;
    placeholderCanvas.height = height;
    const ctx = placeholderCanvas.getContext('2d');
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '24px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HTML Render Error', width / 2, height / 2);
    
    return await createBitmap(placeholderCanvas);
    
  } finally {
    // 7. Cleanup iframe
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}

/**
 * Draw HTML clip to canvas context with standard effects
 * 
 * @param {CanvasRenderingContext2D} ctx - Target context
 * @param {ImageBitmap|Object} bitmap - Rendered bitmap
 * @param {Object} clip - HTML clip object
 * @param {number} time - Current time in seconds
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 */
export function drawHtmlClip(ctx, bitmap, clip, time, canvasWidth, canvasHeight) {
  const clipTime = time - clip.start;
  const timeLeft = clip.duration - clipTime;
  
  // Get animation state (reuses existing calculateAnimationState)
  const aState = typeof calculateAnimationState === 'function'
    ? calculateAnimationState(clip, clipTime, timeLeft, canvasWidth, canvasHeight)
    : { animAlpha: 1, animScale: 1, animX: 0, animY: 0, animRot: 0 };
  
  const fx = clip.effects || {};
  
  ctx.save();
  
  // ── Opacity & Blend Mode ──────────────────────────────────────────────
  ctx.globalAlpha = aState.animAlpha * ((fx.opacity !== undefined ? fx.opacity : 100) / 100);
  ctx.globalCompositeOperation = fx.blendMode || 'source-over';
  
  // ── Transform ─────────────────────────────────────────────────────────
  const cx = canvasWidth / 2 + ((fx.offsetX || 0) * canvasWidth) / 100 + aState.animX;
  const cy = canvasHeight / 2 + ((fx.offsetY || 0) * canvasHeight) / 100 + aState.animY;
  
  ctx.translate(cx, cy);
  ctx.rotate(((fx.rotate || 0) * Math.PI / 180) + aState.animRot);
  ctx.scale(aState.animScale, aState.animScale);
  
  // ── Shadow ────────────────────────────────────────────────────────────
  if (fx.shadowEnable) {
    ctx.shadowColor = fx.shadowColor || 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = fx.shadowBlur || 20;
    ctx.shadowOffsetX = fx.shadowX || 0;
    ctx.shadowOffsetY = fx.shadowY || 10;
  }
  
  // ── Draw Bitmap ───────────────────────────────────────────────────────
  const drawW = canvasWidth;
  const drawH = canvasHeight;
  
  if (bitmap.drawImage) {
    // Fallback canvas object
    bitmap.drawImage(ctx, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    // ImageBitmap
    ctx.drawImage(bitmap, -drawW / 2, -drawH / 2, drawW, drawH);
  }
  
  ctx.restore();
}

/**
 * Pre-render multiple HTML clips (for export optimization)
 * 
 * @param {Object[]} clips - Array of HTML clips
 * @param {number} width - Render width
 * @param {number} height - Render height
 * @returns {Promise<Map<string, ImageBitmap>>} Map of clipId → bitmap
 */
export async function preRenderHtmlClips(clips, width = 1920, height = 1080) {
  const results = new Map();
  
  // Render in parallel (up to 3 at a time to avoid memory issues)
  const batchSize = 3;
  for (let i = 0; i < clips.length; i += batchSize) {
    const batch = clips.slice(i, i + batchSize);
    const bitmaps = await Promise.all(
      batch.map(clip => renderHtmlClip(clip, width, height))
    );
    
    batch.forEach((clip, idx) => {
      results.set(clip.id, bitmaps[idx]);
    });
  }
  
  return results;
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  return {
    size: renderCache.size,
    clips: Array.from(renderCache.keys()),
  };
}

// ── Export all ────────────────────────────────────────────────────────────────
export default {
  renderHtmlClip,
  drawHtmlClip,
  preRenderHtmlClips,
  clearCache,
  clearAllCache,
  getCacheStats,
};
