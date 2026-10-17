export function inspectSecurityHeaders(headers) {
  const issues = [], get = name => headers[name] ?? '';
  const csp = get('content-security-policy');
  if (!csp) issues.push('Response is missing Content-Security-Policy.');
  const directives = new Map(csp.split(';').map(value => { const [name,...tokens] = value.trim().split(/\s+/); return [name,tokens]; }));
  for (const [name,token] of [['default-src',"'self'"],['object-src',"'none'"],['base-uri',"'self'"],['frame-ancestors',"'self'"]]) {
    if (!directives.get(name)?.includes(token)) issues.push(`CSP must contain ${name} ${token}.`);
  }
  const permissions = get('permissions-policy');
  for (const name of ['camera','microphone','geolocation','payment','usb']) {
    if (!new RegExp('(?:^|,)\\s*' + name + '=\\(\\)\\s*(?:,|$)').test(permissions)) issues.push('Permissions-Policy must deny ' + name + '.');
  }
  if (!/(?:^|;)\s*max-age=[1-9]\d*\s*(?:;|$)/i.test(get('strict-transport-security'))) issues.push('HSTS must declare a positive max-age.');
  if (get('x-content-type-options').toLowerCase() !== 'nosniff') issues.push('X-Content-Type-Options must be nosniff.');
  if (get('referrer-policy').toLowerCase() !== 'strict-origin-when-cross-origin') issues.push('Referrer-Policy must be strict-origin-when-cross-origin.');
  return issues;
}
