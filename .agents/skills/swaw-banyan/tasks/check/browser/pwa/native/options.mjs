import {updateCommand} from '../_shared/options.mjs';
export function command() {
  return updateCommand('check/browser/pwa/native',[
    ['page','/powered-by/'],['from','/']
  ]);
}
