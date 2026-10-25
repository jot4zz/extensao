(() => {
  const $ = id => document.getElementById(id);
  const checks = ['enabled', 'spelling', 'grammar', 'typography'];
  let current = TextoCerto.normalize();
  function fill(s) {
    current = TextoCerto.normalize(s);
    for (const name of checks) $(name).checked = current[name];
    $('mode').value = current.mode; $('delay').value = current.delay;
    $('ignoredWords').value = current.ignoredWords.join('\n');
    $('disabledSites').value = current.disabledSites.join('\n');
  }
  const lines = id => [...new Set($(id).value.split(/\r?\n/).map(x => x.trim().toLocaleLowerCase('pt-BR')).filter(Boolean))];
  async function save(s) {
    try { await chrome.storage.local.set({ settings:s }); fill(s); $('status').textContent = 'Preferências salvas. As abas abertas já receberam a atualização.'; }
    catch { $('status').textContent = 'Falha ao salvar. Tente novamente.'; }
  }
  $('settings').addEventListener('submit', e => {
    e.preventDefault();
    const sites = lines('disabledSites');
    if (sites.some(s => !/^(?:localhost|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)$/i.test(s))) {
      $('status').textContent = 'Informe apenas domínios, sem https://, portas ou caminhos.'; return;
    }
    const s = { ...current, mode:$('mode').value, delay:Number($('delay').value), disabledSites:sites, ignoredWords:lines('ignoredWords') };
    for (const name of checks) s[name] = $(name).checked;
    save(TextoCerto.normalize(s));
  });
  $('reset').addEventListener('click', () => {
    if (confirm('Restaurar as configurações e limpar seu dicionário pessoal e a lista de sites?')) save(TextoCerto.normalize());
  });
  $('check').addEventListener('click', async () => {
    const text = $('demo').value, settings = {...current,enabled:true};
    let issues = TextoCerto.analyze(text, settings);
    $('check').disabled = true;
    let limited = false;
    try {
      const words = TextoCerto.candidates(text,settings,issues);
      if (words.length) {
        const response = await chrome.runtime.sendMessage({type:'spell',words});
        if (response?.entries) issues = TextoCerto.dictionaryIssues(text,response.entries,settings,issues);
      }
    } catch { limited = true; } finally { $('check').disabled = false; }
    $('results').replaceChildren();
    const p = document.createElement('p'); p.textContent = `${issues.length} sugestão(ões) encontrada(s).${limited ? ' Dicionário indisponível; somente regras locais.' : ''}`; $('results').append(p);
    for (const i of issues) {
      const row = document.createElement('p'); row.className = 'preview'; row.textContent = `${i.original} → ${i.replacement}\n${i.message}`; $('results').append(row);
    }
  });
  chrome.storage.local.get('settings').then(({settings}) => fill(settings));
})();
