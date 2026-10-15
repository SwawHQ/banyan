import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/pwa/content','Check delayed content-version updates without replacing the active worker.',[
    {name:'next',value:'dir',required:true,description:'Next build; same SW and different content version'},
    {name:'page',value:'path',default:'/powered-by/',description:'Build version panel',parse:sitePath},
    {name:'from',value:'path',default:'/about/',description:'Second cached page',parse:sitePath}
  ]);
  spec.buildDirectories=['dir','next'];
  spec.examples=['check/browser/pwa/content ./old --next ./new',
    'check/browser/pwa/content ./old --next ./new --trace --out ./browser-report'];
  return spec;
}
