import {helpFor,parseArguments} from '../../../_shared/arguments.mjs';
import {ensureDependencies} from '../../../_shared/dependencies.mjs';
import {prepareTools} from '../../../_shared/tools/selection.mjs';

export async function main(stage) {
  const command='deploy/release/tag'+(stage?'/'+stage:'');
  const spec={command,positional:{name:'version'},options:[{name:'check'}]};
  try {
    const args=parseArguments(spec,process.argv.slice(2));
    if (args===null) console.log(helpFor(spec));
    else {
      await ensureDependencies();
      const {versionPattern}=await import('../../../_shared/banyan.mjs');
      if (!versionPattern.test(args.version)) throw new Error(`Use swban ${command} <X.Y.Z> [--check].`);
      await prepareTools(['git','go','hugo']);
      const {release}=await import('./release.mjs');
      console.log(JSON.stringify(release({...args,stage}),null,2));
    }
  } catch(error) { console.error(error.message);process.exitCode=1; }
}
