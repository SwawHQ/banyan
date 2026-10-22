import path from 'node:path';
import {filesUnder,relativeName} from '../../../_shared/output.mjs';
import {classify} from './policy.mjs';

const fingerprint=/\.[a-f0-9]{64}\.[^.]+$/;

export async function inspectFiles(outputs,basePath) {
  const issues=[],warnings=[],counts={files:0,fingerprinted:0,missingFingerprint:0,outsideFingerprint:0,
    uncertainPaths:0},examples=new Map(),uncertain=new Set();
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
    let expected=false,determined=true;
    for(const pathname of paths) {
      const states=classify(outputs,pathname),known=states.filter(state=>state.fingerprinted!==null);
      const positive=known.some(state=>state.fingerprinted);
      expected ||= positive;
      determined &&= states.length>0&&known.length===states.length;
      for(const state of states.filter(state=>state.fingerprinted===null)) {
        counts.uncertainPaths++;
        uncertain.add(state.channel+' overlapping Cache-Control rules: '+state.rules.join(', '));
      }
      for(const state of states.filter(state=>state.headerOverlap&&state.fingerprinted!==null))
        uncertain.add(state.channel+' final Cache-Control merge not verified: '+state.rules.join(', '));
    }
    if(!channels)continue;
    if(expected&&!hashed)issue('missingFingerprint',relative+': fingerprinted path contains a file without a SHA-256 filename.');
    else if(!expected&&determined&&hashed)issue('outsideFingerprint',relative+': fingerprinted filename is outside fingerprinted paths.');
  }
  for(const [kind,count] of examples)if(count>10)issues.push(kind+': '+(count-10)+' additional findings omitted.');
  warnings.push(...uncertain);
  if(!channels)warnings.push('Fingerprint paths not checked: no SW or HTTP policy output is available.');
  return {issues,warnings,counts};
}
