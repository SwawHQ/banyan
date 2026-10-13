import { readAnchor } from '../browse/navigation-state.contract.js';

const toc = document.querySelector('.document-toc');
const content = document.querySelector('.page-content');

if (toc && content) {
    const entries = [...toc.querySelectorAll('a[href]')].map(link => ({
        link,
        heading: document.getElementById(readAnchor(link.hash))
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

    window.addEventListener('pageshow', schedule);
    window.addEventListener('hashchange', schedule);
    content.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    new ResizeObserver(schedule).observe(content.querySelector('.article'));
    schedule();
}
