import {parseArguments} from '../_shared/arguments.mjs';
import {build} from './run.mjs';
const spec={command:'build',options:[{name:'destination',value:true,default:'public'},{name:'baseURL',value:true}]};
try {
  const options=parseArguments(spec,process.argv.slice(2));
  process.exitCode=await build(options);
} catch(error){console.error(`[swban] ${error.message}`);process.exitCode=1;}
