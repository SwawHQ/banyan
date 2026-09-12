const toggle = document.getElementById('document-aside-toggle');
const aside = document.getElementById('document-aside');

function closeAside() {
    // Move focus out of content about to be hidden, without requesting a scroll.
    if (aside.contains(document.activeElement)) {
        document.getElementById('main').focus({ preventScroll: true });
    }
    // A shorter canvas may natively clamp its scroll position; do not compensate.
    toggle.setAttribute('aria-expanded', 'false');
}

toggle.addEventListener('click', () => {
    if (toggle.getAttribute('aria-expanded') === 'true') return closeAside();
    // Like adding a navigation column, disclosure leaves the viewport in place.
    toggle.setAttribute('aria-expanded', 'true');
});

function onEscape(event) {
    if (!event.defaultPrevented && event.key === 'Escape') closeAside();
}
toggle.addEventListener('keydown', onEscape);
aside.addEventListener('keydown', onEscape);
aside.querySelector('.document-toc')?.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    // toc.js retains native fragment history and reveals the selected chapter.
    if (event.target.closest('a[href^="#"]')) closeAside();
});
