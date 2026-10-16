import {printCheck} from '../../_shared/cli.mjs';
import {parseArguments} from '../../_shared/arguments.mjs';
import {inspect} from './inspect.mjs';

try {
  const options=parseArguments({positional:{name:'dir',default:'public'},
    options:[{name:'base-path',value:'path',default:'/'}]},process.argv.slice(2));
  if(options===null)console.log('swban check/delivery [dir] [--base-path <path>]  #Check delivery output and fingerprint paths; defaults: public, /');
  else {
    const result=await inspect(options.dir,{basePath:options['base-path']});
    printCheck('check/delivery',result);
    console.log(JSON.stringify(result.summary));
  }
} catch(error) {console.error(error.message);process.exitCode=1;}
