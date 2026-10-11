import fs from 'node:fs/promises';
import path from 'node:path';

async function resolvedDestination(directory) {
  try {return await fs.realpath(directory);}
  catch(error){
    if(error.code!=='ENOENT')throw error;
    return path.join(await resolvedDestination(path.dirname(directory)),path.basename(directory));
  }
}

export async function assertReportOutsideBuilds(destination,builds) {
  const target=await resolvedDestination(path.resolve(destination));
  for(const build of builds){
    const relative=path.relative(await fs.realpath(path.resolve(build)),target);
    if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))
      throw new Error('Report output must be outside the published build.');
  }
}
