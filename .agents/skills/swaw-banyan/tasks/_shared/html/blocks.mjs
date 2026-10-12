import assert from 'node:assert/strict';

export const stripRawText=html=>html.replace(/<!--[\s\S]*?-->/g,'').replace(/(<(?:script|style)\b[^>]*>)[\s\S]*?(<\/(?:script|style)>)/gi,'$1$2');

// shortcut: only explicitly closed Hugo elements; use a DOM parser for arbitrary HTML.
export function extractBlocks(html,name,predicate=()=>true) {
  const source=stripRawText(html),stack=[],result=[];
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('</?'+escaped+'\\b(?:"[^"]*"|\x27[^\x27]*\x27|[^\x27">])*>','gi');
  for(const match of source.matchAll(pattern)) {
    if(match[0].startsWith('</')) {
      const start=stack.pop();
      assert.ok(start,'Unexpected closing '+name+' element.');
      if(predicate(start.open))result.push({...start,inner:source.slice(start.end,match.index),html:source.slice(start.index,match.index+match[0].length)});
    } else stack.push({open:match[0],index:match.index,end:match.index+match[0].length});
  }
  assert.equal(stack.length,0,'Unclosed '+name+' element.');
  return result.sort((a,b)=>a.index-b.index);
}
