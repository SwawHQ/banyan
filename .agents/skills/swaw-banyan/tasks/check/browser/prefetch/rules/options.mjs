import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/prefetch/rules','Check Chromium acceptance of inline Speculation Rules.',[
    {name:'page',value:'path',default:'/',description:'Page that declares the rules',parse:sitePath},
    {name:'expect',value:'mode',default:'inline',description:'Expected rules mode: inline or off',parse:value=>{
      if(!['inline','off'].includes(value))throw new Error('--expect must be inline or off.');return value;
    }},
    {name:'eager',value:'rules',description:'Expected eager prefetch rule IDs, separated by commas',parse:value=>{
      const rules=value.split(',');
      if(rules.some(rule=>!/^(default|[a-z][a-z0-9_-]*\/(all|root|tail|root\+[1-9]\d*|tail-[1-9]\d*))$/.test(rule))||new Set(rules).size!==rules.length)
        throw new Error('--eager must contain distinct default or icon/scope rule IDs.');
      return rules.join(',');
    }}
  ]);
  spec.examples=['check/browser/prefetch/rules ./preview --page /all/ --eager folder/tail',
    'check/browser/prefetch/rules ./preview --expect off'];
  return spec;
}
