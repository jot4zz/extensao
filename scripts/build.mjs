import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await mkdir('vendor', {recursive:true});
await build({entryPoints:['src/spell-entry.mjs'], outfile:'vendor/spell.js', bundle:true,
  platform:'browser', mainFields:['browser','main'], format:'iife', globalName:'TextoCertoSpell', minify:true, legalComments:'eof',
  footer:{js:'globalThis.TextoCertoSpell = TextoCertoSpell;'}});
for (const [from,to] of [['index.aff','pt.aff'],['index.dic','pt.dic'],['license','dictionary-license.txt']]) {
  await copyFile(`node_modules/dictionary-pt/${from}`, `vendor/${to}`);
}
const licenses = [];
for (const name of ['hunspell-asm', 'emscripten-wasm-loader', 'nanoid']) {
  const license = await readFile(name === 'emscripten-wasm-loader' ? 'licenses/emscripten-wasm-loader.txt' : `node_modules/${name}/LICENSE`, 'utf8');
  licenses.push(`${name}\n${license}`);
}
await writeFile('vendor/THIRD-PARTY.txt', licenses.join('\n\n'));
await copyFile('licenses/hunspell.txt', 'vendor/hunspell-license.txt');
await copyFile('licenses/MPL-1.1.txt', 'vendor/MPL-1.1.txt');
await copyFile('licenses/MPL-2.0.txt', 'vendor/MPL-2.0.txt');
console.log('Motor Hunspell e dicionário VERO preparados em vendor/.');
