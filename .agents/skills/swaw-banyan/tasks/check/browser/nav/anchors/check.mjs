import assert from 'node:assert/strict';

export async function check({page,baseUrl,options}) {
  await page.setViewportSize({width:390,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  const response = await page.goto(baseUrl+options.page,{waitUntil:'load'});
  assert.ok(response?.ok(),'Article must return a successful response.');
  const headings = page.locator('.prose :is(h2,h3)[id]');
  assert.ok(await headings.count(),'Article must have a native heading anchor.');
  const headingId = await headings.last().getAttribute('id');
  const fragment = new URL(baseUrl+options.page),state=new URLSearchParams(fragment.hash.slice(1));
  if(fragment.hash.includes('=')){state.set('anchor',headingId);fragment.hash=state.toString();}
  else fragment.hash=encodeURIComponent(headingId);
  await page.goto(fragment.href,{waitUntil:'load'});
  await page.waitForFunction(id=>{
    const box=document.getElementById(id)?.getBoundingClientRect();
    return box&&box.left>=-1&&box.left<innerWidth&&box.top>=-1&&box.top<innerHeight;
  },headingId);
  const heading = await page.locator('[id]').evaluateAll((nodes,id)=>{
    const box=nodes.find(node=>node.id===id).getBoundingClientRect();
    return {x:box.x,y:box.y,width:box.width};
  },headingId);
  const column = page.locator('.page-content');
  const before = await column.evaluate(node=>node.scrollTop);
  assert.ok(before>0,'The selected article must require vertical scrolling to its last heading.');
  await page.locator('.skip-link').focus(); await page.keyboard.press('Enter');
  await page.waitForURL(url=>url.hash==='#main'||new URLSearchParams(url.hash.slice(1)).get('anchor')==='main');
  await page.waitForFunction(()=>{
    const main=document.getElementById('main').getBoundingClientRect();
    return main.left>=-1&&main.left<innerWidth&&main.top>=-1&&main.top<innerHeight&&document.querySelector('.page-content').scrollTop===0;
  });
  for(const key of ['from','sort','sorts'])assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get(key),
    new URLSearchParams(new URL(baseUrl+options.page).hash.slice(1)).get(key),'Skip link must preserve '+key);
  const after = await column.evaluate(node=>node.scrollTop);
  assert.ok(after<before,`Skip to content must return to the start of the reading column (before ${before}, after ${after}).`);
  return {page:options.page,headingId,heading,before,after,viewport:{width:390,height:900}};
}
