import {browserCommand,sitePath} from '../../_shared/options.mjs';
function pathname(value) {
  const path=sitePath(value);if(/[?#]/.test(path))throw new Error('Column and article paths must not contain a query or fragment.');return path;
}
export function sourceCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'column',value:'path',required:true,parse:pathname},
    {name:'article',value:'path',required:true,parse:pathname}
  ]);

  return spec;
}
