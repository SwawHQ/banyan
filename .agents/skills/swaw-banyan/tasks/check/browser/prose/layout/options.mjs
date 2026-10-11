import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function layoutCommand(command,description) {
  return browserCommand(command,description,[
    {name:'page',value:'path',default:'/about/',description:'Published page with one prose container',parse:sitePath}
  ]);
}
