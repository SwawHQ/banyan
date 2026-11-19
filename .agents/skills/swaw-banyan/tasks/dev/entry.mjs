import {main} from '../server/run.mjs';
import {workspaceEnvironment} from './workspace.mjs';

Object.assign(process.env,workspaceEnvironment);
await main();
