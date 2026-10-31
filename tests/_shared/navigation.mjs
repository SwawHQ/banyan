import fs from 'node:fs';
import path from 'node:path';

export function collectionPayload(directory,logicalPath,href) {
  const resources=path.join(directory,'site/navigation');
  for(const name of fs.readdirSync(resources)) {
    if(!/^[a-f0-9]{64}\.json$/.test(name))continue;
    const payload=JSON.parse(fs.readFileSync(path.join(resources,name),'utf8'));
    if(payload.lp===logicalPath&&payload.href===href)return payload;
  }
  throw new Error('Missing shared collection '+logicalPath+' at '+href);
}
