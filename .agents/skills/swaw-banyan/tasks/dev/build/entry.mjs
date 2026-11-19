import {workspaceEnvironment} from '../workspace.mjs';

Object.assign(process.env,workspaceEnvironment);
await import('../../build/entry.mjs');
