import assert from 'node:assert/strict';
import {installStartupProbe,observeStartup} from '../_shared/startup.mjs';
import {assertRootSelection} from '../../nav/_shared/root.mjs';

export function checkReservedColumns(first,final) {
  assert.ok(first.parsed?.entryPending&&first.entryPending,'Choose an article with source columns awaiting its controller.');
  assert.ok(first.parsed.columns>0,'Source columns must already exist when main is parsed.');
  assert.equal(first.parsed.columns,final.columns.length,'Parsed markup must reserve the final source column count.');
  assert.equal(first.columns.length,final.columns.length,'Startup must retain the reserved source column count.');
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
  assert.equal(first.parsed?.columns,final.columns.length,'Parsed markup must reserve the final static column count.');
  assert.equal(first.columns.length,final.columns.length,'Startup must retain the static column count.');
  if(first.columns.length) {
    assert.ok(final.reservedColumnsRetained,'Startup must reuse its reserved navigation and column nodes.');
    assert.ok(final.pathAccessible,'Settled static navigation must be visible to accessibility tools.');
  }
  for(const [index,column] of first.pathContent.entries()) {
    const settled=final.pathContent[index];
    assert.equal(settled.href,column.href,'Static startup must retain each column source.');
    assert.ok(column.rows.length>0,'Static columns must contain SSR rows.');
    if(!first.sortPending)assert.deepEqual(settled.rows,column.rows,'Static startup must retain SSR row order and labels.');
    if(column.header) {
      assert.ok(settled.header,'Static startup must retain its sortable header.');
      assert.equal(settled.header.label,column.header.label,'Static startup must retain its column label.');
      for(const gap of ['labelToSeparator','separatorToSort'])assert.ok(Math.abs(column.header[gap]-settled.header[gap])<=.1,
        'Static startup must retain header spacing.');
    }
  }
}

export async function check({page,baseUrl,options}) {
  await installStartupProbe(page);const cases=[];
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:900});
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
