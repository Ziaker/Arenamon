# Arenamon — Índice de módulos, responsabilidades e testes

Índice curto para agentes e desenvolvedores. Aponta **onde fica cada responsabilidade e qual teste a protege**; os detalhes estão nos arquivos citados. Estado verificado em 2026-10-16 (`main` após o PR #1). Se algo divergir do código, vale o código — e este arquivo deve ser corrigido.

**Regra central:** edite sempre as fontes (`src/`). Os HTMLs de `dist/` são artefatos gerados por `npm run build` (ignorados pelo Git, regeneráveis e idênticos byte a byte quando as fontes não mudam).

## 1. Escolha o que rodar (testes seletivos)

| Mexi em… | Rode (rápido → completo) | Precisa de navegador? |
|---|---|---|
| `combat-lab/src/sim/`, regras, IA, física | `npm run test:combat-lab:unit` | não |
| `combat-lab/src/{view,ui,workspace}/`, HTML do lab | `npm run test:combat-lab:browser` | sim (Edge/Chromium) |
| `game/src/` | `npm run test:game:unit` · `npm run test:game:browser` | só o 2º |
| `studio/src/` | `npm run test:studio:unit` · `npm run test:studio:browser` | só o 2º |
| `importer/`, `placeholders/` | `npm run test:importer` · `npm run test:placeholders` | sim |
| tipos (JSDoc/`.ts`) | `npm run typecheck` | não |
| qualquer coisa antes de entregar | `npm run verify` (= workspace + tipos + tudo + varredura offline) | sim |

`npm run test:unit` roda todos os testes sem navegador (~1,5 min). `npm run check:offline` faz a varredura estática dos HTMLs gerados (exige `npm run build` antes).

## 2. Laboratório de combate (`prototypes/combat-lab/`)

**Simulação — `src/sim/`** (sem DOM nem Three.js; roda em Node; passo fixo de 120 Hz, determinística por semente)

| Módulo | Responsabilidade | Teste principal |
|---|---|---|
| `config.js` | Configuração viva `C` (regras, locomoção, câmera, perfis, extras, ações, mundo) e `resetConfig` | `core`, `calibration` |
| `game.js` | Ciclo da partida: ordem do passo, eventos, `save/load`, `FixedClock` | `sim`, `core`, `moves` |
| `entity.js` · `math.js` | Lutador, comando, predicados de estado · vetores XZ | `core` |
| `controller.js` | Ações por lutador: stamina, defesa, X (tackle), C (esquiva), cancelamentos, **movimentos** (`movePermission`, `startMove`, `updateMove`) e **Charge** (`chargePermission`, `startCharge`, `cancelCharge`, `stepCharge`) | `core`, `rules`, `moves`, `properties` |
| `locomotion.js` · `motion.js` | Caminhada/sprint/frenagem · curva em fases de X e C | `locomotion` |
| `combat.js` · `physics.js` | Contatos ofensivos (lançamento, clash, defesa) · física, subpassos, arena | `core`, `properties` |
| `world.js` · `geometry.js` | Entidades criadas por movimentos (projétil, barreira, parede, área); `applyHit` único; **reflexão** (`reflectPass`), Tackle×barreira, explosão×barreira · retângulos orientados e varredura de segmento | `moves`, `reflect` |
| `move-state.js` · `scenarios-moves.js` · `ui/moves-panel.js` · `ui/moves-hud.js` · `view/world-view.js` | Estado dos slots (mesmas permissões do controlador) · cenários técnicos dos Moves · aba Moves · HUD dos slots · desenho das entidades, prévia, orbes e anéis | `moves-ui`, `moves-ui.browser` |
| `beam.js` | Traçado do laser: segmentos, reflexão em cadeia, troca de dono, neutralização por PL, parada em parede/corpo/arena (sem DOM) | `beam` |
| `moves/reflect.js` · `moves/psyshock.js` · `moves/rng.js` · `moves/standard.js` | Definição e efeito do Reflect · do Psyshock · sorteios determinísticos · registro dos Moves padrão (chamado só pelo bootstrap, D2) | `reflect`, `psyshock` |
| `charge.js` · `move-effects.js` | Parâmetros capturados, PL por carga, aceleração de recarga (puro) · manipuladores nomeados de efeitos de Move | `charge` |
| `moves.js` | Registro de movimentos (vazio), validação, `setLoadout`, posicionamento relativo | `moves`, `moves-contract` (contrato M28.4, caracterização), `moves-order` (ordem das entradas) |
| `status.js` | Buffs/debuffs (`applyStatus`, `modifier`, `tickStatuses`) | `moves` |
| `ai.js` · `tactics.js` · `ai-eval.js` · `ai-moves.js` | IA do v6 (paridade) · IA tática · avaliação com sementes fixas · decisões de Moves da IA (mesmas regras do jogador) | `ai`, `ai-eval`, `ai-moves` |
| `scenarios.js` · `compare.js` · `ab-switch.js` · `balance.js` · `training.js` · `movement.js` · `attempts.js` | Cenários repetíveis, comparação A×B, métricas, treino, gravador de movimento, diagnóstico de comandos | `calibration`, `training`, `diagnostics` |
| `presets.js` · `telemetry.js` · `recording.js` · `replay.js` · `graphics.js` | Presets, telemetria/frame data, gravação, replay por estado, perfis gráficos | `calibration`, `sim`, `perf` |

**Apresentação e ferramentas:** `src/view/` (cena, personagens, VFX, `world-view.js`) · `src/ui/` (HUD, ajustador, painéis, entrada, `official.js`+`gamepatch.js` que **leem** `game/src/config.ts`) · `src/workspace/` (persistência, SHA-256, ZIP) · `reports/` (painel externo de relatórios) · `src/main.js` (composição). Testes de navegador: `verify.mjs`, `test/*.browser.mjs`.

**Build:** `build-lib.mjs` (esbuild → IIFE → HTML único; embute CSS e a licença do Three) · `build.mjs` (grava `dist/`) · `dev-server.mjs` (servidor local **opcional**, só para desenvolvimento).

**Documentos de domínio:** `MOVIMENTOS.md` (formato e garantias dos Moves) · `OVERHAUL.md` · `CALIBRACAO.md` · `README.md` · decisões em `docs/MOVES_DECISOES_RODADAS.md` (Moves) e `docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md` (mapa da arena).

## 3. Contratos e acoplamentos (para não quebrar)

1. **Ordem do passo** (`Game.step`): comandos → `updateFighter` → `fireMoveEffects` → `stepPhysics` → `stepWorld` → status/cooldowns → fim das ações. Mudar a ordem muda o resultado.
2. **Acerto único:** toda entidade do mundo passa por `world.applyHit` (mesmas regras do tackle). Não crie outro caminho de dano.
3. **Estado = dados simples** clonáveis por `structuredClone` (`save/load`, replay, cenários). Não guarde funções nem referências a DOM no estado.
4. **Sem aleatoriedade própria** na sim: tudo vem da semente (`Brain`). Evite `Math.random`/`Date.now` no passo.
5. **Jogo oficial é independente:** `prototypes/game` não importa o laboratório. O laboratório só **lê** `game/src/config.ts` (comparação e geração de patch; nunca altera). Portar regras ao jogo exige autorização.
6. **Registro de Moves vazio:** nenhum código do laboratório registra movimentos (garantido por `moves.test.mjs`).

## 4. Riscos conhecidos (documentados, sem alteração)

Detalhes e proposta de tratamento: [PROPOSTA_REFATORACAO_ESTADO_GLOBAL.md](PROPOSTA_REFATORACAO_ESTADO_GLOBAL.md).

- **`C` é global e mutável** — 18 módulos de `sim/` o importam; ajustes de interface o alteram durante a partida. Para os Moves isso exige a regra de **captura de parâmetros na criação** (M28.4).
- **`REGISTRY` de Moves é global** (fora do `Game`) e o `save` guarda ids, não definições.
- **Ciclo de importação** `entity → moves → world → entity` (funciona porque os usos ficam dentro de funções).
- **Dois motores de combate** (laboratório em JS, jogo em TS): a paridade verificada é de **valores de configuração**, não de comportamento.

## 5. Outros protótipos

| Pasta | O que é | Testes |
|---|---|---|
| `prototypes/game/` | Protótipo legado de blocos (TS) | `test.mjs`, `locomotion.test.mjs` (unit) · `verify.mjs` (navegador) |
| `prototypes/studio/` | Animation Studio + Rigging; `proposals/` = propostas A/B/C (aguardam decisão do diretor) | `test/ops`, `test/rigging` (unit) · `verify.mjs`, `test/rigging.browser.mjs` |
| `prototypes/importer/` · `placeholders/` | Importador de modelos · laboratório de blocos | `verify.mjs` (navegador) |
| `scripts/` | `verify-workspace.mjs` (governança do checkout), `check-offline.mjs` (varredura estática) | `check-offline.test.mjs` |

Estado dos testes e do que foi (ou não) executado: [VERIFICACOES.md](VERIFICACOES.md). Linha de base de desempenho da simulação (`npm run measure:sim`): [DESEMPENHO_BASELINE.md](DESEMPENHO_BASELINE.md).
