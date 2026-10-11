import {prepareRuntime} from './_toolchain/selection.mjs';
import {readBindings, resolveBinding} from './_toolchain/bindings.mjs';
import fs from 'node:fs';
const [command = 'help', ...args] = process.argv.slice(2);
try {
  if (/^(?:ensure|(?:bun|node|hugo|go|git|gh)\.ensure)$/.test(command) &&
      (args.length > 1 || (args.length === 1 && args[0] !== '--force'))) throw new Error('invalid_ensure_arguments');
  if (/^(?:bun|node|hugo|go|git|gh)\.ensure$/.test(command)) await prepareRuntime();
  else if (!['help','--help','-h','ensure'].includes(command)) {
    const record = readBindings();
    if (!record.runtime || fs.realpathSync(process.execPath) !== fs.realpathSync(resolveBinding(record.runtime,record).path)) {
      throw new Error('runtime_binding_unusable; run swban ensure');
    }
  }
  switch (command) {
    case 'help': case '--help': case '-h': (await import('./help/index.mjs')).help(args); break;
    case 'ensure': console.log(JSON.stringify(await prepareRuntime(args))); break;
    case 'bun': process.exitCode = await (await import('./bun/index.mjs')).run(args); break;
    case 'bun.check': await (await import('./bun/index.mjs')).check(args); break;
    case 'bun.ensure': await (await import('./bun/index.mjs')).ensure(args); break;
    case 'node': process.exitCode = await (await import('./node/index.mjs')).run(args); break;
    case 'node.check': await (await import('./node/index.mjs')).check(args); break;
    case 'node.ensure': await (await import('./node/index.mjs')).ensure(args); break;
    case 'npm': process.exitCode = await (await import('./node/index.mjs')).npm(args); break;
    case 'npx': process.exitCode = await (await import('./node/index.mjs')).npx(args); break;
    case 'go': process.exitCode = await (await import('./go/index.mjs')).run(args); break;
    case 'go.check': await (await import('./go/index.mjs')).check(args); break;
    case 'go.ensure': await (await import('./go/index.mjs')).ensure(args); break;
    case 'hugo': process.exitCode = await (await import('./hugo/index.mjs')).run(args); break;
    case 'hugo.check': await (await import('./hugo/index.mjs')).check(args); break;
    case 'hugo.ensure': await (await import('./hugo/index.mjs')).ensure(args); break;
    case 'git': process.exitCode = await (await import('./git/index.mjs')).run(args); break;
    case 'git.check': await (await import('./git/index.mjs')).check(args); break;
    case 'git.ensure': await (await import('./git/index.mjs')).ensure(args); break;
    case 'gh': process.exitCode = await (await import('./gh/index.mjs')).run(args); break;
    case 'gh.check': await (await import('./gh/index.mjs')).check(args); break;
    case 'gh.ensure': await (await import('./gh/index.mjs')).ensure(args); break;
    default: process.exitCode = await (await import('./_tasks/index.mjs')).runTask(command, args);
  }
} catch (error) {
  console.error(`[swban] ${error.message}`); process.exitCode = 1;
}
