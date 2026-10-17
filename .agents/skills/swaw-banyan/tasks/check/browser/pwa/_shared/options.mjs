import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function updateCommand(command,paths=[]) {
  const spec=browserCommand(command,[
    {name:'next',value:'dir',required:true},
    ...paths.map(([name,value])=>({name,value:'path',default:value,parse:sitePath}))
  ]);
  spec.buildDirectories=['dir','next'];

  return spec;
}
