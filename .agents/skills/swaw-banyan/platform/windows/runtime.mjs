import {extractZip} from './archive.mjs';
import {extractExecutable} from '../../tasks/_shared/tools/tar.mjs';

export const launcherName='cli.cmd';
export const launcherMarker='rem swaw-banyan.cli/v1\r\n';
export function launcherText(record) {
  const tool=record.tools[record.runtime];
  const executable=tool.source==='managed'?'%~dp0'+tool.path.replaceAll('/','\\'):tool.path.replaceAll('%','%%');
  if (/["\r\n\0]/.test(executable)) throw new Error('unsupported_runtime_path');
  return '@echo off\r\n'+launcherMarker+'setlocal DisableDelayedExpansion\r\n'+
    'if not exist "'+executable+'" (\r\n  echo [swban] runtime_binding_unusable; run swban base/'+record.runtime+'/ensure 1>&2\r\n  exit /b 1\r\n)\r\n'+
    '"'+executable+'" %*\r\nexit /b %ERRORLEVEL%\r\n';
}
export const extract=(archive,destination,tool)=>tool.archiveFormat==='tar.gz'?extractExecutable(archive,destination,tool):extractZip(archive,destination,tool);
