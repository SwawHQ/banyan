import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function layoutCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Collection page with entries and a name-column header',parse:sitePath},
    {name:'article',value:'path',description:'Article with this collection in its source path; also compare main and path lists',parse:sitePath},
    {name:'widths',value:'list',default:'390,1440',description:'Comma-separated viewport widths; test height: 900 pixels',parse:parseWidths}
  ]);
  spec.examples=[command+' ./preview --page /all/',command+' ./preview --page /all/ --article /article/#from=all --trace'];
  return spec;
}
