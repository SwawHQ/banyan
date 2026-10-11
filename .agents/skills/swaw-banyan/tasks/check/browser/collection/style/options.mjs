import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function styleCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Article with a selected source row and another path row, e.g. /article/?from=all',parse:sitePath},
    {name:'collection',value:'path',required:true,description:'Collection page with entry links for hover and focus checks',parse:sitePath},
    {name:'choices',value:'path',default:'/appearance/',description:'Appearance settings page with light and dark choice buttons',parse:sitePath},
    {name:'widths',value:'list',default:'1440',description:'Comma-separated viewport widths; test height: 900 pixels',parse:parseWidths}
  ]);
  spec.examples=[command+' ./preview --page /article/?from=all --collection /all/',command+' ./preview --page /zh/article/?from=all --collection /zh/all/ --choices /zh/appearance/ --widths 390,1440'];
  return spec;
}
