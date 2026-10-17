import {browserCommand,sitePath} from '../../_shared/options.mjs';
import {parseWidths} from '../../_shared/viewport.mjs';

export function openCommand(command) {
  const spec=browserCommand(command,[
    {name:'from',value:'path',required:true,parse:sitePath},
    {name:'page',value:'path',required:true,parse:value=>{
      const path=sitePath(value);
      if((new URL(path,'http://swban.invalid').search || new URL(path,'http://swban.invalid').hash))throw new Error('--page selects an article pathname; put source sorting in --from.');
      return path;
    }},
    {name:'widths',value:'list',default:'390,1024,1440',parse:parseWidths},
    {name:'pan',value:'px',parse:value=>{
      if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('--pan must be a nonnegative integer.');
      return Number(value);
    }},
    {name:'touch',default:false},
    {name:'drag',value:'px',parse:value=>{
      if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('--drag must be a positive integer.');
      return Number(value);
    }}
  ]);

  return spec;
}
