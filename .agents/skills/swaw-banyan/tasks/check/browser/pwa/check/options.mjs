import {updateCommand} from '../_shared/options.mjs';
export function command() {
  return updateCommand('check/browser/pwa/check',"Check offline retries, repeated checks and hidden controls without activation.",[
    ['page','/powered-by/','Update panel path'],['from','/about/','Linked source page']
  ]);
}
