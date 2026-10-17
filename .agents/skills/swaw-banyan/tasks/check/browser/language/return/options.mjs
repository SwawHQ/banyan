import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function sourcePath(value) {
  const [withoutFragment,...fragment]=value.split('#');
  const local=sitePath(withoutFragment);
  return local+(fragment.length?'#'+fragment.join('#'):'');
}

export function returnCommand(command) {
  const spec=browserCommand(command,[
    {name:'from',value:'path',required:true,parse:sourcePath},
    {name:'page',value:'path',default:'/language/',parse:sitePath},
    {name:'to',value:'code',required:true,parse:languageCode}
  ]);

  return spec;
}

export function languageCode(value) {
  if(!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(value))throw new Error('Expected a language code.');return value;
}
