import path from 'node:path';
import {hugoEnvironment} from '../../.agents/skills/swaw-banyan/scripts.js/hugo/index.mjs';

export function fixtureEnvironment(work) {
  return hugoEnvironment({...process.env,
    HUGO_CACHEDIR:path.join(work,'cache'),
    HUGO_RESOURCEDIR:path.join(work,'resources'),
    GIT_OPTIONAL_LOCKS:'0'
  });
}

export function serviceWorkerPolicy(mode,contentCheckInterval=5,offlineNoticePath='offline/') {
  return '[service_worker]\nmode = '+JSON.stringify(mode)+'\ncontent_check_interval = '+contentCheckInterval+
    '\noffline_notice_path = '+JSON.stringify(offlineNoticePath)+'\n';
}
