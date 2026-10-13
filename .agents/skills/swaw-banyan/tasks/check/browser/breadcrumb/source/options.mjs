import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
function pathname(value) {
  const path=sitePath(value);if(/[?#]/.test(path))throw new Error('Column and article paths must not contain a query or fragment.');return path;
}
export function sourceCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Page containing the source column',parse:sitePath},
    {name:'column',value:'path',required:true,description:'Collection pathname of the source column',parse:pathname},
    {name:'article',value:'path',required:true,description:'Another article linked by that column',parse:pathname}
  ]);
  spec.examples=[command+' ./preview --page /tags/topic/child/ --column /tags/topic/ --article /article/'];
  return spec;
}
