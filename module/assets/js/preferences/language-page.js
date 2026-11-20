if (location.hash.startsWith('#languages&')) {
    history.replaceState({...history.state, languageSource:location.hash.slice(11)}, '', location.pathname + location.search);
}
document.addEventListener('click', event => {
    const choice = event.target.closest?.('a[data-language-choice]');
    if (!choice || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const source = new URLSearchParams(history.state?.languageSource);
    const path = source.get(choice.dataset.languageChoice);
    if (path?.startsWith('/') && !path.startsWith('//') && !path.includes('\\')) {
        const target = new URL(location.origin);
        target.pathname = path;
        target.search = source.get('_query') || '';
        target.hash = source.get('_hash') || '';
        location.replace(target.href);
        return;
    } else if (source.has(document.documentElement.lang)) {
        const picker = choice.closest('[data-language-settings]');
        const message = picker.dataset.languageMissing.replace(/\\n/g, '\n').replace(/\[?\{lang\}\]?/g, () => choice.querySelector('.item-title').textContent);
        if (!window.confirm(message)) return;
    }
    location.replace(choice.href);
});
