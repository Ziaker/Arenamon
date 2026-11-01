# Melee — G0 (baseline), G1 (MotionState + IASA observável) e G2 (eventos visuais do Anim)

Plano: `docs/ARENAMON_PLANO_MOTOR_ANIMACOES_MELEE_AUDITADO_v1_2.docx` (a v1.2 prevalece sobre a v1.1). Versão do jogo: **1.49.26**. Branch `feat/melee-g1`. G0/G1 entregues em 1.49.25 (`5efa89c7`); G2 em 1.49.26.

## G0 — o que o código real mostra (sem mudar comportamento)

| Requisito do plano | API que já existe | Lacuna |
|---|---|---|
| Registro de estados (MotionState) | Conjuntos em `view/characters.js`: `ACTION_KEYS`, `COMBAT_KEYS`, `LOCOMOTION`, `TIMED`, `ONE_SHOT`, `TRANSIENT`, `MOVE_KEYS` | Não havia descritor nem tipo/autoridade por estado |
| Anim: clipe, relógio, loop, conclusão residual | `Character.update/enter/blend`, `clip-scheduler.js`, `loop-seam.js`, `visual-epilogue.js` (`tryStartEpilogue`, `stepEpilogue`, `resumeEpilogue`, `f.__visualEpilogue`) | Motivo de transição só em texto português; sem identidade da execução de destino |
| IASA: aceito × recusado × bufferizado | Aceitação é de `sim/controller/ctrl-update.js` (`startAction`, `inputBuffer`) | Nada expunha o resultado autoritativo por comando |
| Andar/correr cortam a conclusão visual | `moveCancels` em `visual-epilogue.js` (> 0,3 m/s) e `C.display.animation.moveCancels` | Nenhuma (preservado) |
| Telemetria | `Character.log` (400 entradas) | A troca de estado sobre o **mesmo clipe** não gerava entrada (ex.: Eggo, onde tackle e idle usam o mesmo clipe) |

Falhas **preexistentes** (iguais com e sem as mudanças do G1, conferido restaurando os dois arquivos do `HEAD`): `animation-execution-report.test.mjs` (9 execuções «cortadas indevidamente») e `animation-runtime.test.mjs` (`jump_fall` em reserva). Não foram tocadas.

Risco real confirmado: `verify:workspace` recusa o diretório `.worktrees/` (só aceita a raiz oficial); o trabalho foi feito no worktree interno permitido pelo `AGENTS.md`.

## G1 — o que foi implementado

- `src/view/motion-state.js` (novo, só leitura):
  - `motionStateOf(key)` / `listMotionStates()`: tipo (`action`, `reaction`, `locomotion`, `move-phase`, …), autoridade (`simulation` ou `presentation`) e temporização, **derivados dos conjuntos que o Character já usa**. Sem durações, hitboxes nem janelas.
  - `reasonCodeOf(evento)`: motivos estáveis (`action-accepted`, `locomotion-cancel`, `epilogue-start`, `epilogue-end-natural`, `combat-reaction`…).
  - `snapshotBefore` + `commandOutcome`: comparam o lutador antes/depois do passo do Game e dizem se cada comando foi **aceito**, **bufferizado** ou **recusado**. Nunca aceita nada e nunca escreve no lutador.
- `view/visual-epilogue.js`: todo evento do log ganha `reasonCode`, `motion` (descritor do estado de destino) e `execTo` (identidade da execução de destino, ex. `tackle#1`).
- `view/characters.js`: a troca de estado sobre o mesmo clipe agora também entra no log (`sameClip: true`, nunca marcada como interrupção).

## Comportamento anterior × posterior

| Comportamento | Antes | Depois |
|---|---|---|
| Simulação (save do Game) | — | idêntica com e sem observador (Eggo, Wookada, Cogumelo) |
| Andar/correr cortam a conclusão visual | v1.49.19 | igual; agora com motivo `locomotion-cancel` |
| Interruptor «Andar e correr cortam…» | existe | igual |
| Comando recusado/bufferizado durante a conclusão visual | não cortava | igual; agora observável |
| Log de transições | texto + marcas | mesmos campos + `reasonCode`, `motion`, `execTo`; trocas sobre o mesmo clipe passam a aparecer |

## Testes

- Novo: `prototypes/combat-lab/test/motion-state-g1.test.mjs` (18 verificações; Eggo, Wookada e Cogumelo reais).
- Rodados e verdes: `animation-epilogue`, `-casos`, `-contract`, `-persist`, `clip-fidelity`, `animation-variants`, `animation-loop-controls`, `animation-viewport-vs-jogo`; `tsc` do combat-lab (0 erros).
- Não rodados (regra do projeto): `rapido:tudo`, `verify`, bateria de navegador, benchmarks.

## O que falta para fechar o G1 e iniciar o G2

- Hoje o observador roda só nos testes; ligá-lo ao app (painel de telemetria) é decisão do G2/G3.
- Bufferização é detectada por `inputBuffer`; ações concorrentes no mesmo tick (jogador × CPU) não têm teste próprio.
- Meteor Slam / Riposte × `combatPriority` já têm teste (`clash-priority-noclash`); nada novo neste gate.
- G2: integrar callbacks Anim ao scheduler/epílogo e eventos visuais tipados, com save/load e replay.

## G2 — eventos visuais tipados do Anim (v1.49.26)

Integração com o que já existia: nada foi criado fora do `Character.log` e do `visual-epilogue.js`. Os eventos são **derivados do mesmo log** (`pushLog` é o único funil), então scheduler, epílogo e telemetria continuam uma só fonte.

- `motion-state.js`: `animEventsOf(entrada do log)` e `emitAnimEvents(character, entrada)`.
- Tipos: `state-enter`, `state-exit`, `epilogue-start`, `epilogue-end` (conclusão natural) e `epilogue-interrupted` (com `cause` = código do motivo: `locomotion-cancel`, `action-accepted`, `combat-reaction`…).
- Identidade: `eventId = <executionId>#<tipo>` (ex.: `tackle#1#epilogue-end`). Cada evento sai no máximo uma vez por Character. Consumo: `character.animEvents` (lista) e `character.onAnimEvent(e)` (ouvinte).
- Isolamento: a prévia do Editor/Move não gera evento. Comando recusado ou bufferizado não gera evento.
- Save/load: `resumeEpilogue` restaura em silêncio, então carregar uma partida no meio do epílogo **não repete** `state-enter` nem `epilogue-start` e a conclusão sai uma vez, no mesmo tick da partida original. `f.__visualEpilogue`, variante e clipe continuam como estavam.
- Sem efeito mecânico: o save do Game é idêntico com e sem ouvinte.

Teste novo `prototypes/combat-lab/test/anim-events-g2.test.mjs` (30 verificações, Eggo, Wookada e Cogumelo reais): ciclo completo da conclusão natural, interrupção por locomoção e por esquiva aceita, comando não aceito, prévia isolada, recorte, reverso e recorte+reverso com um único `epilogue-end`, save/load no meio do epílogo e replay determinístico.

Rodados e verdes junto: `motion-state-g1`, `animation-epilogue` (+`-casos`, `-contract`, `-persist`), `clip-fidelity`, `animation-variants`, `animation-loop-controls`, `animation-viewport-vs-jogo`; `tsc` do combat-lab com 0 erros.

**Não feito no G2 (de propósito):**
- Os 15 controles de loopagem avançada não ganharam teste novo de evento (o de `animation-loop-controls` continua verde); laço autoral sem término fica fora da conclusão visual, como já era.
- Os campos do Editor ainda inativos (`minTime`, `autoNext`, `repeats`, `exitCondition`, `priority`) **não foram ativados**: cada um exige especificação própria e decisão registrada.
- Nenhum consumidor visual (VFX, áudio, câmera) foi ligado aos eventos ainda; o contrato está pronto para isso.
- Navegador/app real, `rapido:tudo`, `verify` e benchmarks não foram rodados.

**Para o G3:** conectar o Editor ao contrato (mostrar execução, motivo e eventos), provar no navegador com Wookada e Cogumelo e decidir quais campos pendentes ativar.
