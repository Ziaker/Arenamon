# Overhaul de colisões — Fase 0 (auditoria) e Fase 1 (penetrações): resultados

> **Estado:** Fase 1 implementada e testada (ver §4); Fases 2–7 pendentes. Este documento registra **evidências medidas**, não intenções. Cada item diz se foi reproduzido, corrigido e por qual teste.
> **Base:** commit `4634ca2` (linha atual do jogo, v1.15.5). **Branch de trabalho:** `fix/colisoes-overhaul` (worktree `.worktrees/colisoes-overhaul`). **PR de referência:** [#100](https://github.com/Ziaker/Arenamon/pull/100) (branch `fix/collision-overhaul-stage1`, criada sobre `main@68eda6c`, não integrada).
> **Escopo e decisões:** nenhuma regra aprovada foi alterada (ver `docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md`). Documento-mestre do plano: `docs/OVERHAUL_COLISOES_AMBIENTE.md` (PR #100).

## 1. O que o PR #100 afirma e o que o `4634ca2` realmente tem

O inventário do PR foi escrito sobre uma `main` anterior. No `4634ca2` já existem, e **não** estão no inventário do PR:

| Já existe no 4634ca2 | Onde |
| --- | --- |
| Camada de mapa com plataformas, obstáculos (caixa/cilindro/pilar) e destrutíveis, drops e respawn | `src/sim/map.js` (`collideMapFighter`, `damageDestructible`) |
| Altura de piso e teto por posição XZ (`getGroundHeight`, `getCeilingHeight`), queda de borda, pouso só na descida | `src/sim/physics.js` |
| Arena circular de raio 50 m (`clampToArena`) | `src/sim/physics.js` |
| Oráculo geométrico de penetração em partidas IA×IA | `test/collision-invariants.test.mjs` |
| Testes de tunelamento, de física 3D e de contato | `test/tunneling.test.mjs`, `test/physics3d.test.mjs`, `test/contact-shape.test.mjs` |

Portanto COL-F e COL-G do PR estão **parcialmente superados**: as fases 4 e 5 não partem do zero, e serão auditadas contra o que existe (não reimplementadas).

## 2. Matriz de defeitos (Fase 0)

Legenda: **R** = reproduzido por teste/script no `4634ca2`; **H** = hipótese ainda não comprovada; **F1** = corrigido na Fase 1.

| ID | Sev. | Defeito | Status | Evidência |
| --- | --- | --- | --- | --- |
| COL-A | P0 | Lutador com o centro **dentro** de caixa de `wall`/`barrier` (ex.: Move cria parede em cima dele) não sai pela face mais próxima: a primeira correção move só `r` rumo ao centro do sólido, deixa penetração e o expulsa pela **ponta** da parede (até 0,8 m ao longo dela) | **R, F1** | `test/collision-solid.test.mjs` (4 casos vermelhos → verdes) |
| COL-H | P1 | Barreira marcada `dead` no meio do passo (ex.: quebrada por tackle num subpasso) continua empurrando outros lutadores até a limpeza | **R, F1** | `collision-solid.test.mjs › destruição` |
| COL-I | P1 | Cilindro/pilar do mapa: lutador exatamente no centro (ou a ≤1 µm) fica **preso dentro**, pois o contato era descartado (`d > 1e-6`) | **R, F1** | `test/collision-map.test.mjs` (6 vermelhos → verdes) |
| COL-J | P1 | Cilindro/pilar do mapa não remove a componente de velocidade que entra no sólido (caixas e paredes de Move removem) | **R, F1** | `collision-map.test.mjs` |
| COL-B | P1 | Corredor mais estreito que o corpo: posição final depende da **ordem** (parede de Move → mapa × mapa → parede): z=0,500 × 0,700 | **R** (Fase 2) | script de reprodução da Fase 0 |
| COL-K | P2 | Corpo é **disco** contra paredes de Move e **quadrado** contra o mapa e contra outros lutadores (`contactShape` legado): quinas se comportam diferente conforme o objeto | **H** | leitura de código |
| COL-D | P1 | Projéteis rápidos × barreiras finas | **H** (Fase 3) | `tunneling.test.mjs` existente cobre parte |
| COL-C/F | P1 | Colisão 3D entre lutadores/volumes | **H** (Fase 4) | a verificar contra `physics3d.test.mjs` |

Hipóteses **refutadas** durante a Fase 0 (registradas para não serem reabertas):

- *"Círculo: normal aponta para o centro quando o lutador está dentro"* (PR #100, COL-A): **não reproduzido** no `4634ca2`; o ramo `c.inside` já usa o vetor centro→lutador e sai corretamente em uma chamada.
- *"A velocidade de locomoção volta a entrar na parede a cada tick"*: **refutada**; `game.js:108` copia a velocidade pós-colisão de volta para `locomotionVelocity`.

## 3. Registro de uso das skills (evidência real)

| Skill (invocada pela ferramenta Skill) | Motivo | Artefato produzido |
| --- | --- | --- |
| `superpowers:using-superpowers`, `superpowers:brainstorming` | Início da sessão (rodada da Responsive V2, depois descartada pelo responsável) | Auditoria do PR #98 |
| `superpowers:systematic-debugging` | Causa raiz antes de corrigir | Leitura de `closestOnShape`/`collideFighter`; reprodução com `scratchpad/repro-p0.mjs` (A1–A5); hipótese da velocidade refutada |
| `superpowers:writing-plans` | Dividir as 7 fases | Tabela de tarefas deste documento |
| `superpowers:test-driven-development` | RED → GREEN | `collision-solid.test.mjs` (9 falhas → 0), `collision-map.test.mjs` (6 falhas) |

Ainda **não** invocadas: `requesting-code-review`, `verification-before-completion`, `finishing-a-development-branch`, `subagent-driven-development`.

## 4. Fase 1 — o que mudou e como foi verificado

**Código** (`fix/colisoes-overhaul`, base `4634ca2`):
- `src/sim/solid-contact.js` (novo, núcleo puro): `solidContact(sólido, centro, raio)` → `{normal, depth, inside}`; menor translação real para disco × caixa orientada/círculo, inclusive com o centro já dentro.
- `src/sim/world.js › collideFighter`: usa o núcleo; ignora entidades `dead`; remove só a componente normal da velocidade (comportamento anterior preservado).
- `src/sim/map.js › collideMapFighter` (cilindro/pilar): usa o núcleo; sem ponto morto no centro; remove a componente normal de `velocity` e de `flight.horizontal` (lançado, exceto salto voluntário), como já faziam as caixas.
- `package.json`: os dois testes novos entram em `test:combat-lab:unit`, `test` e `test:physics`; versão 1.15.8.

**Verificação (execuções reais, 21/10/2026):**

| Verificação | Antes (4634ca2 limpo) | Depois |
| --- | --- | --- |
| `collision-solid.test.mjs` (15 casos) | 9 falhas (RED) | 15/15 |
| `collision-map.test.mjs` (9 casos) | 6 falhas (RED) | 9/9 |
| Suíte `test:combat-lab:unit`, arquivo a arquivo | 76/77 | 77/78 (+1 arquivo novo) |
| Falha comum às duas rodadas | `devserver.test.mjs`: o worktree não tem `node_modules/three` (ambiente, não regressão) | idem |
| Regressão focada: map, physics3d, collision-invariants, tunneling, contact-shape, footstool(-vault), standing-on-platform-hit, nav, nav-ai, moves-spikes, moves-emerging-stone, moves-params, core, locomotion, hitbox-shapes, interruptions | — | todos aprovados |

**Não verificado nesta etapa:** testes de navegador (`test:combat-lab:browser`), `npm run verify`, avaliação visual no `JOGAR_ARENAMON.html`, Reflect/Psyshock em partida real além dos testes unitários.

**Achado sobre o PR #100:** o caso de teste "caixa rotacionada" dele usa um empate exato entre duas faces, cujo sinal depende de ruído de ponto flutuante; foi trocado por um ponto sem empate.

## 5. Revisão independente da Fase 1 (skill `requesting-code-review`, subagente somente leitura)

Veredito do revisor: **sem itens críticos; "com ajustes"**. Tratamento:

| Item do revisor | Decisão |
| --- | --- |
| Pilares passaram a remover a velocidade que entra no sólido (muda alcance de lançado contra pilar; pilar, caixa do mapa e parede de Move têm restituições diferentes) | **Mantido e registrado como decisão de jogo pendente de confirmação.** Fundamento: o requisito da Fase 1 é remover só a componente violadora, e as caixas do mapa já faziam isso. Ricochete contra pilar (R3.12 "quando autorizado") **não** foi implementado. Se o responsável preferir o comportamento anterior (lançado desliza mantendo o módulo), basta remover o bloco de velocidade do ramo cilindro/pilar em `map.js`. |
| `locomotionVelocity` não tratada no pilar | **Sem mudança necessária:** `game.js:108` copia `velocity` para `locomotionVelocity` ao fim de cada passo (lutador sem ação/blend/voo); nas ações a velocidade vem da própria ação. Mesmo tratamento das caixas. |
| Faltavam testes de `breakByTackle`, `isNormalJump`, pilar com altura | **Adicionados** (collision-solid: 17 verificações; collision-map: 12). |
| Centro exato de círculo: normal (1,0) × código antigo (0,1) | **Corrigido** para (0,1), compatível com replays antigos. |
| Alocação de objeto por subpasso no pilar | **Corrigido:** `circleContact(centro, raio, p, r)` sem alocação intermediária. |
| NaN em `p` retorna null sem diagnóstico | Registrado; tratamento de diagnóstico fica para a Fase 7 (ferramentas). |
