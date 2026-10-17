import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function imageCommand() {
  const command='check/browser/img/load';
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'selector',value:'css',default:'.slot-main .prose img',parse:value=>{
      if(!value.trim())throw new Error('--selector must not be empty.');return value;
    }}
  ]);
  return spec;
}
