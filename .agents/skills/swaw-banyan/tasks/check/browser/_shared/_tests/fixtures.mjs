export function afterBrowseScript(source) {
  return `const run=()=>{${source}};const html=document.documentElement;
    const pending=()=>html.hasAttribute('data-entry-breadcrumb-pending');
    if(pending()){const observer=new MutationObserver(()=>{if(!pending()){observer.disconnect();run();}});
      observer.observe(html,{attributes:true,attributeFilter:['data-entry-breadcrumb-pending']});
    }else run();`;
}
