import {returnCommand,languageCode} from '../return/options.mjs';

export function bfcacheCommand(command) {
  const spec=returnCommand(command);
  spec.options.push({name:'next',value:'code',parse:languageCode});

  return spec;
}

// Playwright disables BFCache by default. This task requires actual restorations.
export const launchOptions={ignoreDefaultArgs:['--disable-back-forward-cache']};
