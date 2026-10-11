import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function sourcePath(value) {
  const [withoutFragment,...fragment]=value.split('#');
  const local=sitePath(withoutFragment);
  return local+(fragment.length?'#'+fragment.join('#'):'');
}

export function returnCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'from',value:'path',required:true,description:'Source page; retain its query and fragment',parse:sourcePath},
    {name:'page',value:'path',default:'/language/',description:'Language settings linked from the source page',parse:sitePath},
    {name:'to',value:'code',required:true,description:'Target language declared in translated settings',parse:languageCode}
  ]);
  spec.examples=[command+' ./preview --from /article/?from=all#details --to zh',command+' ./preview --from /zh/all/?sort=name-asc --page /zh/language/ --to en --trace'];
  return spec;
}

export function languageCode(value) {
  if(!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(value))throw new Error('Expected a language code.');return value;
}
