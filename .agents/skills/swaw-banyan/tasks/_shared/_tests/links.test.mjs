import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectInternalLinks} from '../html/links.mjs';
import {localReference} from '../output.mjs';

const target={relativePath:'guide/index.html',text:'<h2 id="配置">Config</h2><a name="legacy"></a>'};
const page=text=>({relativePath:'index.html',text});
const options={siteURL:'https://example.test/',files:['manual.pdf']};

test('internal links resolve relative, same-origin, encoded and navigation fragments',()=>{
  const html=`<h2 id="local">Local</h2>
    <a href="#local">Local</a><a href="guide/?x=1&amp;y=2#%E9%85%8D%E7%BD%AE">Encoded</a>
    <a href="https://example.test/guide/#配置">Absolute</a><a href="/guide/#legacy">Named</a>
    <a href="/guide/#from=articles&amp;sorts=name-asc&amp;anchor=%E9%85%8D%E7%BD%AE">Navigation</a>
    <a href="/guide/#from=articles">Source</a><a href="/guide/#sorts=name-asc">Path sort</a>
    <a href="/guide/#sort=name-asc">Main sort</a>
    <a href="#local:~:text=Local">Text</a><a href="manual.pdf#page=2">Download</a>
    <a href="https://external.test/missing/">External</a><a href="mailto:example@example.test">Mail</a>
    <script>const example='<a href="/missing/">';</script><!-- <a href="/missing/"> -->`;
  assert.deepEqual(inspectInternalLinks([page(html),target],options),[]);
});

test('slashless directories resolve their published index and retain anchor checks',()=>{
  const links=page('<a href="/guide">Root</a><a href="guide#配置">Relative anchor</a>');
  assert.deepEqual(inspectInternalLinks([links,target],options),[]);
  assert.deepEqual(inspectInternalLinks([page('<a href="/sub/guide#legacy">Named</a>'),target],
    {siteURL:'https://example.test/sub/'}),[]);
  const issues=inspectInternalLinks([page('<a href="/guide#missing">Anchor</a><a href="/missing">Missing</a>'),target],options);
  assert.equal(issues.length,2);
  assert.match(issues[0],/Missing internal anchor: index.html -> \/guide#missing/);
  assert.match(issues[1],/Missing internal target: index.html -> \/missing/);
  const file={relativePath:'guide',text:'<h2 id="direct">File</h2>'};
  assert.deepEqual(inspectInternalLinks([page('<a href="/guide#direct">File</a>'),file,target],options),[]);
  assert.match(inspectInternalLinks([page('<a href="/guide#配置">Wrong file anchor</a>'),file,target],options)[0],
    /Missing internal anchor/);
});

test('internal link faults report their source and missing target or anchor',()=>{
  const html='<a href="/missing/">Missing</a><a href="/guide/#missing">Anchor</a>'+
    '<a href="/guide/#from=articles&amp;anchor=missing">Navigation anchor</a>'+
    '<a href="/guide/#%FF">Invalid encoding</a><a href="http://[">Invalid URL</a>';
  const issues=inspectInternalLinks([page(html),target],options);
  assert.equal(issues.length,5);
  assert.match(issues[0],/Missing internal target: index.html -> \/missing\//);
  assert.match(issues[1],/Missing internal anchor: index.html -> \/guide\/#missing/);
  assert.match(issues[2],/Missing internal anchor: index.html -> .*anchor=missing/);
  assert.match(issues[3],/Invalid internal link: index.html -> \/guide\/#%FF/);
  assert.match(issues[4],/Invalid internal link: index.html -> http:\/\/\[/);
});

test('internal links retain the deployment prefix and reject URLs outside it',()=>{
  const pages=[page('<a href="guide/#配置">Relative</a><a href="/sub/guide/#legacy">Prefixed</a>'),target];
  assert.deepEqual(inspectInternalLinks(pages,{siteURL:'https://example.test/sub/'}),[]);
  pages[0]=page('<a href="/guide/">Outside the deployment</a>');
  assert.match(inspectInternalLinks(pages,{siteURL:'https://example.test/sub/'})[0],/Missing internal target/);
});

test('encoded deployment prefixes resolve pages and assets without decoding twice',()=>{
  for(const prefix of ['/中文/','/%E4%B8%AD%E6%96%87/','/a%20b/','/a%25b/']) {
    const siteURL='https://example.test'+prefix;
    const pages=[page('<a href="guide/#配置">Relative</a><a href="'+prefix+'guide/#legacy">Prefixed</a>'),target];
    assert.deepEqual(inspectInternalLinks(pages,{siteURL}),[],prefix);
    assert.equal(localReference('site/main.css',{siteURL}),'site/main.css',prefix);
    assert.equal(localReference('guide/100%25.html',{siteURL}),'guide/100%.html',prefix);
    assert.match(inspectInternalLinks([page('<a href="/guide/">Outside</a>'),target],{siteURL})[0],/Missing internal target/);
  }
});

test('deployment prefixes compare decoded paths without changing case or decoding twice',()=>{
  for(const [prefix,href] of [
    ['/%E4%B8%AD%E6%96%87/','/%e4%b8%ad%e6%96%87/guide/'],
    ['/%e4%b8%ad%e6%96%87/','/%E4%B8%AD%E6%96%87/guide/'],
    ['/中文/','/%e4%b8%ad%e6%96%87/guide/'],
    ['/base/','/b%61se/guide/'],
    ['/a%25b/','/a%25b/guide/'],
    ['/a%2520b/','/a%2520b/guide/']
  ]) {
    const siteURL='https://example.test'+prefix;
    assert.deepEqual(inspectInternalLinks([page('<a href="'+href+'">Guide</a>'),target],{siteURL}),[],prefix);
  }
  for(const [prefix,href] of [
    ['/Base/','/base/guide/'],['/base/','/base-extra/guide/'],['/a%2520b/','/a%20b/guide/']
  ]) assert.match(inspectInternalLinks([page('<a href="'+href+'">Outside</a>'),target],
    {siteURL:'https://example.test'+prefix})[0],/Missing internal target/);
});

test('quoted delimiters retain real anchors and links without inventing links from attribute text',()=>{
  const target={relativePath:'guide/index.html',text:
    '<script title="A > B">const fake="<a href=\'/missing/\'>";</script>'+
    "<style title='A > B'>x::before{content:'<a href=\"/missing/\">'}</style>"+
    '<h2 title="A > B" id="target">Target</h2><a title=\'A > B\' name="legacy"></a>'+
    '<a-widget name="not-an-anchor"></a-widget>'};
  const source=page('<a href="/guide/#target">Target</a><a title="A > B" href="/guide/#target">Target</a>'+
    '<a title=\'A > B\' href="/guide/#legacy">Legacy</a>'+
    '<div title="<a href=\'/missing/\'>">Example</div><a-widget href="/missing/"></a-widget>');
  assert.deepEqual(inspectInternalLinks([source,target],options),[]);
  const issues=inspectInternalLinks([page('<a title="A > B" href="/missing/">Missing</a>'+
    '<a title=\'A > B\' href="/guide/#missing">Anchor</a>'+
    '<a href="/guide/#not-an-anchor">Custom element</a>'),target],options);
  assert.equal(issues.length,3);
  assert.match(issues[0],/Missing internal target/);
  assert.match(issues[1],/Missing internal anchor/);
  assert.match(issues[2],/Missing internal anchor/);
});
