import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/prefetch/rules',[
    {name:'page',value:'path',default:'/',parse:sitePath},
    {name:'expect',value:'mode',default:'inline',parse:value=>{
      if(!['inline','off'].includes(value))throw new Error('--expect must be inline or off.');return value;
    }},
    {name:'eager',value:'rules',parse:value=>{
      const rules=value.split(',');
      if(rules.some(rule=>!/^(default|[a-z][a-z0-9_-]*\/(all|root|tail|root\+[1-9]\d*|tail-[1-9]\d*))$/.test(rule))||new Set(rules).size!==rules.length)
        throw new Error('--eager must contain distinct default or icon/scope rule IDs.');
      return rules.join(',');
    }}
  ]);

  return spec;
}
