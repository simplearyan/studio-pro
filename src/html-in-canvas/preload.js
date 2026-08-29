/**
 * HTML-in-Canvas Preloader
 * 
 * Preloads Google Fonts as base64 data URIs and external images
 * so SVG foreignObject can render them without network access.
 * 
 * Zero dependencies — uses native browser APIs only.
 */

/**
 * Fetch Google Fonts CSS, extract WOFF URLs, convert to data URIs,
 * and inject into the CSS string.
 * 
 * @param {string} html - HTML string that may contain <link> font references
 * @param {string} css  - CSS string that may contain @import font references
 * @returns {{ html: string, css: string }} Modified strings with fonts embedded
 */
export async function embedWebFonts(html, css) {
    let combinedCss = css || '';
    let modifiedHtml = html || '';
    const fontUrls = [];

    // 1. Find <link href="https://fonts.googleapis.com..."> in HTML
    const linkRegex = /<link[^>]*href=["'](https:\/\/fonts\.googleapis\.com[^"']*)["'][^>]*>/gi;
    modifiedHtml = modifiedHtml.replace(linkRegex, (match, url) => {
        fontUrls.push(url.replace(/&amp;/g, '&'));
        return ''; // Remove link tag (we'll embed fonts inline)
    });

    // 2. Find @import url("https://fonts.googleapis.com...") in CSS
    const importRegex = /@import\s+(?:url\()?["']?(https:\/\/fonts\.googleapis\.com[^"')\s]*)["']?\)?\s*;/gi;
    combinedCss = combinedCss.replace(importRegex, (match, url) => {
        fontUrls.push(url.replace(/&amp;/g, '&'));
        return ''; // Remove @import
    });

    // 3. For each font URL, fetch CSS → find WOFF URLs → convert to data URIs
    for (const fontUrl of fontUrls) {
        try {
            const response = await fetch(fontUrl);
            if (!response.ok) continue;

            let fontCss = await response.text();

            // Find all url(...) in the font CSS
            const urlRegex = /url\(["']?(https:\/\/[^'")]+)["']?\)/g;
            const woffUrls = [];
            let match;
            while ((match = urlRegex.exec(fontCss)) !== null) {
                woffUrls.push(match[1]);
            }

            // Fetch each font file and convert to base64 data URI
            for (const woffUrl of woffUrls) {
                try {
                    const woffRes = await fetch(woffUrl);
                    const blob = await woffRes.blob();
                    const dataUrl = await blobToDataURL(blob);
                    fontCss = fontCss.replace(woffUrl, dataUrl);
                } catch (e) {
                    console.warn('[Preload] Failed to fetch font file:', woffUrl);
                }
            }

            combinedCss = fontCss + '\n' + combinedCss;
        } catch (e) {
            console.warn('[Preload] Failed to fetch font CSS:', fontUrl);
        }
    }

    return { html: modifiedHtml, css: combinedCss };
}

/**
 * Convert external images in HTML to base64 data URIs
 * so SVG foreignObject can render them without CORS issues.
 * 
 * @param {string} htmlString - HTML string containing <img> tags
 * @returns {Promise<string>} HTML with images converted to data URIs
 */
export async function preloadImages(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const images = doc.querySelectorAll('img');

    const promises = Array.from(images).map(async (img) => {
        const src = img.getAttribute('src');
        if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
            try {
                const response = await fetch(src, { mode: 'cors' });
                if (!response.ok) throw new Error('Network error');
                const blob = await response.blob();
                const dataUrl = await blobToDataURL(blob);
                img.setAttribute('src', dataUrl);
                img.removeAttribute('onerror');
            } catch (e) {
                console.warn('[Preload] Failed to load image:', src);
            }
        }
    });

    await Promise.allSettled(promises);
    return doc.body.innerHTML;
}

/**
 * Convert a Blob to a data URL (base64)
 * 
 * @param {Blob} blob
 * @returns {Promise<string>} data URL string
 */
function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
