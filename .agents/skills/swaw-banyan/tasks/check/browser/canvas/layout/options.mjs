import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function canvasLayoutCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',default:'/about/',description:'Published page',parse:sitePath},
    {name:'height',value:'px',default:900,description:'Viewport height in pixels',parse:value=>{
      if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<240||Number(value)>3840)
        throw new Error('--height must be an integer from 240 to 3840.');
      return Number(value);
    }},
    {name:'widths',value:'list',default:'390,1024,1440',description:'Comma-separated viewport widths in pixels',parse:parseWidths}
  ]);
  spec.examples=[command+' ./preview --page /article/',command+' ./preview --page /article/ --trace --out ./browser-report'];
  return spec;
}
