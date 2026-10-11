// Small task schemas keep accepted arguments and detailed help together.
export function helpFor(spec) {
  const usage = [spec.command, spec.positional ? `[${spec.positional.name}]` : '',
    ...spec.options.map(option => {
      const flag = `--${option.name}${option.value ? ' <'+option.value+'>' : ''}`;
      return option.required ? flag : '['+flag+']';
    })].filter(Boolean).join(' ');
  const rows = [];
  if (spec.positional) rows.push([spec.positional.name, `${spec.positional.description}; default: ${spec.positional.default}`]);
  for (const option of spec.options) rows.push(['--'+option.name+(option.value ? ' <'+option.value+'>' : ''),
    option.description+(option.required ? '; required' : '')+(option.default !== undefined && option.default !== false ? '; default: '+option.default : '')]);
  const width = Math.max(0,...rows.map(([name]) => name.length));
  return [`swban ${usage}`,spec.description,'',...rows.map(([name,description]) => `  ${name.padEnd(width)}  ${description}`),
    '',...(spec.examples ?? []).map(example => 'swban '+example)].join('\n');
}

export function parseArguments(spec,args) {
  if (args.length === 1 && ['--help','-h'].includes(args[0])) return null;
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
      if (!option || used.has(option.name)) throw new Error('Unknown or repeated option: '+arg);
      used.add(option.name);
      if (!option.value) {
        if (match[2] !== undefined) throw new Error('--'+option.name+' takes no value.');
        result[option.name] = true;
      } else {
        const value = match[2] ?? args[++index];
        if (!value || value.startsWith('--')) throw new Error('Missing value for --'+option.name);
        result[option.name] = option.parse ? option.parse(value) : value;
      }
    } else {
      if (!spec.positional || positional || !arg) throw new Error('Unexpected argument: '+arg);
      result[spec.positional.name] = arg; positional = true;
    }
  }
  for (const option of spec.options) if (option.required && !used.has(option.name)) throw new Error('--'+option.name+' is required.');
  return result;
}
