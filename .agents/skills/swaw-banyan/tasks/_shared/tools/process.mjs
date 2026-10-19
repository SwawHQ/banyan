import { spawn } from 'node:child_process';
import path from 'node:path';

export function execute(executable, args, {env = process.env, cwd = process.cwd(), stdio = 'inherit', signal} = {}) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const child = spawn(executable, args, {env, cwd, stdio, shell:false});
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => {
      // Windows signals terminate the wrapper before it can stop its children.
      if (signal && process.platform === 'win32' && child.pid) {
        const killer = spawn(path.join(process.env.SystemRoot,'System32/taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
        killer.once('error',()=>child.kill());
      } else child.kill('SIGTERM');
    };
    const cleanup = () => {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
      signal?.removeEventListener('abort',terminate);
    };
    if (!signal) { process.on('SIGINT', interrupt); process.on('SIGTERM', terminate); }
    signal?.addEventListener('abort',terminate,{once:true});
    child.once('error', error => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => {
      cleanup();
      resolve(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1));
    });
  });
}
export function probe(executable, args, {env = process.env, timeout = 5000} = {}) {
  return new Promise(resolve => {
    const child = spawn(executable, args, {env, stdio:['ignore','pipe','pipe'], shell:false, windowsHide:true});
    let output = '', size = 0, finished = false;
    const finish = result => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      child.stdout.destroy(); child.stderr.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => { child.kill(); finish({ok:false, text:''}); }, timeout);
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > 1024 * 1024) { child.kill(); finish({ok:false, text:''}); }
      else output += chunk.toString('utf8');
    });
    child.stderr.resume();
    child.once('error', () => finish({ok:false, text:''}));
    child.once('close', code => finish({ok:code === 0, text:output.trim()}));
  });
}
export function withPath(directories, environment = process.env) {
  const env = {...environment};
  const key = process.platform === 'win32' ? Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH' : 'PATH';
  env[key] = [...directories, env[key] || ''].join(process.platform === 'win32' ? ';' : ':');
  return env;
}
