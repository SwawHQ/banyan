import { initCanvasPosition } from '../browse/canvas-position.js';

import { initSelectedEntry } from '../browse/selected-entry.js';

// The server marks the selected root entry before deferred scripts run.
initSelectedEntry(document, '[data-root-navigation] a[data-root-href][aria-current="page"]',
    entry => entry.closest('[data-root-navigation]').dataset.rootUrl);

// Install before body parsing so streamed content and early input are covered.
initCanvasPosition();
