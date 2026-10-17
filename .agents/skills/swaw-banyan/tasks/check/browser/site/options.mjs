import {browserCommand} from '../_shared/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/site',[
    {name:'updates',default:false},
    {name:'site',value:'dir',default:'.'}
  ]);
  return spec;
}
