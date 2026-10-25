# Texto Certo

Extensão Manifest V3 para **Chrome e Edge**, com revisão local de português brasileiro. Não exige conta, chave de API, assinatura ou servidor.

## Instalar no navegador

1. Baixe e extraia `dist/texto-certo-1.0.0.zip`.
2. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`.
5. Recarregue os sites abertos. Fixe o Texto Certo na barra de extensões, se desejar.

O ZIP é um pacote para instalação manual ou submissão às lojas; não é instalado por duplo clique. Esta versão ainda não foi publicada nas lojas. Ao carregar o checkout diretamente, rode `npm ci` e `npm run build` antes: a pasta `vendor/` é gerada a partir do lockfile.

## Usar

Digite em um campo de texto, uma área de texto ou um editor compatível. Quando houver sugestões, um botão azul aparece próximo ao campo. Clique nele para ver os problemas. Clique em uma alternativa para aplicá-la, **Ignorar agora** para dispensar a ocorrência ou **Meu dicionário** para ignorar aquela palavra permanentemente.

Abra o botão da extensão para ativar ou desativar a revisão, escolher o modo e controlar o site atual. Em **Todas as configurações**, escolha as categorias, o tempo de espera, as palavras ignoradas e os domínios desativados. As preferências são aplicadas nas abas abertas e permanecem no perfil do navegador.

- **Sugerir** é o padrão: nada muda sem sua decisão.
- **Automático** aplica apenas correções da lista conservadora de erros frequentes, depois de concluir a palavra. Abreviações, sugestões do dicionário e regras dependentes de contexto continuam exigindo aprovação.
- **Desfazer última correção** aparece no painel enquanto não houver outra edição no campo. Ele reverte uma alteração; a pilha nativa de desfazer varia conforme o editor.

## O que é revisado

- Ortografia e flexões com o dicionário brasileiro **VERO**, por meio de **Hunspell/WebAssembly**. Até três alternativas por palavra.
- Acentos, abreviações e erros de digitação comuns, com preservação de maiúsculas.
- Regras específicas de gramática: concordância com “a gente”, tempo decorrido, alguns usos de “haver”, palavras repetidas e redundâncias.
- Espaços duplicados entre palavras e espaços indevidos antes de pontuação.

Para manter a resposta rápida, campos com mais de 50 mil caracteres não são revisados; o dicionário consulta até 200 palavras distintas por revisão e retorna até 20 palavras com alternativas. A lista exibida limita-se a 30 problemas por vez. Palavras em URLs, e-mails e trechos entre crases são preservadas. Siglas e identificadores com maiúsculas no meio são excluídos da consulta ao dicionário.

A análise gramatical é baseada em regras específicas, não em IA. A revisão não garante que toda frase esteja correta. Nomes próprios, estrangeirismos e palavras ambíguas podem receber sugestões inadequadas. Confira o contexto antes de aceitar. O dicionário VERO distribuído por `dictionary-pt` possui sua própria versão e pode não reconhecer neologismos.

## Privacidade e compatibilidade

O texto permanece no navegador. As palavras são consultadas pelo processo local da extensão; não há serviço remoto, telemetria ou persistência do texto digitado. Apenas preferências e o dicionário pessoal são salvos em `chrome.storage.local`. O motor mantém um cache temporário de palavras na memória, que é descartado com o processo.

O acesso a páginas HTTP/HTTPS é necessário para revisar seus campos. As permissões `storage` e `activeTab` são usadas para preferências e controle do domínio atual. A extensão exclui campos de senha, e-mail, número, pagamento identificável e código de autenticação. Essa identificação não substitui sua decisão sobre dados sensíveis: desative a revisão nos sites em que preferir.

Editores podem desativar a revisão com `data-texto-certo="off"` no campo ou em um ancestral. Editores de código conhecidos são excluídos. Não funciona em páginas internas do navegador, lojas de extensões, PDFs e Shadow DOM. Editores como Google Docs/Canvas e alguns editores com modelo próprio podem não ser compatíveis. Campos de texto comuns e editores HTML `contenteditable` são o alvo desta versão. Firefox e Safari não foram preparados ou testados.

## Desenvolvimento

Pré-requisitos: **Node.js 24**, npm, **Python 3** e **Chromium** para os testes da interface. Não há dependências de runtime externas ao pacote da extensão.

```sh
cd /workspace/extensao
npm ci --cache /tmp/texto-certo-npm-cache
npm run build
npm test
npm run test:browser
```

`npm run build` gera o motor local em `vendor/` e o ZIP em `dist/`. Não instala nem publica a extensão. O build preserva as licenças das dependências junto do pacote. Não edite `vendor/` diretamente.

`npm test` verifica o motor de regras. `npm run test:browser` executa os scripts reais no Chromium, com um servidor efêmero local e uma implementação de teste da API de armazenamento/mensagens do Chrome. O dicionário e o WebAssembly usados nesse teste são os mesmos do pacote; a API de extensão é simulada. Esse teste não comprova instalação como extensão.

Em uma máquina que permita extensões de desenvolvimento, execute também:

```sh
npm run test:extension
```

Esse comando tenta carregar a extensão real em um perfil temporário. Neste ambiente na nuvem, a política administrativa do Chromium impediu o carregamento de extensões sem compactação. Portanto, a instalação real e a compatibilidade com sites de terceiros permanecem para validação manual. Para usar outro Chromium nos testes, defina `CHROMIUM_PATH` com o caminho do executável.

Estrutura: `src/engine.js` contém as regras; `src/content.js`, a integração com campos; `src/background.js` e `src/spell-entry.mjs`, a revisão com dicionário; `src/popup.*` e `src/options.*`, as preferências; `tests/`, a validação. Não é necessário manter servidor de desenvolvimento em execução.

## Créditos e licenças

Dicionário VERO de Raimundo Moura e colaboradores, distribuído sem modificações por `dictionary-pt` 4.0.0 (LGPL-3.0 ou MPL; consulte `vendor/dictionary-license.txt`). Fontes do dicionário: https://github.com/wooorm/dictionaries/tree/main/dictionaries/pt e https://github.com/LibreOffice/dictionaries/tree/master/pt_BR.

Motor Hunspell por `hunspell-asm` 4.0.2, com o runtime WebAssembly incluído no pacote npm. Fontes e instruções de compilação: https://github.com/kwonoj/hunspell-asm e Hunspell https://github.com/hunspell/hunspell (a versão usada pelo wrapper é identificada em `node_modules/hunspell-asm/package.json`, campo `config.hunspell-version`). Código do dicionário e do motor não foi alterado. Consulte `vendor/hunspell-license.txt`, `vendor/MPL-1.1.txt` e `vendor/THIRD-PARTY.txt` para avisos de licença. Preferências pessoais e textos não são incluídos no pacote.
