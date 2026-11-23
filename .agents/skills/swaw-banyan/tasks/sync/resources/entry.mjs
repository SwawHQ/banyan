import {usageError} from '../../_shared/usage.mjs';
import {syncResources} from './run.mjs';

try {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const ids = args.filter(arg=>arg !== '--force');
  if (ids.some(id => !id || id.startsWith('-'))) throw usageError('Expected resource ids');
  await syncResources(process.cwd(),{ids,force});
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
