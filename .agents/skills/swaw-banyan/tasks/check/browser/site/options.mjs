import {browserCommand} from '../../../_shared/browser/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/site','Discover representative Banyan pages and run shared browser checks in Chromium.',[
    {name:'updates',default:false,description:'Build a temporary next version and test SW updates'},
    {name:'site',value:'dir',default:'.',description:'Hugo source for --updates'}
  ]);
  spec.options.find(option=>option.name==='out').description='Save JSON, summary and failure screenshots in a new subdirectory';
  spec.options.find(option=>option.name==='trace').description='Save a trace for each executed check';
  spec.examples=['check/browser/site ./public','check/browser/site ./public --updates',
    'check/browser/site ./preview --headed --trace --out ./browser-report'];
  return spec;
}
