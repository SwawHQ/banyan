function sizeLimit(value) {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(b|kb|kib|mb|mib|gb|gib)?$/i);
  if (!match) throw new Error('Invalid size limit: ' + value);
  const units = {b:1,kb:1000,kib:1024,mb:1000**2,mib:1024**2,gb:1000**3,gib:1024**3};
  const bytes = Math.floor(Number(match[1]) * units[(match[2] || 'b').toLowerCase()]);
  if (!Number.isSafeInteger(bytes)) throw new Error('Size limit is too large: ' + value);
  return bytes;
}

// Compile declarations before any fetch or write; check downloaded bytes later.
export function prepareValidators(id, declarations = []) {
  if (!Array.isArray(declarations)) throw new Error(id + ': validators must be a list');
  const validators = declarations.map(spec => {
    if (typeof spec !== 'string') throw new Error(id + ': validator must be a string');
    if (spec === 'json') return {kind:'json',path:[],spec};
    if (spec.startsWith('json:') && spec.slice(5)) {
      return {kind:'json',path:spec.slice(5).split('.'),spec};
    }
    const match = spec.match(/^(min-size|max-size):(.+)$/);
    if (match) return {kind:match[1],limit:sizeLimit(match[2]),spec};
    throw new Error(id + ': unsupported validator: ' + spec);
  });
  return bytes => {
    if (!bytes.length) throw new Error(id + ': resource is empty');
    let json,parsed = false;
    const summaries = validators.map(validator => {
      if (validator.kind === 'json') {
        if (!parsed) {
          try { json = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')); }
          catch (error) { throw new Error(id + ': invalid JSON: ' + error.message); }
          parsed = true;
        }
        let value = json;
        for (const segment of validator.path) {
          if (!value || typeof value !== 'object' || !Object.hasOwn(value,segment)) {
            throw new Error(id + ': missing JSON path for ' + validator.spec);
          }
          value = value[segment];
        }
      } else if (validator.kind === 'min-size' ? bytes.length < validator.limit : bytes.length > validator.limit) {
        throw new Error(`${id}: ${bytes.length} bytes violates ${validator.spec}`);
      }
      return validator.spec + ' passed';
    });
    return summaries.join('; ') || bytes.length + ' bytes';
  };
}
