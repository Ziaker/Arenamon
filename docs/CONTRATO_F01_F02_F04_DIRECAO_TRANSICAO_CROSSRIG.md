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
2. **Normalização Robusta por Tokens:** Previne colisões espúrias de substring através de tokenização exata e correspondência de sufixos delimitados (ex: `Run_E`, `Run_NE`, `Dodge_Forward_Right`).
3. **Tratamento Factual de Ciclos In-Place:**
   - Detecta e reporta quando o ciclo de locomoção é in-place ($\Delta p_{root} < 0{,}05\text{ m}$ no Blender), registrando como fato que a translação horizontal é nula no arquivo e que a orientação é conduzida pela pose ou orientada pelo runtime.
4. **Separação Epistêmica Fato vs. Hipótese na Simetria de Pares:**
   - Se houver medição de espelhamento bilateral:
     - Discrepância $\le 0{,}05\text{ m}$: `SYMMETRIC_MIRRORED` (comprova simetria geométrica de malha/esqueleto).
     - Discrepância $> 0{,}05\text{ m}$: `INDEPENDENT_AUTHORIAL` (comprova autoria de movimento independente).
   - Se não houver medição:
     - Actions distintas: `DISTINCT_ACTIONS_UNMEASURED` (não infere autoria sem medir).
     - Mesma Action em ambas as direções: `SAME_ACTION_REUSED` (a hipótese de rotação procedural no motor de jogo permanece estritamente na seção de `hypotheses`).

---

## 2. F02 — Análise de Transições (`arenamon.transition-analysis/1`)

### 2.1 Objetivo e Regras Fundamentais
1. **Emenda de Actions ($A_{end} \to B_{start}$):**
   - Compara o último frame da Action de origem ($A$) com o primeiro frame da Action de destino ($B$).
   - Frames inteiros e durações físicas reais em segundos ($t = \text{frame} / \text{FPS}$).
2. **Descontinuidade de Raiz e Orientação Real:**
   - Salto espacial da raiz em metros: $\|\vec{p}_{root}^B(0) - \vec{p}_{root}^A(end)\|$.
   - Salto de orientação angular do torso/raiz extraído das matrizes de rotação (Euler yaw em graus).
   - Variação de velocidade linear em m/s.
3. **Continuidade Articular de Todas as Articulações:**
   - Discrepância média e máxima avaliada sobre todos os ossos reais do esqueleto.
   - Identificação nominal do osso com maior salto espacial na emenda.
4. **Continuidade de Apoio dos Pés e Calibração de Solo:**
   - Avalia a distância vertical em relação ao nível de solo real do modelo (`ground_z_reference_m`).
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
3. **Normalização Geométrica Canônica Completa:**
   Para cada ponto temporal $t_i$:
   1. **Centralização na Pelve:** Subtrai as coordenadas do centro de massa anatômico ($\vec{p}_{bone} - \vec{p}_{pelvis}$), colocando a pelve de ambos os esqueletos exatamente em $(0, 0, 0)$.
   2. **Alinhamento Sagital de Orientação:** Aplica rotação inversa pelo ângulo yaw $\theta_{yaw}$, alinhando o vetor frontal de ambos os esqueletos para o eixo canônico $+Y$.
   3. **Normalização de Escala Corporal ($H$):** Divide todas as coordenadas pela altura do respectivo personagem ($H_A$ e $H_B$). Discrepâncias são reportadas em porcentagem da altura corporal ($\%H$) e metros equivalentes.
4. **Normalização Temporal em Segundos:**
   - Amostragem em $N$ fatias uniformes no tempo relativo normalizado $t \in [0, 1]$, calculadas com base nas durações físicas reais em segundos de cada Action ($T = \text{frames} / \text{FPS}$).
5. **Neutralidade Epistêmica:**
   - Mede divergência métrica sem emitir julgamento de valor artístico sobre qual animação seria "superior".

---

## 4. Integração Nativa com Relatórios F15 (`arenamon.agent-report/1`)

Os três contratos dispõem de adaptadores de exportação para F15:
- `export_direction_coverage_to_agent_report()`: Exige rig mapping F03 autêntico e calcula intervalo real a partir das Actions presentes no conjunto.
- `export_transition_to_agent_report()`: Exige rig mapping F03 autêntico; referencia a Action de destino no target com faixa temporal real e registra os marcos da emenda ($A_{end} \to B_{start}$) nos measurements.
- `export_cross_rig_to_agent_report()`: Exige rig mapping F03 autêntico de $A$ e metadados reais de duração e amostragem.

Todos geram relatórios estruturados com taxonomia epistêmica estrita (`facts`, `observations`, `inferences`, `hypotheses`), medições quantitativas com unidades explícitas, validação de arquivos físicos em disco com hashes SHA-256 e o campo `applied: false` mandatório para qualquer proposta.
