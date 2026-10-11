import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../_toolchain/manifest.mjs';
import { fail } from '../_toolchain/filesystem.mjs';

export function help(args) {
  if (args.length > 1) fail('invalid_help_arguments; run swban help en or swban help zh');
  if (args.length && !['en','zh'].includes(args[0])) fail('unsupported_help_language; use en or zh');
  const requested = args[0] || Intl.DateTimeFormat().resolvedOptions().locale;
  const language = /^zh(?:-|$)/i.test(requested) ? 'zh-CN' : 'en';
  process.stdout.write(fs.readFileSync(path.join(skillRoot, `references/swban.help.${language}.md`), 'utf8'));
}
