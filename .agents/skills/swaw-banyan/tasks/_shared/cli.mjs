export function parseDirectory(args, {defaultDirectory = 'public', kind = 'output'} = {}) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) return null;
  if (args.length > 1 || (args.length && (!args[0] || args[0].startsWith('-')))) {
    throw new Error(`Expected one ${kind} directory; default: ${defaultDirectory}`);
  }
  return args[0] ?? defaultDirectory;
}

export function parseReport(args) {
  if (args.length === 1 && ['--help','-h'].includes(args[0])) return null;
  let directory = 'public', top = 8, hasDirectory = false, hasTop = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--top' || arg.startsWith('--top=')) {
      const value = arg === '--top' ? args[++index] : arg.slice(6);
      if (hasTop || !/^\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
        throw new Error('Expected one positive integer for --top');
      }
      top = Number(value); hasTop = true;
    } else if (!arg || arg.startsWith('-') || hasDirectory) {
      throw new Error('Expected one output directory and optional --top N');
    } else { directory = arg; hasDirectory = true; }
  }
  return {directory,top};
}

export function printCheck(command,result) {
  const issues = result.issues ?? [];
  console.log(`${command}: ${issues.length} issues`);
  for (const issue of issues) console.error('- ' + issue);
  for (const warning of result.warnings ?? []) console.warn('Warning: ' + warning);
  if (issues.length) process.exitCode = 1;
}
