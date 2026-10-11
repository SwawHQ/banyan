import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function sortCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Page with a sortable breadcrumb column; query state is allowed',parse:sitePath},
    {name:'column',value:'path',description:'Collection pathname of the column; default: first sortable column',parse:value=>{
      const path=sitePath(value);if(path.includes('?'))throw new Error('--column must be a collection pathname without a query.');return path;
    }}
  ]);
  spec.examples=[command+' ./preview --page /article/?from=all',command+' ./preview --page /tags/topic/child/ --column /tags/topic/'];
  return spec;
}
