import {updateCommand} from '../_shared/options.mjs';
export function command() {
  return updateCommand('check/browser/pwa/check',[
    ['page','/powered-by/'],['from','/']
  ]);
}
