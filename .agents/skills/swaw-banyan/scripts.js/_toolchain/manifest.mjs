import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, payloadName } from './filesystem.mjs';

export const skillRoot = fs.realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
export const toolsRoot = path.join(skillRoot, '.tools');
export const platform = `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
export function definition(name, root = skillRoot) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'toolchain.json'), 'utf8'));
  if (manifest.schema !== 'swaw-banyan.toolchain/v2') fail('invalid_toolchain_manifest');
  const release = manifest.platforms[platform];
  if (!release) fail(`unsupported_platform:${platform}`);
  const matches = release.tools.filter(tool => tool.name === name);
  if (matches.length !== 1) fail(`missing_or_duplicate_runtime:${name}`);
  const tool = {...matches[0], platform};
  if (!['bun','node','hugo','go','git','gh'].includes(name) || !/^\d+\.\d+\.\d+$/.test(tool.version) ||
      !/^[a-f0-9]{64}$/.test(tool.sha256) || !payloadName(tool.executable) || tool.archiveFormat !== 'zip' ||
      !Array.isArray(tool.requiredFiles) || !tool.requiredFiles.includes(tool.executable) ||
      !tool.requiredFiles.every(payloadName) || !tool.compatibility ||
      Object.keys(tool.compatibility).some(key => !['min','before','exact'].includes(key)) ||
      Object.values(tool.compatibility).some(value => !/^\d+\.\d+\.\d+$/.test(value)) ||
      (!tool.compatibility.min && !tool.compatibility.exact)) fail('invalid_runtime_definition');
  return tool;
}
