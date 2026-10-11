import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function scrollbarCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Article with an aside and overflowing reading content at 900 pixels high',parse:sitePath},
    {name:'widths',value:'list',default:'390,768,1800',description:'Comma-separated viewport widths; returns to the first width after resizing',parse:parseWidths},
    {name:'touch',default:false,description:'Use a mobile touch context with native scrollbar colors'}
  ]);
  spec.examples=[command+' ./preview --page /article/',command+' ./preview --page /article/ --touch --widths 390,768'];
  return spec;
}
