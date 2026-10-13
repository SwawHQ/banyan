import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function headerCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Page with a sortable breadcrumb column',parse:sitePath},
    {name:'column',value:'path',description:'Collection pathname; default: first sortable column',parse:value=>{
      const path=sitePath(value);if(/[?#]/.test(path))throw new Error('--column must be a collection pathname without a query or fragment.');return path;
    }},
    {name:'widths',value:'list',default:'390,1440',description:'Comma-separated viewport widths; test height: 900 pixels',parse:parseWidths}
  ]);
  spec.examples=[command+' ./preview --page /tags/topic/child/',command+' ./preview --page /article/#from=all --column /all/ --trace'];
  return spec;
}
