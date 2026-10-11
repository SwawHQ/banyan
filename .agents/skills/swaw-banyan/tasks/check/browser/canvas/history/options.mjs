import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function historyCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'First scrollable article path',parse:sitePath},
    {name:'next',value:'path',required:true,description:'Different scrollable article with a breadcrumb sort control, e.g. /article/?from=all',parse:sitePath}
  ]);
  spec.examples=[command+' ./preview --page /first/?from=all --next /second/?from=all'];
  return spec;
}
