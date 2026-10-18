import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {extractZip} from '../archive.mjs';
import {zip} from './fixtures/zip.mjs';

let work, sequence = 0;
before(() => { work = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'swban-zip-')); });
after(() => { fs.rmSync(work, {recursive:true, force:true}); });
function sample(entries) {
  const directory = path.join(work, String(sequence++));
  fs.mkdirSync(directory);
  const archive = path.join(directory, 'input.zip'), destination = path.join(directory, 'output');
  fs.mkdirSync(destination); fs.writeFileSync(archive, zip(entries));
  return {archive, destination};
}

test('system ZIP extraction preserves nested, Unicode, empty files and archive roots', async () => {
  const longName = 'a'.repeat(90) + '/' + 'b'.repeat(90) + '/' + 'c'.repeat(45);
  const {archive, destination} = sample([
    {name:'sdk/', mode:0x4000}, {name:'sdk/bin/', mode:0x4000},
    {name:'sdk/bin/Þhello-树.exe', bytes:Buffer.from('payload'), mode:0x8000}, {name:'sdk/empty.txt'}, {name:'sdk/' + longName}
  ]);
  await extractZip(archive, destination, {archiveRoot:'sdk'});
  assert.equal(fs.readFileSync(path.join(destination, 'bin/Þhello-树.exe'), 'utf8'), 'payload');
  assert.equal(fs.statSync(path.join(destination, 'empty.txt')).size, 0);
  assert.ok(fs.statSync(path.join(destination, longName)).isFile());
});

test('invalid ZIP metadata and encryption fail before writing any payload', async () => {
  const cases = [
    [[{name:'../escape'}], /unsafe_zip_entry/],
    [[{name:'a', mode:0xa000}], /unsupported_zip_entry_type/],
    [[{name:'a'}, {name:'A'}], /unsafe_zip_entry/],
    [[{name:'a'}, {name:'a/child'}], /zip_parent_is_file/],
    [[{name:'good'}, {name:'C:/escape'}], /unsafe_zip_entry/],
    [[{name:'a\\escape'}], /unsafe_zip_entry/],
    [[{name:'con.txt'}], /unsafe_zip_entry/],
    [[{name:'install.json'}], /unsafe_zip_entry/],
    [[{name:'a/', mode:0x8000}], /unsupported_zip_entry_type/],
    [[{name:'a', mode:0x4000}], /unsupported_zip_entry_type/],
    [[{name:'good'}, {name:'secret', flags:0x801}], /unsupported_zip_entry_type/],
    [[{name:'large', size:256*1024*1024+1}], /zip_entry_too_large/],
    [[{name:'a', size:200*1024*1024}, {name:'b', size:200*1024*1024}, {name:'c', size:200*1024*1024}], /zip_payload_too_large/],
    [Array.from({length:25001}, (_,index) => ({name:`file-${index}`})), /too_many_payload_files/]
  ];
  for (const [entries, expected] of cases) {
    const {archive, destination} = sample(entries);
    await assert.rejects(extractZip(archive, destination, {archiveRoot:''}), expected);
    assert.deepEqual(fs.readdirSync(destination), []);
  }
  const {archive, destination} = sample([{name:'outside/file'}]);
  await assert.rejects(extractZip(archive, destination, {archiveRoot:'expected'}), /unexpected_archive_root/);
  assert.deepEqual(fs.readdirSync(destination), []);
});

test('ZIP extraction rejects existing files and linked destination parents', async () => {
  const {archive, destination} = sample([{name:'file', bytes:Buffer.from('new')}]);
  fs.writeFileSync(path.join(destination, 'file'), 'keep');
  await assert.rejects(extractZip(archive, destination, {archiveRoot:''}));
  assert.equal(fs.readFileSync(path.join(destination, 'file'), 'utf8'), 'keep');
  const linked = sample([{name:'link/file'}]);
  fs.symlinkSync(destination, path.join(linked.destination, 'link'), 'junction');
  await assert.rejects(extractZip(linked.archive, linked.destination, {archiveRoot:''}), /linked_path/);
  assert.equal(fs.readFileSync(path.join(destination, 'file'), 'utf8'), 'keep');
});

test('actual ZIP bytes must match the declared size', async () => {
  for (const size of [1, 20]) {
    const {archive, destination} = sample([{name:'file', bytes:Buffer.from('payload'), size}]);
    await assert.rejects(extractZip(archive, destination, {archiveRoot:''}), /zip_entry_size_mismatch/);
    assert.ok(fs.statSync(path.join(destination, 'file')).size <= size);
  }
});