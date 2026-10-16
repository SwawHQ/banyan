export function compilePath(pattern) {
  if (typeof pattern !== 'string' || !/^\/(?!\/)[^\s?#:\\\x00-\x1f\x7f]*$/.test(pattern) ||
      (pattern.match(/\*/g)?.length ?? 0) > 1 || /%(?![\da-f]{2})/i.test(pattern)) {
    throw new Error('Invalid delivery path: ' + JSON.stringify(pattern) + '; expected a pathname with at most one *.');
  }
  return new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
}
