import {readPages} from '../../../_shared/html/read.mjs';
import {measureJs} from '../../../_shared/size-js.mjs';
export async function report(directory,top) {
  const {root,pages} = await readPages(directory), {assets} = await measureJs(root,pages);
  const hashes = new Map(), families = new Map();
  for (const asset of assets) {
    for (const [map,key] of [[hashes,asset.hash],[families,asset.family]]) {
      const paths = map.get(key) ?? []; paths.push(asset.relativePath); map.set(key,paths);
    }
  }
  console.log(`JS size report: ${assets.length} files; top ${top}`);
  console.log('Total raw bytes\t' + assets.reduce((sum,asset) => sum + asset.rawBytes,0));
  console.log('Total gzip bytes\t' + assets.reduce((sum,asset) => sum + asset.gzipBytes,0));
  for (const asset of assets.sort((a,b) => b.gzipBytes - a.gzipBytes || a.relativePath.localeCompare(b.relativePath)).slice(0,top)) {
    console.log(`${asset.relativePath}\traw=${asset.rawBytes}\tgzip=${asset.gzipBytes}\tpages=${asset.pages}`);
  }
  for (const [title,map] of [['Duplicate JS bytes',hashes],['Multiple JS variants',families]]) {
    for (const paths of [...map.values()].filter(paths => paths.length > 1)) console.log(title + '\t' + paths.join(', '));
  }
}
