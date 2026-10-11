import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function scrollCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Published page with overflowing columns',parse:sitePath},
    {name:'widths',value:'list',default:'390,500,1440',description:'Comma-separated viewport widths; test height: 300 pixels',parse:parseWidths}
  ]);
  spec.examples=[command+' ./preview --page /article/',command+' ./preview --page /all/ --widths 390,1440'];
  return spec;
}
