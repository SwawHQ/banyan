import {browserCommand,sitePath} from '../../../_shared/browser/options.mjs';

export function cspCommand(command,description) {
  return browserCommand(command,description,[
    {name:'page',value:'path',default:'/',description:'Page to load under enforced CSP',parse:sitePath}
  ]);
}
