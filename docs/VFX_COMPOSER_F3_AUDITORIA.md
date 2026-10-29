# VFX Composer — auditoria E2E da F3.2

**Data:** 28/10/2026  
**Escopo:** VFX Composer / F3.2. A integração no jogo e a F4 **não** foram executadas nem autorizadas.  
**Ambiente:** Windows, Microsoft Edge headless, `file://`, contexto offline, viewport 1440×1000.

## O que foi entregue

- Três efeitos criados **pelos controles da interface**, sem injetar um projeto pronto:
  - **Brasa Ascendente** — burst esférico, amarelo/laranja, gravidade positiva, additive.
  - **Névoa Fria** — emissor contínuo, azul/ciano, partículas grandes com blending normal.
  - **Estilhaço Arcano** — burst em anel, magenta/violeta, expansão radial com arrasto.
- Teste E2E novo: `prototypes/vfx-composer/test/f3-audit.browser.mjs`.
- Evidência navegável: `prototypes/vfx-composer/evidence/f3-audit/index.html`.
- Resultado estruturado: `prototypes/vfx-composer/evidence/f3-audit/resultado.json`.
- Projeto exportado pelo próprio app: `prototypes/vfx-composer/evidence/f3-audit/projeto-tres-efeitos.vfx-project.json`.
- O app não abre mais vazio: a demonstração dos três efeitos já toca em loop na aba **Partículas**, com a barra `▶ Tocar os 3 efeitos`, `💥 Explosão (cubos + esferas)` e `Projeto vazio`. Evidência: `evidence/f3-audit/app-demo-em-tempo-real.png`.
- Preset de explosão feito com os controles do app — **8 cubos vermelhos** e **8 esferas amarelas**, 48 tracks de posição, em loop. Evidência: `evidence/f3-audit/explosao-cubos-esferas.png`.
- Cor por objeto (`nodes[].color`), validada no contrato e editável em **Cor do objeto** no inspetor.
- Ferramentas de autoria que faltaram durante a montagem manual: seleção múltipla, explosão radial, lista de trilhas removíveis, rotação/escala, paleta de cores, duplicar, remover objeto, enquadrar a cena e atalhos.
- Teste E2E específico: `prototypes/vfx-composer/test/f3-authoring.browser.mjs`, com evidência em `prototypes/vfx-composer/evidence/f3-authoring/index.html`.

## Resultado

| Verificação | Resultado |
|---|---|
| Criação dos 3 efeitos pela UI | aprovado |
| Canvas WebGL com pixels quentes, frios e magenta | aprovado por diferença de pixels |
| Cena simultânea | **417 partículas**, **3 draw calls** |
| Orçamento medium | **583/900 partículas** (pico bruto 682, 99 suprimidas), publicável (sem certificação de performance) |
| Play / stop / reverse | aprovado; o relógio avançou para ~1,15 s no play |
| Scrub determinístico | aprovado; voltar ao mesmo tempo devolveu a mesma lista |
| three.quarks real | **3 sistemas**, 421 partículas, 2 draw calls, 0 rejeições |
| Comparação A/B | aprovado; as duas prévias ficaram visíveis lado a lado |
| Exportação por download | 3 emissores no JSON |
| Reimportação pelo input | aprovado; a simulação no mesmo tempo ficou idêntica |
| Recarga normal do autosave | 3 emissores preservados |
| Corrupção do slot principal | backup recuperou os 3 efeitos |
| Corrupção sem backup | app abriu vazio, mas informou o fallback |
| Abertura do app | 3 efeitos carregados e tocando em loop, aba Partículas |
| Preset Explosão | 16 objetos (8 cubos `#ff2b2b` + 8 esferas `#ffd400`), 48 tracks, tocando |
| Requisições externas | 0 |
| Erros de console/página | 0 |

Métricas de pixels: a brasa alterou 2.111 pixels (1.046 quentes), a névoa alterou 8.045 (5.813 frios) e o estilhaço alterou 1.209 (440 magenta). Na cena conjunta foram 9.116 pixels alterados.

Partículas no instante capturado: brasa 280, névoa 49 e estilhaço 106. Na cena conjunta são 417 partículas ativas; o orçamento conta 583 porque soma o pico de cada emissor ao longo da simulação, não apenas o quadro.

## Falha real encontrada e corrigida

**O app lia o autosave bruto e ignorava o backup.** O teste unitário F1 já provava `AutosaveManager.load()` com fallback, mas a aplicação não usava esse caminho. Com o slot principal corrompido e um backup válido, o Composer abria **vazio e em silêncio**.

Correção em `src/app/main.ts`:

- o app agora carrega pelo `AutosaveManager.load()`;
- usa o backup quando o slot principal está corrompido;
- mostra o motivo no `#status`;
- quando não há nenhum snapshot válido, abre o projeto inicial e informa o fallback em vez de apagar dados silenciosamente;
- expõe `window.__ARENAMON_VFX_COMPOSER__.recovery` para a auditoria.

## Lacunas da montagem manual (implementadas)

Ao montar a explosão de cubos e esferas apenas pela interface, ficaram evidentes operações que não existiam. Todas foram implementadas e cobertas pelo teste de autoria:

| Lacuna | Solução na interface |
|---|---|
| Selecionar e animar vários objetos | `Ctrl+clique`/`Shift+clique` na hierarquia; keyframe e explosão agem na seleção |
| Criar a explosão sem repetir dezenas de keyframes | **Explosão radial** com raio (m), tempo (s), elevação (m) e semente |
| Conferir e corrigir a animação criada | **Trilhas do objeto** com keyframes clicáveis e remoção individual |
| Apagar uma animação inteira | **Limpar animação do objeto** |
| Girar e escalar sem editar código | Campos **Rotação** (°) e **Escala** (×) no inspetor |
| Pintar rápido | Paleta de seis cores + hexadecimal + ponto de cor na hierarquia |
| Repetir um objeto já animado | **⧉ Duplicar** / `Ctrl+D`, copiando as trilhas |
| Apagar um objeto | 🗑 na hierarquia / `Delete` / `Backspace` (não existia) |
| Achar a cena depois da explosão | **Enquadrar** / `F` |
| Recomeçar limpo | **Projeto vazio** limpa seleção, inspetor e trilhas |

O preset de explosão e a ferramenta radial usam a mesma função pura `buildRadialTracks` (`src/animation/radial.ts`), com semente determinística, limites validados e testes unitários na F2.

Resultado do teste `npm run test:vfx-composer:f3:authoring`: aprovado — 8 objetos, 24 trilhas, duplicar (9 objetos/27 trilhas), remover (8/24), rotação 45° e escala 2×, paleta, atalhos, limpeza e projeto vazio. Capturas: `evidence/f3-authoring/explosao-ferramentas.png` e `trilhas-radiais.png`.

## Como abrir

1. **App:** `ABRIR_ARENAMON.html` → **VFX Composer — F3.2**.
2. **Auditoria visual:** `prototypes/vfx-composer/evidence/f3-audit/index.html`.
3. **Cena com os três efeitos:** `prototypes/vfx-composer/evidence/f3-audit/tres-efeitos.png`.
4. **Comparação A/B:** `prototypes/vfx-composer/evidence/f3-audit/comparacao-ab.png`.
5. **Recuperação do autosave:** `prototypes/vfx-composer/evidence/f3-audit/recuperacao-autosave.png`.
6. **Demonstração tocando ao abrir:** `prototypes/vfx-composer/evidence/f3-audit/app-demo-em-tempo-real.png`.
7. **Explosão de cubos e esferas:** `prototypes/vfx-composer/evidence/f3-audit/explosao-cubos-esferas.png` — ou abra o app e clique em **💥 Explosão (cubos + esferas)**.
8. **Ferramentas de autoria:** `prototypes/vfx-composer/evidence/f3-authoring/index.html` — seleção múltipla, explosão radial e lista de trilhas em uso.

## Reproduzir

```bash
npm run test:vfx-composer:f3:audit
```

O comando recompila o HTML offline e executa o E2E no Edge. Para a bateria focal completa do Composer:

```bash
npm run test:vfx-composer
npm run test:vfx-composer:f1
npm run test:vfx-composer:f2
npm run test:vfx-composer:f3
npm run test:vfx-composer:f3:quarks
npm run test:vfx-composer:f3:quarks:adapter
npm run test:vfx-composer:f1:browser
npm run test:vfx-composer:f2:browser
npm run test:vfx-composer:f3:browser
npm run test:vfx-composer:f3:quarks:browser
npm run test:vfx-composer:f3:authoring
npm run typecheck:vfx-composer
```

## Limites honestos

- A integração no jogo/F4 não foi feita.
- FPS, GPU e memória não foram medidos em hardware amplo; o teste prova canvas e ciclo de vida, não desempenho universal.
- A qualidade artística dos três efeitos é julgamento humano e não foi tratada como aprovada.
- A sequência de quadros é uma amostra de quatro tempos reais, não uma gravação de vídeo contínua.
- O Quarks usa aproximações de turbulência e abertura; a paridade numérica exata continua sendo da simulação autoral.
- O gizmo 3D manipula apenas o objeto principal da seleção; os campos de rotação/escala e a explosão radial aplicam-se a todos os selecionados.
- A paleta tem seis cores fixas; qualquer outra cor sai do campo hexadecimal, que aceita `#rrggbb`.
