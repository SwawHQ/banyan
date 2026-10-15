import {updateCommand} from '../_shared/options.mjs';
export function command() {
  return updateCommand('check/browser/pwa/activate',"Check link-triggered SW activation, native navigation and preserved reader tabs.",[
    ['page','/powered-by/','Update panel path'],['from','/about/','Linked source page']
  ]);
}
