import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function rootsCommand() {
  const command='check/browser/nav/roots';
  const spec=browserCommand(command,'Check root-link visits, selection and native history in Chromium.',[
    {name:'from',value:'path',required:true,description:'Published root page; query context is allowed',parse:sitePath},
    {name:'pages',value:'paths',required:true,description:'Other root page paths, separated by commas',parse:value=>{
      const paths=value.split(',').map(sitePath);
      if(new Set(paths).size!==paths.length||paths.some(path=>path.includes('?')))throw new Error('--pages must contain distinct root paths without queries.');
      return paths;
    }}
  ]);
  spec.examples=[command+' ./preview --from /powered-by/ --pages /about/,/rss/'];return spec;
}
