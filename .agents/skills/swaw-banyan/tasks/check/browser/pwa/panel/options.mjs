import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function panelCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Page containing the update panel',parse:sitePath},
    {name:'from',value:'path',required:true,description:'Page linked from the panel, with a root link back',parse:sitePath},
    {name:'widths',value:'pixels',default:'390,1024',description:'Comma-separated viewport widths',parse:parseWidths}
  ]);
  spec.examples=[command+' ./preview --page /powered-by/ --from /about/',command+' ./preview --page /zh/powered-by/ --from /zh/about/ --trace'];
  return spec;
}
