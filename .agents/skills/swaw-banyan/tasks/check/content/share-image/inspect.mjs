import {readContent} from '../_shared/read.mjs';
export async function inspect(site) {
  const {records,issues} = await readContent(site);
  for (const {relativePath,data} of records) {
    const params = data.params ?? {};
    if (Object.hasOwn(params,'images')) issues.push('Use params.share_image instead of params.images: ' + relativePath);
    if (!Object.hasOwn(params,'share_image')) continue;
    const value = params.share_image;
    if (value !== false && (typeof value !== 'string' || !value.trim())) issues.push('params.share_image must be false or a non-empty string: ' + relativePath);
  }
  return {issues};
}
