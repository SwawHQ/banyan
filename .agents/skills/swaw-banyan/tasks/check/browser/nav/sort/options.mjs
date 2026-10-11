import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function sortCommand(command,description) {
  return browserCommand(command,description,[
    {name:'page',value:'path',default:'/all/',description:'Collection with distinct names and a navigable article',parse:sitePath}
  ]);
}
