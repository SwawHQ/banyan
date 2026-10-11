export function sitePath(value) {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) throw new Error('Page paths must start with a single / and stay within the local site.');
  const url = new URL(value,'http://swban.invalid');
  if (url.origin !== 'http://swban.invalid' || url.hash) throw new Error('Page paths must stay within the local site and have no fragment.');
  return url.pathname+url.search;
}

export function browserCommand(command,description,extraOptions=[]) {
  return {
    command,description,
    positional:{name:'dir',default:'public',description:'Published site directory'},
    options:[
      {name:'headed',default:false,description:'Show the browser window'},
      {name:'trace',default:false,description:'Save trace.zip; default output: system temporary directory'},
      {name:'out',value:'dir',description:'Save JSON and screenshot in a new subdirectory'},
      {name:'timeout',value:'ms',default:15000,description:'Browser launch and individual action timeout',parse:value => {
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value)<1) throw new Error('--timeout must be a positive integer.');
        return Number(value);
      }},
      ...extraOptions
    ],
    examples:[command+' ./preview',command+' ./preview --headed',command+' ./preview --trace --out ./browser-report']
  };
}
