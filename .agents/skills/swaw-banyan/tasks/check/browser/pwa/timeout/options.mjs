import {updateCommand} from '../_shared/options.mjs';
export function command() {
  return updateCommand('check/browser/pwa/timeout',"Check that activation timeout preserves caches and permits requested navigation.",[
    ['page','/powered-by/','Update panel path'],['from','/about/','Linked source page']
  ]);
}
