import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function anchorsCommand(command,description) {
  const spec = browserCommand(command,description,[
    {name:'page',value:'path',required:true,description:'Published article with a heading below the first screen',parse:sitePath}
  ]);
  spec.examples = [command+' ./preview --page /article/',command+' ./preview --page /article/ --trace --out ./browser-report'];
  return spec;
}
