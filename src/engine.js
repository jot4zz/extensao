/* Shared, deterministic offline rules. No text leaves the browser. */
(() => {
  'use strict';
  const defaults = Object.freeze({ enabled: true, mode: 'suggest', delay: 700,
    spelling: true, grammar: true, typography: true, disabledSites: [], ignoredWords: [] });
  const spelling = {
    'voce': 'você', 'voces': 'vocês', 'nao': 'não', 'tambem': 'também',
    'entao': 'então', 'extensao': 'extensão', 'digitaçao': 'digitação',
    'digitacao': 'digitação', 'correçao': 'correção', 'correcao': 'correção',
    'sugestoes': 'sugestões', 'configuraçao': 'configuração', 'configuracao': 'configuração',
    'portugues': 'português', 'ingles': 'inglês', 'ninguem': 'ninguém',
    'alguem': 'alguém', 'porem': 'porém', 'alem': 'além', 'ateh': 'até',
    'possivel': 'possível', 'impossivel': 'impossível', 'facil': 'fácil',
    'dificil': 'difícil', 'util': 'útil', 'inutil': 'inútil', 'necessario': 'necessário',
    'necessaria': 'necessária', 'obrigatorio': 'obrigatório', 'obrigatoria': 'obrigatória',
    'usuario': 'usuário', 'usuarios': 'usuários', 'pagina': 'página', 'paginas': 'páginas',
    'informacao': 'informação', 'informacoes': 'informações', 'opcao': 'opção',
    'opcoes': 'opções', 'funcao': 'função', 'funcoes': 'funções',
    'aplicacao': 'aplicação', 'aplicacoes': 'aplicações', 'versao': 'versão',
    'versoes': 'versões', 'numero': 'número', 'numeros': 'números',
    'codigo': 'código', 'codigos': 'códigos', 'otimo': 'ótimo', 'otima': 'ótima',
    'rapido': 'rápido', 'rapida': 'rápida', 'publico': 'público', 'publicaçao': 'publicação',
    'ola': 'olá', 'amanha': 'amanhã', 'parabens': 'parabéns', 'saude': 'saúde',
    'familia': 'família', 'historico': 'histórico', 'automatico': 'automático',
    'automatica': 'automática', 'gramatica': 'gramática', 'ortografico': 'ortográfico',
    'ortografiaa': 'ortografia', 'concerteza': 'com certeza', 'derrepente': 'de repente',
    'agente': null, 'excessao': 'exceção', 'exceçao': 'exceção', 'excessão': 'exceção',
    'excessões': 'exceções', 'exeção': 'exceção', 'enchergar': 'enxergar',
    'enchergando': 'enxergando', 'mecher': 'mexer', 'mechendo': 'mexendo',
    'ancioso': 'ansioso', 'anciosa': 'ansiosa', 'ansiedadee': 'ansiedade',
    'previlégio': 'privilégio', 'previlegio': 'privilégio', 'privilégioo': 'privilégio',
    'beneficiente': 'beneficente', 'reinvindicar': 'reivindicar', 'reinvindicação': 'reivindicação',
    'empecilho': 'empecilho', 'impecilho': 'empecilho', 'seje': 'seja',
    'esteje': 'esteja', 'menas': 'menos', 'comcerteza': 'com certeza',
    'denovo': 'de novo', 'apartir': 'a partir', 'porfavor': 'por favor',
    'obigado': 'obrigado', 'obrigadoo': 'obrigado', 'precizo': 'preciso',
    'nescessário': 'necessário', 'nescessario': 'necessário', 'nescessidade': 'necessidade',
    'presciso': 'preciso', 'probelma': 'problema', 'problemaa': 'problema',
    'respos ta': null, 'respostaa': 'resposta', 'receberr': 'receber',
    'vc': 'você', 'vcs': 'vocês', 'tbm': 'também', 'pq': 'porque',
    'q': null, 'eh': null
  };
  // Abbreviations depend on context and therefore are never corrected automatically.
  const informal = new Set(['vc', 'vcs', 'tbm', 'pq']);
  const ambiguous = new Set(['publico', 'numero', 'pagina', 'codigo', 'historico', 'familia']);
  const grammar = [
    { re: /\bconcerteza\b/giu, to: 'com certeza', message: '“Com certeza” se escreve separado.', safe: true },
    { re: /\ba gente (somos|estamos|vamos|temos)\b/giu, to: m => 'a gente ' + ({somos:'é',estamos:'está',vamos:'vai',temos:'tem'})[m[1].toLowerCase()], message: '“A gente” pede verbo na terceira pessoa do singular.', safe: false },
    { re: /\b(fazem) (\d+|dois|três|quatro|cinco|muitos|alguns) (anos|meses|dias|séculos)\b/giu, to: m => `faz ${m[2]} ${m[3]}`, message: 'Ao indicar tempo decorrido, “fazer” fica no singular.', safe: false },
    { re: /\b(houveram) (problemas|erros|mudanças|dúvidas|pessoas)\b/giu, to: m => `houve ${m[2]}`, message: 'No sentido de existir, use “houve”.', safe: false },
    { re: /\bmais melhor\b/giu, to: 'melhor', message: '“Melhor” já expressa comparação.', safe: false },
    { re: /\bmais pior\b/giu, to: 'pior', message: '“Pior” já expressa comparação.', safe: false },
    { re: /\bem anexo segue\b/giu, to: 'segue em anexo', message: 'Sugestão de ordem mais natural.', safe: false },
    { re: /(?<!\p{L})(\p{L}+)([ \t]+)\1(?!\p{L})/giu, to: m => m[1], message: 'Palavra repetida; confira se foi intencional.', safe: false },
    { re: /\ba nível de\b/giu, to: 'em termos de', message: 'Se não houver ideia de altura, considere “em termos de”.', safe: false }
  ];
  function caseLike(original, replacement) {
    if (original === original.toLocaleUpperCase('pt-BR')) return replacement.toLocaleUpperCase('pt-BR');
    if (/^\p{Lu}/u.test(original)) return replacement[0].toLocaleUpperCase('pt-BR') + replacement.slice(1);
    return replacement;
  }
  function normalize(settings = {}) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) settings = {};
    return { ...defaults, ...settings,
      ...Object.fromEntries(['enabled', 'spelling', 'grammar', 'typography'].map(k => [k, typeof settings[k] === 'boolean' ? settings[k] : defaults[k]])),
      mode: settings.mode === 'auto' ? 'auto' : 'suggest',
      delay: Math.max(300, Math.min(3000, Number(settings.delay) || defaults.delay)),
      disabledSites: Array.isArray(settings.disabledSites) ? settings.disabledSites.filter(x => typeof x === 'string') : [],
      ignoredWords: Array.isArray(settings.ignoredWords) ? settings.ignoredWords.filter(x => typeof x === 'string') : [] };
  }
  function analyze(text, settings = {}) {
    const s = normalize(settings);
    if (!s.enabled || !text) return [];
    const issues = [], ignored = new Set(s.ignoredWords.map(w => w.toLocaleLowerCase('pt-BR')));
    const protectedRanges = [...text.matchAll(/(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|`[^`]*`/giu)].map(m => [m.index, m.index + m[0].length]);
    function add(start, original, replacement, category, message, safe) {
      if (original === replacement || ignored.has(original.toLocaleLowerCase('pt-BR'))) return;
      const end = start + original.length;
      if (protectedRanges.some(([a,b]) => start < b && end > a)) return;
      if (issues.some(i => start < i.end && end > i.start)) return;
      issues.push({ start, end, original, replacement, category, message, safe });
    }
    if (s.spelling) for (const m of text.matchAll(/\p{L}+/gu)) {
      const word = m[0].toLocaleLowerCase('pt-BR'), replacement = Object.hasOwn(spelling, word) ? spelling[word] : null;
      if (replacement) add(m.index, m[0], caseLike(m[0], replacement), 'Ortografia',
        informal.has(word) ? 'Abreviação: confira o contexto antes de substituir.' : 'Possível erro de digitação ou acentuação.', !informal.has(word) && !ambiguous.has(word));
    }
    if (s.grammar) for (const rule of grammar) {
      for (const m of text.matchAll(rule.re)) add(m.index, m[0], caseLike(m[0], typeof rule.to === 'function' ? rule.to(m) : rule.to), 'Gramática', rule.message, rule.safe);
    }
    if (s.typography) {
      for (const m of text.matchAll(/[^\S\r\n]{2,}/gu)) {
        // Preserve indentation and tabular formatting.
        if (m[0].includes('\t') || m.index === 0 || text[m.index - 1] === '\n') continue;
        add(m.index, m[0], ' ', 'Espaçamento', 'Há espaços consecutivos entre palavras.', false);
      }
      for (const m of text.matchAll(/\p{L}[ \t]+[,;!?]/gu)) {
        add(m.index + 1, m[0].slice(1), m[0].slice(-1), 'Pontuação', 'Remova o espaço antes deste sinal.', false);
      }
    }
    return issues.sort((a,b) => a.start - b.start);
  }
  function maskedText(text) {
    return text.replace(/(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|`[^`]*`/giu, m => ' '.repeat(m.length));
  }
  function candidates(text, settings = {}, existing = []) {
    const s = normalize(settings);
    if (!s.enabled || !s.spelling) return [];
    const ignored = new Set(s.ignoredWords.map(w => w.toLocaleLowerCase('pt-BR')));
    const masked = maskedText(text);
    return [...new Set([...masked.matchAll(/(?<![\p{L}\p{N}_])\p{L}{3,32}(?![\p{L}\p{N}_])/gu)]
      .filter(m => !ignored.has(m[0].toLocaleLowerCase('pt-BR')) && !/^\p{Lu}{2,}$/u.test(m[0]) && !/\p{Ll}\p{Lu}/u.test(m[0]) && !existing.some(i => m.index < i.end && m.index + m[0].length > i.start))
      .map(m => m[0]))].slice(0, 200);
  }
  function dictionaryIssues(text, entries, settings, existing) {
    const words = new Map(entries.map(e => [e.word, e.suggestions]));
    const permitted = new Set(candidates(text, settings, existing));
    const result = [...existing];
    for (const m of maskedText(text).matchAll(/(?<![\p{L}\p{N}_])\p{L}{3,32}(?![\p{L}\p{N}_])/gu)) {
      const alternatives = words.get(m[0]);
      if (!alternatives?.length || !permitted.has(m[0])) continue;
      if (result.some(i => m.index < i.end && m.index + m[0].length > i.start)) continue;
      result.push({start:m.index,end:m.index+m[0].length,original:m[0],replacement:alternatives[0],alternatives,category:'Ortografia',message:'Palavra não reconhecida pelo dicionário. Confira a sugestão ou adicione ao seu dicionário.',safe:false});
    }
    return result.sort((a,b) => a.start - b.start);
  }
  const api = { defaults, normalize, analyze, candidates, dictionaryIssues };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.TextoCerto = api;
})();
