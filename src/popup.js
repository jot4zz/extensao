(() => {
  const $ = id => document.getElementById(id);
  let hostname = '';
  async function refresh() {
    const { settings } = await chrome.storage.local.get('settings');
    const s = TextoCerto.normalize(settings);
    $('enabled').checked = s.enabled; $('mode').value = s.mode;
    $('site').checked = !!hostname && !s.disabledSites.includes(hostname);
  }
  async function update(patch) {
    try {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...TextoCerto.normalize(settings), ...patch } });
      $('status').textContent = 'Preferências salvas.';
    } catch { $('status').textContent = 'Não foi possível salvar. Tente novamente.'; }
  }
  $('enabled').addEventListener('change', () => update({ enabled: $('enabled').checked }));
  $('mode').addEventListener('change', () => update({ mode: $('mode').value }));
  $('site').addEventListener('change', async () => {
    const { settings } = await chrome.storage.local.get('settings');
    const sites = TextoCerto.normalize(settings).disabledSites.filter(s => s !== hostname);
    if (!$('site').checked) sites.push(hostname);
    await update({ disabledSites: sites });
  });
  $('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  chrome.tabs.query({ active:true, currentWindow:true }).then(([tab]) => {
    try { const url = new URL(tab.url); if (!['http:', 'https:'].includes(url.protocol)) throw Error(); hostname = url.hostname; $('hostname').textContent = hostname; $('site').disabled = false; }
    catch { $('hostname').textContent = 'Indisponível nesta página do navegador.'; }
    refresh();
  });
  chrome.storage.onChanged.addListener(refresh);
  refresh();
})();
