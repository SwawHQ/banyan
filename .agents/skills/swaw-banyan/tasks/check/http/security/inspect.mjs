import {request,headerObject} from '../../../_shared/http.mjs';
import {inspectSecurityHeaders} from '../../../_shared/http/security.mjs';
export async function inspect(url) {
  return {issues:inspectSecurityHeaders(headerObject((await request(url)).headers))};
}
