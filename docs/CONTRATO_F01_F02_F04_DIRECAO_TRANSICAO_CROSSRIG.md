# Especificação Técnica F01 + F02 + F04: Cobertura Direcional, Transições e Comparação Cross-Rig

Data: 31/10/2026.
Contratos implementados na suíte de percepção biomecânica:
- **F01:** `arenamon.direction-coverage/1` em [`scripts/blender-vision/direction_coverage.py`](../scripts/blender-vision/direction_coverage.py)
- **F02:** `arenamon.transition-analysis/1` em [`scripts/blender-vision/transition_analysis.py`](../scripts/blender-vision/transition_analysis.py)
- **F04:** `arenamon.cross-rig-compare/1` em [`scripts/blender-vision/cross_rig_compare.py`](../scripts/blender-vision/cross_rig_compare.py)

---

## 1. F01 — Cobertura em Oito Direções (`arenamon.direction-coverage/1`)

### 1.1 Objetivo e Regras Fundamentais
1. **Mapeamento das 8 Direções Canônicas:** Analisa o conjunto de Actions de locomoção/esquiva nas orientações `N` (0°), `NE` (45°), `E` (90°), `SE` (135°), `S` (180°), `SW` (225°), `W` (270°) e `NW` (315°).
2. **Separação Epistêmica Fato vs. Hipótese:**
   - A constatação de semelhança geométrica por espelhamento bilateral não autoriza afirmar que o runtime do jogo espelha as animações proceduralmente.
   - Não se presume rotação procedural de raiz sem evidência explícita no código de execução.
3. **Métricas de Trajetória e Orientação:**
   - Vetor de deslocamento horizontal da raiz ($\Delta x, \Delta y$).
   - Ângulo medido da trajetória e desvio angular em relação ao nominal da direção.
   - Status por direção: `PRESENT`, `ABSENT` ou `DEVIATED` (desvio superior à tolerância, ex: >25°).
4. **Análise de Simetria de Pares Opostos:**
   - Avaliação de pares (`E`/`W`, `NE`/`NW`, `SE`/`SW`).
   - Classificação estrita: `INDEPENDENT_AUTHORIAL` (desenvolvimento coreográfico próprio de cada lado), `SYMMETRIC_MIRRORED` (discrepância pós-espelhamento abaixo do limiar de 0,05 m) ou `RUNTIME_ROTATED`.

---

## 2. F02 — Análise de Transições (`arenamon.transition-analysis/1`)

### 2.1 Objetivo e Regras Fundamentais
1. **Emenda de Actions ($A_{end} \to B_{start}$):**
   - Compara o último frame da Action de origem ($A$) com o primeiro frame da Action de destino ($B$).
   - Frames inteiros e durações físicas reais em segundos ($t = \text{frame} / \text{FPS}$).
2. **Descontinuidade de Raiz:**
   - Salto espacial da raiz em metros: $\|\vec{p}_{root}^B(0) - \vec{p}_{root}^A(end)\|$.
   - Salto de orientação angular do torso/raiz em graus.
   - Variação de velocidade linear em m/s.
3. **Continuidade Articular:**
   - Discrepância média e máxima entre todos os ossos comuns mapeados no esqueleto.
   - Identificação nominal do osso com maior salto espacial na emenda.
4. **Continuidade de Apoio dos Pés e Regra de Ouro Epistêmica:**
   - Pés no solo sem confirmação visual ou colisão física comprovada no runtime **permanecem estritamente classificados como CANDIDATO de contato** (`CANDIDATE`).
   - Medição de escorregamento horizontal na emenda (`foot_sliding_m`) para alertar descontinuidades de apoio.
5. **Recomendação de Janela de Blend:**
   - Cálculo determinístico do tempo de interpolação ($0{,}10\text{ s}$ a $0{,}25\text{ s}$) e frames sugeridos para transição suave sem quebra visual.

---

## 3. F04 — Comparação Cross-Rig com Normalização Estrita (`arenamon.cross-rig-compare/1`)

### 3.1 Objetivo e Regras Fundamentais
1. **Consumo Mandatório de F03 (`arenamon.rig-map/1`):**
   - Exige mapeamentos semânticos válidos nos dois armatures via F03.
   - Apenas papéis canônicos mapeados em ambos os rigs (`STATUS_MAPPED`) entram na comparação.
   - Papéis ausentes (`STATUS_ABSENT`) ou não-mapeados são formalmente isolados em `excluded_roles`.
2. **Proibição Categórica:**
   - **NUNCA comparar diretamente coordenadas brutas de esqueletos incompatíveis.**
3. **Normalização de Escala Corporal ($H$):**
   - As distâncias entre posições articulares são normalizadas pela altura do respectivo personagem ($H_A$ e $H_B$).
   - Discrepâncias são reportadas em porcentagem da altura corporal ($\%H$), garantindo invariância dimensional.
4. **Normalização de Espaço Local e Orientação:**
   - As posições são avaliadas relativamente ao centro de massa anatômico (pelve), subtraindo coordenadas de mundo arbitrárias.
   - Vetores sagitais alinhados para neutralizar rotações espúrias.
5. **Normalização Temporal em Segundos:**
   - Amostragem em $N$ fatias uniformes no tempo relativo normalizado $t \in [0, 1]$, calculadas com base nas durações físicas reais em segundos de cada Action ($T = \text{frames} / \text{FPS}$).
6. **Neutralidade Epistêmica:**
   - Mede divergência métrica sem emitir julgamento de valor artístico sobre qual animação seria "superior".

---

## 4. Integração Nativa com Relatórios F15 (`arenamon.agent-report/1`)

Os três contratos dispõem de adaptadores de exportação para F15:
- `export_direction_coverage_to_agent_report()`
- `export_transition_to_agent_report()`
- `export_cross_rig_to_agent_report()`

Todos geram relatórios estruturados com taxonomia epistêmica estrita (`facts`, `observations`, `inferences`, `hypotheses`), medições quantitativas com unidades explícitas, validação de arquivos físicos em disco com hashes SHA-256 e o campo `applied: false` mandatório para qualquer proposta.
