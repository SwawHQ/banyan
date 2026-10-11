import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function layoutCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Published article with an aside',parse:sitePath},
    {name:'widths',value:'list',default:'390,1024,1600',description:'Comma-separated viewport widths in pixels',parse:parseWidths}
  ]);
  spec.examples=[command+' ./preview --page /article/',command+' ./preview --page /article/ --trace --out ./browser-report'];
  return spec;
}
