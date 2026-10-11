import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';
import {parseWidths} from '../../../../_shared/browser/viewport.mjs';

export function openCommand(command,description) {
  const spec=browserCommand(command,description,[
    {name:'from',value:'path',required:true,description:'Published source collection; include the desired sorting query',parse:sitePath},
    {name:'page',value:'path',required:true,description:'Article pathname linked from the source collection',parse:value=>{
      const path=sitePath(value);
      if(new URL(path,'http://swban.invalid').search)throw new Error('--page selects an article pathname; put source sorting in --from.');
      return path;
    }},
    {name:'widths',value:'list',default:'390,1024,1440',description:'Comma-separated viewport widths; test height: 900 pixels',parse:parseWidths},
    {name:'pan',value:'px',description:'Canvas offset; default: keep the article link visible, pan narrow viewports',parse:value=>{
      if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('--pan must be a nonnegative integer.');
      return Number(value);
    }},
    {name:'touch',default:false,description:'Use native taps in a mobile touch context'},
    {name:'drag',value:'px',description:'Drag left with real Chromium touch input before opening; requires --touch, widths <= 430; excludes --pan',parse:value=>{
      if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('--drag must be a positive integer.');
      return Number(value);
    }}
  ]);
  spec.examples=[command+' ./preview --from /all/ --page /article/',command+' ./preview --from /all/?sort=name-desc --page /article/ --touch',
    command+' ./preview --from /all/ --page /article/ --widths 390 --touch --drag 160'];
  return spec;
}
