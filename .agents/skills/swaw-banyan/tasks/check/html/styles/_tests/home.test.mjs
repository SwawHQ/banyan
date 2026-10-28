import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspect} from '../inspect.mjs';

test('home art styles must match the selected source and load once',async()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/home-style-tests');
  fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'run-'));
  try {
    fs.mkdirSync(path.join(root,'css'));
    for(const name of ['page','art','scene','cards'])fs.writeFileSync(path.join(root,'css',name+'.css'),'');
    const source='/_res/home-art/wind',other='/_res/home-art/cards';
    const link=(name,art='')=>'<link rel="stylesheet" href="/css/'+name+'.css"'+(art?' data-home-art="'+art+'"':'')+'>';
    const page=link('page'),style=link('art',source),scene=link('scene',source);
    const write=(art,styles,content='<main>Art</main>')=>fs.writeFileSync(path.join(root,'index.html'),
      '<html><head><link rel="canonical" href="https://example.test/">'+styles+'</head><body'+
      (art?' data-home-art-source="'+art+'"':'')+'>'+content+'</body></html>');
    const issues=async()=> (await inspect(root)).issues.join('\n');
    write(source,page+style+scene);
    assert.deepEqual((await inspect(root)).issues,[]);
    write(source,page);
    assert.deepEqual((await inspect(root)).issues,[],'An art can render without a dedicated stylesheet.');
    write(source,page+style+scene+style);
    assert.match(await issues(),/stylesheet references must be unique/);
    write(source,page+style+scene+page);
    assert.match(await issues(),/expected one leading page.css stylesheet/);
    write(source,page+link('art')+scene);
    assert.match(await issues(),/unexpected stylesheet families: \/css\/art.css/);
    write(source,page+style+link('scene',other));
    assert.match(await issues(),/declares home art \/_res\/home-art\/cards, expected \/_res\/home-art\/wind/);
    write('',page+style+scene);
    assert.match(await issues(),/declares home art .* expected <none>/);
    write('',page+style,'<main data-home-art-source="'+source+'">Art</main>');
    assert.match(await issues(),/expected <none>/,'Only the body identifies the source.');
    write(other,page+link('cards',other));
    assert.deepEqual((await inspect(root)).issues,[]);
    write('',page);
    assert.deepEqual((await inspect(root)).issues,[],'Ordinary pages do not declare art resources.');
    write(source,page+style);
    fs.rmSync(path.join(root,'css/art.css'));
    assert.match(await issues(),/Missing stylesheet asset \/css\/art.css/);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(parent));
    fs.rmSync(root,{recursive:true,force:true});
  }
});
