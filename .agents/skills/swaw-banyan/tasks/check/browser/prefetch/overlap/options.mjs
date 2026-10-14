import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
export function command() {
  const spec=browserCommand('check/browser/prefetch/overlap','Check that native rules suppress custom prefetch hints in Chromium.',[
    {name:'page',value:'path',required:true,description:'Page with enabled prefetch candidates',parse:sitePath}
  ]);
  spec.examples=['check/browser/prefetch/overlap ./preview --page /all/',
    'check/browser/prefetch/overlap ./preview --page /tags/topic/ --trace --out ./browser-report'];
  return spec;
}
