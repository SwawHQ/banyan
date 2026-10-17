import {browserCommand,sitePath} from '../../_shared/options.mjs';
import {parseWidths} from '../../_shared/viewport.mjs';

export function panelCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'from',value:'path',required:true,parse:sitePath},
    {name:'widths',value:'pixels',default:'390,1024',parse:parseWidths}
  ]);

  return spec;
}
