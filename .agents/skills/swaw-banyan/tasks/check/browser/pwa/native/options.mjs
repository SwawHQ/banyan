import {updateCommand} from '../_shared/options.mjs';
export function command() {
  return updateCommand('check/browser/pwa/native',"Check that reload, history, anchors and new tabs preserve waiting updates.",[
    ['page','/powered-by/','Update panel path'],['from','/about/','Linked source page']
  ]);
}
