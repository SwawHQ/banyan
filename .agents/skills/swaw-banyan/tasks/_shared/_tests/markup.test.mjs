import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeHtmlAttribute,extractTagAttribute,extractElementText} from '../html/markup.mjs';

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
