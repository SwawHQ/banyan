import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function offlineCommand(command) {
  const spec=browserCommand(command,[
    {name:'page',value:'path',default:'/',parse:value=>{
      const page=sitePath(value);
      if(/[?#]/.test(page))throw new Error('--page must be a pathname without a query or fragment.');
      return page;
    }}
  ]);

  return spec;
}
