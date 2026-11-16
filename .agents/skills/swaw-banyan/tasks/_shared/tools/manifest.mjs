import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, payloadName } from './filesystem.mjs';
import {operatingSystem,platform} from './platform.mjs';
export {platform} from './platform.mjs';

export const skillRoot = fs.realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));
export const toolsRoot = path.join(skillRoot, '.tools');
export function definition(name, root = skillRoot) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, `tools.${platform}.json`), 'utf8'));
  if (manifest.schema !== 'swaw-banyan.tools/v2') fail('invalid_tools_manifest');
  const matches = manifest.tools.filter(tool => tool.name === name);
  if (matches.length !== 1) fail(`missing_or_duplicate_runtime:${name}`);
  const tool = {...matches[0], platform};
  if (!['bun','node','hugo','go','git','gh','pagefind'].includes(name) || !/^\d+\.\d+\.\d+$/.test(tool.version) ||
      (!/^[a-f0-9]{64}$/.test(tool.sha256) || !(['zip','tar.gz'].includes(tool.archiveFormat) || operatingSystem === 'mac' && name === 'hugo' && tool.archiveFormat === 'pkg')) || !payloadName(tool.executable) ||
      !Array.isArray(tool.requiredFiles) || !tool.requiredFiles.includes(tool.executable) ||
      !tool.requiredFiles.every(payloadName) || !tool.compatibility ||
      Object.keys(tool.compatibility).some(key => !['min','before','exact'].includes(key)) ||
      Object.values(tool.compatibility).some(value => !/^\d+\.\d+\.\d+$/.test(value)) ||
      (!tool.compatibility.min && !tool.compatibility.exact)) fail('invalid_runtime_definition');
  return tool;
}
