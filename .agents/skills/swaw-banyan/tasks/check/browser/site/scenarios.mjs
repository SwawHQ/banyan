import {check as home} from '../home/check.mjs';
import {check as csp} from '../csp/check.mjs';
import {check as contrast} from '../palette/contrast/check.mjs';
import {check as prose} from '../prose/layout/check.mjs';
import {check as sort} from '../nav/sort/check.mjs';
import {check as rules} from '../prefetch/rules/check.mjs';
import {check as overlap} from '../prefetch/overlap/check.mjs';
import {check as debug} from '../prefetch/debug/check.mjs';
import {check as offline} from '../pwa/offline/check.mjs';
import {check as activate} from '../pwa/activate/check.mjs';
import {check as manual} from '../pwa/check/check.mjs';
import {check as native} from '../pwa/native/check.mjs';
import {check as cancel} from '../pwa/cancel/check.mjs';
import {check as timeout} from '../pwa/timeout/check.mjs';
import {check as error} from '../pwa/error/check.mjs';

export function siteScenarios(site,options) {
  const scenarios=[];
  function add(id,check,page,settings={}) {
    scenarios.push({id,kind:settings.upgrade?'upgrade':'single',serviceWorkers:settings.workers?'allow':'block',
      skipReason:settings.skipReason??(!page?'No published page meets this check\'s requirements.':null),
      run:args=>check({...args,options:{timeout:options.timeout,page,...settings.args,
        ...(settings.upgrade?{dir:args.upgradePair.fromDir,next:args.upgradePair.toDir}:{})}})});
  }
  add('home',home,site.home);
  add('csp',csp,site.home);
  add('palette-contrast',contrast,site.prose,{args:{min:4.5}});
  add('prose-layout',prose,site.prose);
  add('collection-sort',sort,site.collection);
  for(const [name,page] of [['home',site.home],['collection',site.collection],['debug',site.debug]])
    add('prefetch-rules-'+name,rules,page,{args:{expect:site.rules?'header':'off'}});
  add('prefetch-overlap',overlap,site.overlap,{workers:true});
  add('prefetch-debug',debug,site.debug,{workers:true});
  add('pwa-offline',offline,site.offline,{workers:true});
  const updateSkip=!site.offline?'Service workers are not enabled in this build.':
    !site.panel?'No versioned update panel with reciprocal root links.':
    !options.updates?'Use --updates to build and check a next version.':null;
  for(const [name,check] of [['activate',activate],['check',manual],['native',native],['cancel',cancel],['timeout',timeout],['error',error]])
    add('pwa-'+name,check,site.panel,{upgrade:true,workers:true,skipReason:updateSkip,args:{from:site.from}});
  add('pwa-activate-collection',activate,site.panel,{upgrade:true,workers:true,
    skipReason:updateSkip??(!site.collectionFrom?'No sortable collection links to the update panel.':null),args:{from:site.collectionFrom}});
  return scenarios;
}
