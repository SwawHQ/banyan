import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
export function command() {
  const spec=browserCommand('check/browser/prefetch/debug','Check prefetch diagnostic panels and their correspondence to page payloads in Chromium.',[
    {name:'page',value:'path',required:true,description:'Page using the prefetch debug layout',parse:sitePath}
  ]);
  spec.examples=['check/browser/prefetch/debug ./preview --page /prefetchdebug/'];
  return spec;
}
