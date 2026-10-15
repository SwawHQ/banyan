import {updateCommand} from '../_shared/options.mjs';
export function command() {
  return updateCommand('check/browser/pwa/check',"Check browser events, manual retries and hidden controls without automatic checks or activation.",[
    ['page','/powered-by/','Update panel path'],['from','/about/','Linked source page']
  ]);
}
