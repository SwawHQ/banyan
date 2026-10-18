import fs from 'node:fs';
import path from 'node:path';
import { plainPath, stat, payloadName, nameKey, tree, sha256 } from './filesystem.mjs';
import { probe } from './process.mjs';

export function receipt(root, tool, {allowDamaged = false} = {}) {
  try {
    plainPath(root);
    const file = plainPath(path.join(root, 'install.json'));
    if (!stat(file)?.isFile() || stat(file).size > 8 * 1024 * 1024) return null;
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (record.schema !== 'swaw-banyan.install/v1' || record.name !== tool.name || record.platform !== tool.platform ||
        !/^\d+\.\d+\.\d+$/.test(record.version) || !/^[a-f0-9]{64}$/.test(record.archive_sha256) ||
        !Array.isArray(record.files) || record.files.length > 25000) return null;
    const names = new Set(), directories = new Set();
    for (const file of record.files) {
      if (!payloadName(file.name) || names.has(nameKey(file.name)) || !Number.isSafeInteger(file.length) || file.length < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) return null;
      names.add(nameKey(file.name));
      for (let parent = path.posix.dirname(file.name); parent !== '.'; parent = path.posix.dirname(parent)) directories.add(nameKey(parent));
    }
    if (!names.has(nameKey(tool.executable))) return null;
    for (const item of tree(root)) {
      if (item.name === 'install.json' && !item.directory) continue;
      if (!(item.directory ? directories : names).has(nameKey(item.name))) return null;
    }
    for (const file of record.files) {
      const target = path.join(root, file.name), item = stat(target);
      if (allowDamaged && !item) continue;
      if (!item?.isFile() || (!allowDamaged && (item.size !== file.length || sha256(target) !== file.sha256))) return null;
    }
    return record;
  } catch { return null; }
}
export async function versionMatches(root, tool) {
  const version = tool.version.replaceAll('.', '\\.');
  const system = tool.platform.replace('windows-', 'windows/').replace('darwin-', 'darwin/').replace('linux-', 'linux/').replace(/x64$/, 'amd64');
  const patterns = {bun:`^${version}$`, node:`^v${version}$`, hugo:`^hugo v${version}(?:-[a-f0-9]+)?\\+extended(?:\\+withdeploy)? ${system}(?:\\s|$)`, go:`^go version go${version} ${system}$`, git:`^git version ${(tool.reportedVersion || tool.version).replaceAll('.', '\\.')}$`, gh:`^gh version ${version}(?:\\s|$)`};
  patterns.uv = `^uv ${version}(?:\\s|$)`;
  const env = tool.name === 'go' ? {...process.env, GOROOT:root, GOTOOLCHAIN:'local'} : process.env;
  const result = await probe(path.join(root, tool.executable), [tool.name === 'go' || tool.name === 'hugo' ? 'version' : '--version'], {env});
  return result.ok && new RegExp(patterns[tool.name]).test(result.text);
}
export async function definitionMatches(root, tool, record) {
  if (!record || record.version !== tool.version || record.archive_sha256 !== tool.sha256 || record.source !== tool.url) return false;
  for (const file of tool.requiredFiles) if (!stat(plainPath(path.join(root, file)))?.isFile()) return false;
  for (const extra of tool.supplements || []) if (!record.files.some(file => file.name === extra.name && file.sha256 === extra.sha256)) return false;
  return versionMatches(root, tool);
}
