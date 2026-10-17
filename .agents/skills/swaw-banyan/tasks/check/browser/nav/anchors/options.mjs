import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function anchorsCommand(command) {
  const spec = browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath}
  ]);

  return spec;
}
