import {readContent} from '../_shared/read.mjs';
export async function inspect(site) {
  const {records,issues} = await readContent(site);
  for (const {relativePath,data} of records) {
    if (Object.hasOwn(data,'images')) issues.push('Use share_image instead of legacy images: ' + relativePath);
    if (!Object.hasOwn(data,'share_image')) continue;
    const value = data.share_image;
    if (value !== false && (typeof value !== 'string' || !value.trim())) issues.push('share_image must be false or a non-empty string: ' + relativePath);
  }
  return {issues};
}
