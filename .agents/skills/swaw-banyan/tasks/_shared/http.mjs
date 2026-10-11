export function parseURL(args) {
  if (args.length === 1 && ['--help','-h'].includes(args[0])) return null;
  if (args.length !== 1 || !args[0] || args[0].startsWith('-')) throw new Error('Expected one HTTP or HTTPS URL.');
  const url = new URL(args[0]);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Expected an HTTP or HTTPS URL without credentials.');
  return url.href;
}
export async function request(url,method = 'HEAD') {
  const response = await fetch(url,{method,redirect:'follow',signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response;
}
export const headerObject = headers => Object.fromEntries([...headers].map(([key,value]) => [key.toLowerCase(),value]));
