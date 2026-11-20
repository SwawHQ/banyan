import {applyFragmentField, readFieldValue, readFragment} from '../browse/navigation-state.contract.js';

const page = document.querySelector('[data-search-page]');
const input = document.querySelector('[data-search-input]');
const results = page.querySelector('.search-results');
const status = page.querySelector('[role="status"]');
const more = page.querySelector('.search-more');
const copy = JSON.parse(page.dataset.searchCopy);
const decoder = document.createElement('textarea');
let engine, sequence = 0, timer, composing = false, selected = false;
let matches = [], offset = 0;

// Keep cancellation local to this tab; direct visits fall back to the language home.
const referrer = document.referrer ? new URL(document.referrer) : null;
const canReturn = history.state?.searchReturn ?? Boolean(referrer && referrer.origin === location.origin
    && referrer.pathname !== location.pathname && history.length > 1);
history.replaceState({...history.state, searchReturn:canReturn}, '');

function cancel() {
    if (selected) return;
    selected = true;
    clearTimeout(timer);
    sequence++;
    if (canReturn) history.back();
    else location.replace(page.dataset.searchHome);
}

async function appendResults(id) {
    more.disabled = true;
    const end = Math.min(offset + 15, matches.length);
    const items = await Promise.all(matches.slice(offset, end).map(result => result.data()));
    if (id !== sequence) return;
    for (const item of items) {
        const target = new URL(item.url, location.href);
        if (target.origin !== location.origin || !/^https?:$/.test(target.protocol)) continue;
        const article = document.createElement('article');
        article.className = 'search-result';
        const link = document.createElement('a');
        link.className = 'item-control';
        link.href = target.href;
        const title = document.createElement('span');
        title.className = 'search-result-title';
        title.textContent = item.meta.title || target.pathname;
        const excerpt = document.createElement('p');
        excerpt.className = 'search-excerpt';
        // Decode entities in an inert text control, then insert only text.
        decoder.innerHTML = item.plain_excerpt || '';
        excerpt.textContent = decoder.value;
        link.append(title, excerpt);
        article.append(link);
        results.append(article);
    }
    offset = end;
    more.hidden = offset >= matches.length;
    more.disabled = false;
}

async function search(id) {
    const query = input.value.trim();
    const url = applyFragmentField(new URL(location.href), 'q', query);
    history.replaceState(history.state, '', url);
    results.replaceChildren();
    matches = []; offset = 0; more.hidden = true;
    status.textContent = query ? copy.loading : copy.prompt;
    if (!query) return;
    try {
        engine ||= (async () => {
            const bundle = new URL(page.dataset.searchBundle, location.href);
            const response = await fetch(new URL('pagefind-entry.json', bundle), {cache:'no-cache'});
            if (!response.ok) throw new Error('Search index unavailable');
            const {languages} = await response.json();
            const language = document.documentElement.lang.toLowerCase();
            if (!Object.hasOwn(languages, language)) return null;
            return import(bundle.href);
        })().catch(error => { engine = null; throw error; });
        const api = await engine;
        if (id !== sequence) return;
        if (!api) { status.textContent = copy.empty; return; }
        const response = await api.search(query);
        if (id !== sequence) return;
        matches = response.results;
        status.textContent = matches.length ? copy.count.replace('{count}', matches.length) : copy.empty;
        await appendResults(id);
    } catch {
        if (id === sequence) status.textContent = copy.error;
    }
}

function schedule() {
    const id = ++sequence;
    clearTimeout(timer);
    if (!composing) timer = setTimeout(() => search(id), 180);
}
input.addEventListener('input', schedule);
input.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); sequence++; });
input.addEventListener('compositionend', () => { composing = false; schedule(); });
more.addEventListener('click', async () => {
    // Disabling the focused button would otherwise look like search cancellation.
    input.focus({preventScroll:true});
    const id = sequence;
    try { await appendResults(id); }
    catch { if (id === sequence) { status.textContent = copy.error; more.disabled = false; } }
});
document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (link) selected = true;
}, true);
function inside(element) { return element === input || page.contains(element); }
document.addEventListener('focusout', event => {
    if (!inside(event.target)) return;
    if (inside(event.relatedTarget) || event.relatedTarget?.closest?.('a[href]')) return;
    setTimeout(() => { if (!inside(document.activeElement) && document.hasFocus()) cancel(); }, 0);
});
document.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
    if (event.target === input && event.key === 'Enter') {
        event.preventDefault(); clearTimeout(timer); search(++sequence);
    }
    if (event.target === input && event.key === 'ArrowDown') {
        event.preventDefault(); results.querySelector('a')?.focus();
    }
});
const queryKey = 'banyan:search:' + location.pathname;
window.addEventListener('pagehide', () => {
    try {
        const query = input.value.trim();
        if (query) sessionStorage.setItem(queryKey, query);
        else sessionStorage.removeItem(queryKey);
    } catch { /* Search also works without session storage. */ }
});
window.addEventListener('pageshow', event => { if (event.persisted) selected = false; });
window.addEventListener('hashchange', () => {
    const query = readFieldValue(location.hash, 'q');
    if (query === input.value.trim()) return;
    input.value = query;
    clearTimeout(timer);
    search(++sequence);
});
const linkedQuery = readFragment(location.hash).get('q');
input.value = linkedQuery ?? '';
if (linkedQuery === null) {
    try { input.value = sessionStorage.getItem(queryKey) || ''; }
    catch { /* Leave the field empty when storage is unavailable. */ }
}
input.focus({preventScroll:true});
if (linkedQuery === null && input.value) input.select();
try { navigator.virtualKeyboard?.show(); }
catch { /* Keyboard availability must not interrupt search. */ }
document.querySelector('.page-rail').scrollIntoView({inline:'start', block:'nearest'});
if (input.value) search(++sequence);
