import {browserCommand,sitePath} from '../../_shared/options.mjs';
import {parseWidths} from '../../_shared/viewport.mjs';

export function layoutCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'article',value:'path',parse:sitePath},
    {name:'widths',value:'list',default:'390,1440',parse:parseWidths}
  ]);

  return spec;
}
