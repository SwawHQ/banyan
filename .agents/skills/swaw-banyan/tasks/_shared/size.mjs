import {gzipSync} from 'node:zlib';
export const gzipBytes = buffer => gzipSync(buffer,{level:9}).length;
