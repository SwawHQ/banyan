import {browserCommand,sitePath} from '../_shared/options.mjs';

export function appearanceCommand(command) {
  return browserCommand(command,[
    {name:'page',value:'path',default:'/appearance/',parse:sitePath},
    {name:'from',value:'path',default:'/',parse:sitePath}
  ]);
}
