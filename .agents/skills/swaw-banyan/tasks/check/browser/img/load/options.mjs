import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function imageCommand() {
  const command='check/browser/img/load';
  const spec=browserCommand(command,'Check displayed image loading and decoding in Chromium.',[
    {name:'page',value:'path',required:true,description:'Published page containing the images',parse:sitePath},
    {name:'selector',value:'css',default:'.slot-main .prose img',description:'CSS selector for displayed images',parse:value=>{
      if(!value.trim())throw new Error('--selector must not be empty.');return value;
    }}
  ]);
  spec.examples=[command+' ./preview --page /github/'];return spec;
}
