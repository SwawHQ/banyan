import {readBindings,resolveBinding} from '../_shared/toolchain/bindings.mjs';
import {inspectBinding} from '../_shared/toolchain/selection.mjs';
import {inspect,readRelease} from './banyan.mjs';
import {loadCatalog,tools} from './catalog.mjs';
import {systemLanguage} from '../help/run.mjs';

export const failed=check=>Boolean(check.issues?.length)||['disabled','not_declared','blocked','error'].includes(check.state);

export async function diagnose(site) {
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
    bindings=readBindings();
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
  await check('site.banyan',()=>{
    const unavailable=['git','go','hugo'].map(name=>'tool.'+name).filter(id=>checks.find(check=>check.id===id)?.state!=='ok');
    if (unavailable.length) return blocked(unavailable);
    const result=inspect(site),theme=result.module;
    return {...result,detail:'Skill '+release.version+'; Banyan '+(theme?(theme.directory??theme.path)+(theme.version?'@'+theme.version:''):'missing')};
  });
  return checks;
}
