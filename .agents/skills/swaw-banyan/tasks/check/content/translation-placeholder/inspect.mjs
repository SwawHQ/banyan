import {readContent} from '../../../_shared/content.mjs';
export async function inspect(site) {
  const {records,issues} = await readContent(site);
  for (const {relativePath,data} of records) {
    if (!Object.hasOwn(data,'translation_placeholder')) continue;
    if (typeof data.translation_placeholder !== 'boolean') issues.push('translation_placeholder must be a boolean: ' + relativePath);
    else if (data.translation_placeholder) {
      const build = Object.fromEntries(Object.entries(data.build ?? {}).map(([key,value]) => [key.toLowerCase(),value]));
      if (String(build.list ?? '').toLowerCase() !== 'never') issues.push('Translation placeholder must set build.list to never: ' + relativePath);
    }
  }
  return {issues};
}
