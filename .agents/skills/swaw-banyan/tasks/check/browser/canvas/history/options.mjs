import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function historyCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'next',value:'path',required:true,parse:sitePath}
  ]);

  return spec;
}
