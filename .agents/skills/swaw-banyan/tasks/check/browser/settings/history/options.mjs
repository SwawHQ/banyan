import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

function sourcePath(value) {
  const [document,...fragment]=value.split('#');return sitePath(document)+(fragment.length?'#'+fragment.join('#'):'');
}
export function pageList(value) {
  const pages=value.split(',').map(sitePath);
  if(pages.length<2||new Set(pages).size!==pages.length||pages.some(page=>/[?#]/.test(page)))
    throw new Error('--pages must contain at least two distinct settings paths without queries or fragments, separated by commas.');
  return pages;
}
export function historyCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'from',value:'path',required:true,description:'Source page, including query and fragment',parse:sourcePath},
    {name:'pages',value:'paths',required:true,description:'Settings paths in visit order, separated by commas',parse:pageList}
  ]);
  spec.examples=[command+' ./preview --from /article/#from=all&anchor=details --pages /appearance/,/powered-by/,/language/'];
  return spec;
}
