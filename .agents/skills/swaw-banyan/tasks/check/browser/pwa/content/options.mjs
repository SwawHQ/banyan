import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/pwa/content',[
    {name:'next',value:'dir',required:true},
    {name:'page',value:'path',default:'/powered-by/',parse:sitePath},
    {name:'from',value:'path',default:'/about/',parse:sitePath}
  ]);
  spec.buildDirectories=['dir','next'];

  return spec;
}
