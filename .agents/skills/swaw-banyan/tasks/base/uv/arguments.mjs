import {stripVTControlCharacters} from 'node:util';
import {probe} from '../../_shared/tools/process.mjs';

export async function pythonCommandIndex(executable,args,env) {
  for (let index = 0; index < args.length; index++) {
    if (!['run','pip'].includes(args[index])) continue;
    // Let uv distinguish global-option values from commands without executing them.
    const result = await probe(executable,[...args.slice(0,index+1),'--help'],{env});
    const output = stripVTControlCharacters(result.text);
    if (result.ok && /^uv(?:\.exe)? \d+\.\d+\./m.test(output)) return -1;
    const usage = result.ok && output.match(/^Usage: \S+ (.+)$/m)?.[1];
    if (!usage) throw new Error('uv_argument_probe_failed');
    if (usage.startsWith('[OPTIONS]')) continue;
    // A different command owns the remaining arguments, which may execute a tool.
    return usage.startsWith(args[index]+' [OPTIONS]') ? index : -1;
  }
  return -1;
}
