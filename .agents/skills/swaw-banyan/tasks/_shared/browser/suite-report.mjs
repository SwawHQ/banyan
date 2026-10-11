import fs from 'node:fs';
import path from 'node:path';

export function writeSuiteReport(report) {
  const lines=['Browser regression report','Mode\t'+report.mode,
    'Browser\t'+report.browser+' '+report.browserVersion,'Output\t'+report.outputDir,
    'Primary build\t'+report.primaryBuildDir,'Upgrade from\t'+(report.upgradeFromDir||'-'),
    'Upgrade to\t'+(report.upgradeToDir||'-'),
    ...Object.entries(report.totals).map(([name,count])=>name+'\t'+count),''];
  for(const scenario of report.scenarios){
    lines.push('['+scenario.status.toUpperCase()+'] '+scenario.id+' ('+scenario.durationMs+'ms)',
      '  '+scenario.message);
    for(const name of ['screenshot','trace'])if(scenario.artifacts[name])lines.push('  '+name+': '+scenario.artifacts[name]);
  }
  const summary=lines.join('\n')+'\n',reportFile=path.join(report.outputDir,'report.json');
  fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(report.outputDir,'summary.txt'),summary);
  return {summary,reportFile};
}
