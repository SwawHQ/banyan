import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseArguments,helpFor} from '../../../_shared/arguments.mjs';
import {assertReportOutsideBuilds} from '../_shared/artifacts.mjs';
import {loadChromium} from '../../../_shared/browser/runtime.mjs';
import {runScenarioSuite} from '../_shared/suite.mjs';
import {writeSuiteReport} from '../_shared/suite-report.mjs';
import {discoverSite} from './discover.mjs';
import {siteScenarios} from './scenarios.mjs';
import {buildNext} from './updates.mjs';
import {command} from './options.mjs';

export async function run(args=process.argv.slice(2)) {
  const spec=command(),options=parseArguments(spec,args);
  if(options===null){console.log(helpFor(spec));return;}
  const site=await discoverSite(options.dir);
  if(options.updates&&(!site.offline||!site.panel||!site.from))
    throw new Error('--updates requires an SW-enabled build and a versioned update panel with reciprocal root links.');
  if(!options.updates&&options.site!=='.')throw new Error('--site is only used with --updates.');
  const browserType=loadChromium(),parent=path.resolve(options.out||os.tmpdir());
  await assertReportOutsideBuilds(parent,[site.root]);
  await fs.mkdir(parent,{recursive:true});
  const outputDir=await fs.mkdtemp(path.join(parent,'swban-site-'));
  let work;
  try {
    let upgradePair;
    if(options.updates) {
      work=await fs.mkdtemp(path.join(os.tmpdir(),'swban-site-build-'));
      console.log('Preparing a temporary next build from '+path.resolve(options.site));
      upgradePair=await buildNext(options.site,site.root,work);
    }
    const report=await runScenarioSuite({scenarios:siteScenarios(site,options),primaryBuildDir:site.root,
      outputDir,upgradePair,browserType,headless:!options.headed,trace:options.trace,modeName:'site',timeout:options.timeout});
    report.discovery=site;report.temporaryUpgradeBuild=Boolean(work);writeSuiteReport(report);
    return report;
  }finally{
    if(work)await fs.rm(work,{recursive:true,force:true});
  }
}
