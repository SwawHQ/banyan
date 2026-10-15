import {updateCommand} from '../_shared/options.mjs';
export function command() {
  return updateCommand('check/browser/pwa/lifecycle','Check waiting updates and natural activation after controlled pages close.',[
    ['page','/powered-by/','Update panel path'],['from','/about/','Linked source page']
  ]);
}
