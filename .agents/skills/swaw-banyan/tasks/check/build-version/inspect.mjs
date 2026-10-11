import fs from 'node:fs/promises';
import path from 'node:path';
import {extractTagAttribute,decodeHtmlAttribute} from '../../_shared/html/markup.mjs';
import {readPages} from '../../_shared/html/read.mjs';

async function readUtf8IfExists(absolutePath) {
    try {
        return await fs.readFile(absolutePath, 'utf8');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return '';
    }
}

function extractUpdateVersionElements(text) {
    const elements = [];
    const pattern = /<time\b(?=[^>]*\bdata-site-update-version(?:\s|=|>))[^>]*>([\s\S]*?)<\/time>/gi;
    for (const match of text.matchAll(pattern)) {
        const tag = match[0].slice(0, match[0].indexOf('>') + 1);
        elements.push({
            buildVersion: extractTagAttribute(tag, 'title').trim(),
            buildTimeISO: extractTagAttribute(tag, 'datetime').trim(),
            buildTime: decodeHtmlAttribute(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        });
    }
    return elements;
}

async function inspectBuildVersionContract(rootDir, rows) {
    const issues = [];
    let buildVersion = '';
    const updateVersions = [];
    for (const row of rows) {
        const text = await fs.readFile(row.absolutePath, 'utf8');
        const elements = extractUpdateVersionElements(text);
        if (elements.length > 1) {
            issues.push(`${row.relativePath} contains ${elements.length} update version elements; expected at most one.`);
        }
        updateVersions.push(...elements.map((element) => ({ ...element, relativePath: row.relativePath })));
    }

    if (updateVersions.length === 0) {
        issues.push('No data-site-update-version <time> element was published.');
    } else {
        for (const entry of updateVersions) {
            if (!entry.buildVersion) {
                issues.push(`${entry.relativePath} update version is missing its build version title.`);
            }
            if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(entry.buildTime)) {
                issues.push(`${entry.relativePath} has invalid update build time ${JSON.stringify(entry.buildTime)}.`);
            }
            if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(entry.buildTimeISO)) {
                issues.push(`${entry.relativePath} has invalid update build datetime ${JSON.stringify(entry.buildTimeISO)}.`);
            }
        }

        const versions = [...new Set(updateVersions.map((entry) => entry.buildVersion).filter(Boolean))];
        const displayTimes = [...new Set(updateVersions.map((entry) => entry.buildTime).filter(Boolean))];
        const isoTimes = [...new Set(updateVersions.map((entry) => entry.buildTimeISO).filter(Boolean))];
        if (versions.length !== 1) {
            issues.push(`Update pages must expose one build version, found: ${versions.join(', ') || '<none>'}.`);
        } else {
            [buildVersion] = versions;
        }
        if (displayTimes.length !== 1) {
            issues.push(`Update pages must expose one build display time, found: ${displayTimes.join(', ') || '<none>'}.`);
        }
        if (isoTimes.length !== 1) {
            issues.push(`Update pages must expose one build ISO time, found: ${isoTimes.join(', ') || '<none>'}.`);
        }
    }

    const swText = await readUtf8IfExists(path.join(rootDir, 'sw.js'));
    if (buildVersion && swText) {
        const swVersions = [...new Set([...swText.matchAll(/\bv\d{14}\b/g)].map((match) => match[0]))].sort();
        const unexpectedSwVersions = swVersions.filter((entry) => entry !== buildVersion);
        if (!swText.includes('nav-html-') || !swText.includes(buildVersion)) {
            issues.push(`sw.js does not appear to use update-page buildVersion ${buildVersion}.`);
        }
        if (unexpectedSwVersions.length > 0) {
            issues.push(`sw.js contains buildVersion values outside update-page buildVersion ${buildVersion}: ${unexpectedSwVersions.join(', ')}.`);
        }
    }

    return {
        buildVersion,
        updateVersionPageCount: updateVersions.length,
        issues,
    };
}

export async function inspect(directory) {
  const {root,pages} = await readPages(directory);
  return inspectBuildVersionContract(root,pages);
}
