import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function layoutCommand(command) {
  return browserCommand(command,[
    {name:'page',value:'path',default:'/about/',parse:sitePath}
  ]);
}
