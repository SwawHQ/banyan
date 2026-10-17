import {browserCommand,sitePath} from '../../_shared/options.mjs';
import {parseWidths} from '../../_shared/viewport.mjs';

export function firstPaintCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'root',value:'path|none',parse:value=>{
      if(value==='none')return '';
      const root=sitePath(value);
      if(/[?#]/.test(root))throw new Error('--root must be a pathname or none.');
      return root;
    }},
    {name:'widths',value:'list',default:'390,1440',parse:parseWidths}
  ]);

  return spec;
}
