import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
export function isolationCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Page with two sortable path columns, or a path column and main collection',parse:sitePath}
  ]);
  spec.examples=[command+' ./preview --page /article/#from=section/child',command+' ./preview --page /section/child/#sort=date-asc'];
  return spec;
}
