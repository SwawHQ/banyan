import {compilePath} from './path.mjs';

export function parseJson(text, label) {
  if (typeof text !== 'string') throw new Error(label + ' must be JSON text.');
  try { return JSON.parse(text); }
  catch (error) { throw new Error(label + ': invalid JSON: ' + error.message); }
}

export function checkObject(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object.');
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(label + ': unsupported field ' + JSON.stringify(key) + '.');
  }
}

export function checkString(value, label) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(label + ' must be a string without control characters.');
  }
}

export function checkHeaderName(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]+$/.test(value)) {
    throw new Error(label + ' must contain only letters, digits and -.');
  }
}

export function checkRedirectSource(value, label) {
  checkString(value, label);
  const names = new Set();
  const path = value.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_, name) => {
    if (names.has(name)) throw new Error(label + ' repeats placeholder ' + name + '.');
    names.add(name);
    return 'placeholder';
  });
  compilePath(path);
}

export function checkDestination(value, label) {
  checkString(value, label);
  if (!value || /\s|\\/.test(value) || /%(?![\da-f]{2})/i.test(value)) {
    throw new Error(label + ' must be a path or HTTP(S) URL without whitespace.');
  }
  if (value.startsWith('/') && !value.startsWith('//')) return;
  try {
    const url = new URL(value);
    if (/^https?:\/\//i.test(value) && url.hostname) return;
  } catch {}
  throw new Error(label + ' must start with /, http:// or https://.');
}
