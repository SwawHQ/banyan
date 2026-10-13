import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function firstPaintCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Published article, collection or settings page',parse:sitePath},
    {name:'root',value:'path|none',description:'Expected selected root; none means no selection',parse:value=>{
      if(value==='none')return '';
      const root=sitePath(value);
      if(/[?#]/.test(root))throw new Error('--root must be a pathname or none.');
      return root;
    }},
    {name:'widths',value:'list',default:'390,1440',description:'Comma-separated viewport widths; test height: 900 pixels',parse:parseWidths}
  ]);
  spec.examples=[command+' ./preview --page /tags/topic/child/',command+' ./preview --page /article/#from=all --trace --out ./browser-report'];
  return spec;
}
