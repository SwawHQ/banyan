import {generatedHeaders,headerValues} from '../../../_shared/headers.mjs';
import {readPages} from '../../../_shared/html/read.mjs';
import {extractInlineScriptTextById} from '../../../_shared/html/markup.mjs';

export function ruleIssues(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['prefetch','prerender'].includes(key)))
    return ['Speculation rules must be a prefetch/prerender object.'];
  const issues=[];
  for(const [kind,rules] of Object.entries(value)) {
    if(!Array.isArray(rules)||rules.some(rule=>!rule||rule.source!=='document'||!Array.isArray(rule.where?.and)||
      !rule.where.and.some(condition=>condition.selector_matches==='html[data-prefetch-native-ready] a')||
      !['conservative','moderate','eager','immediate'].includes(rule.eagerness)))issues.push('Invalid shared document rules: '+kind);
  }
  return issues;
}
export async function inspect(directory) {
  const {root,pages}=await readPages(directory),policies=await generatedHeaders(root),issues=[];
  if(headerValues(policies.text,'/*','Speculation-Rules').length||headerValues(policies.edge,'/*','Speculation-Rules').length)
    issues.push('Inline speculation rules must not also be delivered by a Speculation-Rules header.');
  for(const page of pages) {
    const text=extractInlineScriptTextById(page.text,'site-speculation-rules');
    if(!text)continue;
    try {issues.push(...ruleIssues(JSON.parse(text)).map(issue=>page.relativePath+': '+issue));}
    catch(error){issues.push(page.relativePath+': Invalid speculation rules JSON: '+error.message);}
  }
  return {issues};
}
