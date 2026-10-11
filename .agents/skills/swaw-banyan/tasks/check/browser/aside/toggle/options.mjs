import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function toggleCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Published article with a document aside',parse:sitePath},
    {name:'widths',value:'list',default:'390,768,1800',description:'Comma-separated viewport widths in pixels',parse:parseWidths},
    {name:'touch',default:false,description:'Use taps and a mobile touch context'}
  ]);
  spec.examples=[command+' ./preview --page /article/',command+' ./preview --page /article/ --trace --out ./browser-report'];
  return spec;
}
