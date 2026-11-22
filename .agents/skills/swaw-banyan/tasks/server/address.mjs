const configFlags=new Set(['baseURL','source','environment','config','configDir','cacheDir','themesDir','theme','contentDir','ignoreVendorPaths']);
const shortFlags={b:'baseURL',s:'source',e:'environment',t:'theme',c:'contentDir'};

export function addressOptions(input) {
  const configArgs=process.env.HUGO_ENVIRONMENT||process.env.HUGO_ENV?[]:['--environment','development'];
  const values={appendPort:true,tlsAuto:false};
  for(let i=0;i<input.length;i++) {
    const arg=input[i];
    const long=/^--([^=]+)(?:=(.*))?$/.exec(arg);
    const short=/^-[DEFNOwhv]*([bsetc])(.*)$/.exec(arg);
    const name=long?.[1]??shortFlags[short?.[1]];
    if(!configFlags.has(name)&&!['appendPort','tlsAuto','tlsCertFile','tlsKeyFile'].includes(name))continue;
    const inline=long?long[2]:short[2]?short[2].replace(/^=/,''):undefined;
    if(name==='appendPort'||name==='tlsAuto') {
      values[name]=inline===undefined||['true','1','t','TRUE','True','T'].includes(inline);
    } else {
      const value=inline??input[++i];
      if(value===undefined)throw new Error(`--${name} requires a value.`);
      values[name]=value;
      if(configFlags.has(name))configArgs.push(`--${name}`,value);
    }
  }
  return {...values,configArgs,tls:values.tlsAuto||!!(values.tlsCertFile&&values.tlsKeyFile)};
}

export function developmentAddress(config,options,port) {
  // shortcut: multihost can allocate extra ports, use Hugo's own address lines for that mode.
  if(Object.values(config.languages??{}).some(language=>language.baseurl))return null;
  let base=options.baseURL||config.baseurl||'http://localhost/';
  if(base==='/')base='http://localhost/';
  if(!base.endsWith('/'))base+='/';
  const url=new URL(base.includes('://')?base:`http://${base.replace(/^\/\//,'')}`);
  if(!options.baseURL) {
    url.hostname='localhost';url.port='';
    url.protocol=options.tls?'https:':'http:';
  }
  if(options.appendPort)url.port=String(port);
  return url.href;
}
