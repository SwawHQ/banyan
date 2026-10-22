import assert from 'node:assert/strict';
import {extractBlocks} from '../../../_shared/html/blocks.mjs';
import {extractStartTags,extractTagAttribute,hasClassToken} from '../../../_shared/html/markup.mjs';

export function inspectDocumentMetadata(html) {
  try {
    const metadata=extractBlocks(html,'div',tag=>hasClassToken(tag,'document-meta'));
    assert.ok(metadata.length<=1,'Document metadata must occur at most once.');
    for(const meta of metadata) {
      const times=extractStartTags(meta.inner,'time');
      const dates=extractBlocks(meta.inner,'div',tag=>hasClassToken(tag,'document-meta__row'))
        .filter(row=>extractStartTags(row.inner,'time').length);
      assert.ok(times.length<=2,'Metadata has at most two dates.');
      assert.equal(dates.length,times.length,'Dates use separate metadata rows.');
      for(const [index,row] of dates.entries()) {
        const start=index?dates[index-1].index+dates[index-1].html.length:0;
        assert.equal(meta.inner.slice(start,row.index).trim(),'','Dates occupy the first, adjacent metadata rows.');
        const icons=extractStartTags(row.inner,'use').map(tag=>extractTagAttribute(tag,'href'));
        assert.deepEqual(icons,['#icon-clock'],'Date rows use the clock icon.');
      }
    }
    return [];
  } catch(error) {return [error.message];}
}
