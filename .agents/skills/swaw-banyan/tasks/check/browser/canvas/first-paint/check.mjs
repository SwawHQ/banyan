import assert from 'node:assert/strict';
import {installStartupProbe,observeStartup} from '../_shared/startup.mjs';
import {assertRootSelection} from '../../nav/_shared/root.mjs';

export function checkReservedColumns(first,final) {
  assert.ok(first.parsed?.entryPending&&first.entryPending,'Choose an article with source columns awaiting its controller.');
  assert.ok(first.parsed.columns>0,'Source columns must already exist when main is parsed.');
  assert.equal(first.parsed.columns,final.columns.length,'Parsed markup must reserve the final source column count.');
  assert.equal(first.columns.length,final.columns.length,'Startup must retain the reserved source column count.');
  assert.ok(first.pathContent.every(column=>column.rows.length===0),'Reserved path columns must not inline list rows.');
  assert.ok(final.pathContent.every(column=>column.rows.length>0),'Loaded path columns must contain navigation rows.');
  assert.ok(final.reservedColumnsRetained,'Startup must reuse its reserved navigation and column nodes.');
  assert.ok(final.pathAccessible,'Settled source navigation must be visible to accessibility tools.');
}

export function checkInitialLayout(first,final,expectedX) {
  assert.ok(first.scriptsHeld>0,'Startup observation must hold external scripts until the initial sample.');
  assert.ok(Math.abs(first.firstFrameX-expectedX)<=1,'The first animation frame must have the expected canvas position.');
  assert.ok(Math.abs(first.canvasOffsetX-expectedX)<=1&&Math.abs(final.canvasOffsetX-expectedX)<=1,
    'Startup must preserve the expected canvas position.');
  assert.ok(Math.abs(first.mainDocumentX-final.mainDocumentX)<=1,'Main must not move while controllers load.');
  assert.ok(Math.abs(first.main.width-final.main.width)<=1,'Main width must remain stable while controllers load.');
  assert.ok(first.columns.every((column,index)=>Math.abs(column.x-final.columns[index].x)<=1&&Math.abs(column.width-final.columns[index].width)<=1),
    'Source columns must retain their initial geometry.');
  assert.equal(final.canvasOffsetY,0,'Startup must not move the document vertically.');
  if(final.layoutShift!==null)assert.ok(final.layoutShift<=.1,'Startup must not cause excessive layout shift.');
}

function checkStaticColumns(first,final) {
  assert.equal(first.parsed?.columns,0,'Pages without pending path data must not reserve path columns.');
  assert.equal(first.columns.length,0,'Pages without pending path data must not contain path columns.');
  assert.equal(final.columns.length,0,'A page without a path must not gain columns after startup.');
}

export async function check({page,baseUrl,options}) {
  await installStartupProbe(page);const cases=[];
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:900});
    await page.goto('about:blank');
    const state=await observeStartup(page,async()=>{
      const response=await page.goto(baseUrl+options.page,{waitUntil:'commit'});
      assert.ok(response?.ok(),'Page must return a successful response.');
    });
    try {
      if(state.first.entryPending)checkReservedColumns(state.first,state.final);
      else checkStaticColumns(state.first,state.final);
      assert.equal(state.first.domContentLoaded,false,'The initial sample must precede DOMContentLoaded and deferred scripts.');
      const root=options.root??false;
      assertRootSelection(state.first.root,root);assertRootSelection(state.final.root,root);
      assert.deepEqual(state.final.root.roots,state.first.root.roots,'Startup must retain the complete root list.');
      assert.deepEqual(state.final.directoryMetadata,state.first.directoryMetadata,
        'Source initialization must retain the original article directory metadata.');
      checkInitialLayout(state.first,state.final,0);
    } catch(error) {error.details={page:options.page,width,...state};throw error;}
    cases.push({width,...state});
  }
  return {page:options.page,cases};
}
