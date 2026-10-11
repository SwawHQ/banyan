import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function updateCommand(command,description,paths=[]) {
  const spec=browserCommand(command,description,[
    {name:'next',value:'dir',required:true,description:'Next SW-enabled build; sw.js must differ'},
    ...paths.map(([name,value,description])=>({name,value:'path',default:value,description,parse:sitePath}))
  ]);
  spec.buildDirectories=['dir','next'];
  spec.examples=[command+' ./old --next ./new',command+' ./old --next ./new --trace --out ./browser-report'];
  return spec;
}
