import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fail,payloadName} from '../../tasks/_shared/tools/filesystem.mjs';
import {extractionPlan} from '../../tasks/_shared/tools/archive-plan.mjs';

export async function extractZip(archive, destination, tool) {
  if (typeof tool.archiveRoot !== 'string' || (tool.archiveRoot && (!payloadName(tool.archiveRoot) || tool.archiveRoot.includes('/')))) fail('invalid_archive_root');
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const script = fileURLToPath(new URL('./archive.ps1', import.meta.url));
  await new Promise((resolve, reject) => {
    const child = spawn(powershell, ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command','& $env:SWBAN_ZIP_SCRIPT $env:SWBAN_ZIP_ARCHIVE'],
      {stdio:['pipe','pipe','pipe'], windowsHide:true, env:{...process.env, SWBAN_ZIP_SCRIPT:script, SWBAN_ZIP_ARCHIVE:archive}});
    let output = '', errorOutput = '', failure, planned = false;
    const interrupt = () => child.kill();
    process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
    child.stdin.on('error', error => { failure ||= error; });
    child.stderr.on('data', chunk => { if (errorOutput.length < 65536) errorOutput += chunk.toString('utf8'); });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (failure || planned) return;
      output += chunk;
      if (Buffer.byteLength(output) > 64 * 1024 * 1024) { failure = new Error('zip_metadata_too_large'); child.kill(); return; }
      const end = output.indexOf('\n');
      if (end < 0) return;
      try {
        const plan = extractionPlan(JSON.parse(output.slice(0,end)).entries, destination, tool);
        planned = true;
        child.stdin.end(JSON.stringify(plan) + '\n');
      } catch (error) { failure = error; child.kill(); }
    });
    child.once('error', error => { failure ||= error; });
    child.once('close', code => {
      process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
      if (failure) reject(failure);
      else if (code !== 0 || !planned) reject(new Error(errorOutput.trim() || 'zip_extraction_failed'));
      else resolve();
    });
  });
}