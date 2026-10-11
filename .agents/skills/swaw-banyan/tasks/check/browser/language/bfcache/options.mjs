import {returnCommand,languageCode} from '../return/options.mjs';

export function bfcacheCommand(command,description) {
  const spec=returnCommand(command,description);
  spec.options.push({name:'next',value:'code',description:'Second target; default: source language',parse:languageCode});
  spec.examples=[command+' ./preview --from /article/?from=all#details --to zh',
    command+' ./preview --from /article/ --to zh --next zh-tw --trace'];
  return spec;
}

// Playwright disables BFCache by default. This task requires actual restorations.
export const launchOptions={ignoreDefaultArgs:['--disable-back-forward-cache']};
