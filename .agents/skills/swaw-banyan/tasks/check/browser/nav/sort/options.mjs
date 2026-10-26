import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function sortCommand(command) {
  return browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath}
  ]);
}
