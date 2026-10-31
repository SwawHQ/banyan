export function readCollectionSortCopy() {
    const rawCopy = document.body?.dataset.collectionSortCopy || '';
    try {
        const copy = JSON.parse(rawCopy);
        return {
            fields: copy?.fields && typeof copy.fields === 'object' ? copy.fields : {},
            actions: copy?.actions && typeof copy.actions === 'object' ? copy.actions : {},
        };
    } catch (_) {
        return { fields: {}, actions: {} };
    }
}

export function formatSortAction(copy, field, order) {
    return (copy.actions[order] || `${field}-${order}`)
        .replaceAll('{field}', () => copy.fields[field] || field);
}
