import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/prefetch/rules','Check Chromium receipt and acceptance of external Speculation Rules.',[
    {name:'page',value:'path',default:'/',description:'Page whose response declares the rules',parse:sitePath},
    {name:'expect',value:'mode',default:'header',description:'Expected rules mode: header or off',parse:value=>{
      if(!['header','off'].includes(value))throw new Error('--expect must be header or off.');return value;
    }},
    {name:'eager',value:'slots',description:'Expected eager prefetch slots, separated by commas',parse:value=>{
      const slots=value.split(',');
      if(slots.some(slot=>!['nav','crumb','sort','desc','post'].includes(slot))||new Set(slots).size!==slots.length)
        throw new Error('--eager must contain distinct nav, crumb, sort, desc or post slots.');
      return slots.join(',');
    }}
  ]);
  spec.examples=['check/browser/prefetch/rules ./preview --page /all/ --eager nav',
    'check/browser/prefetch/rules ./preview --expect off'];
  return spec;
}
