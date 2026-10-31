# Evidências Visuais e Pipeline de Dados — Auditoria Gigantic (P1/P2)

Este diretório contém as folhas de contato visuais em múltiplas vistas ortográficas independentes, inventários de root motion, análises Procrustes e dados brutos de curvas extraídos do corpus de animações de *Gigantic: Rampage Edition* para guiar os sistemas de movimentação e combate do Arenamon (Wookada e Cogumelo/Mosh).

---

## 1. Estrutura de Diretórios

```
prototypes/combat-lab/evidence/gigantic/
├── p1/                         # Folhas visuais de corrida (8 direções × 5 heróis)
├── p2/                         # Folhas visuais de Dodge, RushAttack e habilidades
├── data/                       # Dados analíticos em JSON e CSV
│   ├── analise_procrustes.json # Resíduos de rotação rígida vs espelhamento
│   ├── rootmotion_inventory.json # Medições de deslocamento de b_Root
│   ├── timing_psa_vs_blend.csv # Comparativo de taxas de quadros e duração
│   ├── sheets_index.json       # Índice estruturado das folhas compostas
│   ├── curves3/                # Curvas locais das 8 corridas por herói
│   ├── curves_dodge/           # Curvas locais dos 9 dodges por herói
│   └── scan/                   # Varredura completa de todas as ações dos rigs
├── manifest.json               # Inventário de arquivos com dimensões e tamanhos
└── README.md                   # Este documento
```

---

## 2. Protocolo de Inspeção Visual e Câmeras

- **Critério de Independência:** Todas as animações avaliadas foram inspecionadas e registradas em **pelo menos 2 vistas independentes**:
  - `FRONT`: Câmera ortográfica apontando para `(0, -1, 0)` (frente do personagem, no referencial do importador onde frente = −Y).
  - `SIDE_NX`: Câmera ortográfica apontando para `(-1, 0, 0)` (lado direito do personagem).
  - **Separação angular:** 90° entre os eixos de visão (cumprindo com folga a exigência de separação $\ge 35^\circ$).
- **Configuração da Câmera:**
  - Tipo: `ORTHO` (ortográfica sem distorção de perspectiva).
  - Alcance de corte: `clip_start = 0.5`, `clip_end = 4000.0` (garantindo que rigs em centímetros com span de até 250 cm e posições a `span*2` fiquem completamente dentro do frustum).
  - Rastreamento: Câmera centralizada dinamicamente no centro horizontal do corpo a cada quadro, com altura fixa (`zmid`) e escala de enquadramento ortográfico constante por ação.
  - Shading: Workbench Studio com iluminação neutra, silhueta ativa (`object_outline`) e cavidade (`cavity = WORLD`).
  - Filtragem de malha: Exclusão de objetos auxiliares e FX flutuantes (mantendo apenas as malhas com modificador de armadura).

---

## 3. Síntese dos Resultados Técnicos Verificados

### 3.1 P1 — Locomoção em 8 Direções (40 Ações Verificadas)
- **Deslocamento de Root Motion:** **0,0 cm (0,0000 cm) em todas as 40 ações `Run_*`**.
  - A locomoção é estritamente *in-place*. O deslocamento do ator pelo mundo é responsabilidade integral do motor de jogo.
- **Autorialidade vs Rotação do Quadril:**
  - A análise de Procrustes prova que as 8 direções de corrida não são 8 animações corporais independentes, mas **4 a 6 clipes únicos** por herói com rotação aplicada no osso `b_Pelvis`/`b_Root` (ex: Pakko possui 4 clipes únicos; as direções intermediárias colapsam com resíduo de 0,000–0,160 cm após rotação de $\pm 30^\circ$ e $\pm 60^\circ$).
  - **Espelhamento não é utilizado nas corridas:** Resíduos de espelhamento variam entre 5,9 cm e 22,0 cm, comprovando que o estúdio produziu variações autoriais para esquerda/direita em vez de mirror simétrico simples.

### 3.2 P2 — Dodge, Sprint e Habilidades Direcionais
- **Dodge:**
  - Sistema **3-way** rígido: `{E, W, S}` em 3 variantes de estado: `{Solo, Air, Exhausted}`. Não existe `Dodge_N` nem diagonais nos arquivos.
  - **Deslocamento de Raiz:** Esquivas terrestres laterais possuem deslocamento real no root de **313,0 cm a 399,6 cm** (3,1m a 4,0m).
- **Avanço Frontal (Skill_RushAttack):**
  - O equivalente funcional de avanço rápido para a frente em combate não é um Dodge, mas o `Skill_RushAttack` (presente em Pakko, Rutger, Wu e Tripp).
  - Deslocamento de raiz verificado: **exatamente 400,0 cm em −Y**.
- **Sprint:**
  - Sistema **3-way** (`Sprint_N`, `Sprint_NE`, `Sprint_NW`). Não há sprint para trás ou puramente lateral.
  - Todas as animações de Sprint são *in-place* (deslocamento de raiz = 0,0 cm).

### 3.3 Metadados dos Rigs Analisados
| Herói | AnimSet (Armature) | Ossos | Scene FPS | Total de Ações |
|---|---|---|---|---|
| **Charnok** | `Bombard_Default_LOD0` | 93 | 30.0 | 116 |
| **Pakko** | `Frosty_Default_LOD0` | 83 | 30.0 | 223 |
| **Rutger** | `Stoneskin_Default_LOD0` | 122 | 30.0 | 140 |
| **Wu** | `Judo_Default_LOD0` | 127 | 30.0 | 294 |
| **Tripp (pilot)** | `Rogue_Default_LOD0` | 80 | 24.0 | 187 |

---

## 4. Inventário de Arquivos Entregues

### P1 (18 Folhas PNG)
1. `p1/GIG-P1-CHARNOK-RUN-DIRECOES-FRONT.png` (1774×1704)
2. `p1/GIG-P1-CHARNOK-Run_E-FRONT.png` (1624×408)
3. `p1/GIG-P1-CHARNOK-Run_N-FRONT.png` (1624×408)
4. `p1/GIG-P1-CHARNOK-Run_N-SIDE_NX.png` (1624×408)
5. `p1/GIG-P1-CHARNOK-Run_NE-FRONT.png` (1624×408)
6. `p1/GIG-P1-CHARNOK-Run_NW-FRONT.png` (1624×408)
7. `p1/GIG-P1-CHARNOK-Run_W-FRONT.png` (1624×408)
8. `p1/GIG-P1-PAKKO-RUN-DIRECOES-FRONT.png` (1774×1056)
9. `p1/GIG-P1-PAKKO-Run_N-FRONT.png` (1624×408)
10. `p1/GIG-P1-PAKKO-Run_N-SIDE_NX.png` (1624×408)
11. `p1/GIG-P1-PAKKO-Run_NE-FRONT.png` (1624×408)
12. `p1/GIG-P1-PAKKO-Run_SW-FRONT.png` (1624×408)
13. `p1/GIG-P1-RUTGER-Run_N-FRONT.png` (1624×408)
14. `p1/GIG-P1-RUTGER-Run_N-SIDE_NX.png` (1624×408)
15. `p1/GIG-P1-TRIPP-Run_N-FRONT.png` (1624×408)
16. `p1/GIG-P1-TRIPP-Run_N-SIDE_NX.png` (1624×408)
17. `p1/GIG-P1-WU-Run_N-FRONT.png` (1624×408)
18. `p1/GIG-P1-WU-Run_N-SIDE_NX.png` (1624×408)

### P2 (14 Folhas PNG)
1. `p2/GIG-P1-CHARNOK-Dodge_W-FRONT.png` (1948×408)
2. `p2/GIG-P1-CHARNOK-Dodge_W-SIDE_NX.png` (1948×408)
3. `p2/GIG-P1-CHARNOK-Skill_Breath_Start-FRONT.png` (1300×408)
4. `p2/GIG-P1-PAKKO-Skill_RushAttack-FRONT.png` (1624×408)
5. `p2/GIG-P1-PAKKO-Skill_RushAttack-SIDE_NX.png` (1624×408)
6. `p2/GIG-P1-RUTGER-Skill_Focus_Charge-FRONT.png` (1300×408)
7. `p2/GIG-P1-RUTGER-Skill_RushAttack-FRONT.png` (1624×408)
8. `p2/GIG-P1-TRIPP-Dodge_E-FRONT.png` (1624×408)
9. `p2/GIG-P1-TRIPP-Skill_Slash_RushAttack-FRONT.png` (1624×408)
10. `p2/GIG-P1-TRIPP-Skill_Slash_RushAttack-SIDE_NX.png` (1624×408)
11. `p2/GIG-P1-WU-Skill_RushAttack-FRONT.png` (1948×408)
12. `p2/GIG-P1-WU-Skill_RushAttack-SIDE_NX.png` (1948×408)
13. `p2/GIG-P1-WU-Skill_TigerKick_01-FRONT.png` (1300×408)
14. `p2/GIG-P2-RUSH-ATTACK-COMPARADO.png` (2098×1380)

### Dados Técnicos (`data/`)
- `data/analise_procrustes.json`: Tabela completa de resíduos e rotações estimadas entre pares direcionais.
- `data/rootmotion_inventory.json`: Inventário de deslocamentos, bounding boxes e FCurves de raiz.
- `data/timing_psa_vs_blend.csv`: Comparação sistemática de frame counts e taxas de quadros.
- `data/sheets_index.json`: Índice das 32 folhas compostas, com parâmetros de enquadramento e spans.
- `data/curves3/`: Curvas locais de rotação e deslocamento para os 5 heróis (40 runs).
- `data/curves_dodge/`: Curvas locais de dodge para os 5 heróis.
- `data/scan/`: Varreduras completas de todos os canais de animação dos 5 rigs.
