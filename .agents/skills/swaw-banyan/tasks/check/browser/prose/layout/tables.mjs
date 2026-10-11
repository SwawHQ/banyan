import assert from 'node:assert/strict';

export const tableSamples='<table data-prose-table-fixture="ordinary"><thead><tr><th>Kind</th><th>Value</th></tr></thead>'
  +'<tbody><tr><td>ordinary</td><td>table</td></tr></tbody></table>'
  +'<div class="highlight" data-prose-table-fixture="chroma"><div class="chroma"><table class="lntable"><tbody><tr>'
  +'<td class="lntd"><pre class="chroma"><code><span class="lnt">1</span></code></pre></td>'
  +'<td class="lntd"><pre class="chroma"><code><span class="line">const value = 1;</span></code></pre></td>'
  +'</tr></tbody></table></div></div>';

export async function checkTableStyles(page) {
  const state=await page.locator('.prose').evaluate(prose=>{
    const ordinary=prose.querySelector('[data-prose-table-fixture="ordinary"]');
    const chroma=prose.querySelector('[data-prose-table-fixture="chroma"] table.lntable');
    const describe=node=>{
      const style=getComputedStyle(node);
      return Object.fromEntries(['borderCollapse','borderTopStyle','borderTopWidth','display','fontSize','overflowX','overflowY','paddingBlockStart','paddingInlineStart'].map(key=>[key,style[key]]));
    };
    return {fontSize:getComputedStyle(prose).fontSize,ordinary:{table:describe(ordinary),cell:describe(ordinary.querySelector('td'))},
      chroma:{table:describe(chroma),cell:describe(chroma.querySelector('td.lntd'))}};
  });
  const {ordinary,chroma,fontSize}=state;
  assert.ok(ordinary.table.display==='block'&&ordinary.table.overflowX==='auto'&&ordinary.table.overflowY==='hidden'
    &&ordinary.table.borderCollapse==='collapse'&&ordinary.cell.borderTopStyle==='solid'&&ordinary.cell.borderTopWidth!=='0px'
    &&ordinary.cell.fontSize!==fontSize,'Ordinary Markdown tables must keep the prose table presentation.');
  assert.ok(chroma.table.display==='table'&&chroma.table.overflowX==='visible'&&chroma.table.overflowY==='visible'
    &&chroma.table.borderCollapse==='separate'&&chroma.table.borderTopStyle==='none'&&chroma.table.borderTopWidth==='0px'
    &&chroma.cell.borderTopStyle==='none'&&chroma.cell.borderTopWidth==='0px'&&chroma.cell.paddingBlockStart==='0px'
    &&chroma.cell.paddingInlineStart==='0px'&&chroma.cell.fontSize===fontSize,
    'Chroma line-number tables must not inherit ordinary prose table layout and cell styles.');
  return state;
}
