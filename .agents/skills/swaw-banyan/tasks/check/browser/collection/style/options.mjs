import {browserCommand,sitePath} from '../../_shared/options.mjs';
import {parseWidths} from '../../_shared/viewport.mjs';

export function styleCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'collection',value:'path',required:true,parse:sitePath},
    {name:'choices',value:'path',default:'/appearance/',parse:sitePath},
    {name:'widths',value:'list',default:'1440',parse:parseWidths}
  ]);

  return spec;
}
