export function decodeHtmlAttribute(value) {
    return value
        .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, decimal) =>
            String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10)))
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

export function extractAttribute(text, attributeName) {
    const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escapedName}=(?:"([^"]*)"|'([^']*)')`);
    const match = text.match(pattern);
    if (!match) {
        return '';
    }
    return match[1] ?? match[2] ?? '';
}

export function extractTagAttribute(tagText, attributeName) {
    const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'<>]+))`, 'i');
    const match = tagText.match(pattern);
    if (!match) {
        return '';
    }
    return decodeHtmlAttribute(match[1] ?? match[2] ?? match[3] ?? '');
}

export function extractStartTags(text, tagName) {
    const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...text.matchAll(new RegExp(`<${escapedTagName}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
}

export function extractStylesheetHrefs(text) {
    const hrefs = [];
    for (const tag of extractStartTags(text, 'link')) {
        const rel = extractTagAttribute(tag, 'rel').toLowerCase().split(/\s+/).filter(Boolean);
        if (!rel.includes('stylesheet')) {
            continue;
        }
        const href = extractTagAttribute(tag, 'href').trim();
        if (href) {
            hrefs.push(href);
        }
    }
    return hrefs;
}

export function hasClassToken(text, token) {
    const classPattern = /<[A-Za-z][^>]*\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
    for (const match of text.matchAll(classPattern)) {
        const className = match[1] ?? match[2] ?? match[3] ?? '';
        if (className.split(/\s+/).includes(token)) {
            return true;
        }
    }
    return false;
}

export function normalizeCssAssetFamilyKey(relativePath) {
    return `${relativePath ?? ''}`
        .replace(/\.([0-9a-f]{16,})(?=\.css$)/i, '')
        .replace(/\.min(?=\.css$)/i, '')
        .replace(/^\/css\/page\.[0-9a-f]{32}\.css$/i, '/css/page.css');
}

export function extractExternalScriptSrcs(text) {
    const matches = text.matchAll(/<script\b[^>]*\bsrc=(?:"([^"]*)"|'([^']*)'|([^"' >]+))/gi);
    const refs = [];
    for (const match of matches) {
        const raw = match[1] ?? match[2] ?? match[3] ?? '';
        if (raw) {
            refs.push(raw.trim());
        }
    }
    return refs;
}

export function extractInlineScriptTextById(text, scriptId) {
    for (const match of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (extractTagAttribute(match[1], 'id') === scriptId) return match[2];
    }
    return '';
}

export function extractCanonicalHref(text) {
    for (const tag of extractStartTags(text, 'link')) {
        const relTokens = extractTagAttribute(tag, 'rel').toLowerCase().split(/\s+/).filter(Boolean);
        if (relTokens.includes('canonical')) {
            return extractTagAttribute(tag, 'href');
        }
    }
    return '';
}

export function extractMetaContent(text, name) {
    const normalizedName = name.toLowerCase();
    for (const tag of extractStartTags(text, 'meta')) {
        if (extractTagAttribute(tag, 'name').toLowerCase() === normalizedName) {
            return extractTagAttribute(tag, 'content');
        }
    }
    return '';
}

export function extractElementText(text, tagName) {
    const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`<${escapedTagName}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTagName}>`, 'i'));
    if (!match) {
        return '';
    }
    return decodeHtmlAttribute(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

export function isRedirectPage(text) {
    return /<meta\b[^>]*\bhttp-equiv=(?:"refresh"|'refresh'|refresh(?:\s|>|\/))/i.test(text);
}
