const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const native = process.env.REAL_EXTENSION === '1';
  const server = http.createServer(async (req, res) => {
    if (req.url === '/src/spell-worker.js') {
      res.setHeader('Content-Type','application/javascript');
      res.setHeader('Content-Security-Policy', "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'");
      res.end(`self.chrome={runtime:{getURL:p=>new URL('/'+p,self.location.origin).href,onInstalled:{addListener(){}},onMessage:{addListener(fn){self.onmessage=e=>fn(e.data,{},r=>postMessage(r))}}},storage:{local:{async get(){return {}},async set(){}}}};importScripts('background.js');`);
      return;
    }
    if (/^\/(?:src|vendor)\/[a-z-]+\.(?:js|css|html|aff|dic)$/.test(req.url)) {
      try {
        res.setHeader('Content-Type', req.url.endsWith('.js') ? 'application/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
        res.end(await fs.readFile(path.join(root, req.url))); return;
      } catch { res.writeHead(404); res.end(); return; }
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="pt-BR"><title>Editor de teste</title><body>
      <label>Texto<textarea id="text" rows="5" cols="60"></textarea></label>
      <input id="plain" type="text"><input id="password" type="password"><input id="email" type="email"><input id="card" autocomplete="cc-number">
      <div id="rich" contenteditable="true"><b>voce</b> tambem</div>
      <div id="cancel" contenteditable="true">voce</div>
      <script>document.querySelector('#cancel').addEventListener('beforeinput',e=>e.preventDefault())</script>
      </body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'texto-certo-test-'));
  let context, passed = 0;
  const ok = name => { passed++; console.log(`PASS ${name}`); };
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true,
      args:[...(native ? [`--disable-extensions-except=${root}`, `--load-extension=${root}`] : []), '--no-sandbox'],
      ignoreDefaultArgs:['--disable-extensions'], viewport:{width:1100,height:800}
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    let worker, extensionId;
    if (native) {
      worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      extensionId = new URL(worker.url()).host;
    } else {
      // Test real application scripts and DOM against a local implementation of
      // the storage API. This does NOT claim browser extension installation passed.
      await context.addInitScript(() => {
        const listeners = [];
        let dictionary;
        window.chrome = {
          storage: {
            local: {
              async get(key) { return { [key]: JSON.parse(localStorage.getItem(key) || 'null') }; },
              async set(data) {
                const changes = {};
                for (const [key,value] of Object.entries(data)) {
                  changes[key] = {oldValue:JSON.parse(localStorage.getItem(key) || 'null'),newValue:value};
                  localStorage.setItem(key, JSON.stringify(value));
                }
                for (const f of listeners) f(changes,'local');
              }
            }, onChanged:{addListener(f) {listeners.push(f);}}
          },
          tabs:{async query() { return [{url:location.href}]; }},
          runtime:{
            openOptionsPage() {window.open('/src/options.html');},
            async sendMessage(message) {
              if (message.type !== 'spell') return;
              if (!dictionary) dictionary = Promise.all(['aff','dic'].map(async ext => new Uint8Array(await (await fetch(`/vendor/pt.${ext}`)).arrayBuffer())))
                .then(([aff,dic]) => TextoCertoSpell.create(aff,dic));
              return {entries:(await dictionary).check(message.words)};
            }
          }
        };
        addEventListener('storage', e => {
          if (!e.key) return;
          for (const f of listeners) f({[e.key]:{oldValue:JSON.parse(e.oldValue),newValue:JSON.parse(e.newValue)}},'local');
        });
      });
      await context.addInitScript({path:path.join(root,'src/engine.js')});
      await context.addInitScript({path:path.join(root,'vendor/spell.js')});
      const content = await fs.readFile(path.join(root,'src/content.js'),'utf8');
      await context.addInitScript(`document.addEventListener('DOMContentLoaded', () => { if (location.pathname === '/') { ${content}\n } });`);
      worker = await context.newPage(); await worker.goto(`${origin}/control`);
    }
    const configure = async patch => {
      await worker.evaluate(async patch => {
        const { settings } = await chrome.storage.local.get('settings');
        await chrome.storage.local.set({settings:TextoCerto.normalize({...settings,...patch})});
      }, patch);
    };
    await configure({mode:'suggest',delay:300});
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin);
    if (!native) {
      const result = await page.evaluate(() => new Promise((resolve,reject) => {
        const w = new Worker('/src/spell-worker.js');
        const timeout = setTimeout(() => {w.terminate();reject(Error('Spell worker timeout'));},15000);
        w.onmessage = e => {clearTimeout(timeout);w.terminate();resolve(e.data);};
        w.onerror = e => {clearTimeout(timeout);w.terminate();reject(Error(e.message));};
        w.postMessage({type:'spell',words:['computdor']});
      }));
      assert.ok(result.entries?.[0]?.suggestions.includes('computador'));
      ok('background scripts and bundled WASM work in a worker with extension-equivalent script CSP');
    }
    const text = page.locator('#text'), badge = page.locator('#texto-certo-root .badge');
    const replacement = word => page.locator('#texto-certo-root button.new').filter({hasText:word});
    const pause = () => page.waitForTimeout(550);
    await text.fill('voce tambem'); await badge.waitFor({state:'visible'});
    assert.equal(await text.inputValue(), 'voce tambem');
    await badge.click(); await replacement('você').click();
    assert.equal(await text.inputValue(), 'você tambem');
    await page.locator('#texto-certo-root .undo').click();
    assert.equal(await text.inputValue(), 'voce tambem');
    ok('suggestions require consent; apply and undo work');

    await page.locator('#texto-certo-root .actions button').filter({hasText:'Meu dicionário'}).first().click();
    await pause();
    assert.equal(await replacement('você').count(), 0);
    assert.equal(await replacement('também').count(), 1);
    ok('personal dictionary persists and refreshes active review');
    await configure({ignoredWords:[],mode:'auto'});
    await text.fill('voce '); await pause();
    assert.equal(await text.inputValue(), 'você ');
    await text.fill('voce'); await pause(); assert.equal(await text.inputValue(), 'voce');
    await text.fill('pq '); await pause(); assert.equal(await text.inputValue(), 'pq ');
    ok('automatic mode only changes complete safe words');

    await configure({mode:'suggest',disabledSites:['127.0.0.1']});
    await text.fill('voce tambem'); await pause(); assert.equal(await badge.isVisible(), false);
    await configure({disabledSites:[],enabled:false}); await pause(); assert.equal(await badge.isVisible(), false);
    await configure({enabled:true}); await badge.waitFor({state:'visible'});
    ok('site and global switches apply to already open tabs');

    for (const id of ['password','email','card']) {
      await page.locator(`#${id}`).fill('voce'); await pause(); assert.equal(await badge.isVisible(), false);
    }
    ok('password, email and payment fields excluded');

    await page.locator('#rich').click(); await badge.waitFor({state:'visible'}); await badge.click();
    await replacement('você').click();
    assert.equal(await page.locator('#rich b').textContent(), 'você');
    assert.equal(await page.locator('#rich').textContent(), 'você tambem');
    ok('rich-text replacement preserves bold formatting');

    await page.locator('#cancel').click(); await badge.waitFor({state:'visible'}); await badge.click();
    await replacement('você').click(); assert.equal(await page.locator('#cancel').textContent(), 'voce');
    ok('respects editors cancelling beforeinput');

    await text.fill('concerteza'); await pause(); await badge.waitFor({state:'visible'}); await badge.click();
    await page.locator('#texto-certo-root .actions button').filter({hasText:'Ignorar agora'}).click();
    assert.equal(await page.locator('#texto-certo-root .issue').count(), 0);
    ok('dismiss suggestion without changing text');

    await text.fill('computdor'); await pause();
    await badge.waitFor({state:'visible'});
    if (await page.locator('#texto-certo-root .panel').isHidden()) await badge.click();
    await replacement('computador').waitFor({state:'visible',timeout:10000}).catch(async error => {
      console.log('Dictionary panel:', await page.locator('#texto-certo-root .status').textContent());
      console.log('Dictionary diagnostic:', await page.evaluate(async () => {try { return await chrome.runtime.sendMessage({type:'spell',words:['computdor']}); } catch(e) {return String(e.stack);}}));
      throw error;
    });
    await replacement('computador').click(); assert.equal(await text.inputValue(), 'computador');
    ok('bundled Hunspell WASM recognizes and corrects a word outside fixed rules');

    await text.fill('');
    await text.dispatchEvent('compositionstart'); await text.fill('voce'); await pause();
    assert.equal(await badge.isVisible(), false);
    await text.dispatchEvent('compositionend'); await badge.waitFor({state:'visible'});
    ok('waits for IME composition to finish');

    const options = await context.newPage(); await options.goto(native ? `chrome-extension://${extensionId}/src/options.html` : `${origin}/src/options.html`);
    await options.locator('#ignoredWords').fill('MinhaMarca');
    await options.locator('#disabledSites').fill('exemplo.com');
    await options.locator('button[type=submit]').click();
    await options.waitForFunction(() => document.querySelector('#status').textContent.includes('Preferências salvas'));
    await options.reload();
    await options.waitForFunction(() => document.querySelector('#ignoredWords').value === 'minhamarca');
    assert.equal(await options.locator('#disabledSites').inputValue(), 'exemplo.com');
    await options.locator('#check').click(); await options.locator('#results .preview').first().waitFor(); assert.ok((await options.locator('#results .preview').count()) >= 4);
    ok('options persist across reloads and demo performs actual review');

    const popup = await context.newPage(); await popup.goto(native ? `chrome-extension://${extensionId}/src/popup.html` : `${origin}/src/popup.html`);
    await popup.locator('#mode').selectOption('auto');
    await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('salvas'));
    assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings.mode), 'auto');
    ok('popup updates stored preferences');
    assert.deepEqual(errors, []);
    console.log(`${passed} browser checks passed; no page errors. Mode: ${native ? 'installed extension' : 'DOM integration with local storage API fixture (extension installation not tested)'}.`);
  } finally {
    if (context) await context.close();
    await new Promise(resolve => server.close(resolve));
    await fs.rm(profile, {recursive:true,force:true});
  }
})().catch(e => {console.error(e); process.exitCode = 1;});
