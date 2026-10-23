# PROMPT DE TRABALHO — IMPLEMENTAR OS MOVES NOVOS DO ARENAMON (escrito pelo agente para si mesmo)

> **Atualização de 22/10/2026 (auditoria `docs/AUDITORIA_DOCUMENTACAO_2026-10-22.md`):** **execução concluída:** os 13 Moves novos estão na `main` (v1.14.0 em diante). Ficaram pendentes o Body Slam (sem gameplay especificado), a IA/SFX finais e a homologação do responsável (ver `DECISOES_PROVISORIAS_MOVES_NOVOS.md`).

> **Autoria:** agente Claude, a pedido do diretor ("comece a implementar os moves novos, inclusive os genéricos… mas antes prepare um prompt para si").
> **Data:** 21/10/2026. **Branch de trabalho:** `feat/moves-novos` (base: `feat/ferramentas-open-source` v1.13.0 + merge de `origin/main`, que só trouxe documentação).
> **Status:** este prompt é a **minha instrução operacional**. Não é aprovação de gameplay. Onde o documento-fonte diz "pendente", eu **não invento regra**: uso um *padrão provisório documentado*, visível na interface e registrado em `DECISOES_PROVISORIAS_MOVES_NOVOS.md`.

## 0. Missão

Implementar, de forma **jogável, testada e acessível pelo portal**, os Moves abaixo no **Combat Lab** (`prototypes/combat-lab/`, o jogo principal), sem alterar o jogo enquanto o Move não estiver equipado.

| # | Move | Fonte | Natureza |
|---|---|---|---|
| 1 | **Harden** | `docs/MOVES_GENERICOS_CATALOGO.md` §4 | Normal · Status · sem PL |
| 2 | **Second Wind** | `5_MOVES_GENERICOS_PROMPT.md` §7 (branch `docs/5-moves-genericos`) | Normal · Status · sem PL |
| 3 | **Swift** | catálogo §3 | Burst · Projectile · PL1 |
| 4 | **Lunge** | `5_MOVES…` §3 | Burst · Melee · PL1 |
| 5 | **Quick Attack** | catálogo §2 | Burst · Melee · PL1 (vai e volta) |
| 6 | **Feint** | `5_MOVES…` §5 | Burst · Trick · sem PL |
| 7 | **Guard Break** | `5_MOVES…` §4 | Charge · Melee · PL1–3 |
| 8 | **Riposte** | `5_MOVES…` §6 | Normal · Status + Melee · PL1 |
| 9 | **Bounce** | catálogo §6 | Charge · Trick + Melee · PL1–3 |
| 10 | **Spikes** | catálogo §5 | Normal · Field · PL1 |
| 11 | **Sand Wave** | `MUSHROOM_MOVES_DECISOES.md` §6 (SW-D01…) | Burst · Field/Projectile · PL1 + cegueira |
| 12 | **Bullet Punch** | `MUSHROOM_MOVES_DECISOES.md` §2–§5 | Normal (marcador, **não Charge**) · Melee · PL2 |
| 13 | **Emerging Stone** | `EMERGING_STONE_PROMPT_IMPLEMENTACAO.md` + ES-D01…ES-D103 | Normal · Projectile + Field · cronologia C |
| — | **Body Slam** | `MUSHROOM_MOVES_DECISOES.md` §1 | **Nome aprovado, gameplay NÃO especificado → não implementar** (ver §8) |

A ordem acima é a **ordem de execução** (dependências crescentes: status → projétil → dash melee → charge → trick/campo → entidades complexas).

## 1. Hierarquia de fontes e regras invioláveis

1. Ler antes de cada Move a ficha na fonte e `docs/REGRAS_CRIACAO_MOVES.md` (§2 ficha, §7 cobrança, §19 verificações, §20/§31 modelo). **Precedência:** decisão expressa e posterior do diretor > regra específica do Move > regras gerais > contratos técnicos > propostas. Código existente não é prova de aprovação.
2. **Cobrança universal (não perguntar de novo):** Normal/Burst → stamina e cooldown **após confirmar alvo/local e soltar o botão, antes do disparo**; Charge → **ao ativar a carga**. Sem reembolso em interrupção após a cobrança, salvo falha por falta de espaço já prevista (Reflect/Psyshock).
3. **Parâmetros capturados (M28.4):** sliders valem para usos **futuros**; entidades/execuções ativas guardam `captured`.
4. **Paridade:** nada muda no jogo com o Move não equipado (loadouts continuam vazios por padrão; equipar é opt-in). Teste de regressão obrigatório por Move.
5. **Geometria 3D real:** colisão contínua, apoio, tetos, plataformas; VFX nunca define colisão. Eventos reais disparam VFX/SFX (sem dupla emissão).
6. **Determinismo:** passo de 120 Hz, `structuredClone`, sem `Math.random`/DOM na sim; janelas em passos inteiros `[início, fim)`; quantizar durações (ex.: 0,22 s = 26,4 passos → declarar o arredondamento).
7. **Controle em Ajustes/Moves:** todo parâmetro importante tem slider/seletor visível com nome, unidade, padrão, mínimo, máximo e passo. **Não inventar ranges "aprovados":** onde o documento não traz faixa, o slider usa faixa **provisória** marcada como tal.
8. **Não tocar** em Animation Studio, modelos, Tackle/Dodge/Guard aprovados, câmera ZZZ, Reflect/Psyshock, a menos que seja adaptação compartilhada comprovada e coberta por testes de regressão.
9. **Pendências materiais** (GM-P01…P15, QA-retorno, Harden × Fields, Bounce aéreo, Spikes × Sturdy, ES-* restantes): implementar o **padrão provisório mais conservador**, expor a escolha (toggle/slider) e registrar em `DECISOES_PROVISORIAS_MOVES_NOVOS.md` com ID `MV-P##`, fonte, valor e como trocar. **Nunca** afirmar homologação.
10. Entrega honesta: "compila" ≠ "funciona". Relatar números reais de teste e distinguir não executado de aprovado. Nada vai para `main`.

## 2. Fatos da infraestrutura (auditados em 21/10/2026 — reconfirmar no código antes de usar)

- **Registro:** `src/sim/moves.js` (`registerMove`, validação, `setLoadout`, `placeRelative`), `src/sim/moves/standard.js` (`registerStandardMoves`, `STANDARD_MOVE_IDS` = reflect, psyshock). **Só o bootstrap do laboratório (`main.js`) e testes chamam `registerStandardMoves`** — existe teste de arquitetura em `test/moves.test.mjs` que **proíbe** chamadas em `src/` fora do bootstrap (aprendi isso na Fase 5).
- **Schema `MoveDef`:** `duration`, `cost`, `cooldown`, `cancelAfter`, `cancelFrom`, `fromGuard`, `invulnerable [t0,t1]`, `aim` (`target|facing|input`), `motion` (`none|root|dash`), `timeline[{at, spawn|status|hit|effect}]`, `charge{max,…}`, `cooldownBoost`. `category` histórica ≠ categorias oficiais (Normal/Burst/Charge).
- **Execução:** `controller.js` — `pressSkill` (borda do botão `cmd.skill`), `movePermission`, `startMove` (**cobra stamina e cooldown ao iniciar a ação**, `f.action = {kind:'move', …}`), `updateMove` (dash suave + timeline → `f.moveFx`), `chargePermission/startCharge/stepCharge/cancelCharge` (Charge: `cmd.skillHeld[slot]`, parâmetros congelados). `game.fireMoveEffects` roda `spawn/status/hit/effect`; efeitos com código próprio via `registerEffect(nome, fn)` em `move-effects.js` (`fn(game, f, def, fx) → {ok:false, reason}` desfaz custo).
- **Mundo/entidades:** `world.js` (`projectile` com `homing`, `barrier`, `wall`, `area`, `beam`; `applyHit` único; Clash/Counter de PL por entidades `clashable`; subpassos de contato), `status.js` (atributos `speed, attack, damageTaken, staminaRegen, staminaCost, knockbackTaken, cooldownRate`; flags `rooted, silenced, disarmed, stunned`; **não há atributo `defense`** — o "+30% Defesa" de Harden precisa de decisão de modelagem, ver MV-P01), `passive-engine.js` (Sturdy etc.).
- **Combate:** `combat.js` (`resolveHit`, `tackleConnects`, janelas `combatWindows`, `hitShapeOf` novo), `physics.js` (contato circular `test.contactShape=1`, subpassos), `map.js` (sólidos, plataformas, `mountTolerance`), `moves/rng.js` (sorteio determinístico).
- **UI:** `ui/moves-panel.js` (equipar, emissores técnicos, sliders), `ui/moves-hud.js` + `sim/move-state.js` (estado dos slots), `ui/tuning*.js` (Ajustes), cenários em `sim/scenarios-moves.js`. **IA:** `sim/ai-moves.js` usa só Moves equipados, mesmas permissões do jogador.
- **Testes de referência:** `test/moves.test.mjs`, `charge.test.mjs`, `reflect.test.mjs`, `psyshock.test.mjs`, `moves-params.test.mjs`, `ai-moves.test.mjs`, `moves-ui.test.mjs` e os `*.browser.mjs`. **Falha pré-existente:** `moves-ui.browser.mjs` 30/31 ("Tackle × pedra: Clash em PL1") também no commit-base — não é minha.
- **Infra nova desta sessão a reutilizar:** oráculo de penetração (`physics-poc/poc-metrics.js`), varredura `collision-invariants.test.mjs`, `hitbox espacial` (`extras.hitbox`), interpolação de desenho, nav Yuka (`src/nav`) e post-processing opcionais.

## 3. Lacunas de infraestrutura a construir (Fase 0, antes do primeiro Move)

Cada item: módulo pequeno, testado, **sem efeito quando não usado**.

| Lacuna | Necessário para | Plano |
|---|---|---|
| **Cast com mira por marcador** (segurar para ajustar, soltar confirma; Normal, não Charge) | Spikes (local), Bullet Punch, Emerging Stone, Sand Wave (direção) | `def.aimMode:'marker'` + estado `f.aimCast` (marcador mundial, alcance 3D, validade, vermelho); cobrança ao confirmar/soltar; cancelar por defesa conforme ficha |
| **Cronologia C** (cast na pressão; dispara com cast concluído **e** botão solto) | Emerging Stone | variante de `aimMode` com `castOnPress` |
| **Ausência física** (corpo/colisor/alvo inexistentes) | Bullet Punch | flag de estado `f.absent` respeitada por física, alvo, colisão, entidades e IA |
| **Retorno à origem sem segundo hit** | Quick Attack | fase `return` da ação, sem hitbox |
| **Reação a hit recebido na janela** (anular dano/knockback + disparar contra-golpe) | Riposte | gancho em `resolveHit`/`applyHit` consultado só se o alvo tem `f.riposte` ativo |
| **Cancelar ação em curso por Move** | Feint | permissão `cancelOffensive` no controlador, por janela |
| **Modificadores de defesa e de knockback recebido** | Harden | atributo `defense` no `status.js` **ou** equivalência documentada (MV-P01); `knockbackTaken:0` já existe |
| **Campo com suporte** (entidade `area/trap` que checa apoio e some sem suporte) | Spikes, Emerging Stone | entidade `trap` + `support` com reavaliação por passo |
| **Entidade sólida progressiva** (rocha) | Emerging Stone | entidade `solidBlock` com colisor crescente, HP, empilhamento, propriedade |
| **Cegueira** (status + fog só na câmera do atingido + lock-on 10 m + IA) | Sand Wave | status `blind` + regras de seleção de alvo + efeito de câmera |
| **Painel de Moves novos** | todos | aba Moves lista os novos, equipa jogador/vermelho, sliders por Move, emissores/prévias sem dano real |

## 4. Protocolo por Move (repetir 13 vezes)

1. **Ficha:** preencher o modelo §20/§31 de `REGRAS_CRIACAO_MOVES.md` em `docs/moves-nao-iniciados/fichas/<id>.md` (estado: proposto/aprovado/implementado/testado/homologado **por detalhe**).
2. **Rastreabilidade:** tabela regra → fonte → ID → status; pendências viram `MV-P##`.
3. **Código:** `src/sim/moves/<id>.js` (def + efeito + estado), registro em `standard.js`/lista nova `NEW_MOVE_IDS` (**não** altera `STANDARD_MOVE_IDS` de Reflect/Psyshock), parâmetros em `C.world.<id>` com `captured`.
4. **Testes** (`test/moves-<id>.test.mjs`): entrada/cobrança/cooldown, interrupções, acerto/erro, defesa parcial/perfeita, i-frames, Clash/Counter quando elegível, knockback H/V incluindo zeros, geometria (parede, plataforma, teto, apoio), captured vs slider, save/load/replay, determinismo, **paridade sem equipar**.
5. **Interface:** slider/seletor de cada parâmetro, HUD do slot, motivo de recusa, prévia visual.
6. **VFX/SFX:** por evento real, com família `vfx-solido`/quarks quando couber; `noFlash`/`reduceMotion` respeitados.
7. **IA mínima:** usa o Move só quando equipado e quando o motor aceitaria; sem vantagem de informação.
8. **Cenário rápido** em Cenários (sem terminal).
9. **Commit** rastreável por Move (`feat(moves): <Nome> …`), testes verdes antes do commit.

## 5. Padrões provisórios já decididos (para não parar por perguntas)

| ID | Pendência | Padrão provisório |
|---|---|---|
| MV-P01 | "+30% Defesa" (Harden) sem atributo `defense` | modelar como redução proporcional do dano recebido equivalente a +30% de Defesa na fórmula existente; documentar a conta e expor o fator |
| MV-P02 | Quick Attack: origem inacessível/interrompido | voltar ao ponto físico válido mais próximo da origem; interrupção deixa o corpo onde estiver, sem teleporte através de sólido |
| MV-P03 | Harden × empurrão contínuo de Fields | **não** nega (só knockback ofensivo discreto de ataque/projétil); toggle exposto |
| MV-P04 | Bounce em estados aéreos | só no chão (como Charge atual); toggle |
| MV-P05 | Spikes: perda de suporte | a armadilha some sem efeito; dano ignora Sturdy? → **trata como dano comum**, toggle |
| MV-P06 | Guard Break: guard stun 0,50 s; defesa perfeita anula dano e guard stun; Harden não anula guard stun; sem defesa ativa = dano + knockback leve | conforme proposta do documento, sliders |
| MV-P07 | Riposte: multi-hit consome a janela no 1º hit; janela 0,13–0,30 s; não anula grab nem Guard Break | conforme proposta |
| MV-P08 | Feint: ações canceláveis = Tackle, Lunge, Guard Break (pré-soltura); fora da janela executa e pune | conforme proposta |
| MV-P09 | Second Wind: "+40%/s" = +40% da **stamina máxima por segundo**; custo −25% em esquiva/sprint | fórmula explícita no slider |
| MV-P10 | Janelas dos 5 genéricos (g→passos) | remapeamento proporcional recalculado (o doc fonte erra a conversão — ver `REGRAS_CRIACAO_MOVES.md` §22.1), soma de fases validada |

Se surgir contradição **insolúvel** que exija regra nova de gameplay, parar **só aquele detalhe**, registrar `MV-P##` pendente com a pergunta exata e seguir com os demais Moves.

## 6. Critérios de aceitação globais

- `npm run build:combat-lab` e `npm run typecheck` limpos; suíte unitária inteira verde; novos testes verdes; navegador: os existentes continuam (exceto a falha pré-existente de `moves-ui`).
- Cada Move: equipado por `game.setLoadout`/aba Moves, executável pelo teclado/gamepad, com HUD, diagnóstico de recusa, cenário rápido e prévia.
- **Não equipado = comportamento idêntico** (teste de hash de partida com e sem registro).
- Versão do `package.json` sobe a cada entrega (memória do projeto); documentação `docs/` e portais (`ABRIR_`, `HTMLS_`, `TESTES_ARENAMON.html`) atualizados na mesma entrega.
- Relatório final: matriz **Move × regra × teste × evidência**, lista de `MV-P##` provisórios, o que **não** foi feito e por quê, hash do commit publicado em `feat/moves-novos`.

## 7. Ordem e marcos

1. **M0** — Infra (§3) mínima para os Moves de Status: atributo `defense`/equivalente, painel de Moves novos, `NEW_MOVE_IDS`, teste de paridade.
2. **M1** Harden · Second Wind → **M2** Swift → **M3** Lunge · Quick Attack → **M4** Guard Break · Feint · Riposte → **M5** Bounce → **M6** Spikes + campo com suporte → **M7** Sand Wave (+ cegueira) → **M8** Bullet Punch (+ ausência física) → **M9** Emerging Stone.
3. Cada marco termina com commit, testes e nota em `DECISOES_PROVISORIAS_MOVES_NOVOS.md`. Se o orçamento acabar no meio, o estado deve estar **consistente e honesto**: o que não foi feito aparece como "não iniciado" no inventário, nunca como pronto.

## 8. Body Slam e limites de escopo

- **Body Slam** não tem gameplay especificado (`MUSHROOM_MOVES_DECISOES.md` §1). Implementar seria inventar regra: **fica fora**, com a lista de perguntas mínimas registrada no inventário (categoria, tipo, PL, custo, knockback H/V, geometria, VFX).
- Animações de personagem/rigging **não** são escopo (o diretor não pediu); os Moves usam o bloco `move_<slot>` existente (clipe do Tackle como fallback) + VFX procedurais.
- Mushroom ↔ Mosh: os Moves são equipáveis por qualquer lutador do laboratório; **não** renomear personagem nem assets.

## 9. Fim do prompt

Executar com disciplina: **ler → ficha → código → teste → interface → commit**, um Move por vez. Não perguntar de novo sobre cobrança de recursos. Não simplificar física 3D. Não declarar pronto sem teste e evidência.
