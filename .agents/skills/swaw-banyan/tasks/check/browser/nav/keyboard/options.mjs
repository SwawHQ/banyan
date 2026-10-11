import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function keyboardCommand(command,description) {
  return browserCommand(command,description,[
    {name:'page',value:'path',default:'/appearance/',description:'Published page with root links and a tabbable control in the next column',parse:sitePath}
  ]);
}
