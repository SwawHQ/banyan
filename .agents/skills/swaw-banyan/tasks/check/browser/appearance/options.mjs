import {browserCommand,sitePath} from '../../../_shared/browser/options.mjs';

export function appearanceCommand(command,description) {
  return browserCommand(command,description,[
    {name:'page',value:'path',default:'/appearance/',description:'Published appearance settings page',parse:sitePath},
    {name:'from',value:'path',default:'/about/',description:'Page whose settings link and history return are checked',parse:sitePath}
  ]);
}
