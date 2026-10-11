import {checkNavigationFailure} from '../timeout/check.mjs';

export function check(args) {
  return checkNavigationFailure(args,()=>{
    const post=ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage=function(message,...args){
      if(message?.type==='SKIP_WAITING')throw new Error('Simulated activation failure');
      return post.call(this,message,...args);
    };
  });
}
