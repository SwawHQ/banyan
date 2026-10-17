import {browserCommand,sitePath} from '../../_shared/options.mjs';
import {parseWidths} from '../../_shared/viewport.mjs';

export function toggleCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'widths',value:'list',default:'390,768,1800',parse:parseWidths},
    {name:'touch',default:false}
  ]);

  return spec;
}
