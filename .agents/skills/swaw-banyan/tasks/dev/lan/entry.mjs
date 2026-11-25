import {workspaceEnvironment} from '../workspace.mjs';

Object.assign(process.env,workspaceEnvironment);
await import('../../server/lan/entry.mjs');
