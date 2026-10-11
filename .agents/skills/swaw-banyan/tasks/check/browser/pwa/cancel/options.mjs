import {updateCommand} from '../_shared/options.mjs';
export function command() {
  return updateCommand('check/browser/pwa/cancel',"Check that a later native anchor cancels a pending update navigation.",[
    ['page','/powered-by/','Update panel path'],['from','/about/','Linked source page']
  ]);
}
