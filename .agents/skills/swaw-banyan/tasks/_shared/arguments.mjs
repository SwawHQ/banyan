import {usageError} from './usage.mjs';
import {taskHelp} from '../help/run.mjs';

export const helpFor=(spec,language)=>taskHelp(spec.command,language);

export function parseArguments(spec,args) {
  const result = Object.fromEntries(spec.options.map(option => [option.name,option.default ?? false]));
  if (spec.positional) result[spec.positional.name] = spec.positional.default;
  const used = new Set();
  let positional = false, literal = false;
  for (let index=0; index<args.length; index++) {
    const arg = args[index];
    if (!literal && arg === '--') { literal = true; continue; }
    if (!literal && arg.startsWith('-')) {
      const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
      const option = spec.options.find(option => option.name === match?.[1]);
      if (!option || used.has(option.name)) throw usageError('Unknown or repeated option: '+arg);
      used.add(option.name);
      if (!option.value) {
        if (match[2] !== undefined) throw usageError('--'+option.name+' takes no value.');
        result[option.name] = true;
      } else {
        const value = match[2] ?? args[++index];
        if (!value || value.startsWith('--')) throw usageError('Missing value for --'+option.name);
        try { result[option.name] = option.parse ? option.parse(value) : value; }
        catch (error) { throw usageError(error.message); }
      }
    } else {
      if (!spec.positional || positional || !arg) throw usageError('Unexpected argument: '+arg);
      result[spec.positional.name] = arg; positional = true;
    }
  }
  for (const option of spec.options) if (option.required && !used.has(option.name)) throw usageError('--'+option.name+' is required.');
  return result;
}
