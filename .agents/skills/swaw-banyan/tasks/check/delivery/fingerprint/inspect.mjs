import path from 'node:path';
import {filesUnder,relativeName} from '../../../_shared/output.mjs';
import {expectsFingerprint} from './policy.mjs';

// Recognize content-addressed resources, Hugo fingerprints and esbuild dependencies.
const fingerprint=/(?:(?:^|\.)[a-f0-9]{64}|-[A-Z2-7]{8})\.[^.]+$/;

export async function inspectFiles(outputs,basePath) {
  const issues=[],warnings=[],counts={files:0,fingerprinted:0,missingFingerprint:0,outsideFingerprint:0,
    uncertainPaths:0},examples=new Map();
  function issue(kind,message) {
    counts[kind]++;
    const seen=examples.get(kind)??0;
    if(seen<10)issues.push(message);
    examples.set(kind,seen+1);
  }
  const channels=[outputs.sw,outputs.cloudflare,outputs.edgeone].filter(value=>value!==null).length;
  const url=new URL('https://output.invalid/');
  for(const file of await filesUnder(outputs.root)) {
    counts.files++;
    const relative=relativeName(outputs.root,file),hashed=fingerprint.test(path.basename(file));
    if(hashed)counts.fingerprinted++;
    url.pathname=basePath+relative.replace(/[%\\]/g,encodeURIComponent);
    const encoded=url.pathname;
    const paths=[encoded];
    if(relative==='index.html'||relative.endsWith('/index.html'))paths.push(encoded.slice(0,-'index.html'.length));
    else if(outputs.cloudflare!==null&&relative.endsWith('.html'))paths.push(encoded.slice(0,-'.html'.length));
    if(!channels)continue;
    const expected=paths.some(pathname=>expectsFingerprint(outputs,pathname));
    if(expected&&!hashed)issue('missingFingerprint',relative+': fingerprinted path contains a file without a content hash in its filename.');
    else if(!expected&&hashed)issue('outsideFingerprint',relative+': fingerprinted filename is outside fingerprinted paths.');
  }
  for(const [kind,count] of examples)if(count>10)issues.push(kind+': '+(count-10)+' additional findings omitted.');
  if(!channels)warnings.push('Fingerprint paths not checked: no SW or HTTP policy output is available.');
  return {issues,warnings,counts};
}
