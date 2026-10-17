import {browserCommand,sitePath} from '../../_shared/options.mjs';
import {parseWidths} from '../../_shared/viewport.mjs';

export function canvasLayoutCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',default:'/about/',parse:sitePath},
    {name:'height',value:'px',default:900,parse:value=>{
      if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<240||Number(value)>3840)
        throw new Error('--height must be an integer from 240 to 3840.');
      return Number(value);
    }},
    {name:'widths',value:'list',default:'390,1024,1440',parse:parseWidths}
  ]);

  return spec;
}
