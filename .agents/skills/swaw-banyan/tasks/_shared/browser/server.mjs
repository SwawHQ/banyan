import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomInt} from 'node:crypto';
import {once} from 'node:events';
import {parseHeaders} from '../headers.mjs';
import {readOptional} from '../output.mjs';

const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json',
  '.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.xml':'application/xml'};
function within(root,file) {
  const relative = path.relative(root,file);
  return relative !== '..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative);
}
async function readRoot(directory) {
  const root = await fs.realpath(directory);
  if (!(await fs.stat(path.join(root,'index.html'))).isFile()) throw new Error('Build directory must contain index.html.');
  const rules = parseHeaders(await readOptional(path.join(root,'_headers'))).map(rule => ({...rule,
    pattern:new RegExp('^'+rule.source.split('*').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$')}));
  return {root,rules};
}
export async function createStaticSiteServer(directory) {
  let current = await readRoot(directory);
  const server = http.createServer(async (request,response) => {
    // A request keeps one build and its headers even if the next build is selected.
    const {root,rules} = current;
    try {
      if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      let pathname;
      try { pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname); }
      catch { response.writeHead(400); response.end(); return; }
      if (/[\\\0]/.test(pathname)) { response.writeHead(400); response.end(); return; }
      let file = path.resolve(root,'.'+pathname);
      if (!within(root,file)) { response.writeHead(403); response.end(); return; }
      if ((await fs.stat(file)).isDirectory()) file = path.join(file,'index.html');
      file = await fs.realpath(file);
      if (!within(root,file)) { response.writeHead(403); response.end(); return; }
      const body = await fs.readFile(file);
      const headers = {'Content-Type':mime[path.extname(file).toLowerCase()] ?? 'application/octet-stream'};
      for (const rule of rules) if (rule.pattern.test(pathname)) {
        for (const {key,value} of rule.headers) headers[key] = value;
      }
      response.writeHead(200,headers);
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(['ENOENT','ENOTDIR','EISDIR'].includes(error.code) ? 404 : 500);
      response.end();
    }
  });
  return {
    async setRoot(directory) { current = await readRoot(directory); },
    async start() {
      // The OS can assign port 0 below the dynamic range, including browser-blocked ports.
      for(let attempt=0;attempt<10;attempt++) {
        try {
          const ready=once(server,'listening');
          server.listen(randomInt(49152,65536),'127.0.0.1');
          await ready;return;
        } catch(error) {
          if(error.code!=='EADDRINUSE'||attempt===9)throw error;
        }
      }
    },
    getBaseUrl() { return 'http://127.0.0.1:'+server.address().port; },
    async stop() {
      if (!server.listening) return;
      const stopped = new Promise((resolve,reject) => server.close(error=>error ? reject(error) : resolve()));
      server.closeAllConnections();
      await stopped;
    }
  };
}
