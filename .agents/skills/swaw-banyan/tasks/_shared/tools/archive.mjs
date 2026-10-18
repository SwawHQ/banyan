import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fail, inside, payloadName, nameKey } from './filesystem.mjs';

function extractionPlan(entries, destination, tool) {
  const prefix = tool.archiveRoot ? tool.archiveRoot + '/' : '';
  const plan = [], names = new Map();
  let total = 0;
  if (entries.length > 25000) fail('too_many_payload_files');
  for (const [index, entry] of entries.entries()) {
    if (entry.name === prefix) continue;
    if (!entry.name.startsWith(prefix)) fail('unexpected_archive_root');
    const name = entry.name.slice(prefix.length).replace(/\/$/, '');
    const directory = entry.name.endsWith('/');
    const type = (entry.attributes >>> 16) & 0xf000;
    if (!payloadName(name) || names.has(nameKey(name))) fail('unsafe_zip_entry');
    if (![0,0x4000,0x8000].includes(type) || (type === 0x4000 && !directory) || (type === 0x8000 && directory) || (entry.flags & 1)) fail('unsupported_zip_entry_type');
    if (entry.length > 256 * 1024 * 1024) fail('zip_entry_too_large');
    total += entry.length;
    if (total > 512 * 1024 * 1024) fail('zip_payload_too_large');
    names.set(nameKey(name), directory);
    plan.push({index, name, directory, target:inside(destination, name)});
  }
  // Validate every entry and parent collision before writing any payload.
  for (const {name} of plan) {
    for (let parent = path.posix.dirname(name); parent !== '.'; parent = path.posix.dirname(parent)) {
      if (names.get(nameKey(parent)) === false) fail('zip_parent_is_file');
    }
  }
  return plan;
}
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