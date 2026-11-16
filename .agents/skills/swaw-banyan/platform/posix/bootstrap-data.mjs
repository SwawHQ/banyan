import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

// Regenerate this small cold-start input whenever a POSIX Node definition changes.
export function bootstrapData(platform,architecture) {
  if(!['linux-x64','mac-x64','mac-arm64'].includes(platform+'-'+architecture))throw new Error('unsupported_bootstrap_platform');
  const tool=JSON.parse(fs.readFileSync(new URL('../../tools.'+platform+'-'+architecture+'.json',import.meta.url),'utf8')).tools.find(t=>t.name==='node');
  return ['swaw-banyan.bootstrap-release/v1',tool.version,tool.url,tool.sha256,tool.archiveRoot,tool.executable,
    tool.compatibility.min||'',tool.compatibility.exact||'',tool.compatibility.before||''].join('\n')+'\n';
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const [platform,architecture,flag,...extra]=process.argv.slice(2),data=bootstrapData(platform,architecture);
  if(extra.length||flag!==undefined&&flag!=='--check')throw new Error('invalid_bootstrap_data_arguments');
  const file=new URL('../'+platform+'/node-'+architecture+'.txt',import.meta.url);
  if(flag==='--check') {
    if(fs.readFileSync(file,'utf8')!==data)throw new Error('stale_node_bootstrap_data');
  }else fs.writeFileSync(file,data);
}
