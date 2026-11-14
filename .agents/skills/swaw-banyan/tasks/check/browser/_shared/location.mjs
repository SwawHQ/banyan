import {extractCanonicalHref,isRedirectPage} from '../../../_shared/html/markup.mjs';

export function pageRoute(relativePath) {
  return '/'+relativePath.split('/').map(encodeURIComponent).join('/').replace(/(^|\/)index\.html$/,'$1');
}

export function siteLocation(pages) {
  const entry=pages.find(page=>page.relativePath==='index.html');
  if(!entry)throw new Error('Build directory must contain index.html.');
  const canonical=extractCanonicalHref(entry.text);
  const home=isRedirectPage(entry.text)?pages.find(page=>!isRedirectPage(page.text)&&canonical&&extractCanonicalHref(page.text)===canonical):entry;
  if(!home)throw new Error('The root redirect must target a published home page.');
  const route=canonical?new URL(canonical).pathname:pageRoute(home.relativePath);
  const suffix=pageRoute(home.relativePath);
  if(!route.endsWith(suffix))throw new Error('Home canonical URL does not match its output path.');
  return {home:route,basePath:route.slice(0,route.length-suffix.length)+'/'};
}
