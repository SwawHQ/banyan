export function decodeHtmlAttribute(value) {
    return value.replace(/&(?:#(?:[xX]([0-9a-fA-F]+)|(\d+))|(quot|amp|lt|gt));/g,
        (_, hex, decimal, named) => named
            ? { quot: '"', amp: '&', lt: '<', gt: '>' }[named]
            : String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10)));
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
    const name = attributeName.toLowerCase();
    for (const match of tagText.matchAll(/(?:^|\s)([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g)) {
        if (match[1].toLowerCase() === name) {
            return decodeHtmlAttribute(match[2] ?? match[3] ?? match[4] ?? '');
        }
    }
    return '';
}

export function extractStartTags(text, tagName) {
    const expected = tagName?.toLowerCase(), tags = [];
    // Scan whole tags first; quoted values may contain > or another tag.
    for (const match of text.matchAll(/<([a-z][a-z0-9:-]*)(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
        if (!expected || match[1].toLowerCase() === expected) tags.push(match[0]);
    }
    return tags;
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
