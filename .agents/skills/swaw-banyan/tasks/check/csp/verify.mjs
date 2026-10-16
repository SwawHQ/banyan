// Read-only verification: Hugo owns policy generation; this command never patches output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {parseHeaders,headerValues} from '../../_shared/headers.mjs';

const executableTypes = new Set(['', 'text/javascript', 'application/javascript',
    'text/ecmascript', 'application/ecmascript', 'module', 'speculationrules']);
const xmlPolicy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'";

function attribute(attributes, name) {
    const match = attributes.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
    if (!match) return null;
    return (match[1] ?? match[2] ?? match[3] ?? '')
        .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, decimal) =>
            String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10)))
        .replace(/&amp;/g, '&');
}

function htmlFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(dir, entry.name);
        return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith('.html') ? [file] : [];
    });
}

export function verifyCspOutput(directory) {
    const root = path.resolve(directory);
    const policies=[];
    if(fs.existsSync(path.join(root,'_headers')))policies.push({name:'_headers',rules:parseHeaders(fs.readFileSync(path.join(root,'_headers'),'utf8'))});
    if(fs.existsSync(path.join(root,'edgeone.json'))) {
        const rules=JSON.parse(fs.readFileSync(path.join(root,'edgeone.json'),'utf8')).headers;
        assert.ok(Array.isArray(rules),'edgeone.json must contain a headers array');
        policies.push({name:'edgeone.json',rules});
    }
    assert.ok(policies.length,'HTTP CSP not checked: no platform output is available.');
    function policyFor(source) {
        const values=policies.map(({name,rules})=>{
            const values=headerValues(rules,source,'Content-Security-Policy');
            assert.equal(values.length,1,source+' must declare one enforced CSP in '+name);
            return values[0].trim();
        });
        for(const value of values)assert.equal(value,values[0],source+' policies must agree');
        return values[0];
    }
    const policy = policyFor('/*');
    assert.equal(policyFor('/*.xml'), xmlPolicy, 'Preserve the XML stylesheet CSP override');
    const scriptSrc = policy.split(';').find(value => value.trim().startsWith('script-src '));
    assert.ok(scriptSrc, 'Missing script-src');
    assert.ok(!scriptSrc.includes("'unsafe-inline'") && !scriptSrc.includes("'unsafe-eval'"), 'Keep script-src enforced');
    const hashes = new Set([...scriptSrc.matchAll(/'sha256-([^']+)'/g)].map(match => match[1]));
    assert.ok(hashes.size > 0, 'Missing inline script hashes');
    const observed = new Set();
    const files = htmlFiles(root);
    assert.ok(files.length > 0, 'No HTML files to verify');
    let inlineScripts = 0;
    for (const file of files) {
        const html = fs.readFileSync(file, 'utf8');
        assert.ok(!/\sstyle\s*=/i.test(html), 'Inline style attributes violate production style-src in ' + path.relative(root,file));
        for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
            const [, attributes, body] = match;
            const src = attribute(attributes, 'src');
            if (src !== null) {
                continue;
            }
            if (!executableTypes.has((attribute(attributes, 'type') || '').toLowerCase()) || !body.trim()) continue;
            const hash = createHash('sha256').update(body).digest('base64');
            assert.ok(hashes.has(hash), 'CSP does not allow final inline script in ' + path.relative(root, file)
                + '. Check minify.disableJS=true and the inline script registry.');
            observed.add(hash);
            inlineScripts += 1;
        }
    }
    return { htmlFiles: files.length, inlineScripts, uniqueHashes: observed.size };
}
