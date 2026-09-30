/* ═════════════════════════════════════════════════════════════════════
 * hic-theme.js — shared theme boot + toggle for the html-in-canvas pages.
 * Requires hic-theme.css. Loading this script in <head> (before the page
 * paints) prevents a light flash on dark-first visits:
 *   <script src="hic-theme.js"></script>
 * Any button with class .hic-theme-toggle gets wired automatically.
 * Key: localStorage('hic_theme') — same as prompts-engineer.html.
 * ═════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var KEY = 'hic_theme';
    var root = document.documentElement;

    /* boot BEFORE paint (script sits in <head>): override → system */
    var pref = null;
    try { pref = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
    var systemDark = false;
    try { systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { /* old webview */ }
    root.setAttribute('data-theme', (pref === 'light' || pref === 'dark') ? pref : (systemDark ? 'dark' : 'light'));

    /* follow the OS until the user picks explicitly */
    try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            var p = null; try { p = localStorage.getItem(KEY); } catch (er) { /* noop */ }
            if (p !== 'light' && p !== 'dark') root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        });
    } catch (e) { /* matchMedia.addEventListener unsupported — fine */ }

    /* expose for pages that want a custom control */
    window.hicTheme = {
        get: function () { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; },
        set: function (t) {
            root.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
            try { localStorage.setItem(KEY, t === 'dark' ? 'dark' : 'light'); } catch (e) { /* noop */ }
            syncButtons();
        },
        toggle: function () { this.set(this.get() === 'dark' ? 'light' : 'dark'); }
    };

    function syncButtons() {
        var btns = document.querySelectorAll('.hic-theme-toggle');
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            var dark = root.getAttribute('data-theme') === 'dark';
            b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
            b.title = b.getAttribute('aria-label');
        }
    }

    function wire() {
        var btns = document.querySelectorAll('.hic-theme-toggle');
        for (var i = 0; i < btns.length; i++) {
            if (btns[i].dataset.hicThemeWired) continue;
            btns[i].dataset.hicThemeWired = '1';
            btns[i].addEventListener('click', function () { window.hicTheme.toggle(); });
        }
        syncButtons();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
    else wire();

    /* enable theme transitions only after first paint (no flash on load) */
    requestAnimationFrame(function () {
        requestAnimationFrame(function () { root.classList.add('md-theme-anim'); });
    });
})();
