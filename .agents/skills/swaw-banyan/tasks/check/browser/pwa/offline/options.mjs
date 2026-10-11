import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function offlineCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'page',value:'path',default:'/',description:'First page to cache and reload offline',parse:value=>{
      const page=sitePath(value);
      if(page.includes('?'))throw new Error('--page must be a pathname without a query.');
      return page;
    }}
  ]);
  spec.examples=[command+' ./preview',command+' ./preview --page /zh/about/ --trace --out ./browser-report'];
  return spec;
}
