import {updateCommand} from '../_shared/options.mjs';
export function command() {
  const spec=updateCommand('check/browser/pwa/language',[['page','/language/']]);
  spec.options.push({name:'to',value:'code',required:true,parse:value=>{
    if(!/^[a-z\d]+(?:-[a-z\d]+)*$/i.test(value))throw new Error('--to must be a language code.');return value;
  }});

  return spec;
}
