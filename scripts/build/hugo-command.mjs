import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function resolveHugoCommand({ cwd = process.cwd() } = {}) {
    const siteRequire = createRequire(path.join(cwd, 'package.json'));
    const packageUrl = pathToFileURL(siteRequire.resolve('hugo-extended')).href;
    const { getHugoBinary } = await import(packageUrl);
    return getHugoBinary();
}
