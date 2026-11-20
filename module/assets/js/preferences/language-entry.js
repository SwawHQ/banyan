// Carry the source's published translations only when opening the language picker.
const entry = document.querySelector('a[data-language-entry]');
entry?.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (entry.pathname === location.pathname) { event.preventDefault(); return; }
    const fields = new URLSearchParams();
    for (const alternate of document.querySelectorAll('link[rel="alternate"][hreflang]:not([hreflang="x-default"])')) {
        fields.set(alternate.hreflang, new URL(alternate.href).pathname);
    }
    fields.set(document.documentElement.lang, location.pathname);
    if (location.search) fields.set('_query', location.search);
    if (location.hash) fields.set('_hash', location.hash);
    const target = new URL(entry.href);
    target.hash = 'languages&' + fields;
    event.preventDefault();
    location.assign(target);
});
