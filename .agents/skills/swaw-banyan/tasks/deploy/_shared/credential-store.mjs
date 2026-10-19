import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const script = fileURLToPath(new URL('./credential.ps1',import.meta.url));

export function credentialStore(target,action,record) {
  if (process.platform !== 'win32') throw new Error('credentials_require_windows');
  return new Promise((resolve,reject)=>{
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
    const child = spawn(executable,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Action',action,'-Target',target],
      {windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output = '', size = 0;
    const timer = setTimeout(()=>child.kill(),15000);
    child.stdout.on('data',chunk=>{size += chunk.length;if(size > 16384)child.kill();else output += chunk.toString('utf8');});
    child.stderr.resume();child.stdin.on('error',()=>{});
    child.once('error',()=>{clearTimeout(timer);reject(new Error('credential_store_failed'));});
    child.once('close',code=>{
      clearTimeout(timer);
      if (code !== 0 || size > 16384) return reject(new Error('credential_store_failed'));
      try {resolve(JSON.parse(output));} catch {reject(new Error('credential_store_failed'));}
    });
    // The secret travels over a private pipe, never arguments or a temporary file.
    child.stdin.end(record ? JSON.stringify(record) : '');
  });
}
