import {ensureTool} from '../../../_shared/tools/operations.mjs';

const args=process.argv.slice(2);
try {
  await ensureTool('bun',args);
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
