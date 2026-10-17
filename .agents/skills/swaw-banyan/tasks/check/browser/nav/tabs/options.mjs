import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function tabsCommand() {
  const command='check/browser/nav/tabs';
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'selector',value:'css',default:'.slot-main .prose a[target="_blank"]',parse:value=>{
      if(!value.trim())throw new Error('--selector must not be empty.');return value;
    }}
  ]);
  return spec;
}
