import {browserCommand,sitePath} from '../../_shared/options.mjs';

function sourcePath(value) {
  const [document,...fragment]=value.split('#');return sitePath(document)+(fragment.length?'#'+fragment.join('#'):'');
}
export function pageList(value) {
  const pages=value.split(',').map(sitePath);
  if(pages.length<2||new Set(pages).size!==pages.length||pages.some(page=>/[?#]/.test(page)))
    throw new Error('--pages must contain at least two distinct settings paths without queries or fragments, separated by commas.');
  return pages;
}
export function historyCommand(command) {
  const spec=browserCommand(command,[
    {name:'from',value:'path',required:true,parse:sourcePath},
    {name:'pages',value:'paths',required:true,parse:pageList}
  ]);

  return spec;
}
