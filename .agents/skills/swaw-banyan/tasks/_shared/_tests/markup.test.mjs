import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeHtmlAttribute,extractTagAttribute,extractElementText,extractStartTags} from '../html/markup.mjs';
import {stripRawText} from '../html/blocks.mjs';

test('HTML entity decoding keeps supported named and numeric values',()=>{
  assert.equal(decodeHtmlAttribute('&amp; &lt; &gt; &quot; &#39; &#x1f331; &#128161; &#X41;'),"& < > \" ' 🌱 💡 A");
});

test('HTML entity decoding does not decode replacement text again',()=>{
  for(const [encoded,expected] of [
    ['&amp;lt;tag&amp;gt;','&lt;tag&gt;'],
    ['&#38;lt;tag&#38;gt;','&lt;tag&gt;'],
    ['&#x26;lt;tag&#x26;gt;','&lt;tag&gt;'],
    ['&amp;#60;tag&amp;#62;','&#60;tag&#62;'],
    ['&amp;quot;quote&amp;quot;','&quot;quote&quot;'],
    ['&unknown;','&unknown;'],
  ])assert.equal(decodeHtmlAttribute(encoded),expected,encoded);
});

test('HTML attribute and element readers keep literal entity text',()=>{
  const tag='<a href="/p/&amp;lt;tag&amp;gt;/" title="Literal &amp;lt;tag&amp;gt;">';
  assert.equal(extractTagAttribute(tag,'title'),'Literal &lt;tag&gt;');
  assert.equal(extractTagAttribute(tag,'href'),'/p/&lt;tag&gt;/');
  assert.equal(extractElementText('<bdi>Literal &amp;lt;tag&amp;gt;</bdi>','bdi'),'Literal &lt;tag&gt;');
});

test('attribute readers skip attribute-like text inside other quoted values',()=>{
  for(const [tag,name,value] of [
    [`<a title="Example href='/missing/'" HREF = "/guide/#real">`,'href','/guide/#real'],
    [`<h2 title='Example id="fake"' id=real>`,'ID','real'],
    [`title="Example name='fake'" name='legacy'`,'name','legacy'],
    [`<a title="Example href='/missing/'">`,'href',''],
    [`<h2 title='Example id="fake"'>`,'id',''],
    [`<a title="Example href='/missing/'" href="">`,'href',''],
    [`disabled title="Example href='/missing/'" href=/guide/?x=1&amp;y=2`,'href','/guide/?x=1&y=2'],
  ])assert.equal(extractTagAttribute(tag,name),value,tag);
});

test('opening tags preserve quoted delimiters and match complete names',()=>{
  const tags=[
    '<H2 title="A > B" id="target">',
    '<a title=\'A > B\' href="#target">',
    '<a-widget href="/not-a-link/">',
    '<div title="<a href=\'/not-a-link/\'>">',
    '<a href="#last"/>',
    '<span id="last">'
  ];
  const html=tags.map(tag=>tag+'Text').join('')+'</span></div></a-widget></a></h2>';
  assert.deepEqual(extractStartTags(html,'A'),[tags[1],tags[4]]);
  assert.deepEqual(extractStartTags(html,'h2'),[tags[0]]);
  assert.deepEqual(extractStartTags(html),tags);
});

test('raw-text stripping preserves complete quoted opening tags and following elements',()=>{
  const script='<script title="A > B">',style="<style title='A > B'>";
  const heading='<h2 id="target">';
  const html=script+'const fake="</style><a href=\'/missing/\'>";</script>'+style+
    'x::before{content:"<a href=\'/missing/\'>"}</style><!-- <a href="/missing/"> -->'+heading+'Target</h2>';
  const stripped=stripRawText(html);
  assert.deepEqual(extractStartTags(stripped,'script'),[script]);
  assert.deepEqual(extractStartTags(stripped),[script,style,heading]);
});
