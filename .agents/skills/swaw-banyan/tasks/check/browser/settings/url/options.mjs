import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function urlCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Settings page whose unused URL data is checked',parse:sitePath}
  ]);
  spec.examples=[command+' ./preview --page /appearance/',command+' ./preview --page /zh/powered-by/ --trace'];
  return spec;
}
