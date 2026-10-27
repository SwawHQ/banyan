import { readStorage, writeStorage } from '../preferences/storage.js';

const PREFERENCE_KEY = 'banyan:document-aside-expanded';
const toggle = document.getElementById('document-aside-toggle');
const aside = document.getElementById('document-aside');

function setExpanded(expanded) {
    toggle.setAttribute('aria-expanded', String(expanded));
    aside.toggleAttribute('data-expanded', expanded);
}

setExpanded(readStorage(PREFERENCE_KEY) === 'true');

function closeAside() {
    // Move focus out of content about to be hidden, without requesting a scroll.
    if (aside.contains(document.activeElement)) {
        document.getElementById('main').focus({ preventScroll: true });
    }
    // A shorter canvas may natively clamp its scroll position; do not compensate.
    setExpanded(false);
    writeStorage(PREFERENCE_KEY, 'false');
}

toggle.addEventListener('click', () => {
    if (toggle.getAttribute('aria-expanded') === 'true') return closeAside();
    // Like adding a navigation column, disclosure leaves the viewport in place.
    setExpanded(true);
    writeStorage(PREFERENCE_KEY, 'true');
});

function onEscape(event) {
    if (!event.defaultPrevented && event.key === 'Escape') closeAside();
}
toggle.addEventListener('keydown', onEscape);
aside.addEventListener('keydown', onEscape);
document.getElementById('document-aside-close').addEventListener('click', closeAside);
