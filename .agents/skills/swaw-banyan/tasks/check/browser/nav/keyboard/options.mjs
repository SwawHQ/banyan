import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function keyboardCommand(command) {
  return browserCommand(command,[
    {name:'page',value:'path',default:'/appearance/',parse:sitePath}
  ]);
}
