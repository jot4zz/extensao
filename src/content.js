(() => {
  'use strict';
  const engine = globalThis.TextoCerto;
  let settings = engine.normalize(), active = null, timer, composing = false, issues = [], undo = null, reviewId = 0, dictionaryStatus = '';
  const dismissed = new Set();
  let topHostname = location.hostname;
  try { if (location.ancestorOrigins.length) topHostname = new URL(location.ancestorOrigins[location.ancestorOrigins.length - 1]).hostname; } catch { /* Use the frame hostname. */ }
  const host = document.createElement('div');
  host.id = 'texto-certo-root';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;pointer-events:none;top:0;left:0;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host{all:initial}*{box-sizing:border-box} .wrap{font:14px/1.5 system-ui,sans-serif;color:#17293b;position:fixed;pointer-events:auto;width:330px;max-width:calc(100vw - 20px)}
    button{font:inherit;cursor:pointer;border:0;border-radius:8px;padding:7px 11px;background:#e9edf4;color:#17293b}button:focus-visible{outline:3px solid #527cf2;outline-offset:2px}
    .badge{background:#245acf;color:white;box-shadow:0 3px 15px #0003;font-weight:600;float:right}.panel{clear:both;background:white;border:1px solid #d7deea;border-radius:12px;box-shadow:0 8px 30px #0003;margin-top:6px;max-height:340px;overflow:auto;padding:14px}
    [hidden]{display:none!important}header{display:flex;align-items:center;justify-content:space-between;gap:8px}strong{font-size:15px}.issue{padding:12px 0;border-bottom:1px solid #e9edf4}.label{font-size:11px;text-transform:uppercase;color:#52627b;letter-spacing:.05em}.message{margin:6px 0;color:#52627b;font-size:12px}.replace{display:flex;align-items:center;gap:6px;flex-wrap:wrap;overflow-wrap:anywhere}.old{text-decoration:line-through;color:#aa364b;white-space:pre-wrap}.new{background:#e5f3ec;color:#12683f;white-space:pre-wrap}.actions{display:flex;gap:6px;margin-top:7px}.small{font-size:12px}footer{font-size:11px;color:#52627b;margin-top:10px}.status{margin:6px 0;font-size:12px}
  </style><div class="wrap" hidden><button class="badge" aria-expanded="false" aria-label="Abrir sugestões do Texto Certo"></button><section class="panel" aria-label="Revisão do Texto Certo" hidden><header><strong>Texto Certo</strong><button class="close" aria-label="Fechar sugestões">✕</button></header><div class="status" role="status" aria-live="polite"></div><div class="list"></div><button class="undo" hidden>Desfazer última correção</button><footer>Revisão local em português · confira as sugestões.</footer></section></div>`;
  const $ = q => shadow.querySelector(q), wrap = $('.wrap'), badge = $('.badge'), panel = $('.panel');
  document.documentElement.append(host);
  function allowed() { return settings.enabled && !settings.disabledSites.includes(location.hostname) && !settings.disabledSites.includes(topHostname); }
  function field(target) {
    if (!(target instanceof Element)) return null;
    const el = target.closest('textarea,input,[contenteditable]');
    if (!el || el.readOnly || el.disabled || el.getAttribute('aria-readonly') === 'true') return null;
    if (el.closest('[data-texto-certo="off"], [data-sensitive]') || /(?:^|\s)(?:cc-\S+|one-time-code|current-password|new-password)(?:\s|$)/i.test(el.getAttribute('autocomplete') || '')) return null;
    if (el instanceof HTMLInputElement && !['text', 'search'].includes(el.type)) return null;
    if (el instanceof HTMLInputElement && /password|senha|token|secret|cart[aã]o|credit|cpf|cvv/i.test(`${el.name} ${el.id} ${el.autocomplete}`)) return null;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && !el.isContentEditable) return null;
    if (el.closest('[role="code"],.monaco-editor,.CodeMirror,.cm-editor')) return null;
    return el;
  }
  function value(el) { return 'value' in el ? el.value : el.textContent; }
  function key(i) { return [i.start, i.original, i.replacement].join('|'); }
  function position() {
    if (!active?.isConnected) { wrap.hidden = true; return; }
    const r = active.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !r.width || !r.height) { wrap.hidden = true; return; }
    wrap.style.left = `${Math.max(10, Math.min(r.right - 330, innerWidth - Math.min(330, innerWidth - 20) - 10))}px`;
    const estimated = panel.hidden ? 38 : Math.min(390, innerHeight - 20);
    wrap.style.top = `${Math.max(10, Math.min(r.bottom + 4, innerHeight - estimated - 10))}px`;
  }
  function textNodeAt(el, offset) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node, remaining = offset;
    while ((node = walker.nextNode())) {
      if (remaining <= node.length) return [node, remaining];
      remaining -= node.length;
    }
    return null;
  }
  function replace(issue, remember = true) {
    if (!active || !allowed()) return false;
    const before = value(active);
    if (before.slice(issue.start, issue.end) !== issue.original) { review(); return false; }
    const el = active;
    el.focus({ preventScroll: true });
    const event = new InputEvent('beforeinput', { bubbles:true, cancelable:true, inputType:'insertReplacementText', data:issue.replacement });
    if (!el.dispatchEvent(event)) return false;
    if ('value' in el) {
      const start = el.selectionStart, end = el.selectionEnd, direction = el.selectionDirection;
      const native = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
      native.call(el, before.slice(0, issue.start) + issue.replacement + before.slice(issue.end));
      const delta = issue.replacement.length - issue.original.length;
      const shift = n => n <= issue.start ? n : n >= issue.end ? n + delta : issue.start + issue.replacement.length;
      el.setSelectionRange(shift(start), shift(end), direction);
    } else {
      const a = textNodeAt(el, issue.start), b = textNodeAt(el, issue.end);
      if (!a || !b) return false;
      const selection = getSelection(), saved = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const range = document.createRange(); range.setStart(...a); range.setEnd(...b);
      selection.removeAllRanges(); selection.addRange(range);
      // Native editing preserves rich-text markup and the browser's undo stack where supported.
      const inserted = document.execCommand('insertText', false, issue.replacement);
      if (!inserted) { range.deleteContents(); range.insertNode(document.createTextNode(issue.replacement)); }
      if (saved && el.contains(saved.commonAncestorContainer)) { selection.removeAllRanges(); selection.addRange(saved); }
    }
    el.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertReplacementText', data:issue.replacement }));
    if (remember) undo = { el, after: value(el), issue: { start:issue.start, end:issue.start + issue.replacement.length, original:issue.replacement, replacement:issue.original } };
    dismissed.clear();
    return true;
  }
  function button(label, handler, className = '') {
    const b = document.createElement('button'); b.textContent = label; b.className = className; b.addEventListener('click', handler); return b;
  }
  function render() {
    $('.list').replaceChildren();
    for (const issue of issues.slice(0, 30)) {
      const item = document.createElement('div'); item.className = 'issue';
      const label = document.createElement('div'); label.className = 'label'; label.textContent = issue.category;
      const row = document.createElement('div'); row.className = 'replace';
      const old = document.createElement('span'); old.className = 'old'; old.textContent = issue.original;
      row.append(old, document.createTextNode(' → '));
      for (const suggestion of issue.alternatives || [issue.replacement]) row.append(button(suggestion, () => { replace({...issue,replacement:suggestion}); review(false); }, 'new'));
      const message = document.createElement('p'); message.className = 'message'; message.textContent = issue.message;
      const actions = document.createElement('div'); actions.className = 'actions';
      actions.append(button('Ignorar agora', () => { dismissed.add(key(issue)); review(false); }, 'small'));
      if (issue.category === 'Ortografia') actions.append(button('Meu dicionário', async () => {
        const current = await chrome.storage.local.get('settings');
        const fresh = engine.normalize(current.settings);
        const ignoredWords = [...new Set([...fresh.ignoredWords, issue.original.toLocaleLowerCase('pt-BR')])];
        await chrome.storage.local.set({ settings: { ...fresh, ignoredWords } });
      }, 'small'));
      item.append(label, row, message, actions); $('.list').append(item);
    }
    badge.textContent = issues.length ? `✓ ${issues.length} sugest${issues.length === 1 ? 'ão' : 'ões'}` : '✓ Texto Certo';
    $('.status').textContent = dictionaryStatus || (issues.length ? 'Clique na correção para aplicar.' : 'Nenhum problema encontrado nas regras disponíveis.');
    $('.undo').hidden = !undo || undo.el !== active || undo.after !== value(active);
    wrap.hidden = !allowed() || (!issues.length && panel.hidden && $('.undo').hidden);
    position();
  }
  async function review(auto = true) {
    const id = ++reviewId;
    clearTimeout(timer);
    if (!active?.isConnected || !allowed() || composing) { wrap.hidden = true; return; }
    const text = value(active);
    if (text.length > 50000) { wrap.hidden = true; return; }
    issues = engine.analyze(text, settings).filter(i => !dismissed.has(key(i)));
    if (auto && settings.mode === 'auto') {
      // Only complete words, outside the caret word, and explicitly safe rules.
      const caret = 'selectionStart' in active ? active.selectionStart : null;
      const safe = issues.filter(i => i.safe && /[\s.,;:!?)]/u.test(text[i.end] || '') && (caret === null || caret < i.start || caret > i.end));
      for (const i of safe.reverse()) replace(i);
      issues = engine.analyze(value(active), settings).filter(i => !dismissed.has(key(i)));
    }
    dictionaryStatus = '';
    render();
    const el = active, snapshot = value(el), base = [...issues], words = engine.candidates(snapshot, settings, base);
    if (!words.length) return;
    dictionaryStatus = 'Consultando o dicionário local…'; render();
    try {
      const response = await chrome.runtime.sendMessage({type:'spell', words});
      if (id !== reviewId || active !== el || value(el) !== snapshot || !allowed()) return;
      if (response?.error || !response?.entries) throw Error('Dicionário indisponível');
      issues = engine.dictionaryIssues(snapshot, response.entries, settings, base).filter(i => !dismissed.has(key(i)));
      dictionaryStatus = ''; render();
    } catch {
      if (id !== reviewId || active !== el) return;
      dictionaryStatus = 'Dicionário indisponível; revisão limitada às regras locais. Recarregue a extensão e a página.'; render();
    }
  }
  badge.addEventListener('click', () => { panel.hidden = !panel.hidden; badge.setAttribute('aria-expanded', String(!panel.hidden)); position(); });
  $('.close').addEventListener('click', () => { panel.hidden = true; badge.setAttribute('aria-expanded', 'false'); render(); });
  $('.undo').addEventListener('click', () => {
    if (undo?.el === active && undo.after === value(active)) { const previous = undo; undo = null; replace(previous.issue, false); review(false); }
  });
  document.addEventListener('focusin', e => {
    if (e.composedPath().includes(host)) return;
    const el = field(e.target);
    if (active !== el) { reviewId++; active = el; dismissed.clear(); undo = null; panel.hidden = true; badge.setAttribute('aria-expanded','false'); }
    if (el) review(false); else wrap.hidden = true;
  }, true);
  document.addEventListener('input', e => {
    if (e.target !== active || composing) return;
    reviewId++;
    dismissed.clear(); clearTimeout(timer); timer = setTimeout(review, settings.delay);
  }, true);
  document.addEventListener('compositionstart', () => { composing = true; reviewId++; clearTimeout(timer); wrap.hidden = true; });
  document.addEventListener('compositionend', () => { composing = false; timer = setTimeout(review, settings.delay); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { panel.hidden = true; badge.setAttribute('aria-expanded','false'); render(); } });
  addEventListener('scroll', position, true); addEventListener('resize', position);
  chrome.storage.local.get('settings').then(data => { settings = engine.normalize(data.settings); if (active) review(false); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.settings) { settings = engine.normalize(changes.settings.newValue); if (active) review(false); } });
})();
