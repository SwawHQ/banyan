export function sitePath(value) {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) throw new Error('Page paths must start with a single / and stay within the local site.');
  const url = new URL(value,'http://swban.invalid');
  if (url.origin !== 'http://swban.invalid') throw new Error('Page paths must stay within the local site.');
  return url.pathname+url.search+url.hash;
}

export function browserCommand(command,extraOptions=[]) {
  return {
    command,
    positional:{name:'dir',default:'public'},
    options:[
      {name:'headed',default:false},
      {name:'trace',default:false},
      {name:'out',value:'dir'},
      {name:'timeout',value:'ms',default:15000,parse:value => {
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value)<1) throw new Error('--timeout must be a positive integer.');
        return Number(value);
      }},
      ...extraOptions
    ]
  };
}
