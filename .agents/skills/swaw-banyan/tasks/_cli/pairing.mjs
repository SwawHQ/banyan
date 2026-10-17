import path from 'node:path';
import {parseDirectory} from '../_shared/cli.mjs';
import {parseArguments} from '../_shared/arguments.mjs';
import {command as browserSiteCommand} from '../check/browser/site/options.mjs';
import {inspect} from '../check/banyan/inspect.mjs';
import {prepareHugo} from '../base/hugo/run.mjs';

export function siteDirectory(command,args) {
  if (command.startsWith('check/content/')) return parseDirectory(args,{defaultDirectory:'.',kind:'site'});
  if (command === 'check/browser/site') return parseArguments(browserSiteCommand(),args).site;
  return process.cwd();
}

export async function requirePairing(command,args) {
  const directory=siteDirectory(command,args);
  await prepareHugo();
  const result=inspect(directory);
  if (result.issues.length) throw new Error(`Banyan pairing: ${result.state} (${path.resolve(directory)})\n${result.issues.join('\n')}`);
}
