import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/canvas/touch','Check native mobile drags, link suppression, reading and history in Chromium.',[
    {name:'page',value:'path',required:true,description:'Long article with a document aside',parse:sitePath},
    {name:'next',value:'path',required:true,description:'Different page visited before native Back',parse:sitePath}
  ]);
  spec.examples=['check/browser/canvas/touch ./preview --page /article/?from=all --next /appearance/'];
  return spec;
}
