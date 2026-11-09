import assert from 'node:assert/strict';

const image='<img width="16" height="16" alt="Sample">';
const blocks={
  paragraph:'<p>Ordinary text.</p>',
  inline:'<p>Inline '+image.replace('<img','<img class="md-inline-image"')+' text.</p>',
  image:'<p>'+image+'</p>',
  linked:'<p><a class="md-image-link">'+image+'</a></p>',
  responsive:'<p><a class="md-image-link"><picture class="md-responsive-image">'+image+'</picture></a></p>',
  figure:'<figure class="md-centered-image">'+image+'</figure>',
  quote:'<blockquote><p>Quoted text.</p></blockquote>',
  table:'<table><tbody><tr><td>Table text.</td></tr></tbody></table>',
  code:'<div class="highlight"><pre><code>const value = 1;</code></pre></div>',
  pre:'<pre><code>Plain code.</code></pre>'
};
const framed=['image','linked','responsive','figure','quote','table','code','pre'];

export async function checkFlow(page) {
  const original=await page.locator('.prose').evaluate(node=>({html:node.innerHTML,classes:node.className}));
  const rootSize=await page.evaluate(()=>document.documentElement.style.fontSize),results=[];
  try {
    await page.locator('.prose').evaluate((prose,blocks)=>{
      prose.innerHTML=['h2','h3'].flatMap(heading=>Object.entries(blocks).map(([name,html])=>
        `<section data-flow="${heading}-${name}"><${heading}>Heading</${heading}>${html}</section>`)).join('')
        +'<span class="md-caption">Caption</span>';
    },blocks);
    await page.locator('.prose').evaluate((prose,{blocks,framed})=>{
      prose.insertAdjacentHTML('beforeend',framed.map(name=>
        `<section data-adjacent="paragraph-${name}">${blocks.paragraph}${blocks[name]}</section>`).join('')
        +framed.flatMap(left=>framed.map(right=>
          `<section data-adjacent="${left}-${right}">${blocks[left]}${blocks[right]}</section>`)).join(''));
    },{blocks,framed});
    for(const collection of [false,true])for(const size of [15,20]) {
      const state=await page.locator('.prose').evaluate((prose,{collection,size})=>{
        prose.classList.toggle('collection-body',collection);
        document.documentElement.style.fontSize=size+'px';
        return {collection,size,gaps:[...prose.querySelectorAll('[data-flow]')].map(section=>{
          const [heading,block]=section.children;
          return {sample:section.dataset.flow,
            actual:block.getBoundingClientRect().top-heading.getBoundingClientRect().bottom};
        }),adjacent:[...prose.querySelectorAll('[data-adjacent]')].map(section=>{
          const [a,b]=section.children;
          return {pair:section.dataset.adjacent,gap:b.getBoundingClientRect().top-a.getBoundingClientRect().bottom};
        }),images:[...prose.querySelectorAll('[data-flow] img:not(.md-inline-image)')].map(image=>({
          margin:getComputedStyle(image).marginBlock,
          offset:image.getBoundingClientRect().top-image.closest('p,figure').getBoundingClientRect().top
        })),fonts:Object.fromEntries(['blockquote p','td','pre code','.md-caption'].map(selector=>
          [selector,parseFloat(getComputedStyle(prose.querySelector(selector)).fontSize)]))};
      },{collection,size});
      for(const image of state.images)assert.deepEqual(image,state.images[0],
        'Responsive and ordinary images must share their paragraph spacing.');
      for(const gap of state.gaps) {
        const [heading,name]=gap.sample.split('-');
        const paragraph=state.gaps.find(item=>item.sample===heading+'-paragraph');
        const extra=gap.actual-paragraph.actual;
        assert.ok(['paragraph','inline'].includes(name)?Math.abs(extra)<1:extra>=size*.25&&extra<=size*.5,
          'Heading spacing must compensate for text line boxes next to blocks: '+JSON.stringify({...gap,extra,collection,size}));
      }
      for(const pair of state.adjacent) {
        const reference=state.adjacent.find(item=>item.pair===(pair.pair.startsWith('paragraph-')?'paragraph-code':'quote-code'));
        assert.ok(Math.abs(pair.gap-reference.gap)<1,
          'Paragraph and block spacing must match equivalent pairs: '+JSON.stringify({...pair,reference,collection,size}));
      }
      results.push(state);
    }
    for(const collection of [false,true]) {
      const [small,large]=results.filter(result=>result.collection===collection);
      for(const selector of Object.keys(small.fonts))assert.ok(Math.abs(large.fonts[selector]/small.fonts[selector]-20/15)<.01,
        'Prose fonts must scale with the base size: '+selector);
    }
    return results;
  } finally {
    await page.locator('.prose').evaluate((node,original)=>{node.innerHTML=original.html;node.className=original.classes;},original);
    await page.evaluate(size=>document.documentElement.style.fontSize=size,rootSize);
  }
}
