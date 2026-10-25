const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyze, normalize } = require('../src/engine.js');

test('suggests accents, frequent typing errors and preserves case and UTF-16 positions', () => {
  const text = '😀 Ola, VOCE tambem quer corrigir a digitaçao?';
  const issues = analyze(text);
  assert.deepEqual(issues.map(i => i.replacement), ['Olá', 'VOCÊ', 'também', 'digitação']);
  for (const i of issues) assert.equal(text.slice(i.start, i.end), i.original);
});
test('grammar includes agreement, elapsed time, repetitions and redundancy', () => {
  const issues = analyze('A gente vamos. Fazem dois anos. Houveram erros. Você você é mais melhor.');
  assert.deepEqual(issues.map(i => i.replacement), ['A gente vai', 'Faz dois anos', 'Houve erros', 'Você', 'melhor']);
  assert.ok(issues.every(i => !i.safe));
});
test('protects URLs, email and inline code', () => {
  assert.equal(analyze('https://voce.com/nao www.tambem.com voce@nao.com `voce nao`').length, 0);
});
test('respects disabled categories, personal dictionary and enabled flag', () => {
  assert.equal(analyze('voce voce  !', { enabled:false }).length, 0);
  assert.equal(analyze('voce', { ignoredWords:['VOCE'] }).length, 0);
  assert.equal(analyze('voce voce  !', { spelling:false, grammar:false, typography:false }).length, 0);
});
test('does not match parts of words or generate overlapping edits', () => {
  assert.equal(analyze('supervoce novamente impublico').length, 0);
  const issues = analyze('voce voce  , concerteza');
  assert.ok(issues.length > 0);
  for (let n = 1; n < issues.length; n++) assert.ok(issues[n].start >= issues[n-1].end);
});
test('ambiguous words and abbreviations are never automatic', () => {
  assert.ok(analyze('publico numero pagina pq vc').every(i => !i.safe));
  assert.ok(analyze('voce nao tambem').every(i => i.safe));
});
test('normalizes missing and malformed preferences', () => {
  assert.equal(normalize({delay:-1}).delay, 300);
  assert.equal(normalize({delay:99999}).delay, 3000);
  assert.deepEqual(normalize({ignoredWords:'wrong'}).ignoredWords, []);
  assert.equal(normalize({mode:'invalid'}).mode, 'suggest');
});
test('preserves indentation and reports inner spaces and punctuation', () => {
  const issues = analyze('  teste  legal !\n\tlinha');
  assert.equal(issues.length, 2);
  assert.deepEqual(issues.map(i => i.replacement), [' ', '!']);
});
test('correct text produces no suggestions', () => {
  assert.equal(analyze('Olá, você também pode escrever com certeza. A gente vai amanhã.').length, 0);
});
test('programming identifiers cannot access dictionary prototype properties', () => {
  assert.equal(analyze('constructor toString prototype hasOwnProperty').length, 0);
  assert.equal(normalize(null).enabled, true);
  assert.equal(normalize({enabled:'false'}).enabled, true);
});
