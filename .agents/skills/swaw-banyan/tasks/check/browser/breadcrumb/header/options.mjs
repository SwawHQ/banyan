import {browserCommand,sitePath} from '../../_shared/options.mjs';
import {parseWidths} from '../../_shared/viewport.mjs';

export function headerCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'column',value:'path',parse:value=>{
      const path=sitePath(value);if(/[?#]/.test(path))throw new Error('--column must be a collection pathname without a query or fragment.');return path;
    }},
    {name:'widths',value:'list',default:'390,1440',parse:parseWidths}
  ]);

  return spec;
}
