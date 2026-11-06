export function afterBrowseScript(source) {
  return `const run=()=>{${source}};const html=document.documentElement;
    const pending=()=>html.hasAttribute('data-entry-breadcrumb-pending')||html.hasAttribute('data-breadcrumb-sort-pending');
    if(pending()){const observer=new MutationObserver(()=>{if(!pending()){observer.disconnect();run();}});
      observer.observe(html,{attributes:true,attributeFilter:['data-entry-breadcrumb-pending','data-breadcrumb-sort-pending']});
    }else run();`;
}
