import {usageError} from '../../_shared/usage.mjs';
import {syncResources} from './run.mjs';

try {
  const ids = process.argv.slice(2);
  if (ids.some(id => !id || id.startsWith('-'))) throw usageError('Expected resource ids');
  await syncResources(process.cwd(),{ids});
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
