import { loadModule } from 'hunspell-asm';

export async function create(aff, dic) {
  const factory = await loadModule();
  const dictionary = factory.create(factory.mountBuffer(aff, 'pt.aff'), factory.mountBuffer(dic, 'pt.dic'));
  const cache = new Map();
  return {
    check(words) {
      const result = [];
      for (const word of [...new Set(words)].slice(0, 200)) {
        if (typeof word !== 'string' || !/^\p{L}{3,32}$/u.test(word)) continue;
        if (!cache.has(word)) {
          const suggestions = dictionary.spell(word) ? [] : dictionary.suggest(word).filter(s => s !== word).slice(0, 3);
          cache.set(word, suggestions);
        }
        const suggestions = cache.get(word);
        if (suggestions.length) result.push({ word, suggestions });
        if (result.length >= 20) break;
      }
      if (cache.size > 2000) cache.clear();
      return result;
    },
    dispose() { dictionary.dispose(); }
  };
}
