import {browserCommand,sitePath} from '../../../_shared/browser/options.mjs';

export function paletteCommand(command,description,extraOptions=[]) {
  return browserCommand(command,description,[
    {name:'page',value:'path',default:'/about/',description:'Published page with prose styles',parse:sitePath},
    ...extraOptions
  ]);
}
