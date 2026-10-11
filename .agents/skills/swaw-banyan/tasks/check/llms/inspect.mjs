import fs from 'node:fs/promises';
import path from 'node:path';
import {filesUnder,insideOutput,isFile,readOptional,relativeName} from '../../_shared/output.mjs';
import {decodeHtmlAttribute} from '../../_shared/html/markup.mjs';

function normalizePublicRelativePath(relativePath) {
    let normalized = `${relativePath ?? ''}`.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized === '') {
        return 'index.html';
    }
    if (normalized.endsWith('/')) {
        normalized += 'index.html';
    }
    return normalized;
}

function isIgnoredHref(href) {
    return href === ''
        || href.startsWith('#')
        || /^(?:data|javascript|mailto|tel):/i.test(href);
}

function stripMarkdownTitle(rawTarget) {
    let target = `${rawTarget ?? ''}`.trim();
    if (target.startsWith('<')) {
        const closeIndex = target.indexOf('>');
        if (closeIndex >= 0) {
            return target.slice(1, closeIndex).trim();
        }
    }
    return target.replace(/\s+["'][\s\S]*$/, '').trim();
}

function extractMarkdownLinks(text) {
    const links = [];
    const pattern = /(!?)\[[^\]\r\n]*\]\(([^)\r\n]+)\)/g;

    for (const match of text.matchAll(pattern)) {
        const target = stripMarkdownTitle(match[2] ?? '');
        if (target) {
            links.push({
                isImage: match[1] === '!',
                target
            });
        }
    }

    return links;
}

function isMarkdownTarget(target) {
    try {
        return new URL(target, 'https://agent-audit.local/').pathname.toLowerCase().endsWith('.md');
    } catch {
        return `${target ?? ''}`.split(/[?#]/, 1)[0].toLowerCase().endsWith('.md');
    }
}

function extractCanonicalOrigin(llmsText) {
    const match = llmsText.match(/^Canonical site:\s*(\S+)/mi);
    if (!match) {
        return '';
    }

    try {
        return new URL(match[1]).origin;
    } catch {
        return '';
    }
}

function hasPerPageMirrorList(llmsText) {
    return /^\s*Mirrors:/m.test(llmsText);
}

function resolvePublicPathFromHref(href, { canonicalOrigin, currentRelativePath = '' }) {
    const trimmed = decodeHtmlAttribute(`${href ?? ''}`.trim());
    if (isIgnoredHref(trimmed)) {
        return { kind: 'ignored', relativePath: '' };
    }

    try {
        const basePath = currentRelativePath || 'index.html';
        const url = new URL(trimmed, `https://agent-audit.local/${basePath}`);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return { kind: 'external', relativePath: '' };
        }
        if (url.origin !== 'https://agent-audit.local' && canonicalOrigin && url.origin !== canonicalOrigin) {
            return { kind: 'external', relativePath: '' };
        }
        if (url.origin !== 'https://agent-audit.local' && !canonicalOrigin) {
            return { kind: 'external', relativePath: '' };
        }

        return {
            kind: 'local',
            relativePath: normalizePublicRelativePath(decodeURIComponent(url.pathname))
        };
    } catch (error) {
        return {
            kind: 'invalid',
            relativePath: '',
            message: error instanceof Error ? error.message : String(error)
        };
    }
}

async function inspectLlmsFile({
    publicRoot,
    relativePath,
    canonicalOrigin,
    rootText,
    languageFile,
    issues
}) {
    const absolutePath = path.join(publicRoot, relativePath);
    const text = await fs.readFile(absolutePath, 'utf8');
    const localLinks = new Set();
    const markdownLinks = new Set();
    const fileCanonicalOrigin = extractCanonicalOrigin(text);

    if (!fileCanonicalOrigin) {
        issues.push(`${relativePath} is missing a parseable Canonical site URL.`);
    } else if (canonicalOrigin && fileCanonicalOrigin !== canonicalOrigin) {
        issues.push(`${relativePath} Canonical site origin differs from root llms.txt: ${fileCanonicalOrigin}`);
    }
    if (languageFile && rootText && text.trim() === rootText) {
        issues.push(`Language llms.txt duplicates the root llms.txt exactly: ${relativePath}`);
    }
    if (!/^## Agent Notes\b/m.test(text)) {
        issues.push(`${relativePath} is missing the Agent Notes section.`);
    }
    if (!/^- Canonical human-facing pages are HTML\.\s*$/m.test(text)) {
        issues.push(`${relativePath} does not declare canonical human-facing pages as HTML.`);
    }
    if (hasPerPageMirrorList(text)) {
        issues.push(`${relativePath} still contains a retired per-page Mirrors list.`);
    }
    if (languageFile) {
        if (!/^## Site Entry Points\b/m.test(text)) {
            issues.push(`${relativePath} is missing the Site Entry Points section.`);
        }
        if (!/^## Key Content Pages\b/m.test(text)) {
            issues.push(`${relativePath} is missing the Key Content Pages section.`);
        }
    } else if (!/^## Languages?\b/m.test(text) && !/^## Key Content Pages\b/m.test(text)) {
        issues.push(`${relativePath} is missing a Languages or Key Content Pages section.`);
    }

    for (const link of extractMarkdownLinks(text)) {
        if (isMarkdownTarget(link.target)) {
            markdownLinks.add(link.target);
            issues.push(`${relativePath} links to retired Markdown content: ${link.target}`);
        }

        const resolved = resolvePublicPathFromHref(link.target, {
            canonicalOrigin: canonicalOrigin || fileCanonicalOrigin,
            currentRelativePath: relativePath
        });
        if (resolved.kind === 'ignored' || resolved.kind === 'external') {
            continue;
        }
        if (resolved.kind === 'invalid') {
            issues.push(`${relativePath} contains an invalid link target: ${link.target}`);
            continue;
        }

        localLinks.add(resolved.relativePath);
        if (!await isFile(insideOutput(publicRoot, resolved.relativePath))) {
            issues.push(`${relativePath} points to a missing local file: ${link.target} -> ${resolved.relativePath}`);
        }
    }

    const sitemapMatch = text.match(/^Sitemap:\s*(\S+)/mi);
    if (!sitemapMatch) {
        issues.push(`${relativePath} is missing a Sitemap line.`);
    } else {
        const resolved = resolvePublicPathFromHref(sitemapMatch[1], {
            canonicalOrigin: canonicalOrigin || fileCanonicalOrigin,
            currentRelativePath: relativePath
        });
        if (resolved.kind === 'local' && !await isFile(insideOutput(publicRoot, resolved.relativePath))) {
            issues.push(`${relativePath} Sitemap points to a missing local file: ${resolved.relativePath}`);
        }
    }

    return {
        localLinks,
        markdownLinks,
        text
    };
}

async function inspectLlms(publicRoot, issues) {
    const rootPath = path.join(publicRoot, 'llms.txt');
    const rootText = await readOptional(rootPath);
    if (!rootText) {
        issues.push('Missing root llms.txt.');
        return {
            hasLlms: false,
            canonicalOrigin: '',
            fileCount: 0,
            languageFiles: [],
            localLinkCount: 0,
            markdownLinkCount: 0
        };
    }

    const canonicalOrigin = extractCanonicalOrigin(rootText);
    const rootResult = await inspectLlmsFile({
        publicRoot,
        relativePath: 'llms.txt',
        canonicalOrigin,
        rootText: '',
        languageFile: false,
        issues
    });
    const llmsPaths = await filesUnder(publicRoot,file => path.basename(file).toLowerCase() === 'llms.txt');
    const languageFiles = [];
    const localLinks = new Set(rootResult.localLinks);
    const markdownLinks = new Set(rootResult.markdownLinks);

    for (const llmsPath of llmsPaths) {
        const relativePath = relativeName(publicRoot, llmsPath);
        if (relativePath === 'llms.txt') {
            continue;
        }

        languageFiles.push(relativePath);
        const result = await inspectLlmsFile({
            publicRoot,
            relativePath,
            canonicalOrigin,
            rootText: rootText.trim(),
            languageFile: true,
            issues
        });
        for (const link of result.localLinks) {
            localLinks.add(link);
        }
        for (const link of result.markdownLinks) {
            markdownLinks.add(link);
        }
    }

    return {
        hasLlms: true,
        canonicalOrigin,
        fileCount: llmsPaths.length,
        languageFiles: languageFiles.sort(),
        localLinkCount: localLinks.size,
        markdownLinkCount: markdownLinks.size
    };
}


export async function inspect(directory) {
  const issues = [];
  await inspectLlms(path.resolve(directory),issues);
  return {issues};
}
