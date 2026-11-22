import {checkTool} from '../../../_shared/tools/operations.mjs';

const args=process.argv.slice(2);
try {
  await checkTool('gh',args);
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
