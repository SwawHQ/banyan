import {browserCommand,sitePath} from '../_shared/options.mjs';

export function cspCommand(command) {
  return browserCommand(command,[
    {name:'page',value:'path',default:'/',parse:sitePath}
  ]);
}
