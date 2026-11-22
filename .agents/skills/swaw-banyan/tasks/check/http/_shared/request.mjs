import {usageError} from '../../../_shared/usage.mjs';
export function parseURL(args) {
  if (args.length !== 1 || !args[0] || args[0].startsWith('-')) throw usageError('Expected one HTTP or HTTPS URL.');
  let url;
  try { url = new URL(args[0]); } catch (error) { throw usageError(error.message); }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw usageError('Expected an HTTP or HTTPS URL without credentials.');
  return url.href;
}
export async function request(url,method = 'HEAD') {
  const response = await fetch(url,{method,redirect:'follow',signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response;
}
export const headerObject = headers => Object.fromEntries([...headers].map(([key,value]) => [key.toLowerCase(),value]));
