import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execute} from '../_shared/tools/process.mjs';
import {prepareRuntime} from '../_shared/tools/selection.mjs';
import {readBindings,resolveBinding} from '../_shared/tools/bindings.mjs';
import {runTask,taskFile} from './dispatch.mjs';
import {taskHelp} from '../help/run.mjs';

const [requested='help',...args]=process.argv.slice(2);
const helpFlags=['--help','-h'];
const suffixHelp=!args.length&&requested.endsWith('/help')&&requested!=='/help';
const helpArgument=args.length===1&&helpFlags.includes(args[0]);
let command=helpFlags.includes(requested)?'help':requested;
if (suffixHelp) command=requested.slice(0,-5);
else if (helpArgument) command=command.replace(/\/$/,'');
const native=/^base\/(?:bun|node|hugo|go|git|gh|pagefind|node\/(?:npm|npx))$/.test(command);
const showingHelp=suffixHelp||helpArgument&&!native;
try {
  taskFile(command,{allowHelpTopic:showingHelp});
  if (helpArgument&&!native) throw new Error(`Unknown option: ${args[0]}. See swban ${command}/help`);
  if (suffixHelp) {
    const language=command==='help/zh'?'zh':command==='help/en'?'en':undefined;
    console.log(taskHelp(command,language));
  } else {
    const preparing=/^base\/(?:bun|node|hugo|go|git|gh|pagefind)\/ensure$/.test(command);
    if (preparing&&(args.length>1||(args.length===1&&args[0]!=='--force'))) throw new Error(`invalid_ensure_arguments. See swban ${command}/help`);
    let executable=process.execPath;
    if (command!=='doctor'&&!/^help(?:\/(?:en|zh))?$/.test(command)&&!/^(?:base\/[^/]+)\/check$/.test(command)) {
      const record=readBindings();
      if (!record.runtime||preparing) {
        const runtime=await prepareRuntime();
        if (!preparing) executable=runtime.path;
      } else if (fs.realpathSync(executable)!==fs.realpathSync(resolveBinding(record.runtime,record).path)) {
        throw new Error(`runtime_binding_unusable; run swban base/${record.runtime}/ensure`);
      }
    }
    // Only a runtime change needs another Node process; tasks run in this process.
    process.exitCode=fs.realpathSync(executable)!==fs.realpathSync(process.execPath)
      ?await execute(executable,[fileURLToPath(import.meta.url),command,...args])
      :await runTask(command,args);
  }
} catch (error) {
  console.error(`[swban] ${error.message}`);
  if (error.message.startsWith('unknown_command:')) console.log(taskHelp('help'));
  process.exitCode=1;
}
