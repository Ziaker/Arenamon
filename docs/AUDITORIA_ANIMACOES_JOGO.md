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
| 4 | O osso que o jogo trata como quadril é preso à posição da física (X/Z) | em rigs com osso raiz ACIMA do quadril detectado, apagaria o balanço do quadril (no Eggo o jogo trata o `Root` como quadril, então o `Hips` real já mexia livre — conferido depois) | trava de root motion — `view/characters.js` ~l. 906–927 |
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

- **Quadril preso:** o osso que o jogo usa como quadril fica **exatamente** sobre a posição da física (0,00 m). Correção
  depois da auditoria: no Eggo esse osso é o `Root` (raiz), não o `Hips`; o balanço do `Hips` já aparecia. O risco existe
  para rigs em que o quadril detectado tem uma raiz acima dele.
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

## Correções aplicadas (v1.49.18, 31/10/2026, pedido «Sim, corrige»)

| # | Correção | Onde ajustar / desfazer |
|---|---|---|
| 1 | **Velocidade global das animações = 1×** (a linha 1,75× saiu da base de calibração; workspace salvo com 1,75 migra para 1 ao abrir) | Visualizar › «Animação: transições» › Velocidade geral das animações; Editor de animações › Animação (global) |
| 2–3 | **Ações tocam na velocidade em que foram animadas** (esquiva, tackle, salto sobre o rival, recuo, atordoamento; a idle de reserva também a 1×). O que sobra do clipe segue em epílogo (sistema de conclusão visual que já existia) | mesmo bloco › «Ações tocam na velocidade em que foram animadas» (desligar = modo antigo, esticar na ação) |
| 4 | Quadril: só é preso quando é ele que carrega o deslocamento (sem efeito no Eggo/Wookada/Cogumelo atuais; protege rigs com raiz acima do quadril) | mesmo bloco › «Manter o balanço do quadril» |
| 7 | `eggo.glb` reexportado com «Slide to zero» e sem o quadro repetido no fim dos loops (idle, walk, sprint, jump rise, jump fall) | `scripts/blender-vision/exportar_eggo_glb.py` |

**Medição depois da correção** (partida real, IA × IA): o relógio dos clipes passou a andar a **1,00×** nas ações e nas reservas
(esquiva, carga do tackle, empurrado, defesa, atordoamento) nos três personagens; a pose continua idêntica ao Blender (0,0 cm).

**Não aplicadas (precisam de decisão):**
- 5 «Trava ao chão» desligada por padrão: desligá-la faria o `Jump 1` (subida de 0,6 m dentro do clipe) somar altura à do salto
  da física. Continua por animação no editor (grupo Movimento) — para o pulinho do sprint, desligue só na animação `sprint`.
- 6 Sincronia de passada: mudaria a velocidade das pernas em relação ao animado (a walk do Eggo precisaria de ~7×). A
  alternativa é velocidade de deslocamento por personagem ou passadas maiores nas animações.

**Testes:** `clip-fidelity.test.mjs` (novo), `calibration-base`, `tuning-io`, `animation`, `animation-epilogue*`,
`animation-viewport-vs-jogo`, `animation-loop-controls`, `sprint-turn` e os de navegador `eggo-sprint-turn` e
`game-feel-rig` passam. Os testes do contrato antigo (`animation`, `animation-epilogue-contract`, `animation-runtime`)
rodam com o modo antigo ligado explicitamente. `animation-runtime` tem uma falha que **já existia antes** destas mudanças
(`jump_fall` não alcançado no roteiro sintético).

## Correção seguinte (v1.49.19): andar e correr cortam o fim da animação anterior

Relato: «as animações ficam esperando a anterior finalizar ao invés de cancelar em outra, especialmente quanto ao dodge,
walk e sprint». Causa: a **conclusão visual** (`view/visual-epilogue.js`) segura o resto do clipe de uma ação quando a
simulação já a liberou, e por desenho a locomoção não a cortava; com as ações tocando na velocidade original (v1.49.18) sobra
mais clipe (ex.: dash de 1,38 s numa esquiva de 0,66 s), então o personagem corria com a pose da esquiva.

Correção: com o lutador **se deslocando** (> 0,3 m/s, estado de andar/correr), a locomoção entra na hora e corta o resto do
clipe (também no pouso já em movimento). Parado, o clipe termina como antes. Ação nova, reação e defesa já cortavam.
Controle: Visualizar › «Animação: transições» › **«Andar e correr cortam o fim da animação anterior»** (desligar = regra antiga).

Medição numa partida real com o Eggo: tempo que o clipe da ação continuou com o corpo já andando = **0 s** em todas as
saídas de ação. Testes: `clip-fidelity.test.mjs` (andar logo após a esquiva = walk em todos os passos); os testes do contrato
antigo (`animation-epilogue`, `animation-epilogue-casos`, `animation-viewport-vs-jogo`) rodam com a regra antiga ligada.
