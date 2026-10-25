# VFX por fase no Atelier Areia/Pedra: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (ou `executing-plans` do Claude Superskills) para implementar este plano em lotes de 3 tarefas, com relatório entre os lotes.

**Goal:** Fazer o Atelier Areia/Pedra (`prototypes/sand-stone-lab/`) cumprir o `docs/PADRAO_ATELIES_VFX.md`: as seis fases desligáveis, sliders completos agrupados por fase, seletor de disparo Argola / Tiro em cone, salvar/exportar/importar e acessibilidade, para os 24 efeitos (8 categorias × 3 propostas), sem alterar o jogo nem a simulação.

**Architecture:** A camada de dados já existe em `src/config.ts` (interruptores `startOn…impactOn`, controles de disparo `shot*`, tempos `startTime/flightTime/holdTime/finishTime/impactTime`, faixas expandidas, `phaseOf`, `help`) e a validação em `src/presets.ts` já lê `controls`. Falta ligar isso à interface e aos efeitos: (1) um módulo puro `src/phases.ts` com o relógio de fases (pula as fases desligadas e diz qual está ativa) e a camada de disparo reutilizável; (2) `main.js` agrupa os sliders por fase, com interruptor, campo numérico, aviso de «nada para mostrar», salvamento automático e legenda; (3) cada classe de efeito declara as janelas das suas fases e respeita os interruptores. Nenhum valor padrão muda a aparência atual.

**Tech Stack:** JavaScript/TypeScript ESM (esbuild), three.js, three.quarks, testes em Node (`test.mjs`, `presets.test.mjs`) e Playwright + Edge para o navegador.

**Decisões do responsável (24/10/2026), registradas antes de implementar:**
1. Escopo: Atelier Areia/Pedra (Sand Wave, Emerging Stone, Rocha, Swift, Psyshock, Bullet Punch, Quick Attack, Riposte).
2. Impacto do disparo (clarão, halo, coice, ondas) **soma** ao seletor: continua uma camada à parte, ligada pelo interruptor da fase Disparo; o seletor só escolhe Nenhum / Argola / Tiro em cone.
3. Desligar todas as fases que desenham algo: o painel **avisa** («nenhuma fase visual ligada»).
4. Extras: só os controles de referência de `PADRAO_ATELIES_VFX.md` §2 e §3; todo parâmetro novo nasce com padrão que mantém o visual atual (desligado ou discreto).

**Regras que valem em todas as tarefas:** o Move Charge só tem carga onde o Move é Charge (Psyshock); VFX nasce no evento e não decide hitbox/dano; sem acerto não se mostra hit; tick mecânico ≠ frame de animação; fase desligada não executa nem aparece na legenda e seus sliders ficam esmaecidos guardando o valor. Antes de entregar: `node prototypes/sand-stone-lab/build.mjs`, `node prototypes/sand-stone-lab/test.mjs`, `node prototypes/sand-stone-lab/presets.test.mjs`, teste de navegador, `npm run build:combat-lab` (o portal liga o atelier) e `npx tsc --noEmit -p prototypes/combat-lab/tsconfig.json`.

---

## Lote 1: fundação + Sand Wave (detalhado) — CONCLUÍDO em 24/10/2026

### Tarefa 1: relógio de fases (módulo puro)

**Files:**
- Create: `prototypes/sand-stone-lab/src/phases.ts`
- Create: `prototypes/sand-stone-lab/phases.test.mjs`

**Step 1: teste que falha.** `phases.test.mjs` importa `{PhaseClock, enabledPhases}` de `./src/phases.ts` e confere:
- com `spans=[{id:'start',from:0,to:.25},{id:'body',from:.25,to:1},{id:'finish',from:1,to:1.65}]` e tudo ligado, `clock.map(.3)` devolve `.3` e `clock.phaseAt(.3)` devolve `'body'`;
- com `startOn:0`, `clock.map(0)` devolve `.25` (pula a fase) e `clock.duration` cai de 1,65 para 1,4;
- `clock.phaseAt(t)` nunca devolve uma fase desligada;
- com todas desligadas, `clock.nothingToShow === true` e `duration === 0`;
- `enabledPhases({startOn:0,launchOn:1,...})` lista só as ligadas, na ordem de `phases`.

**Step 2:** `node prototypes/sand-stone-lab/phases.test.mjs` → FAIL (módulo inexistente).

**Step 3: implementação mínima** em `phases.ts`: `export type Span={id:Phase,from:number,to:number}`; `class PhaseClock{constructor(spans,values)}` com `duration`, `nothingToShow`, `map(t)` (tempo do efeito = `from` da primeira fase ligada + deslocamento acumulado, pulando os trechos desligados), `phaseAt(t)`; `enabledPhases(values)`.

**Step 4:** rodar o teste → PASS. **Step 5: commit** `feat(atelier): relogio de fases desligaveis (modulo puro)`.

### Tarefa 2: camada de disparo (Argola / Tiro em cone)

**Files:** Create `src/shot-effect.ts`, `shot.test.mjs`.

**Step 1: teste que falha.** `new ShotEffect(stage, particles, values, {origin:[0,.4,-2], direction:[0,0,1]})`: com `shotKind=0` desenha uma argola (um `RingGeometry`/`TorusGeometry` filho do stage, raio `shotRadius`, achatado por `shotSquash`, deslocado por `shotHorizontal/shotVertical` COM SINAL), com `shotKind=1` cria partículas Quarks em cone (`shotCount`, `shotAngleH/V` com sinal, `shotLength`), `launchOn=0` não cria nada, e `dispose()` limpa (partículas = 0). Valores de um tipo sobrevivem à troca para o outro.

**Step 2:** rodar → FAIL. **Step 3:** implementar usando `Particles.create` e `shockRing` de `art.js`. **Step 4:** PASS. **Step 5:** commit `feat(atelier): camada de disparo reutilizavel (argola e tiro em cone)`.

### Tarefa 3: Sand Wave respeita as fases

**Files:** Modify `src/effects.js` (`SandEffect`), `test.mjs`.

**Step 1: teste que falha** (acrescentar em `test.mjs`): para cada variante de `sand`, (a) `p.startOn=0` → `warning.material.opacity===0` e nenhuma ação antes de `startTime`; (b) `p.bodyOn=0` → nenhuma frente visível (`fronts.every(f=>!f.head.visible)`) e nenhuma corrente de partículas (`streams.length===0` após `update`); (c) `p.impactOn=0` → `impact()` não cria partículas nem tremor (`punch===0`); (d) `p.finishOn=0` → a frente some sem o desvanecer de .65 s; (e) com todos os padrões, as posições da frente em t=0,25/0,6/1 ficam iguais às de hoje (tolerância 1e-9: o visual não muda).

**Step 2:** FAIL. **Step 3:** `SandEffect` passa a usar `p.startTime`, `p.flightTime`, `p.finishTime`, `p.impactTime` no lugar das constantes `.25/.75/.65`; expõe `timeline()` com as janelas por fase; chama `ShotEffect` no fim do surgimento. **Step 4:** PASS (e `test.mjs` inteiro). **Step 5:** commit `feat(atelier): Sand Wave com seis fases desligaveis`.

**Relatório do lote 1:** `phases.ts` (+ `phases.test.mjs`), `shot-effect.ts` (+ `shot.test.mjs`) e Sand Wave com fases (+ `sand-phases.test.mjs`, golden `golden/sand-padrao.json` gravado antes da mudança: com os padrões o visual não mudou). Ainda sem interface: a tela do atelier continua igual.

**Desvios do plano (decisão registrada):** (1) o seletor de disparo ficou com 3 opções (0 Nenhum = padrão, 1 Argola, 2 Tiro em cone) para o visual padrão não mudar; o interruptor da fase Disparo desliga também o disparo antigo do efeito. (2) Disparo e contato são camadas de evento ligadas por `launchOn`/`impactOn`; o relógio `PhaseClock` costura só as fases sequenciais (surgimento, corpo, duração, finalização). (3) Os testes de fase do Sand ficaram em `sand-phases.test.mjs` (não em `test.mjs`).

---

## Lote 2: interface, persistência e acessibilidade (detalhar ao chegar)

- **Tarefa 4:** `main.js` agrupa os sliders por `phaseOf(key)` com título da fase (`phaseNames`), interruptor «Ligar esta fase» no topo de cada grupo, slider + campo numérico sincronizados, explicação (`help`), botão Restaurar do efeito, sliders esmaecidos quando a fase está desligada, aviso «nenhuma fase visual ligada», legenda do canto só com as fases ligadas (`PhaseClock.phaseAt`). Troca `groups.slice(0,5)` por agrupamento por fase. Ajustar o teste que confere IDs do `template.html`.
- **Tarefa 5:** salvamento automático (substitui «Salvar/Carregar» manuais por salvar ao mexer + restaurar ao abrir, por variante), exportação com data no nome do arquivo, importação que **ignora e conta campos desconhecidos** em vez de recusar, aviso de que o armazenamento local vale para o mesmo navegador/arquivo e que o JSON é a cópia segura; `presets.ts` (`SCHEMA_VERSION` continua 1, `ATELIER_VERSION` sobe, versões 3/5/6 continuam migrando).
- **Tarefa 6:** acessibilidade: «Sem flash» (zera clarão, halo e brilho pulsante, mantém ondas e partículas) e «Movimento reduzido» (valor inicial vem de `prefers-reduced-motion`; reduz velocidade, quantidade e giro).

## Lote 3: demais efeitos, prova e entrega (detalhar ao chegar)

- **Tarefa 7:** Emerging Stone (origem + percurso subterrâneo + emergência + rocha persistente) e Rocha (inspeção de objeto: explicita que não é ataque e que só tem fases de exibição).
- **Tarefa 8:** Quick Attack (arrancada → contato/erro → retorno sem segundo hit), Bullet Punch (corpo ausente na corrida) e Riposte (preserva os quatro cenários).
- **Tarefa 9:** Swift (Burst, sem carga) e Psyshock (única com carga).
- **Tarefa 10:** teste de navegador no Edge (sliders, limites com sinal, fases, alternância, persistência, limpeza), capturas em `prototypes/sand-stone-lab/evidence/`, documentação (`docs/LAB_AREIA_PEDRA.md`, `docs/MOVES_ELEMENTAIS_VISUAL_QUARKS.md` corrigido), link no portal, versão do `package.json`.

## Fora deste plano (continua decisão do responsável)

Estilo visual definitivo (§6 do padrão); aplicar o seletor ao Water Pulse e ao Air Slash do jogo; qualquer mudança em hitbox/dano; medição de desempenho em GPU (Tarefa 6 do plano restante).

---

## Estado final (24/10/2026)

Tarefas 1 a 10 concluídas. Lote 1: `phases.ts`, `shot-effect.ts`, Sand Wave. Lote 2: painel por fase (`panel-model.ts`, `main.js`), salvamento automático, exportação datada, importação tolerante (`presets.ts`, atelier 7.0.0), Sem flash e Movimento reduzido. Lote 3: Emerging Stone (com trajeto subterrâneo), Rocha (inspeção), Quick Attack (retorno), Bullet Punch (corpo ausente), Riposte, Swift e Psyshock; `timelines.test.mjs` cobre as 24 propostas; teste de navegador e capturas em `prototypes/sand-stone-lab/evidence/fases-24-10/`. Desvios: seletor com 3 opções (Nenhum é o padrão); disparo e contato são camadas de evento; o retorno do Quick Attack e o corpo ausente do Bullet Punch mudam o visual padrão de propósito.

**Não feito / pendente:** aprovação visual do responsável; desempenho em GPU nos limites ampliados; aplicar o padrão aos Moves elementais do ateliê Quarks e ao jogo; estilo visual definitivo.
