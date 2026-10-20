import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {plainPath,stat} from '../../_shared/tools/filesystem.mjs';

const workingFiles = {
  // shortcut: Wrangler still searches ancestors for native config; revisit if those configs must be blocked.
  wrangler:{'package.json':'{"private":true}\n','.env':''},
  cf:{'package.json':'{"private":true,"type":"module"}\n','cloudflare.config.ts':'export default {};\n','.env':''},
  tccli:{}
};

export function workingDirectory(tool) {
  if (!Object.hasOwn(workingFiles,tool)) throw new Error('invalid_cloud_tool');
  const files = workingFiles[tool],parent = plainPath(path.join(fs.realpathSync.native(os.tmpdir()),'swaw','banyan'));
  fs.mkdirSync(parent,{recursive:true});
  const cwd = plainPath(path.join(parent,tool));
  if (!stat(cwd)) {
    // Publish all lookup boundaries together so concurrent starts never see partial files.
    const staging = fs.mkdtempSync(path.join(parent,tool+'-'));
    try {
      for (const [name,content] of Object.entries(files)) fs.writeFileSync(path.join(staging,name),content);
      try {fs.renameSync(staging,cwd);}
      catch (error) {if (!stat(cwd)?.isDirectory()) throw error;}
    } finally {
      if (path.dirname(staging) !== parent || !path.basename(staging).startsWith(tool+'-')) throw new Error('invalid_cloud_directory');
      fs.rmSync(staging,{recursive:true,force:true});
    }
  }
  if (!stat(cwd)?.isDirectory()) throw new Error('Invalid '+tool+' working directory: '+cwd);
  for (const [name,content] of Object.entries(files)) {
    const file = plainPath(path.join(cwd,name)),info = stat(file);
    if (!info?.isFile() || info.size !== Buffer.byteLength(content) || fs.readFileSync(file,'utf8') !== content) {
      throw new Error('Invalid '+tool+' working file: '+file);
    }
  }
  return cwd;
}
