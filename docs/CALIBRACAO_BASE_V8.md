# Base de calibração v8 (decisão do responsável, 22/10/2026)

O arquivo `arenamon-calibracao-v8 (1).json` («arenamon-tuning» v9, exportado do laboratório em 21/10/2026) e o `config-ts-proposta.patch` passam a ser a **base do jogo**: o que o laboratório abre por padrão e o que `prototypes/game/src/config.ts` traz.

## Onde está
- **Laboratório (padrão ao abrir, «Ajustes padrão» e testes):** `prototypes/combat-lab/src/sim/calibration-base.js` — 158 linhas `[caminho, valor novo, valor anterior]`, aplicadas por `defaults()` por cima dos valores de fábrica (`factoryDefaults()`). **Reverter uma linha = trocar o valor novo pelo anterior.**
- **Jogo (`prototypes/game/src/config.ts`):** o patch aplicado como veio (perfis, locomoção, câmera, stamina, recoil/guard stun, `arenaHalf` 16, velocidade 4,8). Os tempos aprovados (esquiva 0,4 s, i-frames 0,2 s, `blend` 0,1) **não** mudam: o patch só leva a calibração provisória.

## O que mudou no padrão (resumo; lista completa em `calibration-base.js`)
Stamina máx. 7,1 e regeneração 1,25 s · gravidade de lançamento 39,6 (lançamentos bem mais rápidos) · Tackle 1,352 s / 1,9 m · esquiva 0,5 s / 2,05 m (vault até 2,2 m) · recuo e guard stun 0,514 s · recuperação de pouso 0,629 s · locomoção (aceleração 40, freio 34, reversão 62, giro mais rápido) · velocidades dos perfis · câmera (distância máx. 24, `closeRange` 1,3) · salto 2,3 m com controle aéreo 0,7 · sprint mais forte · VFX/animação/HUD do export · **IA padrão = revisão 1** · **Riposte** (recarga 2 s, cast 1 s, janela 0–0,51 s, knockback 16,6/5, alcance 2,9) e **Bullet Punch** (cast 0,2 s, alcance de busca 8 m, até 18 m) como o usuário deixou no laboratório.

> Atenção: os 13 valores de Riposte/Bullet Punch **não** estavam em `changedFromLabDefaults` do arquivo (esse bug de exportação foi corrigido, abaixo); vieram de `values`. Estão marcados na tabela com a observação «fora de changedFromLabDefaults».

## Testes
- Os testes que caracterizam a **mecânica nos valores de fábrica** foram fixados em `factoryDefaults()` (cabeçalho em cada arquivo); a base é coberta por `calibration-base.test.mjs` (tabela × fábrica, valores-chave, `config.ts`, 6 partidas IA × IA sem NaN e os 15 cenários de colisão) e pelos testes de colisão/ambiente, que rodam na base.
- Ajustes de teste causados pela base (cada um explicado no arquivo): cenários do Meteor Slam com o azul a 3,75 m; lançamentos dos cenários/testes de colisão com `vy` e alcance calculados para a gravidade nova; `collision-invariants` classifica arco de vault como «no ar» e tolera sobreposição de **1 passo** no pouso do salto por cima do rival (44 eventos em 24 partidas, todos de 1 passo).

## Regras de combate pedidas junto (mesma data)
1. **Aceleração manual de recarga em todos os Moves** (M5.8/M5.9): apertar o botão do Move em recarga gasta 0,5 de stamina por 1 s e encurta a recarga, sem iniciar o Move; segurar não repete; sem stamina é negado. Antes só Reflect e Psyshock tinham `cooldownBoost`; os 13 Moves novos negavam o toque. `cooldownBoost: false` desliga num Move. Teste: `moves-cooldown-boost` (33).
2. **Exportação de parâmetros de ações/Moves:** `changedFromLabDefaults` agora inclui todo parâmetro numérico alterado, também os sem slider (`world.*`), e a importação os aplica de volta (`src/ui/tuning-io.js`; testes `tuning-io` e `tuning-export.browser`).
3. **Contra-golpe do Riposte:** tratado como **PL 4** (vence qualquer PL) e **nunca faz clash**.
4. **Meteor Slam:** **PL 2**, **nunca faz clash**, a **hitbox só existe com o personagem no chão** (preparação e mergulho não acertam; o impacto vem no pouso); bloqueado, arrasta o defensor para trás (`slamBlockPushDistance`, 5 m no padrão). Teste: `slam-riposte-rules` (6, com verificação de que cada regra falha sem a sua implementação).

## Decisões e riscos para você
- **IA padrão virou a revisão 1** (o export tinha `revision: 1`). Se não era a intenção, é a linha `extras.ai.revision` da tabela.
- **Faixa de montagem (resíduo conhecido, agora mais visível):** com salto de 2,3 m, subir em caixas de 2,2 m é rotina; ao andar para fora da borda do topo, o corpo atravessa a lateral por até ~36 cm e é ejetado de lado. Decisão pendente (dar apoio até a borda inteira do corpo ou bloquear a lateral nessa faixa).
- Não verificado: sensação de jogo com a base (não joguei); GPU real; `npm run verify` na pasta oficial.

## 2ª exportação (22/10/2026 12:12 -03, laboratório v1.15.7)
O arquivo `arenamon-calibracao-v8.json` enviado depois sobrescreve a base anterior: 34 linhas tiveram o valor trocado e 26 foram acrescentadas (184 no total; **180** desde a rodada de 22/10 à tarde, que retirou as 4 linhas do marcador do Bullet Punch — `searchRadius`, `startDistance`, `maxDistance`, `growTime` — porque o marcador deixou de existir; o valor `reach` 6 m segue valendo e agora é o alcance do Move), por exemplo stamina máx. **11,1** e regeneração **4 s**, Tackle **0,65 s / 1,55 m**, `recoilFraction` 0,8, janela da defesa perfeita 0,34 s, salto 2,4 m com controle aéreo 0,85, footstool com rebote 11,1, VFX de impacto (`vfx.hit.*`), Riposte (custo 1,55, recarga 8 s, janela 0–0,59 s, knockback 16,8/6,6, alcance 3,8) e Bullet Punch (alcance 6, `impactMult` 2,6). Conferido por script: `defaults()` = JSON em todos os valores numéricos. O `config.ts` do jogo recebeu `recoilFraction .8`, `perfect .34`, `staminaMax 11.1` e `regenTime 4`. Os 4 slots estão em `1 2 3 4` (`Digit1`–`Digit4`) como no export.

## 3ª exportação (28/10/2026 19:36 -03, laboratório v1.43) — passa a ser o padrão
Pedido do responsável: «faça ser as configs principais». O arquivo `arenamon-calibracao-v8.json` («arenamon-tuning» v9) foi guardado sem alteração em `docs/calibracao/arenamon-calibracao-v8-2026-10-28.json` e a tabela de `calibration-base.js` foi regenerada por `node scripts/gen-calibration-base.mjs` (trilha de auditoria: compara cada folha do JSON com os valores de fábrica; linha = [caminho, valor do JSON, valor de fábrica]).

**Contagem:** 180 → 168 linhas · 12 com valor trocado · 4 acrescentadas · 16 retiradas (o JSON voltou ao valor de fábrica ou ao valor que o código já tem) · 0 caminhos ignorados.

| Parâmetro | Base de 22/10 | Base de 28/10 | Fábrica |
|---|---|---|---|
| `rules.staminaMax` | 11,1 | **23,1** | 3 |
| `rules.regenTime` | 4 | **1,4** | 5 |
| `rules.recoil` | 0,514 | **0,61** | 0,3 |
| `rules.guardStun` | 0,514 | **0,505** | 0,2 |
| `rules.landingRecovery` | 0,629 | **0,467** | 0,19 |
| `rules.chargeTackleSpeed2 / 3` | 1,5 / 2,2 | **1,94 / 2,71** | 1,25 / 1,6 |
| `rules.tackleFriction1 / 3` | 1,8 / 1,8 | **1,1 / 1** | 0 / 0 |
| `actions.dodge.duration` | 0,5 | **0,657** | 0,4 |
| `actions.tackle.duration` | 0,65 | **1,143** | 0,4 |
| `extras.visual.smear.smearOpacity` | 1 | **0,75** | 0,85 |
| acrescentadas | — | `rules.chargeTackleMove` 0,9 · `rules.regenDelay` 0 · `smearColorMode` 1 · `dodgeSquashScale` 1,3 | — |

**Testes:** os testes de mecânica escritos contra a base de 22/10 (`moves-ui`, `moves-ab-sensitivity`, `move-editor`, `f5-vfx-dispatch` e o A/B da matriz F7) passaram a usar uma cópia congelada dessa base (`test/fixtures/calibration-base-2026-10-22.mjs` via `test/base-anterior.mjs`); ela não é usada pelo jogo. O padrão atual é coberto por `calibration-base.test.mjs` e `env-integration.test.mjs`. O cenário de colisão com destrutível usa distância derivada do alcance do Tackle (antes `z = 3` fixo).

**Pendências desta base (não resolvidas):**
- `env-integration.test.mjs` falha com a nova base: na semente 12 um lutador no estado «pushed» fica 2 ticks «afundado» em `rock_1002` (mapa denso 8 + 8). É um resíduo de colisão real a investigar.
- `f5-vfx-dispatch` falha com a nova base no modo three.quarks LIGADO (desligado por padrão): o impacto sai do VFX legado e do quarks ao mesmo tempo. Com a base de 22/10 não ocorre.
- Não verificado: sensação de jogo com a nova base; GPU real.
