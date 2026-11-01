import fs from 'node:fs';
import path from 'node:path';
import {readNavigationFragment} from '../../.agents/skills/swaw-banyan/tasks/_shared/html/breadcrumb.mjs';

export function collectionPayload(directory,logicalPath,href) {
  const resources=path.join(directory,'site/navigation');
  for(const name of fs.readdirSync(resources)) {
    if(!/^[a-f0-9]{64}\.txt$/.test(name))continue;
    const column=readNavigationFragment(fs.readFileSync(path.join(resources,name),'utf8'));
    if(column.logicalPath===logicalPath&&column.href===href)return column;
  }
  throw new Error('Missing shared collection '+logicalPath+' at '+href);
}
