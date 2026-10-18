import fs from 'node:fs';
import {pythonHome} from '../base/uv/environment.mjs';
import {inspectPython} from '../base/python/runtime.mjs';
import {readBindings,resolveBinding} from '../_shared/tools/bindings.mjs';
import {inspectBinding} from '../_shared/tools/selection.mjs';
import {inspect,readRelease} from './banyan.mjs';
import {loadCatalog,tools} from './catalog.mjs';
import {systemLanguage} from '../help/run.mjs';
import {dependencyState} from '../_shared/dependencies.mjs';

export const failed=check=>Boolean(check.issues?.length)||['missing','outdated','disabled','not_declared','blocked','error'].includes(check.state);

export async function diagnose(site) {
  const dependencies=dependencyState();
  if (dependencies.state!=='ready') return [{id:'packages.core',...dependencies,
    hint:systemLanguage()==='zh'?'运行 swban base/packages/ensure，准备核心依赖。':'Run swban base/packages/ensure to prepare core dependencies.'}];
  const catalog=loadCatalog(),language=systemLanguage(),release=readRelease(),checks=[];
  const hint=text=>text.replace(/\{(module|version)\}/g,(_,key)=>release[key]);
  let bindings;
  async function check(id,run) {
    const definition=catalog.checks[id];
    let result;
    if (!definition?.enabled) result={state:definition?'disabled':'not_declared',hint:catalog.hints.incomplete[language]};
    else {
      try { result=await run(); }
      catch(error) { result={state:'error',issues:[error.message]}; }
    }
    checks.push({id,...result,hint:hint(result.hint??definition?.hint[language]??catalog.hints.incomplete[language])});
  }
  const blocked=ids=>({state:'blocked',issues:['blocked_by: '+ids.join(', ')],hint:catalog.hints.blocked[language]});
  await check('tool.runtime',()=>{
    try { bindings=readBindings(); }
    catch(error) { return {state:'error',issues:[error.message],hint:catalog.hints.bindings[language]}; }
    if (!bindings.runtime) throw new Error('runtime_not_prepared');
    const runtime=resolveBinding(bindings.runtime,bindings);
    return {state:'ok',detail:bindings.runtime+'; '+runtime.path};
  });
  for (const name of tools) await check('tool.'+name,async()=>{
    if (!bindings) return blocked(['tool.runtime']);
    if (!bindings.tools[name]) return {state:'not_selected'};
    const tool=await inspectBinding(name);
    return {state:'ok',detail:tool.version+'; '+tool.path};
  });
  await check('tool.python',async()=>{
    if (!fs.existsSync(pythonHome())) return {state:'not_selected'};
    const python=await inspectPython();
    return {state:'ok',detail:python.version+'; '+python.path};
  });
  await check('site.banyan',()=>{
    const unavailable=['git','go','hugo'].map(name=>'tool.'+name).filter(id=>checks.find(check=>check.id===id)?.state!=='ok');
    if (unavailable.length) return blocked(unavailable);
    const result=inspect(site),theme=result.module;
    return {...result,detail:'Skill '+release.version+'; Banyan '+(theme?(theme.directory??theme.path)+(theme.version?'@'+theme.version:''):'missing')};
  });
  return checks;
}
