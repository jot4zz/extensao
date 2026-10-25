const {test} = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/engine.js');

test('actual Hunspell WASM and VERO dictionary recognize inflections and suggest typing corrections', async () => {
  const {create} = await import('../src/spell-entry.mjs');
  const {default:pt} = await import('dictionary-pt');
  const dictionary = await create(pt.aff,pt.dic);
  try {
    const result = dictionary.check(['cachoro','computdor','escrever','escrevemos','português','123','x'.repeat(100)]);
    assert.ok(result.find(r => r.word === 'cachoro').suggestions.includes('cachorro'));
    assert.ok(result.find(r => r.word === 'computdor').suggestions.includes('computador'));
    assert.ok(!result.some(r => ['escrever','escrevemos','português'].includes(r.word)));
    const text = 'computdor https://computdor.com `computdor` x_computdor';
    const issues = engine.dictionaryIssues(text,result,{},[]);
    assert.equal(issues.length,1);
    assert.equal(issues[0].start,0);
    assert.equal(issues[0].safe,false);
    assert.deepEqual(engine.candidates('computdor computdor MinhaMarca API',{},[]),['computdor']);
    assert.equal(engine.dictionaryIssues('computdor',result,{ignoredWords:['computdor']},[]).length,0);
  } finally { dictionary.dispose(); }
});
