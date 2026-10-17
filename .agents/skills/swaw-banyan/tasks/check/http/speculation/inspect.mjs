import {request} from '../_shared/request.mjs';
import {extractInlineScriptTextById} from '../../../_shared/html/markup.mjs';
import {ruleIssues} from '../../prefetch/rules/inspect.mjs';
export async function inspect(url) {
  const response=await request(url,'GET'),issues=[];
  if(response.headers.get('speculation-rules'))issues.push('Inline speculation rules must not also use a Speculation-Rules header.');
  const text=extractInlineScriptTextById(await response.text(),'site-speculation-rules');
  if(text) {
    try {issues.push(...ruleIssues(JSON.parse(text)));}
    catch(error){issues.push('Invalid speculation rules JSON: '+error.message);}
  }
  return {issues};
}
