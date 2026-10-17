import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {loadChromium} from '../../../_shared/browser/runtime.mjs';
import {createStaticSiteServer} from './server.mjs';
import {assertReportOutsideBuilds} from './artifacts.mjs';
import {writeSuiteReport} from './suite-report.mjs';

async function timedRun(run,timeout,label) {
  let timer;
  try {return await Promise.race([run(),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(label+' timed out after '+timeout+'ms.')),timeout);
  })]);}finally{clearTimeout(timer);}
}

function outcomeDetails(outcome) {
  if(!outcome||typeof outcome!=='object'||Array.isArray(outcome))return {details:outcome??{},artifacts:{}};
  if(['details','artifacts','message'].some(name=>Object.hasOwn(outcome,name)))
    return {details:outcome.details??{},artifacts:outcome.artifacts??{},message:outcome.message};
  return {details:outcome,artifacts:{}};
}

async function runScenario(scenario,runtime) {
  const started=Date.now(),artifactDir=path.join(runtime.outputDir,scenario.id);
  const result={id:scenario.id,kind:scenario.kind,status:'passed',durationMs:0,message:'Passed',artifacts:{},details:{}};
  if(scenario.skipReason) {
    console.log('[SKIP] '+scenario.id+': '+scenario.skipReason);
    return {...result,status:'skipped',message:scenario.skipReason};
  }
  if(scenario.kind==='upgrade'&&!runtime.upgradePair)return {...result,status:'skipped',message:'No upgrade build pair was supplied.'};
  fs.mkdirSync(artifactDir,{recursive:true});let context,page,tracing=false,scenarioBrowser;
  try {
    await runtime.server.setRoot(scenario.kind==='upgrade'?runtime.upgradePair.fromDir:runtime.primaryBuildDir);
    // BFCache checks need launch flags that must not affect the other scenarios.
    if(scenario.launchOptions)scenarioBrowser=await runtime.type.launch({...scenario.launchOptions,
      executablePath:runtime.type.executablePath(),headless:runtime.headless,...(runtime.timeout?{timeout:runtime.timeout}:{})});
    const browser=scenarioBrowser??runtime.browser;
    context=await browser.newContext({viewport:scenario.viewport??{width:1440,height:960},
      serviceWorkers:scenario.serviceWorkers??'allow',locale:scenario.locale??'en-US',
      isMobile:scenario.isMobile??false,hasTouch:scenario.hasTouch??false});
    if(runtime.timeout){context.setDefaultTimeout(runtime.timeout);context.setDefaultNavigationTimeout(runtime.timeout);}
    if(runtime.trace){await context.tracing.start({screenshots:true,snapshots:true,sources:true});tracing=true;}
    page=await context.newPage();const dialogs=[];
    page.on('dialog',async dialog=>{
      dialogs.push({message:dialog.message(),type:dialog.type()});
      if(scenario.dialogPolicy==='accept')await dialog.accept().catch(()=>{});
      else await dialog.dismiss().catch(()=>{});
    });
    console.log('[RUN] '+scenario.id);
    const outcome=await timedRun(()=>scenario.run({artifactDir,baseUrl:runtime.server.getBaseUrl(),
      browser,context,dialogs,outputDir:runtime.outputDir,page,
      primaryBuildDir:runtime.primaryBuildDir,server:runtime.server,upgradePair:runtime.upgradePair}),
      scenario.timeoutMs??45000,scenario.id);
    const normalized=outcomeDetails(outcome);
    result.details=normalized.details;result.artifacts=normalized.artifacts;result.message=normalized.message||'Passed';
    console.log('[PASS] '+scenario.id);
  }catch(error){
    result.status='failed';result.message=error.message;if(error.details)result.details=error.details;
    if(page&&!page.isClosed()){
      const screenshot=path.join(artifactDir,'failure.png');
      try{await page.screenshot({path:screenshot,fullPage:true,timeout:5000});result.artifacts.screenshot=screenshot;}catch{}
    }
    console.log('[FAIL] '+scenario.id+': '+result.message);
  }finally{
    if(tracing){
      const trace=path.join(artifactDir,'trace.zip');
      try{await context.tracing.stop({path:trace});result.artifacts.trace=trace;}catch{}
    }
    try {if(context)await context.close();}finally {if(scenarioBrowser)await scenarioBrowser.close();}
    result.durationMs=Date.now()-started;
  }
  return result;
}

export async function runScenarioSuite({scenarios,primaryBuildDir,outputDir,upgradePair=null,
  onlyScenarioIds=[],browserType,headless=true,trace=false,modeName='browser',timeout}) {
  assert.ok(Array.isArray(scenarios)&&scenarios.length,'Browser suite requires explicit scenarios.');
  for(const scenario of scenarios){
    assert.match(scenario.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Scenario IDs must be plain directory names.');
    assert.ok(['single','upgrade'].includes(scenario.kind),'Scenario kind must be single or upgrade.');
    assert.equal(typeof scenario.run,'function','Scenario must provide a run function.');
  }
  const known=new Set(scenarios.map(scenario=>scenario.id));
  assert.equal(known.size,scenarios.length,'Scenario IDs must be unique.');
  const unknown=onlyScenarioIds.filter(id=>!known.has(id));
  assert.equal(unknown.length,0,'Unknown browser scenario(s): '+unknown.join(', '));
  assert.equal(typeof primaryBuildDir,'string','Supply a published build directory.');
  assert.equal(typeof outputDir,'string','Supply a report directory.');
  primaryBuildDir=path.resolve(primaryBuildDir);outputDir=path.resolve(outputDir);
  if(upgradePair)upgradePair={fromDir:path.resolve(upgradePair.fromDir),toDir:path.resolve(upgradePair.toDir)};
  await assertReportOutsideBuilds(outputDir,[primaryBuildDir,...(upgradePair?[upgradePair.fromDir,upgradePair.toDir]:[])]);
  const server=await createStaticSiteServer(primaryBuildDir),type=browserType??loadChromium();let browser;
  const report={generatedAt:new Date().toISOString(),mode:modeName,browser:type.name(),browserVersion:'',
    outputDir,primaryBuildDir,upgradeFromDir:upgradePair?.fromDir??'',upgradeToDir:upgradePair?.toDir??'',
    scenarios:[],totals:{passed:0,failed:0,skipped:0}};
  try {
    await server.start();
    browser=await type.launch({headless,executablePath:type.executablePath(),
      ...(timeout?{timeout}:{}),
      ...(type.name()==='chromium'?{ignoreDefaultArgs:['--hide-scrollbars']}:{})});
    report.browserVersion=browser.version();fs.mkdirSync(outputDir,{recursive:true});
    for(const scenario of scenarios.filter(item=>!onlyScenarioIds.length||onlyScenarioIds.includes(item.id))){
      const result=await runScenario(scenario,{browser,type,headless,server,outputDir,primaryBuildDir,upgradePair,trace,timeout});
      report.scenarios.push(result);report.totals[result.status]++;writeSuiteReport(report);
    }
  }finally{try{if(browser)await browser.close();}finally{await server.stop();}}
  const {summary,reportFile}=writeSuiteReport(report);console.log(summary+'\nJSON report: '+reportFile);
  if(report.totals.failed)process.exitCode=1;return report;
}
