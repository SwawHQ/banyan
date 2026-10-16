import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloudflareHeaders} from '../../../_shared/headers.mjs';
import {compilePath} from '../_shared/path.mjs';
import {parseCloudflareHeaders} from '../cloudflare/pages/headers.mjs';
import {parseCloudflareRedirects} from '../cloudflare/pages/redirects.mjs';
import {parseEdgeoneConfig} from '../edgeone/makers/config.mjs';
import {parseSwPolicy} from '../sw/policy.mjs';

function edgeone(overrides = {}) {
  return {installCommand: '', buildCommand: 'hugo --minify', outputDirectory: 'public', nodeVersion: '22.11.0',
    hugoVersion: '0.157.0', headers: [], redirects: [], ...overrides};
}
function edgeHeader(key = 'Cache-Control', value = 'public, max-age=31536000, immutable') {
  return {source: '/assets/*', headers: [{key, value}]};
}
const readEdge = config => parseEdgeoneConfig(JSON.stringify(config));

test('delivery paths preserve encoding, case and literal regular-expression characters', () => {
  const pattern = compilePath('/Assets/a+b.[x]/*.json');
  assert.ok(pattern.test('/Assets/a+b.[x]/%E6%A0%91/data.json'));
  assert.equal(pattern.test('/assets/a+b.[x]/%E6%A0%91/data.json'), false);
  assert.equal(pattern.test('/Assets/ab.x/item.json'), false);
  assert.ok(compilePath('/').test('/'));
  assert.ok(compilePath('/a%2Fb').test('/a%2Fb'));
  assert.equal(compilePath('/a%2Fb').test('/a/b'), false);
});

test('delivery paths reject unsupported or malformed patterns', () => {
  for (const value of [null, 3, '', 'a/', '//host/x', '/a?x=1', '/a#x', '/:name', '/a\\b', '/a b', '/a\0b', '/a/*/*.js', '/bad%', '/bad%xy']) {
    assert.throws(() => compilePath(value), /Invalid delivery path/, String(value));
  }
});

test('Cloudflare parser preserves append, unset, order, case and CRLF', () => {
  const text = '# comment\r\n/*\r\n  Cache-Control: max-age=900\r\n  X-List: first\r\n/assets/*\r\n  ! cache-control\r\n  Cache-Control: immutable\r\n  x-list: second\r\n/assets/*.json\r\n  Content-Type: application/json\r\n';
  const rules = parseCloudflareHeaders(text), headers = cloudflareHeaders(rules, '/assets/a.json');
  assert.deepEqual(rules.map(rule => rule.source), ['/*', '/assets/*', '/assets/*.json']);
  assert.deepEqual(rules[1].unset, ['cache-control']);
  assert.equal(headers['cache-control'], 'immutable');
  assert.equal(headers['x-list'], 'first, second');
  assert.equal(headers['content-type'], 'application/json');
  assert.deepEqual(parseCloudflareHeaders('# no rules\n'), []);
});

test('Cloudflare parser rejects malformed declarations and controls', () => {
  for (const text of ['  X-Test: orphan', '/a\n  broken', '/a', '/a?x=1\n  X-Test: yes', '/a\n  Bad_Name: value',
    '/a\n  X-Test: a\tb', '/a\n  X-Test: a\0b', '/a\n  ! Bad_Name']) {
    assert.throws(() => parseCloudflareHeaders(text));
  }
});

test('Cloudflare header limits include whitespace, names and values', () => {
  const line = '  X: ' + 'a'.repeat(1995);
  assert.equal(line.length, 2000);
  assert.equal(parseCloudflareHeaders('/a\n' + line).length, 1);
  assert.throws(() => parseCloudflareHeaders('/a\n' + line + 'a'), /2000 characters/);
  const rules = Array.from({length: 100}, (_, index) => '/a' + index + '\n  X: yes').join('\n');
  assert.equal(parseCloudflareHeaders(rules).length, 100);
  assert.throws(() => parseCloudflareHeaders(rules + '\n/extra\n  X: yes'), /100 rules/);
});

test('Cloudflare redirects preserve order and accept local and external destinations', () => {
  const rules = parseCloudflareRedirects('# generated\n/old/ /new/?q=1#part 301\r\n/docs/* https://example.test/:splat 302\n');
  assert.deepEqual(rules, [{source: '/old/', destination: '/new/?q=1#part', status: 301},
    {source: '/docs/*', destination: 'https://example.test/:splat', status: 302}]);
  assert.deepEqual(parseCloudflareRedirects(''), []);
});

test('Cloudflare redirects reject missing fields, unsupported codes and unsafe values', () => {
  for (const text of ['/a /b', '/a /b 307', '/a /b 301 extra', '/a?x=1 /b 301', '/a javascript:alert(1) 301',
    '/a //example.test/b 301', '/a https:example.test 301', '/a /b\r 301', '/a /bad% 301']) {
    assert.throws(() => parseCloudflareRedirects(text), undefined, text);
  }
});

test('redirect sources support named placeholders without relaxing delivery paths', () => {
  const source = '/articles/:articleId/:part_2', destination = '/read/:articleId/:part_2';
  assert.deepEqual(parseCloudflareRedirects(source + ' ' + destination + ' 301'), [{source, destination, status: 301}]);
  const config = edgeone({redirects: [{source, destination, statusCode: 302}]});
  assert.deepEqual(readEdge(config), config);
  assert.throws(() => compilePath(source), /Invalid delivery path/);
  for (const invalid of ['/articles/:', '/articles/:2id', '/articles/:_id', '/articles/:id/:id', '/articles/:id:']) {
    assert.throws(() => parseCloudflareRedirects(invalid + ' /new 301'));
    assert.throws(() => readEdge(edgeone({redirects: [{source: invalid, destination: '/new', statusCode: 301}]})));
  }
  const dynamic = Array.from({length: 101}, (_, index) => '/a' + index + '/:id /new 301').join('\n');
  assert.throws(() => parseCloudflareRedirects(dynamic), /100 dynamic/);
});

test('Cloudflare redirect counts distinguish static and dynamic rules', () => {
  const statics = Array.from({length: 2000}, (_, index) => '/a' + index + ' /new 301').join('\n');
  const dynamics = Array.from({length: 100}, (_, index) => '/a' + index + '/* /new 302').join('\n');
  assert.equal(parseCloudflareRedirects(statics + '\n' + dynamics).length, 2100);
  assert.throws(() => parseCloudflareRedirects(statics + '\n/extra /new 301'), /2000 static/);
  assert.throws(() => parseCloudflareRedirects(dynamics + '\n/extra/* /new 301'), /100 dynamic/);
  const line = '/a /' + 'a'.repeat(992) + ' 301';
  assert.equal(line.length, 1000);
  assert.equal(parseCloudflareRedirects(line).length, 1);
  assert.throws(() => parseCloudflareRedirects(line + ' '), /1000 characters/);
});

test('EdgeOne parser preserves overlapping rules without assigning precedence', () => {
  const config = edgeone({headers: [edgeHeader(), {source: '/assets/*.json', headers: [{key: 'Content-Type', value: 'application/json'}]}],
    redirects: [{source: '/old/*', destination: '/new/:splat', statusCode: 301}]});
  assert.deepEqual(readEdge(config), config);
  assert.deepEqual(readEdge(edgeone()), edgeone());
});

test('EdgeOne accepts host redirects without relaxing Cloudflare or ordinary destinations', () => {
  for (const [source, destination] of [['$host', '$wwwhost'], ['$wwwhost', '$host']]) {
    const config = edgeone({redirects: [{source, destination, statusCode: 301}]});
    assert.deepEqual(readEdge(config), config);
    assert.throws(() => parseCloudflareRedirects(source + ' ' + destination + ' 301'));
  }
  for (const [source, destination] of [['$host', '$host'], ['$host', '/new'], ['/old', '$wwwhost'],
    ['$unknown', '$wwwhost'], ['$host/', '$wwwhost'], ['$host', '$wwwhost/']]) {
    assert.throws(() => readEdge(edgeone({redirects: [{source, destination, statusCode: 301}]})));
  }
  assert.throws(() => readEdge(edgeone({redirects: [{source: '$host', destination: '$wwwhost', statusCode: '301'}]})));
});

test('EdgeOne parser validates its generated structure and header fields', () => {
  for (const value of ['null', '[]', '{', '{}']) assert.throws(() => parseEdgeoneConfig(value));
  for (const config of [edgeone({unknown: true}), edgeone({nodeVersion: 22}), edgeone({headers: false}),
    edgeone({headers: [{source: '/*', headers: []}]}), edgeone({headers: [edgeHeader('bad_name')]}),
    edgeone({headers: [edgeHeader('X-Test', 'bad\nvalue')]}), edgeone({headers: [edgeHeader('X-Test', '')]}),
    edgeone({headers: [edgeHeader('X-Test', '中文')]}), edgeone({headers: [{...edgeHeader(), unset: ['Cache-Control']}]}),
    edgeone({headers: [{source: '/*', headers: [{key: 'X-Test', value: 'first'}, {key: 'x-test', value: 'second'}]}]})]) {
    assert.throws(() => readEdge(config));
  }
});

test('EdgeOne header limits cover rule count, key length and value length', () => {
  assert.equal(readEdge(edgeone({headers: Array.from({length: 30}, () => edgeHeader())})).headers.length, 30);
  assert.throws(() => readEdge(edgeone({headers: Array.from({length: 31}, () => edgeHeader())})), /30 rules/);
  assert.ok(readEdge(edgeone({headers: [edgeHeader('X'.repeat(100), 'a'.repeat(1000))]})));
  assert.throws(() => readEdge(edgeone({headers: [edgeHeader('X'.repeat(101))]})), /100 characters/);
  assert.throws(() => readEdge(edgeone({headers: [edgeHeader('X', 'a'.repeat(1001))]})), /1-1000/);
});

test('EdgeOne redirect limits and status types are checked', () => {
  const redirect = {source: '/old', destination: '/new', statusCode: 301};
  assert.equal(readEdge(edgeone({redirects: Array.from({length: 100}, () => redirect)})).redirects.length, 100);
  assert.throws(() => readEdge(edgeone({redirects: Array.from({length: 101}, () => redirect)})), /100 rules/);
  assert.ok(readEdge(edgeone({redirects: [{...redirect, source: '/' + 'a'.repeat(499), destination: '/' + 'b'.repeat(499)}]})));
  for (const overrides of [{source: '/' + 'a'.repeat(500)}, {destination: '/' + 'a'.repeat(500)}, {statusCode: '301'},
    {statusCode: 307}, {destination: 'javascript:bad'}, {extra: true}]) {
    assert.throws(() => readEdge(edgeone({redirects: [{...redirect, ...overrides}]})));
  }
});

test('SW JSON parser preserves actual first-match priority and empty arrays', () => {
  const rules = [{path: '/private/*', bucket: 'off'}, {path: '/assets/*', bucket: 'fingerprinted'}, {path: '/*', bucket: 'versioned'}];
  assert.deepEqual(parseSwPolicy(JSON.stringify(rules)), rules);
  assert.deepEqual(parseSwPolicy('[]'), []);
});

test('SW JSON parser rejects malformed JSON, unsupported fields and buckets', () => {
  for (const text of ['{', '{}', 'null', '[null]', '[[]]', '[{}]', '[{"path":"/*","bucket":"cache-first"}]',
    '[{"path":"/*","bucket":false}]', '[{"path":"/*","bucket":"off","mode":"off"}]', '[{"path":"/:name","bucket":"off"}]']) {
    assert.throws(() => parseSwPolicy(text), undefined, text);
  }
});
