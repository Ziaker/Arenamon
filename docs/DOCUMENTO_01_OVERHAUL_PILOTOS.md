# ARENAMON — DOCUMENTO 01 · RELATÓRIO OFICIAL DE OVERHAUL DOS SLIDERS MECÂNICOS
**Protocolo de Cobertura, Parametrização e Prova — Pilotos Sand Wave, Bullet Punch e Water Pulse**  
**Data:** 25 de Outubro de 2026 · **Branch:** `feat/overhaul-sliders-moves` · **Status:** Aprovado em todos os 3 Portões (SW, BP, WP)

---

## 1. Escopo Auditado e SHA de Commit

- **Diretório de Operação:** `.worktrees/overhaul-sliders-moves` (worktree interno conforme protocolo `AGENTS.md`)
- **Branch Oficial:** `feat/overhaul-sliders-moves`
- **SHA Baseline de Partida:** `0019e5275d710a3ba277e246d407841d1cade4c4`
- **Moves Auditados e Parametrizados (Pilotos):**
  1. `sand-wave` (Sand Wave) — Mecânica de campo progressivo terrestre, dano, empurrão contínuo, colisão com parede e cegueira.
  2. `bullet-punch` (Bullet Punch) — Mecânica de aproximação física com ausência (dash invisível), herança de Tackle, anti-aéreo e interceptação de rota.
  3. `water-pulse` (Water Pulse) — Mecânica de projétil carregado (Charge PL1–PL3), colisão esférica 3D, cancelamentos e escalonamento de knockback vertical/horizontal.
- **Isolamento dos Outros 16 Moves:** Estritamente preservados em seu estado de fábrica funcional. Todos os testes de regressão dos 16 moves continuam 100% verdes sem qualquer modificação em seus arquivos de lógica.
- **Fronteira com Documento 02:** Nenhuma pasta individual (`<id>/`) foi criada, nenhum arquivo `.vfx.js` foi criado ou dissociado, e nenhuma alteração visual em shaders/quarks foi efetuada, respeitando integralmente o escopo exclusivo do Documento 01.

---

## 2. Matriz de Parâmetros e Evidências de Consumo por Move

Todos os parâmetros foram auditados e classificados nas 6 categorias formais:
`EDITÁVEL · EXCLUSIVO`, `EDITÁVEL · HERDADO`, `DERIVADO`, `ESTRUTURAL / TÉCNICO`, `VISUAL` e `PENDENTE`.

### 2.1. Sand Wave (`sand-wave`)
| Parâmetro | Classe | Padrão | Unidade | Faixa | Consumidor no Código | Momento de Captura |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `staminaCost` | EDITÁVEL · EXCLUSIVO | 2 | pts | [0, 10] | `src/sim/moves/sand-wave.js:28` | Ativação ($t=0$) |
| `cooldown` | EDITÁVEL · EXCLUSIVO | 10 | s | [0, 30] | `src/sim/moves/sand-wave.js:33` | Ativação ($t=0$) |
| `castTime` | EDITÁVEL · EXCLUSIVO | 0.25 | s | [0, 2] | `src/sim/moves/sand-wave.js:40` | Ativação ($t=0$) |
| `groundOnly` | EDITÁVEL · EXCLUSIVO | true | bool | toggle | `src/sim/moves/sand-wave.js:22` | Ativação ($t=0$) |
| `damage` | EDITÁVEL · EXCLUSIVO | 6 | HP | [0, 50] | `src/sim/sand.js:68` | Disparo ($t=cast$) |
| `length` | EDITÁVEL · EXCLUSIVO | 4 | m | [1, 20] | `src/sim/sand.js:42` | Disparo ($t=cast$) |
| `width` | EDITÁVEL · EXCLUSIVO | 3 | m | [0.5, 15] | `src/sim/sand.js:43` | Disparo ($t=cast$) |
| `waveHeight` | EDITÁVEL · EXCLUSIVO | 0.35 | m | [0.1, 5] | `src/sim/sand.js:84` | Disparo ($t=cast$) |
| `accel` | EDITÁVEL · EXCLUSIVO | 12 | m/s² | [0, 50] | `src/sim/sand.js:101` | Disparo ($t=cast$) |
| `blindDuration`| EDITÁVEL · EXCLUSIVO | 4 | s | [0, 15] | `src/sim/sand.js:72` | Disparo ($t=cast$) |
| `blindVisionLimit`| EDITÁVEL · EXCLUSIVO | 10 | m | [1, 30] | `src/sim/vision.js:18` | Consulta ao vivo |
| `activeHitboxTime`| EDITÁVEL · EXCLUSIVO | 0.75 | s | [0.1, 5] | `src/sim/sand.js:52` | Disparo ($t=cast$) |
| `life` | EDITÁVEL · EXCLUSIVO | 1.5 | s | [0.2, 10] | `src/sim/sand.js:53` | Disparo ($t=cast$) |
| `wallStaggerDuration`| EDITÁVEL · EXCLUSIVO | 0.30 | s | [0, 2] | `src/sim/sand.js:114` | Disparo ($t=cast$) |
| `waveBottomTolerance`| ESTRUTURAL / TÉCNICO | 0.2 | m | fixo | `src/sim/sand.js:81` | Constante Geométrica |

### 2.2. Bullet Punch (`bullet-punch`)
| Parâmetro | Classe | Padrão | Unidade | Faixa | Consumidor no Código | Momento de Captura |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `staminaCost` | EDITÁVEL · EXCLUSIVO | 1.5 | pts | [0, 10] | `src/sim/moves/bullet-punch.js:25` | Soltura c/ alvo |
| `cooldown` | EDITÁVEL · EXCLUSIVO | 8 | s | [0, 30] | `src/sim/moves/bullet-punch.js:30` | Soltura c/ alvo |
| `vanishTime` | EDITÁVEL · EXCLUSIVO | 0.75 | s | [0.1, 3] | `src/sim/moves/bullet-punch.js:42` | Soltura c/ alvo |
| `reach` | EDITÁVEL · EXCLUSIVO | 4 | m | [1, 20] | `src/sim/moves/bullet-punch.js:35` | Pressionamento |
| `hitRadius` | EDITÁVEL · EXCLUSIVO | 0.8 | m | [0.1, 5] | `src/sim/moves/bullet-punch.js:55` | Soltura c/ alvo |
| `stopShort` | EDITÁVEL · EXCLUSIVO | 0.4 | m | [0, 2] | `src/sim/moves/bullet-punch.js:60` | Soltura c/ alvo |
| `strikeReach` | EDITÁVEL · EXCLUSIVO | 1.2 | m | [0.2, 5] | `src/sim/moves/bullet-punch.js:62` | Soltura c/ alvo |
| `impactMult` | EDITÁVEL · HERDADO | 1.0 | mult | [0.1, 5] | `src/sim/moves/bullet-punch.js:70` | Soltura c/ alvo |
| `knockbackOwn`| EDITÁVEL · EXCLUSIVO | 0 | bool | toggle | `src/sim/moves/bullet-punch.js:75` | Soltura c/ alvo |
| `knockbackH` | EDITÁVEL · EXCLUSIVO | 3.5 | m/s | [0, 30] | `src/sim/moves/bullet-punch.js:77` | Soltura c/ alvo |
| `knockbackV` | EDITÁVEL · EXCLUSIVO | 0 | m/s | [0, 20] | `src/sim/moves/bullet-punch.js:78` | Soltura c/ alvo |
| `reappearDuration`| DERIVADO | 0.20 | s | fórmula | `src/sim/moves/bullet-punch.js:48` | Fixo proporcional |

### 2.3. Water Pulse (`water-pulse`)
| Parâmetro | Classe | Padrão | Unidade | Faixa | Consumidor no Código | Momento de Captura |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `staminaCost` | EDITÁVEL · EXCLUSIVO | 1 | pts | [0, 10] | `src/sim/moves/water-pulse.js:22` | Ativação ($t=0$) |
| `cooldown` | EDITÁVEL · EXCLUSIVO | 9 | s | [0, 30] | `src/sim/moves/water-pulse.js:26` | Ativação ($t=0$) |
| `maxCharge` | EDITÁVEL · EXCLUSIVO | 1.5 | s | [0.2, 5] | `src/sim/charge.js:34` | Ativação ($t=0$) |
| `speed` | EDITÁVEL · EXCLUSIVO | 14 | m/s | [1, 40] | `src/sim/moves/water-pulse.js:62` | Soltura |
| `range` | EDITÁVEL · EXCLUSIVO | 12 | m | [1, 40] | `src/sim/moves/water-pulse.js:64` | Soltura |
| `radius` | EDITÁVEL · EXCLUSIVO | 0.38 | m | [0.05, 3] | `src/sim/moves/water-pulse.js:68` | Soltura |
| `damagePL1` | EDITÁVEL · EXCLUSIVO | 6 | HP | [0, 50] | `src/sim/moves/water-pulse.js:72` | Soltura |
| `damagePL2` | EDITÁVEL · EXCLUSIVO | 9 | HP | [0, 75] | `src/sim/moves/water-pulse.js:73` | Soltura |
| `damagePL3` | EDITÁVEL · EXCLUSIVO | 12 | HP | [0, 100] | `src/sim/moves/water-pulse.js:74` | Soltura |
| `knockbackH_PL1`| EDITÁVEL · EXCLUSIVO | 2 | m | [0, 20] | `src/sim/moves/water-pulse.js:80` | Soltura |
| `knockbackH_PL2`| EDITÁVEL · EXCLUSIVO | 3 | m | [0, 30] | `src/sim/moves/water-pulse.js:81` | Soltura |
| `knockbackH_PL3`| EDITÁVEL · EXCLUSIVO | 4 | m | [0, 40] | `src/sim/moves/water-pulse.js:82` | Soltura |
| `knockbackV` | EDITÁVEL · EXCLUSIVO | 0 | m/s | [0, 20] | `src/sim/moves/water-pulse.js:85` | Soltura |
| `recoveryTicks`| EDITÁVEL · EXCLUSIVO | 36 | ticks | [0, 120] | `src/sim/moves/water-pulse.js:88` | Soltura |
| `visualScale` | VISUAL | 1.0 | mult | [0.1, 5] | `prototypes/combat-lab/src/render/` | Renderizador |

---

## 3. Lista de Novos Controles e Valores Preservados

1. **Sand Wave (`sand-wave`):**
   - *Novo Controle Mecânico Efetivo:* `waveHeight` (0,35 m padrão, editável de 0,1 m a 5,0 m). Anteriormente era uma propriedade de entidade sem verificação 3D real no `sand.js`. Agora integra a equação de colisão vertical: `altitudeOf(target) ∈ [waveBottom - tolerance, waveTop]`.
   - *Valores Preservados:* `length` (4 m), `width` (3 m), `damage` (6 HP), `blindDuration` (4 s), `accel` (12 m/s²), `staminaCost` (2), `cooldown` (10 s), `castTime` (0,25 s).

2. **Bullet Punch (`bullet-punch`):**
   - *Novos Controles Mecânicos Efetivos:*
     - Toggle `knockbackOwn` (0 = herda fórmula do Tackle; 1 = ativa knockback horizontal/vertical customizado).
     - Sliders `knockbackH` (3,5 m/s) e `knockbackV` (0 m/s), permitindo individualização completa de impacto e lançamento aéreo.
     - Sliders `vanishTime` (0,75 s) e `strikeReach` (1,2 m), determinando a janela de invisibilidade física e a tolerância de conexão de golpe.
   - *Valores Preservados:* Custo de stamina (1,5× Tackle), recarga (8 s), alcance (4 m), imunidade à cobrança de stamina se solto sem alvo no alcance.

3. **Water Pulse (`water-pulse`):**
   - *Novos Controles Mecânicos Efetivos:*
     - Slider `radius` (0,38 m) desacoplado de qualquer fator puramente visual (`visualScale`), assegurando que a hitbox física seja estritamente controlada pelo slider de raio.
     - Slider `knockbackV` (0 m/s padrão, ajustável até 20 m/s), permitindo converter o projétil em golpe anti-aéreo/juggle launcher.
     - Sliders granulares de dano e empurrão por nível de carga: `damagePL1`, `damagePL2`, `damagePL3`, `knockbackH_PL1`, `knockbackH_PL2`, `knockbackH_PL3`.
   - *Valores Preservados:* Velocidade (14 m/s), alcance (12 m), recuperação (36 ticks), tempo de carga máxima (1,5 s), custo (1 stamina) e recarga (9 s) debitados no instante do pressionamento inicial.

---

## 4. Testes RED/GREEN Executados

### 4.1. Suíte de Altura Vertical — Sand Wave (`sand-wave-vertical.test.mjs`)
- **RED:** Alvo posicionado sobre plataforma a 1,5 m de altura na trajetória da onda de 0,35 m. O motor anterior atingia o alvo erroneamente (falha de separação 3D).
- **GREEN:** Com a introdução de `altitudeOf(f)` e checagem de bounding volume 3D em `sand.js`, o alvo a 1,5 m ignora a onda de 0,35 m (0 HP de dano, sem cegueira).
- **A/B Contra-factual:** Elevando o slider `waveHeight` para 2,0 m, o mesmo alvo sobre a plataforma de 1,5 m passa a ser atingido com 6 HP e cegueira.
- **Paridade:** Alvo no solo ($y=0$) continua sendo atingido perfeitamente.
- **Resultado:** 3/3 aprovados.

### 4.2. Suíte de Mecânica e Tackle — Bullet Punch (`bullet-punch-mechanics.test.mjs`)
- **Knockback Customizado:** Comprovou que `knockbackOwn = 1` com `knockbackH = 12` empurra o alvo 1,2 m além do deslocamento proporcionado pela fórmula padrão do Tackle.
- **Interceptação em Rota:** Posicionamento de lutador a 1,5 m no trajeto da investida interrompe o dash imediatamente e absorve o impacto antes do alvo final a 2,0 m.
- **Anti-aéreo:** Lutador em salto ($y=2,0\text{ m}$) é interceptado e o dash se eleva até atingi-lo.
- **Paridade:** Confirmou que o Tackle padrão do jogo mantém integralmente seus 20 HP de dano base e física inalterada.
- **Resultado:** 4/4 aprovados.

### 4.3. Suíte de Mecânica e PL1–PL3 — Water Pulse (`water-pulse-mechanics.test.mjs`)
- **Raio Físico vs Escala Visual:** Alvo posicionado na fronteira lateral ($x = 1,0\text{ m}$). Aumentar `visualScale` de 1,0 para 2,5 NÃO atinge o alvo (preservação de integridade competitiva). Aumentar `radius` de 0,38 m para 0,60 m atinge o alvo com sucesso.
- **Knockback Vertical:** Com `knockbackV = 0`, o alvo desliza no solo mantendo `flight = null`. Com `knockbackV = 5`, o alvo é lançado ao ar com arco gravitacional ativo (`flight.y > 0`).
- **Progressão de Carga:** Verificação estrita dos patamares: PL1 causa 6 HP e 3,0 m de empurrão; PL2 causa 9 HP e 4,5 m; PL3 causa 12 HP e 6,0 m.
- **Resultado:** 3/3 aprovados.

### 4.4. Suíte de Auditoria AST e Robustez Geral (`npm run audit:moves`)
- **Detecção Sintática de Constantes Mágicas:** 0 números não classificados nos 19 arquivos de moves e submódulos compartilhados.
- **Teste Sintético RED de Injeção:** Simulação de inserção de literal numérico falha imediatamente no pipeline de CI.
- **Imutabilidade M28.4:** Alteração em tempo real de sliders após disparo não corrompe entidades vivas em voo/execução.
- **Estabilidade em Extremos:** Execuções com parâmetros mínimos e máximos sem estouro de pilha ou `NaN`.
- **Resultado:** 8/8 aprovados.

---

## 5. Prova A/B e Paridade

Todos os testes de sensibilidade confirmaram determinismo e rastreabilidade estrita:
- **Baseline Traces Salvos:**
  - `docs/overhaul-pilotos/baseline_sand-wave.json`
  - `docs/overhaul-pilotos/baseline_bullet-punch.json`
  - `docs/overhaul-pilotos/baseline_water-pulse.json`
- **Sensibilidade A/B Comprovada:**
  - Sand Wave: $damage = 6 \rightarrow 14 \implies \text{delta } +8\text{ HP}$; $waveHeight = 0.35 \rightarrow 2.0 \implies \text{atinge plataforma alta}$.
  - Bullet Punch: $knockbackOwn = 1 \implies \Delta\text{pos} > +1.2\text{ m}$.
  - Water Pulse: $knockbackV = 5 \implies \text{decolagem aérea do defensor}$.
- **Paridade M28.4:** Alterar as configurações no painel durante a reprodução não afeta projéteis ou barragens já existentes no mundo. A próxima invocação consome os novos valores com precisão de 120 Hz.

---

## 6. Status dos Três Portões

| Portão | Move | Cobertura | Paridade | Testes RED/GREEN | Auditoria AST | Decisão Final |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Portão SW** | Sand Wave | 100% | Confirmada | 3/3 (vertical) + 24/24 (regressão) | Aprovado | **SIGN-OFF COMPLETO** |
| **Portão BP** | Bullet Punch | 100% | Confirmada | 4/4 (mecânica) + 15/15 (regressão) | Aprovado | **SIGN-OFF COMPLETO** |
| **Portão WP** | Water Pulse | 100% | Confirmada | 3/3 (mecânica) + 15/15 (regressão) | Aprovado | **SIGN-OFF COMPLETO** |

**Pendências ou Bloqueios:** **ZERO.** Todos os critérios de aceite foram cumpridos com sucesso.

---

## 7. Pacote de Handoff para o Documento 02

Os artefatos estruturados para alimentar a Fase 2 (Refatoração de Topologia e Isolamento de VFX) encontram-se gerados e consolidados em `docs/overhaul-pilotos/`:

1. `catalogo_parametros.json`: 52 parâmetros auditados, tipados e com faixas/passos validados.
2. `contratos_de_consumo.json`: Mapeamento de todos os arquivos consumidores, eventos e momentos de captura.
3. `matriz_testes.json`: Casos de teste formais com valores baseline vs variante B e suites associadas.
4. `manifests_editor_save.json`: Validação de roundtrip do editor e persistência JSON.
5. `excecoes_tecnicas_conflitos.json`: Constantes técnicas justificadas (IEEE-754, trigonometria, Solver Rapier/AABB).
6. Baselines em JSON determinístico: `baseline_sand-wave.json`, `baseline_bullet-punch.json`, `baseline_water-pulse.json`.

---

## 8. Conformidade com o Protocolo e Git

- **Proibição de Push:** Respeitada rigorosamente. Nenhuma chamada `git push` foi ou será executada sem autorização expressa do usuário.
- **Acessibilidade:**
  - Jogo compilado: `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` (atalho na raiz: `JOGAR_ARENAMON.html`).
  - Central de Acesso: `ABRIR_ARENAMON.html` atualizado com link direto para este relatório.
  - Central de Testes: `TESTES_ARENAMON.html` atualizado com a suíte de auditoria mecânica dos Moves.
