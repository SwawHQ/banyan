import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import {setTimeout as delay} from 'node:timers/promises';
import {prepareHugo,hugoEnvironment} from '../base/hugo/run.mjs';
import {toolExecutable} from '../_shared/tools/operations.mjs';
import {execute} from '../_shared/tools/process.mjs';
import {buildArguments,indexSite} from '../build/run.mjs';
import {readHugoConfig} from '../_shared/hugo.mjs';
import {addressOptions,developmentAddress} from './address.mjs';

export function serverArguments(input,{lan=false}={}) {
  let port='5678',bind=lan?'::':'127.0.0.1';
  for(let i=0;i<input.length;i++) {
    const arg=input[i];
    if(/^--(?:destination|renderToMemory|renderStaticToDisk|cleanDestinationDir)(?:=|$)/.test(arg)||/^-[DEFNOwhv]*d/.test(arg))
      throw new Error('The server manages its disk output; destination, memory rendering and output cleanup options are not supported.');
    const match=/^--(port|bind)(?:=(.*))?$/.exec(arg);
    if(match) {
      const value=match[2]??input[++i];
      if(!value||value.startsWith('-'))throw new Error(`--${match[1]} requires a value.`);
      if(match[1]==='port')port=value;else bind=value;
    } else {
      const short=/^-[DEFNOwhv]*p(.*)$/.exec(arg);
      if(short)port=short[1]?short[1].replace(/^=/,''):input[++i];
    }
  }
  if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw new Error('The server requires a port between 1 and 65535.');
  return {port:Number(port),bind,args:['server','--buildDrafts','--disableFastRender','--noHTTPCache','--port','5678','--bind',lan?'::':'127.0.0.1','--renderToMemory=false','--cleanDestinationDir=false',...input]};
}

export function listening(port,bind) {
  const host=bind==='::'?'::1':bind==='0.0.0.0'?'127.0.0.1':bind;
  return new Promise(resolve=>{
    const socket=net.connect({port,host});
    const finish=value=>{socket.destroy();resolve(value);};
    socket.setTimeout(300,()=>finish(false));
    socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));
  });
}

export function serving(port,bind,tls=false) {
  const hostname=bind==='::'?'::1':bind==='0.0.0.0'?'127.0.0.1':bind;
  return new Promise(resolve=>{
    // Readiness probes connect locally, including servers with self-signed certificates.
    const request=(tls?https:http).get({hostname,port,path:'/',timeout:500,...(tls?{rejectUnauthorized:false}:{})},response=>{
      response.resume();resolve(true);
    });
    request.once('timeout',()=>request.destroy());
    request.once('error',()=>resolve(false));
  });
}

export function printCommand(executable,args,{cwd=process.cwd()}={}) {
  console.log(`[swban] cwd: ${cwd}`);
  console.log(`[swban] ${[executable,...args].map(value=>/[\s"]/u.test(value)?`"${value.replaceAll('"','\\"')}"`:value).join(' ')}`);
}

export async function dev(input,options={}) {
  const {args,port,bind}=serverArguments(input,options);
  const controller=new AbortController(),stop=()=>controller.abort();
  let server;
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try {
    await prepareHugo();
    if(controller.signal.aborted)return 130;
    if(await listening(port,bind))throw new Error(`Port ${port} is in use; choose another with --port.`);
    const executable=toolExecutable('hugo');
    const addressSettings=addressOptions(input);
    const config=await readHugoConfig(process.cwd(),'',addressSettings.configArgs);
    const {destination}=buildArguments({destination:config.publishdir||'public'},path.resolve(addressSettings.source||process.cwd()),config);
    let address;
    try {
      address=developmentAddress(config,addressSettings,port);
    } catch(error) {console.error(`[swban] Could not determine development address: ${error.message}`);}
    printCommand(executable,args);
    let ended=false;
    server=execute(executable,args,{env:hugoEnvironment(),signal:controller.signal}).finally(()=>{ended=true;});
    server.catch(()=>{});
    // The TCP port is reserved early; HTTP responses start after the initial render.
    while(!ended&&!controller.signal.aborted&&!await serving(port,bind,addressSettings.tls))await delay(100);
    if(ended||controller.signal.aborted)return await server;
    if(options.pagefind!==false) {
      const status=await indexSite(destination,{index:(exe,indexArgs,settings)=>{
        printCommand(exe,indexArgs,settings);
        console.log(`[swban] Pagefind config: ${path.join(settings.cwd,'pagefind.json')}`);
        return execute(exe,indexArgs,{...settings,signal:controller.signal});
      }});
      if(status!==0){stop();await server;return status;}
      console.log('[swban] Search index ready. Restart the server to index content changes.');
    } else console.log('[swban] Pagefind skipped.');
    if(bind==='::'||bind==='0.0.0.0') {
      const addresses=Object.values(os.networkInterfaces()).flat().filter(item=>item&&!item.internal&&item.family==='IPv4');
      console.log(`[swban] LAN addresses: ${addresses.map(item=>item.address).join(', ')}; port ${port}`);
    }
    if(address)console.log(`[swban] ${address}`);
    return await server;
  } finally {
    stop();
    if(server)await server.catch(()=>{});
    process.off('SIGINT',stop);process.off('SIGTERM',stop);
  }
}

export async function main(options) {
  try {process.exitCode=await dev(process.argv.slice(2),options);}
  catch(error){console.error(`[swban] ${error.message}`);process.exitCode=1;}
}
