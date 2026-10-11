import {updateCommand} from '../_shared/options.mjs';
export function command() {
  return updateCommand('check/browser/pwa/error',"Check that activation errors preserve caches and permit requested navigation.",[
    ['page','/powered-by/','Update panel path'],['from','/about/','Linked source page']
  ]);
}
