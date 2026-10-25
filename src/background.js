importScripts('engine.js');
importScripts('../vendor/spell.js');
let checker;
function dictionary() {
  if (!checker) checker = Promise.all(['pt.aff','pt.dic'].map(async name => {
    const response = await fetch(chrome.runtime.getURL(`vendor/${name}`));
    if (!response.ok) throw Error('Dicionário indisponível');
    return new Uint8Array(await response.arrayBuffer());
  })).then(([aff,dic]) => TextoCertoSpell.create(aff,dic)).catch(error => {checker = null; throw error;});
  return checker;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'spell' || !Array.isArray(message.words)) return;
  dictionary().then(d => respond({entries:d.check(message.words)})).catch(() => respond({error:'dictionary-unavailable'}));
  return true;
});
chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) await chrome.storage.local.set({ settings: TextoCerto.normalize() });
});
