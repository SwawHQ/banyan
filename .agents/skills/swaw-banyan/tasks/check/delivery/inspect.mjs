import {readDeliveryOutputs} from './_shared/read.mjs';
import {compilePath} from './_shared/path.mjs';
import {inspectFiles} from './fingerprint/inspect.mjs';

export async function inspect(directory,{basePath='/'}={}) {
  compilePath(basePath);
  if(basePath.includes('*'))throw new Error('The base path must not contain a wildcard.');
  basePath=new URL(basePath,'https://output.invalid/').pathname;
  if(!basePath.endsWith('/'))basePath+='/';
  const outputs=await readDeliveryOutputs(directory),issues=[...outputs.issues],warnings=[];
  for(const [name,available] of [['SW',outputs.sw!==null],['Cloudflare Pages',outputs.cloudflare!==null],['EdgeOne Makers',outputs.edgeone!==null]])
    if(!available)warnings.push(name+': not checked; output is absent or invalid.');
  if(outputs.redirects!==null&&outputs.edgeone!==null) {
    const edge=outputs.edgeone.redirects.map(({source,destination,statusCode})=>({source,destination,status:statusCode}));
    if(JSON.stringify(outputs.redirects)!==JSON.stringify(edge))issues.push('Cloudflare and EdgeOne redirects differ in content or order.');
  }
  const files=await inspectFiles(outputs,basePath);
  issues.push(...files.issues);warnings.push(...files.warnings);
  return {issues,warnings,summary:{outputs:outputs.present,...files.counts,
    complete:issues.length===0&&warnings.length===0}};
}
