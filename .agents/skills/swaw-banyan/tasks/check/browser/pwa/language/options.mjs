import {updateCommand} from '../_shared/options.mjs';
export function command() {
  const spec=updateCommand('check/browser/pwa/language',"Check native language links while a service-worker update waits.",[['page','/language/','Language settings path']]);
  spec.options.push({name:'to',value:'code',required:true,description:'Another published language',parse:value=>{
    if(!/^[a-z\d]+(?:-[a-z\d]+)*$/i.test(value))throw new Error('--to must be a language code.');return value;
  }});
  spec.examples=['check/browser/pwa/language ./old --next ./new --to zh'];
  return spec;
}
