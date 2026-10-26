# ARENAMON — DOCUMENTO 02 · RELATÓRIO OFICIAL DE TOPOLOGIA MODULAR E SEPARAÇÃO MECÂNICA/VFX
**Protocolo de Separação Arquitetural, Isolamento Headless e Paridade dos 3 Pilotos**  
**Data:** 26 de Outubro de 2026 · **Branch:** `feat/overhaul-sliders-moves` · **Status:** Aprovado em todos os Portões (SW, BP, WP, Conjunta)

---

## 1. Escopo Auditado e Diretrizes de Execução

- **Diretório de Operação:** `.worktrees/overhaul-sliders-moves` (worktree interno conforme protocolo `AGENTS.md`)
- **Branch Oficial:** `feat/overhaul-sliders-moves`
- **Moves Pilotos Reestruturados (3 Pilotos Aprovados):**
  1. `sand-wave` (Sand Wave) — Portão SW
  2. `bullet-punch` (Bullet Punch) — Portão BP
  3. `water-pulse` (Water Pulse) — Portão WP
- **Cláusula Estrita de Escopo Inalterável:**
  - Os outros 16 Moves permaneceram **ESTRITAMENTE INTOCADOS** em sua topologia plana legada (`src/sim/moves/<id>.js`, `<id>.params.js`, `<id>.move.json`).
  - Nenhum dos 16 Moves restantes foi migrado, rebalanceado, renomeado ou alterado estruturalmente.
  - A regressão completa dos 16 Moves foi executada e permanece 100% aprovada.
  - O trabalho desta fase encerra-se formalmente após a validação conjunta dos 3 pilotos.

---

## 2. Nova Topologia Modular dos Pilotos

Cada um dos 3 pilotos migrados reside exclusivamente em sua própria subpasta dentro de `prototypes/combat-lab/src/sim/moves/<id>/`, composto exatamente por 4 arquivos especializados:

```
prototypes/combat-lab/src/sim/moves/
├── sand-wave/
│   ├── sand-wave.js          (Mecânica pura, 120 Hz, sem Three.js/DOM)
│   ├── sand-wave.vfx.js      (Renderização/partículas, exclusivo da camada view/)
│   ├── sand-wave.move.json   (Ficha central de dados, parâmetros e sliders)
│   └── sand-wave.params.js   (Carregador puro de dados para C.world sem dependência circular)
├── bullet-punch/
│   ├── bullet-punch.js       (Mecânica de dash invisível, ausência física e tackle)
│   ├── bullet-punch.vfx.js   (Visual do rush metálico, sombras de velocidade e impacto)
│   ├── bullet-punch.move.json(Ficha com sliders de alcance, vanish, stopShort e knockback)
│   └── bullet-punch.params.js(Carregador puro de parâmetros de fábrica)
└── water-pulse/
    ├── water-pulse.js        (Mecânica de projétil de carga PL1–PL3, colisão 3D)
    ├── water-pulse.vfx.js    (Esfera d'água Three.quarks, rastro, splash e tail)
    ├── water-pulse.move.json (Ficha com sliders de carga, raio, velocidade e knockback)
    └── water-pulse.params.js (Carregador puro de parâmetros de fábrica)
```

### 2.1. Responsabilidades de Cada Arquivo

| Arquivo | Camada | Dependências Permitidas | Proibições Absolutas |
| :--- | :--- | :--- | :--- |
| `<id>.js` | **Simulação Pura (120 Hz)** | `sim/config.js`, `sim/math.js`, `sim/entity.js`, `sim/physics.js` | Three.js, Quarks, DOM, window, `.vfx.js`, `view/*` |
| `<id>.vfx.js` | **Visual / Apresentação** | Three.js, Three.quarks, `sand-stone-lab/*`, `view/*` | Importar lógica interna da simulação ou alterar estado mecânico |
| `<id>.move.json` | **Fonte Única da Verdade** | JSON puro compatível com Schema v1 e Ateliê de Efeitos | Valores não serializáveis, funções ou dependências de runtime |
| `<id>.params.js` | **Carregador Puro de Dados** | `../move-data.js`, `./<id>.move.json` | Importar `config.js` ou qualquer módulo do motor (evita ciclo) |

---

## 3. Isolamento Arquitetural Comprovado

Foi criada a suíte formal de análise de grafo de dependências (`test/moves-vfx-isolation.test.mjs`), inspecionando todos os módulos e pontos de entrada da simulação headless.

### 3.1. Resultados da Auditoria de Isolamento:
- **Grafo de Simulação Mapeado:** 97 arquivos
- **Pontos de Entrada Inspecionados:** 38
- **Pureza de `.vfx.js`:** **0 arquivos `.vfx.js`** no grafo de simulação (100% de pureza).
- **Pureza Headless:** **0 dependências** de Three.js ou three.quarks alcançáveis pela simulação.
- **Fronteira View:** **0 imports** da camada `view/` a partir de `sim/moves/`.

---

## 4. Registro VFX Centralizado e Exclusivo

O novo componente `prototypes/combat-lab/src/view/moves-vfx-registry.js` foi integrado à camada de visualização (`world-view.js` e `wv-update.js`):
1. **Assunção Exclusiva dos Pilotos:**
   - `sand-wave` é filtrado de `atelierFx` e gerenciado pelo registro.
   - `bullet-punch` é dissociado de `atelier-game.js` (onde `quick-attack` permaneceu intacto) e gerenciado pelo registro.
   - `water-pulse` (`waterorb`) é dissociado de `elemental-game.js` (onde `airslash`, `firespin` e `seed` permaneceram intactos) e gerenciado pelo registro.
2. **Prevenção de Duplicatas e Interferência Cruzada:**
   - O método `filterUnmigrated(entities)` garante que os manipuladores legados nunca recebam entidades dos 3 pilotos migrados.
   - `atelier-game.js` e `elemental-game.js` preservam 100% de suas configurações, acessibilidade e limpeza para os demais 16 Moves.
3. **Ciclo de Vida Completo:**
   - Criação de malhas e partículas (`spawn`).
   - Atualização determinística (`update` e `advanceRush`).
   - Recepção de eventos de impacto (`onEvent`).
   - Limpeza total de malhas, emissores de quarks e materiais (`dispose` e `disposeAll`).
   - Acessibilidade (`noFlash` e `reduceMotion`) respeitada em todos os módulos visuais.

---

## 5. Gravação Híbrida e Detecção de Duplicatas

A API local de gravação (`move-save-api.mjs`) e o modelo do editor (`move-save-model.js`, `move-editor-panel.js`) foram atualizados para suportar o ecossistema híbrido:
1. **Resolução Dinâmica:** Localiza tanto `<id>/<id>.move.json` quanto `<id>.move.json`.
2. **Detecção Estrita de Duplicatas (409 Conflict):**
   - Caso um Move exista simultaneamente na raiz legada e na subpasta nova, as operações de leitura e gravação são imediatamente rejeitadas com erro HTTP 409, impedindo que o Editor grave num arquivo diferente daquele carregado pelo motor.
3. **Exibição do Caminho Real:**
   - O modal de confirmação do Editor de Moves exibe o caminho relativo exato do arquivo que será gravado no disco.

---

## 6. Prova de Paridade Determinística (0 Divergência)

O teste de paridade determinística `prototypes/combat-lab/test/moves-pilots-baseline.test.mjs` comparou a execução da simulação reestruturada com os baselines JSON gerados no Documento 01:

| Piloto | Arquivo de Baseline | Divergência em Eventos | Divergência de Estado Final | Status |
| :--- | :--- | :---: | :---: | :---: |
| **Sand Wave** | `docs/overhaul-pilotos/baseline_sand-wave.json` | **0 ticks** (100% idêntico) | **0.000 HP / pos** | **APROVADO** |
| **Bullet Punch** | `docs/overhaul-pilotos/baseline_bullet-punch.json` | **0 ticks** (100% idêntico) | **0.000 HP / pos** | **APROVADO** |
| **Water Pulse (PL1)** | `docs/overhaul-pilotos/baseline_water-pulse.json` | **0 ticks** (100% idêntico) | **0.000 HP / pos** | **APROVADO** |
| **Water Pulse (PL2)** | `docs/overhaul-pilotos/baseline_water-pulse.json` | **0 ticks** (100% idêntico) | **0.000 HP / pos** | **APROVADO** |
| **Water Pulse (PL3)** | `docs/overhaul-pilotos/baseline_water-pulse.json` | **0 ticks** (100% idêntico) | **0.000 HP / pos** | **APROVADO** |

---

## 7. Sumário dos Testes e Portões de Qualidade

Todos os portões foram validados individualmente e conjuntamente com 100% de aprovação:

1. **Portão SW (Sand Wave):**
   - `sand-wave-vertical.test.mjs`: 3/3 aprovados.
   - `moves-sand-wave.test.mjs`: 24/24 aprovados.
2. **Portão BP (Bullet Punch):**
   - `bullet-punch-mechanics.test.mjs`: 4/4 aprovados.
   - `moves-bullet-punch.test.mjs`: 15/15 aprovados.
3. **Portão WP (Water Pulse):**
   - `water-pulse-mechanics.test.mjs`: 3/3 aprovados.
   - `moves-water-pulse.test.mjs`: 15/15 aprovados.
4. **Infraestrutura e Isolamento:**
   - `moves-vfx-isolation.test.mjs`: 1/1 aprovado (97 arquivos mapeados, 0 violações).
   - `moves-pilots-baseline.test.mjs`: 5/5 subtestes aprovados com 0 divergência.
   - `moves-fichas.test.mjs`: 6/6 aprovados.
   - `move-data.test.mjs`: 13/13 aprovados.
   - `move-save-model.test.mjs`: 9/9 aprovados.
   - `move-save-api.test.mjs`: 8/8 aprovados.
   - `audit:moves` (AST + Sensibilidade A/B): 8/8 aprovados.
5. **Navegador (Playwright Headless):**
   - `move-save.browser.mjs`: 21/21 verificações aprovadas.
   - `move-editor.browser.mjs`: 33/33 verificações aprovadas.
6. **Regressão dos 16 Moves Não-Migrados:**
   - 17/17 suítes completas de testes unitários aprovadas sem falhas.
7. **Typecheck e Catraca Estrita:**
   - `npm run typecheck`: 0 erros.
   - `scripts/estrito.mjs`: 939 erros (orçamento de 939 respeitado à risca).
   - `npm run rapido`: 6/6 fases aprovadas em 31.3s.

---

## 8. Cláusula de Conclusão e Encerramento

Com a conclusão dos passos acima, o escopo do **Documento 02** está **integralmente cumprido e encerrado**.
Os 3 pilotos encontram-se plenamente migrados para a topologia modular de 4 arquivos com separação de física e visual, registro dedicado na camada `view/`, cobertura total de sliders mecânicos no Editor de Moves e paridade determinística comprovada.
Nenhum outro Move deve ser migrado sem aprovação expressa subsequente.
