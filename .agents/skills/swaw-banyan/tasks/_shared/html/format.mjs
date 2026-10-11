export function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    const kib = bytes / 1024;
    if (kib < 1024) {
        return `${kib.toFixed(1)} KiB`;
    }
    return `${(kib / 1024).toFixed(2)} MiB`;
}

export function formatByteMetric(bytes, { includeExactBytes = true } = {}) {
    const readable = formatBytes(bytes);
    if (!includeExactBytes || readable === `${bytes} B`) {
        return readable;
    }
    return `${readable} (${bytes} B)`;
}
