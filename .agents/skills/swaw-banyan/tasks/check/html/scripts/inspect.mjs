import {readPages,pageState,publishedURL} from '../../../_shared/html/read.mjs';
import {extractExternalScriptSrcs} from '../../../_shared/html/markup.mjs';
import {localReference,insideOutput,isFile,readOptional} from '../../../_shared/output.mjs';
import {inspectDocumentControls} from './controls.mjs';

const controllers=['preferences/language-page','preferences/back-links','updates/page','pages/offline'];
const belongsTo=(reference,family)=>new RegExp('(?:^|/)js/'+family.replaceAll('.','\\.')+'(?:\\.min)?\\.[^/]+\\.js$').test(reference);
function hasMarker(text,name) {
  return (text.match(/<[a-z][^>]*>/gi)||[]).some(tag=>new RegExp('\\sdata-'+name+'(?:\\s|=|/?>)','i').test(tag));
}
export async function inspect(directory) {
  const {root,pages} = await readPages(directory), siteURL = await publishedURL(root), issues = [], common = new Set();
  for (const page of pages.map(pageState)) {
    const references = extractExternalScriptSrcs(page.text);
    if (!page.isRedirect && !references.some(ref => /\/js\/main(?:\.min)?\.[^"' >]+/.test(ref))) {
      issues.push('Missing main JS bundle on non-redirect page: ' + page.relativePath);
    }
    const assets=[];
    for (const ref of new Set(references)) {
      const relative = localReference(ref,{siteURL,page:page.relativePath});
      if (relative && relative !== 'livereload.js' && !await isFile(insideOutput(root,relative))) {
        issues.push(`Missing script asset ${relative} referenced by ${page.relativePath}`);
      }
      if(relative)assets.push(relative);
    }
    if(page.isRedirect)continue;
    for(const issue of inspectDocumentControls(page.text))issues.push(issue+': '+page.relativePath);
    if(page.relativePath==='index.html'&&assets.some(ref=>belongsTo(ref,'browse/path-entry'))) {
      issues.push('Home page must not load the path entry bundle: ' + page.relativePath);
    }
    const expected=[];
    if(hasMarker(page.text,'language-settings'))expected.push('preferences/language-page');
    if(hasMarker(page.text,'site-update-panel'))expected.push('updates/page');
    if(hasMarker(page.text,'page-actions'))expected.push('pages/offline');
    if(!hasMarker(page.text,'language-settings')&&/\sdata-page-action=(?:"back"|'back'|back(?:\s|>))/.test(page.text))expected.push('preferences/back-links');
    for(const family of controllers) {
      const count=references.filter(ref=>belongsTo(ref,family)).length;
      if(count!==(expected.includes(family)?1:0))issues.push(`Controller loading boundary ${family}: expected ${expected.includes(family)?1:0}, found ${count} on ${page.relativePath}`);
    }
    for(const asset of assets)if(belongsTo(asset,'main')||belongsTo(asset,'sw-manager.enable'))common.add(asset);
  }
  for(const asset of common) {
    const code=await readOptional(insideOutput(root,asset));
    for(const marker of ['data-language-choice','data-site-update-panel','data-page-action'])
      if(code.includes(marker))issues.push(`Page controller ${marker} must stay out of shared bundle ${asset}`);
  }
  return {issues};
}
