import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function rootsCommand() {
  const command='check/browser/nav/roots';
  const spec=browserCommand(command,[
    {name:'from',value:'path',required:true,parse:sitePath},
    {name:'pages',value:'paths',required:true,parse:value=>{
      const paths=value.split(',').map(sitePath);
      if(new Set(paths).size!==paths.length||paths.some(path=>/[?#]/.test(path)))throw new Error('--pages must contain distinct root paths without queries or fragments.');
      return paths;
    }}
  ]);
  return spec;
}
