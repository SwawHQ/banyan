import {request,headerObject} from '../_shared/request.mjs';
import {inspectSecurityHeaders} from './headers.mjs';
export async function inspect(url) {
  return {issues:inspectSecurityHeaders(headerObject((await request(url)).headers))};
}
