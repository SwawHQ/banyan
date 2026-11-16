import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import {extract as extractArchive} from '../posix/archive.mjs';
import {plainPath,tree,fail} from '../../tasks/_shared/tools/filesystem.mjs';
export {launcherName,launcherMarker,launcherText,bootstrapBinding,finalizeInstallation} from '../posix/runtime.mjs';

export function canProbe(name,executable) {
  if(name==='node') {
    const result=childProcess.spawnSync(executable,['-p','process.arch'],{encoding:'utf8',timeout:5000});
    return result.status===0&&result.stdout.trim()===process.arch;
  }
  // Running Apple's Git shim without developer tools opens a system installation dialog.
  if(name==='git'&&fs.realpathSync(executable)==='/usr/bin/git') {
    return childProcess.spawnSync('/usr/bin/xcode-select',['-p'],{stdio:'ignore',timeout:5000}).status===0;
  }
  return true;
}

export function extract(archive,destination,tool) {
  if(tool.archiveFormat!=='pkg')return extractArchive(archive,destination,tool);
  if(tool.name!=='hugo')fail('unsupported_pkg_tool');
  plainPath(destination);
  const expanded=plainPath(path.join(path.dirname(destination),'expanded'));
  if(fs.existsSync(expanded))fail('occupied_pkg_directory');
  // Expand the verified package without running installer scripts or changing the system.
  const result=childProcess.spawnSync('/usr/sbin/pkgutil',['--expand-full',archive,expanded],{encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
  if(result.error||result.status!==0)fail('pkg_expansion_failed');
  const files=tree(expanded);
  const payload=files.filter(file=>file.name.startsWith('Payload/')&&!file.directory);
  if(payload.length!==1||payload[0].name!=='Payload/hugo'||payload[0].length>256*1024*1024)fail('unexpected_hugo_payload');
  fs.copyFileSync(path.join(expanded,'Payload/hugo'),path.join(destination,'hugo'),fs.constants.COPYFILE_EXCL);
  fs.chmodSync(path.join(destination,'hugo'),0o755);
}
