const toc = document.querySelector('.document-toc');
const content = document.querySelector('.page-content');

if (toc && content) {
    const entries = [...toc.querySelectorAll('a[href]')].map(link => ({
        link,
        heading: document.getElementById(decodeURIComponent(link.hash.slice(1)))
    })).filter(entry => entry.heading && content.contains(entry.heading));
    let current;
    let pending = false;

    function update() {
        pending = false;
        const top = content.getBoundingClientRect().top + 24;
        let next;
        for (const entry of entries) {
            if (entry.heading.getBoundingClientRect().top <= top) next = entry;
        }
        if (content.scrollTop > 0 && content.scrollHeight - content.scrollTop - content.clientHeight <= 1) {
            next = entries.at(-1);
        }
        if (next === current) return;
        current?.link.classList.remove('is-current');
        current?.link.removeAttribute('aria-current');
        next?.link.classList.add('is-current');
        next?.link.setAttribute('aria-current', 'location');
        current = next;
    }

    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(update);
    }

    function reveal(entry) {
        entry.heading.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
        // Reveal the whole reading column, not just the heading's visible end.
        content.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        schedule();
    }

    toc.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const entry = entries.find(entry => entry.link === event.target.closest('a'));
        // Keep native hash history, modified clicks and the no-script links.
        if (entry) requestAnimationFrame(() => reveal(entry));
    });

    function openChapter() {
        let id;
        try { id = decodeURIComponent(location.hash.slice(1)); } catch { /* Invalid fragments have no target. */ }
        const entry = entries.find(entry => entry.heading.id === id);
        // Chapter URLs reopen the chapter; reading progress is not stored.
        // Native history restoration completes after pageshow dispatch.
        if (entry) requestAnimationFrame(() => reveal(entry));
        schedule();
    }
    window.addEventListener('pageshow', openChapter);
    window.addEventListener('hashchange', openChapter);
    content.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    new ResizeObserver(schedule).observe(content.querySelector('.article'));
    schedule();
}
