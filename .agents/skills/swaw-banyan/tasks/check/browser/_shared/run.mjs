import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {parseArguments,helpFor} from '../../../_shared/arguments.mjs';
import {printCheck} from '../../../_shared/cli.mjs';
import {createStaticSiteServer} from './server.mjs';
import {assertReportOutsideBuilds} from './artifacts.mjs';

export async function runBrowserCheck(spec,check,loadBrowser,args=process.argv.slice(2),launchOptions={},contextOptions={}) {
  const options = parseArguments(spec,args);
  if (options === null) { console.log(helpFor(spec)); return; }
  const root = path.resolve(options.dir);
  if (!(await fs.stat(path.join(root,'index.html'))).isFile()) throw new Error('Build directory must contain index.html.');
  const browserType = loadBrowser();
  let artifacts;
  if (options.out || options.trace) {
    const parent = path.resolve(options.out || os.tmpdir());
    await assertReportOutsideBuilds(parent,(spec.buildDirectories??['dir']).map(name=>options[name]));
    await fs.mkdir(parent,{recursive:true});
    artifacts = await fs.mkdtemp(path.join(parent,'swban-'+spec.command.split('/').at(-1)+'-'));
  }
  const result = {command:spec.command,browser:browserType.name(),directory:root,issues:[],details:{},artifacts};
  const server = await createStaticSiteServer(root);
  let browser,context,page,tracing=false;
  let interrupted = 0;
  const interrupt = () => { interrupted=130; if (browser) void browser.close().catch(()=>{}); };
  const terminate = () => { interrupted=143; if (browser) void browser.close().catch(()=>{}); };
  process.on('SIGINT',interrupt); process.on('SIGTERM',terminate);
  try {
    await server.start();
    if (interrupted) throw new Error('Browser check interrupted.');
    browser = await browserType.launch({...launchOptions,executablePath:browserType.executablePath(),headless:!options.headed,timeout:options.timeout});
    result.browserVersion = browser.version();
    if (interrupted) throw new Error('Browser check interrupted.');
    context = await browser.newContext({viewport:{width:1440,height:960},serviceWorkers:'block',
      hasTouch:options.touch??false,isMobile:options.touch??false,...contextOptions});
    context.setDefaultTimeout(options.timeout);
    context.setDefaultNavigationTimeout(options.timeout);
    if (options.trace) { await context.tracing.start({screenshots:true,snapshots:true,sources:true}); tracing=true; }
    page = await context.newPage();
    result.details = await check({page,context,baseUrl:server.getBaseUrl(),server,options});
  } catch (error) {
    result.issues.push(error.message);
    if (error.details) result.details = error.details;
  } finally {
    try {
      if (artifacts && page && !page.isClosed()) {
        try { await page.screenshot({path:path.join(artifacts,'page.png'),timeout:5000}); }
        catch (error) { result.issues.push('Screenshot failed: '+error.message); }
      }
      if (tracing) {
        try { await context.tracing.stop({path:path.join(artifacts,'trace.zip')}); }
        catch (error) { result.issues.push('Trace failed: '+error.message); }
      }
    } finally {
      try { if (browser) await browser.close(); }
      finally {
        try { await server.stop(); }
        finally { process.off('SIGINT',interrupt); process.off('SIGTERM',terminate); }
      }
    }
  }
  if (artifacts) {
    await fs.writeFile(path.join(artifacts,'result.json'),JSON.stringify(result,null,2)+'\n');
    console.log('Artifacts: '+artifacts);
  }
  printCheck(spec.command,result);
  if (interrupted) process.exitCode = interrupted;
  return result;
}
