import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {toolExecutable} from '../../scripts.js/_toolchain/operations.mjs';
import {hugoEnvironment} from '../../scripts.js/hugo/index.mjs';

// Build source-test modules with the same bundler and @params handling as a site.
// The caller owns an isolated work directory and removes it after the assertions.
export async function buildJavaScript({jsRoot, entries, params = {}, work}) {
  const site = path.join(work, 'site');
  const output = path.join(work, 'output');
  await fs.mkdir(path.join(site, 'layouts'), {recursive:true});
  await fs.mkdir(path.join(site, 'data'), {recursive:true});
  const sources = path.join(site, 'source/js');
  // Hugo 0.157 drops virtual assets imports from source maps. Native file
  // imports keep the full graph; all files still stay inside this fixture.
  await fs.cp(jsRoot, sources, {recursive:true});
  for (const entry of entries) {
    const wrapper = path.join(site, 'assets', entry);
    const source = path.resolve(sources, entry).replace(/\\/g, '/');
    await fs.mkdir(path.dirname(wrapper), {recursive:true});
    await fs.writeFile(wrapper, 'export * from '+JSON.stringify(source)+';\n');
  }
  await fs.writeFile(path.join(site, 'hugo.json'), JSON.stringify({
    baseURL:'https://example.test/', disableKinds:['taxonomy','term','rss','sitemap'],
    build:{noJSConfigInAssets:true}
  }));
  await fs.writeFile(path.join(site, 'data/spec.json'), JSON.stringify({entries, params}));
  await fs.writeFile(path.join(site, 'layouts/home.html'), `
{{ range site.Data.spec.entries }}
  {{ $target := replaceRE "\\\\.js$" ".mjs" . }}
  {{ $options := dict "targetPath" $target "format" "esm" "platform" "browser" "target" "es2022" "sourceMap" "external" "params" site.Data.spec.params }}
  {{ $built := resources.Get . | js.Build $options }}
  {{ $built.RelPermalink }}
{{ end }}
`);
  const result = spawnSync(toolExecutable('hugo'), [
    '--source',site,'--destination',output,'--noBuildLock'
  ], {env:hugoEnvironment({...process.env,
    HUGO_CACHEDIR:path.join(work,'cache'), HUGO_RESOURCEDIR:path.join(work,'resources'),
    GIT_OPTIONAL_LOCKS:'0'
  }), shell:false, encoding:'utf8', windowsHide:true, timeout:30000});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || 'Hugo JS build failed.');
  return new Map(await Promise.all(entries.map(async entry => {
    const file = path.join(output, entry.replace(/\.js$/, '.mjs'));
    const map = JSON.parse(await fs.readFile(file+'.map', 'utf8'));
    return [entry, {file, sources:map.sources.map(source =>
      path.relative(sources, fileURLToPath(source)).replace(/\\/g,'/'))}];
  })));
}
