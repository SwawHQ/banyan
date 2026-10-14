import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
export function command() {
  const spec=browserCommand('check/browser/prefetch/debug','Check diagnostic controls, selected backend and inline prefetch payloads in Chromium.',[
    {name:'page',value:'path',required:true,description:'Page using the prefetch debug layout',parse:sitePath}
  ]);
  spec.examples=['check/browser/prefetch/debug ./preview --page /prefetchdebug/'];
  return spec;
}
