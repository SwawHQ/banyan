import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
export function command() {
  const spec=browserCommand('check/browser/prefetch/overlap','Check runtime suppression of speculation-owned links without suppressing other slots in Chromium.',[
    {name:'page',value:'path',required:true,description:'Page with runtime preemption and link candidates',parse:sitePath}
  ]);
  spec.examples=['check/browser/prefetch/overlap ./preview --page /all/',
    'check/browser/prefetch/overlap ./preview --page /tags/topic/ --trace --out ./browser-report'];
  return spec;
}
