# Auditoria: como o jogo (combat-lab) toca as animações

Data: 31/10/2026 · versão do jogo auditada: **v1.49.17** · pedido: «o problema tá no próprio motor do jogo e como ele tá
tratando as animações (…) muito mais rápido e bugado (…) apenas faça uma auditoria». **Nada foi alterado no jogo.**

Personagens medidos: **Eggo** (`chars/Eggo/eggo.glb`), **Wookada** (`chars/wookada/wookada.glb`) e **Cogumelo**
(`chars/mosh/Cogumelo.glb`). Scripts e resultados: `prototypes/combat-lab/evidence/auditoria-animacoes/`.

## Resumo

A pose que chega ao jogo é **idêntica** à do Blender (0,0 cm de diferença em todos os ossos, em todos os clipes). O
problema está no **relógio** com que o motor toca os clipes e em camadas que mexem no tempo e no corpo:

| # | Achado | Efeito visível | Onde no código |
|---|---|---|---|
| 1 | **Velocidade global das animações = 1,75×** | TUDO toca 75% mais rápido que o animado | `display.animation.speed` (= `Character.options.speed`), usado em `speedOf()` — `view/characters.js:446` |
| 2 | Ações com tempo da simulação **esticam/espremem o clipe inteiro** na duração da ação | esquiva, salto sobre o rival, tackle, aterrissagem, atordoamento rápidos demais | ramo `TIMED` de `blend()` e `progressOf()` — `view/characters.js` ~l. 890, `view/visual-epilogue.js:180` |
| 3 | Estados sem clipe próprio tocam a **idle esticada na duração da ação** | idle «respirando» a 3,6× no tackle e 7,5× no atordoamento da defesa | mesma regra do item 2 + reservas `STATE_FALLBACK` (`view/characters.js` ~l. 38) |
| 4 | O **quadril é preso à posição da física** (X/Z) em todo quadro | some o balanço lateral/frontal do quadril que foi animado | trava de root motion — `view/characters.js` ~l. 906–927 (`rootMotionNodes` inclui o quadril) |
| 5 | **«Trava ao chão»** ligada por padrão apoia o ponto mais baixo no chão | some o sobe-desce do clipe (pulinho do sprint, subida do Jump 1) | `groundCurve()` / `lockToGround` — `view/characters.js` ~l. 930 |
| 6 | Velocidade do corpo × passada do clipe **não são sincronizadas** | pés patinando | não existe sincronia de passada no motor |
| 7 | GLB exportado começa em 1/24 s e repete o quadro 1 no fim do loop | pequeno «engasgo» a cada volta do loop | exportação (`scripts/blender-vision/exportar_eggo_glb.py`, sem «slide to zero») |
| 8 | Transições curtas (0,19 s entre estados, 0,09 s para ações) | troca brusca entre clipes | `display.animation.fade` / `actionFade` |

## 1. Velocidade global de 1,75× (causa principal do «muito mais rápido»)

- `speedOf(id) = (Character.options.speed || 1) × (velocidade do clipe no editor || 1)` — **toda** animação de relógio livre
  (idle, walk, sprint, loops, prévia) avança `dt × 1,75`.
- O valor vem do slider da aba **Personagens** («velocidade das animações», parâmetro oficial `display.animation.speed`),
  gravado em **1,75** na calibração v8 (`prototypes/combat-lab/inicial/calibracao-v8.json`, linha 2170; commit `ef9a065e`)
  e importado na primeira abertura pelo workspace inicial (`app/workspace-boot.js:45`). O padrão do código é 1.
- Medição numa partida real (60 quadros/s, 1 atualização do personagem por quadro, `dt` ≈ 1/60):

| Estado | Eggo: clipe avança por segundo real | Wookada |
|---|---|---|
| walk (relógio livre) | **2,0×** | **1,5×** |
| esquiva (dodge) | 2,1× | 1,1–1,2× |
| salto sobre o rival (usa o clipe `jump`) | 2,8× | 1,2× |
| tackle sem clipe (idle) | 3,6× | — |
| atordoamento da defesa sem clipe (idle) | 7,5× | — |

(O Wookada parece «menos errado» porque os clipes dele são curtos e no lugar; a mesma multiplicação vale para ele.)

## 2. Ações cronometradas pela simulação (TIMED)

Esquiva, tackle, salto sobre o rival, recuo, aterrissagem, atordoamento etc. não usam o relógio do clipe: o motor faz
`tempo do clipe = progresso da ação (0–1) × duração do clipe`. O clipe inteiro (com antecipação e recuperação) é
**espremido** na duração da ação:

| Ação | Duração no jogo | Clipe do Eggo | Compressão |
|---|---|---|---|
| esquiva (dodge) | 0,657 s | dash 1,38 s / dodge lateral 0,92 s | 2,1× / 1,4× |
| salto sobre o rival (vault) | ~0,45 s | `jump` 1,25 s | ~2,8× |
| tackle | 1,143 s | (sem clipe → idle 4,21 s) | 3,7× |
| atordoamento da defesa | 0,505 s | (sem clipe → idle) | ~8× |
| aterrissagem | 0,467 s | `land` 0,46 s | 1,0× |

O editor de animações tem **recorte** (trim), que permite tocar só o trecho principal, mas por padrão o clipe todo é usado.

## 3. Estados sem clipe → idle esticada

O Eggo tem 13 clipes. Sem clipe próprio: andar para trás/esquerda/direita, girar no lugar, queda genérica, tackle, carga do
tackle, defesa, dano, lançado, recuperar, caído, morte. Pelas reservas, a maioria cai na **idle** e, como vários desses
estados são cronometrados (item 2), a idle respira 3–8× mais rápido. O Cogumelo tem clipes trocados (uma animação de
dano usada como esquiva para a esquerda, uma de morte como esquiva para trás). Detalhe por personagem:
`evidence/auditoria-animacoes/resultado_clipes_por_estado.json`.

## 4–5. Camadas que mexem no corpo

- **Quadril preso:** medido em prévia com walk, sprint e esquivas dos três personagens: o quadril fica **exatamente**
  sobre a posição da física (0,00 m) em todo quadro. Correto para o deslocamento (root motion), mas também apaga o
  deslocamento lateral/frontal que o quadril tem DENTRO da pose (ex.: o Eggo desloca o quadril 2 cm para a perna de apoio).
- **Trava ao chão:** ligada por padrão; o sobe-desce do clipe é neutralizado (o pulinho de 7 cm do sprint e a subida de
  0,6 m do Jump 1 não aparecem; a altura do salto vem só da física). Pode ser desligada por animação no editor (grupo
  Movimento).

## 6. Passada × velocidade do corpo

| Clipe | Distância por ciclo no Blender | Velocidade do clipe | Velocidade no jogo | Patina |
|---|---|---|---|---|
| Eggo walk | 0,72 m / 1,04 s | 0,69 m/s | 4,8 m/s (equilibrado) | ~7× (≈ 4× com a velocidade 1,75) |
| Eggo sprint | 3,2 m / 1,38 s | 2,33 m/s | 7,44 m/s | ~3,2× (≈ 1,8× com 1,75) |
| Wookada / Cogumelo | clipes no lugar ou 0,4–2,8 m/s | — | 4,8–7,4 m/s | idem |

O motor não ajusta a velocidade do clipe à velocidade do corpo.

## 7. Exportação (pequeno, do lado do Blender → GLB)

Os tempos do `eggo.glb` começam em 1/24 s (quadro 1) e o último quadro dos loops repete o primeiro: o motor segura o
quadro 1 por 1/24 s a cada volta. Corrige-se exportando com «Slide to zero» e sem o quadro duplicado.

## O que NÃO é problema

- Exportação das poses (Blender = GLB = jogo, 0,0 cm).
- Chamadas por quadro: o personagem é atualizado **uma vez** por quadro, com `dt` real (sem atualização dupla).
- Root motion horizontal: removido corretamente (o modelo não escapa do corpo).

## Correções possíveis (não aplicadas; decisão do responsável)

1. **Velocidade global de volta a 1,0×** (aba Personagens) — as animações de relógio livre passam a tocar como no Blender.
2. **Ações cronometradas tocando na velocidade original** (opção nova): o clipe toca em 1,0× e a ação usa só o trecho que
   cabe, ou um recorte padrão por estado — em vez de esticar/espremer o clipe todo.
3. **Reservas sem idle esticada:** estado sem clipe próprio cronometrado usa a idle em relógio livre (1,0×).
4. **Quadril:** prender só o deslocamento acumulado da raiz, preservando o balanço do quadril dentro da pose.
5. **Trava ao chão** desligada por padrão para clipes que já foram animados no chão certo (opção por personagem).
6. **Sincronia de passada** opcional (velocidade do clipe acompanha a do corpo, com limites), ou velocidades de
   deslocamento por personagem.
7. Exportar o GLB com «Slide to zero» e sem quadro duplicado.
