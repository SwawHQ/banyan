import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {sha256,durableWrite,plainPath} from '../../tasks/_shared/tools/filesystem.mjs';
export {extract} from './archive.mjs';

export const launcherName='cli';
export const launcherMarker='# swaw-banyan.cli/v1\n';
export function launcherText(record) {
  const tool=record.tools[record.runtime];
  const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
  if (/[\r\n\0]/.test(tool.path)) throw new Error('unsupported_runtime_path');
  const executable=tool.source==='managed'?'"$root"/'+quote(tool.path):quote(tool.path);
  return '#!/bin/sh\n'+launcherMarker+'set -eu\nroot=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec '+executable+' "$@"\n';
}
export function bootstrapBinding(record) {
  const tool=record.tools[record.runtime];
  if (/[\r\n\0]/.test(tool.path)) throw new Error('unsupported_runtime_path');
  return 'swaw-banyan.bootstrap-binding/v1\n'+tool.source+'\n'+tool.path+'\n';
}
export function finalizeInstallation(root,tool) {
  if(tool.name!=='node')return;
  const payload=path.join(root,'node'),file=plainPath(path.join(root,'node-receipt.txt')),temporary=file+'.'+randomUUID()+'.tmp';
  // A cold shell checks the receipt digest instead of parsing or executing JSON.
  durableWrite(temporary,'swaw-banyan.bootstrap-node/v1\n'+tool.version+'\n'+sha256(path.join(payload,tool.executable))+'\n'+sha256(path.join(payload,'install.json'))+'\n');
  try{fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
