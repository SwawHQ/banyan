import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function choicesCommand(command) {
  return browserCommand(command,[
    {name:'page',value:'path',default:'/language/',parse:sitePath}
  ]);
}
