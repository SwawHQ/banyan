import {browserCommand,sitePath} from '../../_shared/options.mjs';
import {parseWidths} from '../../_shared/viewport.mjs';

export function chaptersCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'widths',value:'list',default:'390,1024,1800',parse:parseWidths}
  ]);

  return spec;
}
