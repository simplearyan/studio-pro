/**
 * Data-Animate Adapter
 * 
 * Converts declarative data-animate attributes to WAAPI animations.
 * AI agents write simple HTML attributes instead of custom animate(t) functions.
 * 
 * Usage in HTML clip:
 *   <div data-animate="fade-in" data-delay="0.2s" data-duration="0.5s">
 *     <h1>Title</h1>
 *   </div>
 *   <div class="chart" data-animate="grow-right" data-delay="0.5s">
 *     <div class="bar" style="width: 80%"></div>
 *   </div>
 * 
 * Supported animations:
 *   fade-in, fade-out, slide-up, slide-down, slide-left, slide-right,
 *   scale-up, scale-down, grow-right, grow-left, rotate-in, bounce-in
 */

(function() {
    'use strict';

    const ANIMATIONS = {
        'fade-in': {
            from: { opacity: '0' },
            to: { opacity: '1' }
        },
        'fade-out': {
            from: { opacity: '1' },
            to: { opacity: '0' }
        },
        'slide-up': {
            from: { opacity: '0', transform: 'translateY(30px)' },
            to: { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-down': {
            from: { opacity: '0', transform: 'translateY(-30px)' },
            to: { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-left': {
            from: { opacity: '0', transform: 'translateX(30px)' },
            to: { opacity: '1', transform: 'translateX(0)' }
        },
        'slide-right': {
            from: { opacity: '0', transform: 'translateX(-30px)' },
            to: { opacity: '1', transform: 'translateX(0)' }
        },
        'scale-up': {
            from: { opacity: '0', transform: 'scale(0.8)' },
            to: { opacity: '1', transform: 'scale(1)' }
        },
        'scale-down': {
            from: { opacity: '0', transform: 'scale(1.2)' },
            to: { opacity: '1', transform: 'scale(1)' }
        },
        'grow-right': {
            from: { width: '0%' },
            to: { width: 'var(--target-width, 100%)' }
        },
        'grow-left': {
            from: { width: '0%', transform: 'translateX(100%)' },
            to: { width: 'var(--target-width, 100%)', transform: 'translateX(0)' }
        },
        'rotate-in': {
            from: { opacity: '0', transform: 'rotate(-10deg) scale(0.9)' },
            to: { opacity: '1', transform: 'rotate(0deg) scale(1)' }
        },
        'bounce-in': {
            from: { opacity: '0', transform: 'scale(0.3)' },
            to: { opacity: '1', transform: 'scale(1)' }
        }
    };

    /**
     * Initialize all data-animate elements in the document.
     * Call this once after DOM is ready.
     */
    window.initDataAnimate = function() {
        document.querySelectorAll('[data-animate]').forEach(function(el) {
            const type = el.dataset.animate;
            const delay = parseFloat(el.dataset.delay || '0') * 1000;
            const duration = parseFloat(el.dataset.duration || '0.5') * 1000;
            const easing = el.dataset.easing || 'ease-out';

            const animDef = ANIMATIONS[type];
            if (!animDef) {
                console.warn('[data-animate] Unknown animation:', type);
                return;
            }

            // Store target width for grow animations
            if (type === 'grow-right' || type === 'grow-left') {
                const targetWidth = el.style.width || getComputedStyle(el).width;
                el.style.setProperty('--target-width', targetWidth);
            }

            // Create WAAPI animation
            const keyframes = [
                Object.fromEntries(
                    Object.entries(animDef.from).map(function([k, v]) {
                        return [k, v];
                    })
                ),
                Object.fromEntries(
                    Object.entries(animDef.to).map(function([k, v]) {
                        return [k, v.replace('var(--target-width, 100%)', el.style.width || '100%')];
                    })
                )
            ];

            el.animate(keyframes, {
                duration: duration,
                delay: delay,
                easing: easing,
                fill: 'forwards'
            });
        });
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.initDataAnimate);
    } else {
        window.initDataAnimate();
    }

})();
