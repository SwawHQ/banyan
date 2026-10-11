import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function tabsCommand() {
  const command='check/browser/nav/tabs';
  const spec=browserCommand(command,'Check native new-tab links and opener isolation in Chromium.',[
    {name:'page',value:'path',required:true,description:'Published page containing new-tab links',parse:sitePath},
    {name:'selector',value:'css',default:'.slot-main .prose a[target="_blank"]',description:'CSS selector for the anchors to activate',parse:value=>{
      if(!value.trim())throw new Error('--selector must not be empty.');return value;
    }}
  ]);
  spec.examples=[command+' ./preview --page /powered-by/'];return spec;
}
