import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function choicesCommand(command,description) {
  return browserCommand(command,description,[
    {name:'page',value:'path',default:'/language/',description:'Language settings page with translated choices',parse:sitePath}
  ]);
}
