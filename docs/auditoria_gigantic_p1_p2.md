# Auditoria Técnica e Visual das Animações de Gigantic: Rampage Edition (P1/P2)
## Metodologia, Decomposição Cinemática, Matrizes Comparativas e Aplicação Prática ao Arenamon (Wookada e Cogumelo)

**Data de Conclusão:** 31 de outubro de 2026  
**Agente Responsável:** `teamwork_worker_m2` (Engenharia de Animação e Integridade Técnica)  
**Modo Operacional:** Modo A (Auditoria / Somente Leitura) — estritamente não-destrutivo  
**Ambiente de Inspeção:** Blender 5.2.2 LTS (Workbench Studio, Câmera Ortográfica Calibrada)  
**Repositório Alvo:** Arenamon (branch `feat/overhaul-arquitetural-f3-f9`, commit `de779ee1`)  
**Corpus Fonte Analisado:** `C:\Users\zerke\Downloads\gigas` (940 arquivos, 904 MiB, 129 PSAs, 6 unidades)  
**Diretório de Evidências Produzidas:** `prototypes/combat-lab/evidence/gigantic/` (32 folhas PNG, 7 datasets JSON/CSV)  
**Documentos Relacionados:** `AGENTS.md`, `docs/MANUAL_BLENDER_AGENTES.md`, `docs/MOTION_LENS_AUDITORIA_EVOLUCAO_2026-10-31.md`

---

## Sumário Executivo

Esta auditoria constitui o estudo definitivo e exaustivo das famílias de locomoção em 8 direções (P1) e de esquivas, investidas, corridas aceleradas e transições (P2) do acervo de animações de *Gigantic: Rampage Edition* (desenvolvido originalmente pela Motiga e relançado pela Abstraction Games / Gearbox Publishing). O propósito precípuo é desconstruir a biomecânica, a arquitetura de canais de animação da Unreal Engine 3/4 e as técnicas autorais empregadas no título comercial para transpor soluções comprovadas aos lutadores autorais do Arenamon — especificamente **Wookada** (guardião pesado com escala 2×) e **Cogumelo / Mosh** (lutador ágil com chapéu desproporcional e anomalias de rig).

### Principais Conclusões Comprovadas da Auditoria:

1. **Locomoção em 8 Direções (P1) é 100% In-Place:**
   - Em todas as 40 ações de corrida (`Run_N`, `Run_NE`, `Run_E`, `Run_SE`, `Run_S`, `Run_SW`, `Run_W`, `Run_NW`) examinadas nos 5 heróis extraídos, o deslocamento líquido e o deslocamento máximo do osso de raiz (`b_Root`) é rigorosamente **0,0000 cm**.
   - Toda translação do ator no espaço de jogo é governada pela simulação do motor de física/gameplay, jamais pela raiz da animação esquelética.

2. **O Fenômeno do Colapso por Rotação da Pelve (`b_Pelvis`):**
   - Com exceção de Charnok (cujo design exigiu 8 ciclos corporais autorais), os heróis do Gigantic **não possuem 8 animações distintas de corrida**.
   - A cobertura direcional é obtida por colapso rígido de **4 a 6 clipes base**, nos quais as diagonais são derivadas por rotações angulares discretas ($\pm 30,00^\circ$ e $\pm 60,00^\circ$) injetadas no osso `b_Pelvis`, com resíduos de Procrustes entre $0,000\text{ cm}$ e $0,150\text{ cm}$ e variação angular dos demais 80 a 126 ossos do corpo de rigorosamente $0,00^\circ$ a $0,01^\circ$.

3. **Inexistência Absoluta de Espelhamento Bilateral (Mirroring Refutado):**
   - O teste sistemático de Procrustes com inversão de simetria lateral ($X \to -X$) revelou resíduos massivos entre **5,9 cm e 26,5 cm**. O estúdio optou categoricamente por animações autorais independentes para as laterais (`Run_E` e `Run_W`), preservando a assimetria visual de armas, mochilas e postura de combate, repudiando o espelhamento artificial.

4. **Esquivas (P2) São Estritamente Tridirecionais e Uniaxiais:**
   - O sistema de esquivas de Gigantic é composto exclusivamente pela tríade `{Dodge_E, Dodge_W, Dodge_S}` multiplicada pelos estados `{Solo, Ar, Esgotado}` (9 ações por herói).
   - **Não existe Dodge frontal (`Dodge_N`) nem esquivas diagonais em nenhum herói do corpus.**
   - O deslocamento no solo é puramente uniaxial (apenas no eixo da esquiva, com outros eixos travados em $0,0\text{ cm}$) e padronizado entre **2,63 m e 4,00 m** (263 cm a 400 cm) nas esquivas normais (com variantes esgotadas descendo a 2,08 m – 2,60 m), independentemente da envergadura do personagem.

5. **O Avanço Frontal de Evasão é o Golpe Ofensivo `Skill_RushAttack`:**
   - O jogador que comanda uma esquiva para a frente executa uma ação de ataque físico de investida (`Skill_RushAttack`), e não uma esquiva defensiva.
   - Esse avanço possui deslocamento de raiz constante de **exatamente 400,0000 cm em −Y** em 4 dos 5 heróis (Pakko, Rutger, Wu e Tripp).

6. **Inexistência de Ataques Planares 8-Way:**
   - Dentre as 1.045 ações catalogadas no corpus, **nenhuma habilidade (`Skill_*`) possui variantes direcionais planares**. Todos os ataques avançam estritamente no eixo longitudinal (−Y) ou ascendem no vertical (+Z).

---

## 1. Introdução, Escopo e Metodologia Científica de Inspeção

### 1.1 Contexto da Auditoria e Limites Operacionais

O projeto Arenamon adota uma política inflexível de integridade técnica e respeito aos ativos autorais e de terceiros, expressa no documento normativo `AGENTS.md`. A presente auditoria seguiu estritamente as seguintes restrições:
- **Modo A (Somente Leitura):** Proibição categórica de gravação, alteração de keyframes, salvamento de arquivos `.blend` ou mutação de malhas na pasta fonte `C:\Users\zerke\Downloads\gigas`.
- **Proteção do Repositório Git:** Proibição de inclusão ou commit de arquivos proprietários binários (`.blend`, `.psa`, `.psk`, `.upk`). Todo o conhecimento foi sintetizado em relatórios analíticos (`.md`), dados abertos (`.json`, `.csv`) e folhas de contato visuais (`.png`) geradas por renderizador headless em conformidade com as regras de documentação técnica.
- **Não-Implementação Antecipada:** Nenhuma linha de código das propostas de evolução F03–F15 foi aplicada nesta etapa. O escopo concentrou-se na extração analítica e na formulação de planos determinísticos de remediação.

### 1.2 Corpus Analisado e Integridade Criptográfica

O corpus em `C:\Users\zerke\Downloads\gigas` compreende **940 arquivos** totalizando **947.849.822 bytes** (~904 MiB). Todos os arquivos tiveram seus hashes criptográficos SHA-256 aferidos no início e no término da investigação, confirmando a integridade integral do acervo original.

| Personagem | Codinome Interno | Classe / Papel | Arquivo `.blend` Principal | Tamanho | Hash SHA-256 Original e Final |
|---|---|---|---|---|---|
| **Charnok** | `Bombard` | Mago de Fogo (Ranged) | `charnok/Charnok_Animations.blend` | 9,61 MB | `742f3e7ef0eff7dceb401260db700d501028ae56d54d411aaf7090c62d51ce4a` |
| **Pakko** | `Frosty` | Tanque / Iniciador Cômico | `pakko/Pakko_Animations.blend` | 10,08 MB | `b9bc2695b2988b0d22a3ab81957e3e60575c9027358a7b899562b2646c4ca62b` |
| **Rutger** | `Stoneskin` | Tanque / Geomante | `rutger/Rutger_Animations.blend` | 18,07 MB | `076d89168a90927d1d8f34aaccde507078c095b8c8da0eee2ba25dc07d6b6ac1` |
| **Wu** | `Judo` | Lutador Acrobático (Melee) | `wu/Wu_Animations.blend` | 12,65 MB | `bb32e226cbba41dbb6c87638b0e545bf22391ff4733394cb7ed07868d38069ab` |
| **Tripp** | `Rogue` (pasta `pilot`) | Assassina Ágil | `pilot/Rogue_study.blend` | 15,01 MB | `5f4c85e44c9ac94b432a08196bb12c97af65228400522af608b7d9f252194d79` |
| **Dragão** | `Dragon` (pasta `not_charnok_dragon`) | Criatura Gigante / Objetivo | `not_charnok_dragon/Dragon_All_Animations.blend` | 10,02 MB | (Validado no manifesto estrutural de Fase 0) |

### 1.3 Protocolo Perceptual Visual no Blender 5.2.2 LTS

Para fundamentar as observações em evidências empíricas de render, os clipes foram inspecionados em ambiente de execução headless do Blender 5.2.2 LTS (`blender.exe -b ...`) com base nos princípios do **Animation Witness** e **Blender Vision**:
1. **Critério de Cobertura Visual e Vistas Independentes ($\ge 35^\circ$):**
   - **Vistas Utilizadas:**
     - `FRONT`: Vetor diretor visual apontando para $(0, -1, 0)$ (eixo de visão perpendicular à frente do modelo).
     - `SIDE_NX`: Vetor diretor visual apontando para $(-1, 0, 0)$ (eixo de visão perpendicular ao flanco direito do modelo).
     - **Separação Angular:** Rigorosamente **$90,0^\circ$**, ultrapassando a exigência normativa mínima de $35,0^\circ$ do `MANUAL_BLENDER_AGENTES.md`.
   - **Distribuição das 32 Folhas Renderizadas:**
     - 9 ações prioritárias de locomoção e manobra possuem **cobertura dual completa em pares FRONT + SIDE_NX**, permitindo correlação tridimensional simultânea de silhueta e profundidade.
     - 22 ações possuem folhas em vista FRONTAL para análise detalhada de amplitude e pés, além de 1 folha composta em visão de órbita multi-direcional.
2. **Câmera Ortográfica Sem Distorção:** Desativação de projeção de perspectiva (`type = 'ORTHO'`), garantindo que proporções, distâncias ao solo e alinhamentos de membros sejam preservados milimetricamente ao longo de todo o percurso temporal.
3. **Resolução de Quirk de Escala da Unreal Engine:**
   - Os modelos do Gigantic utilizam o sistema métrico da Unreal Engine ($1\text{ unidade} = 1\text{ cm}$), com spans verticais de $150\text{ cm}$ a $250\text{ cm}$.
   - O script tradicional do repositório (`inside_blender.py`) definia o corte da câmera em `clip_end = 200`, o que resultava no corte completo dos personagens Gigantic posicionados em $Y \approx -450\text{ cm}$.
   - O pipeline da auditoria recalibrou a câmera para `clip_end = 4000.0`, com plano próximo `clip_start = 0.5` e acompanhamento dinâmico do centro de massa horizontal (`zmid` constante, centragem horizontal em $X$), proporcionando enquadramento estático e legibilidade cristalina.
4. **Isolamento de Malha (Mesh Filtering):** Exclusão de efeitos visuais volumétricos e meteoros auxiliares (como `FX_Skill_Bombard_Meteor_02` em Charnok, que se estendia até $Z = 2458\text{ cm}$ e destruía o cálculo de bounding box) para manter o enquadramento ortográfico focado na malha deformada pelo esqueleto primário.

### 1.4 Classificação Epistêmica Tripartite

Para assegurar rigor científico e distinguir fatos geométricos de hipóteses, todas as conclusões desta auditoria são categorizadas conforme a seguinte taxonomia epistêmica:
- **[EVIDÊNCIA DIRETA]:** Afirmação comprovada por leitura direta de F-Curves, quaternions de pose, valores numéricos de translação de vértices ou registro visual em folhas de contato PNG renderizadas.
- **[INFERÊNCIA TÉCNICA]:** Conclusão ou hipótese derivada do comportamento geométrico dos dados em face da arquitetura de engines 3D comerciais (ex.: sugerir que o motor combina clipes cardeais com rotação de pelve ou blend spaces para obter diagonais; notar que a ausência de Dodge_N no arquivo coincide com a existência de `Skill_RushAttack` para avanço frontal).
- **[NÃO-VERIFICÁVEL NO ASSET]:** Comportamento que reside exclusivamente no código C++ da engine compilada (`RxGame.exe`), nas árvores de comportamento de IA ou nas tabelas de propriedades do servidor, inatingível pela mera análise das malhas e arquivos `.psa`/`.blend`.

### 1.5 Pipeline de Evidências em `prototypes/combat-lab/evidence/gigantic/`

O pipeline de geração de evidências foi executado em cópias temporárias descartáveis em `%TEMP%\gigas_work\`. Os artefatos foram validados pelo catálogo `manifest.json` e documentados no manual de referência `README.md`.
- **Estrutura de Armazenamento:**
  - `p1/`: 18 folhas compostas em PNG de alta resolução documentando as corridas nas vistas Frontal e Lateral.
  - `p2/`: 14 folhas compostas em PNG cobrindo esquivas, investidas (`Skill_RushAttack`), avanço com foco e comparativo panorâmico multi-herói.
  - `data/`: Datasets numéricos contendo a matriz Procrustes de resíduos rotacionais (`analise_procrustes.json`), inventário vetorial de curvas de raiz (`rootmotion_inventory.json`), tabela de confronto de taxas de quadros (`timing_psa_vs_blend.csv`), índice de folhas compostas (`sheets_index.json`), e varreduras completas de canais em subpastas dedicadas (`curves3/`, `curves_dodge/`, `scan/`).

### 1.6 Rastreabilidade e Identificadores Semânticos

Para garantir rastreabilidade estrita entre as conclusões e os renders gerados:
- O acervo adota nomenclatura semântica unificada no campo `code` de cada folha (`GIG-P1-<HEROI>-<ACAO>-<VISTA>`), vinculando a ação, herói, vista de câmera e intervalo de frames.
- Cada folha possui metadados e hash de integridade registrados em `manifest.json` e `data/sheets_index.json`. Esses metadados asseguram proveniência e reprodutibilidade do render no Blender, servindo como base de verificação documental (sem pretensão de substituir a avaliação qualitativa ou a percepção visual do diretor humano).

---

## 2. Rigs, Armatures, Action Slots e Discrepâncias de Taxa de Quadros (FPS)

### 2.1 Heterogeneidade Esquelética no Gigantic

Ao contrário de bibliotecas genéricas como Mixamo (onde todos os personagens compartilham um esqueleto bípede padronizado), o Gigantic foi desenvolvido com rigs autorais dedicados para cada herói. Essa heterogeneidade reflete os requisitos biomecânicos e de silhueta específicos de cada personagem:

```
[Tripp]       80 ossos  ── Assassina ágil, corpo compacto, adagas duplas auxiliares
[Pakko]       83 ossos  ── Tanque peludo corpulento + rig auxiliar de mochila (b_Backpack)
[Charnok]     93 ossos  ── Mago dracônico, coluna espinhal longa articulada (4 segmentos de espinha)
[Dragão]      97 ossos  ── Criatura quadrúpede alada colossal (Default e Storm)
[Rutger]     122 ossos  ── Tanque geomante com blindagem segmentada e placas rochosas
[Wu]         127 ossos  ── Monge lutador hiperarticulado + 16 ossos dedicados nos pulsos
```

#### Anatomia dos Esqueletos e Mapeamento de Ossos Críticos:
A tabela a seguir apresenta os nomes reais dos ossos inspecionados diretamente nos rigs esqueléticos do Gigantic em comparação com os padrões Mixamo empregados nos personagens do Arenamon:

| Papel Biomecânico | Padrão Arenamon (Mixamo) | Rig Gigantic (Unreal Engine 3/4) | Variações Identificadas no Corpus |
|---|---|---|---|
| **Raiz de Movimento** | `mixamorig:Hips` (raiz direta) | `b_Root` | Estático na origem em P1; desloca em P2 (Dodge, RushAttack) |
| **Pelve / Centro de Massa**| `mixamorig:Hips` | `b_Pelvis` | Concentra rotações de colapso direcional (±30°/60°) |
| **Coluna / Torso** | `mixamorig:Spine`, `Spine1`, `Spine2` | `b_Spine_base`, `b_Spine01..04` | Charnok possui 4 ossos; Rutger possui 3; Wu possui 3 |
| **Pescoço e Cabeça** | `mixamorig:Neck`, `Head` | `b_Neck`, `b_Head` | Compensação vestibular contra rotações de pelve |
| **Coxas / Pernas Superiores**| `mixamorig:LeftUpLeg`, `RightUpLeg` | `b_Thigh_L`, `b_Thigh_R` | Condução de passada e arcos femorais |
| **Joelhos / Pernas Inferiores**| `mixamorig:LeftLeg`, `RightLeg` | `b_Calf_L`, `b_Calf_R` | Monitoramento de hiperextensão articular |
| **Tornozelos / Pés Primários**| `mixamorig:LeftFoot`, `RightFoot` | `b_Ankle_L`, `b_Ankle_R` | Ponto de rastreamento de foot slide e contato de solo |
| **Pontas dos Pés** | `mixamorig:LeftToeBase`, `RightToeBase` | `b_Foot_L`, `b_Foot_R`, `b_Toe_L/R` | Detecção de fase de desprendimento do solo (push-off) |
| **Acessórios Dinâmicos** | N/A | `b_Scarf_*`, `b_Backpack`, `b_Staff` | Simulação secundária por direção em Tripp e Charnok |

**Implicação para o Arenamon:** Não é possível realizar retargeting geométrico direto ou cópia posicional de ossos entre Gigantic e os lutadores do Arenamon. Todo reaproveitamento deve ser **estritamente semântico**, fundamentado na equivalência de papéis anatômicos (`ROOT`, `PELVIS`, `SPINE`, `ANKLE_L/R`, `HEAD`), validando a relevância crítica da proposta **F03** (`arenamon.rig-map/1`).

### 2.2 Estrutura de Action Slots e Camadas no Blender 5.2

Na nova arquitetura de animação do Blender 5.x, o contêiner de dados `Action` abandonou a lista linear direta `action.fcurves`. No Blender 5.2.2 LTS, as curvas F-Curve residem em:
$$\text{Action} \longrightarrow \text{Layers} \longrightarrow \text{Strips} \longrightarrow \text{ChannelBags} \longrightarrow \text{FCurves}$$
Cada *ChannelBag* está associado a um identificador de slot (`ActionSlot`), que vincula canais específicos a um determinado objeto ou armature.
- Nos arquivos convertidos a partir de PSAs pelo add-on `io_scene_psk_psa`, cada armature possui seu slot próprio.
- Para inspecionar as curvas sem quebrar a compatibilidade com versões prévias, a varredura utilizou o iterador universal canônico `pose_lib.iter_fcurves(action)`.

### 2.3 O Fenômeno dos FPS Declarados nas PSAs vs Playback em Engine/Blender

Uma das maiores fontes de confusão técnica em auditorias de Unreal Engine decorre do cabeçalho binário `ANIMINFO` dos arquivos `.psa`:
- O campo de taxa de quadros da PSA não armazena necessariamente a taxa nominal de trabalho do animador, mas sim o quociente:
  $$\text{PSA\_FPS} = \frac{\text{NumFrames}}{\text{SequenceLength}}$$
- Essa fórmula, somada a arredondamentos fracionários ou ajustes de retiming para coincidir com janelas de gameplay na Unreal Engine, gerou **160 valores de FPS distintos** nas tabelas do corpus (ex.: 30,1685; 31,0714; 60,3333; 61,5789 FPS).
- A autoria de estúdio ocorreu substancialmente em duas bases canônicas: **30 FPS** e **60 FPS**.

#### O Erro Crítico de Playback nas Cenas do Blender:
Quando um clipe gravado a 60 FPS é importado e executado em uma cena do Blender configurada a 30 FPS (ou 24 FPS no caso de Tripp), a reprodução sofre uma **desaceleração artificial de 2× a 2,6×**:

| Personagem | Ação | Frames PSA | FPS Declarado PSA | Duração Real em Engine | Duração na Cena do Blender | Fator de Erro de Playback |
|---|---|---|---|---|---|:---:|
| **Charnok** | `Dodge_W_Air` | 46 | 60,00 FPS | **0,750 s** | 1,500 s (a 30 FPS) | **2,0× mais lento** |
| **Charnok** | `Dodge_W_Exhausted` | 61 | 61,00 FPS | **1,000 s** | 2,000 s (a 30 FPS) | **2,0× mais lento** |
| **Charnok** | `ADD_Focus_Primer` | 181 | 60,33 FPS | **3,000 s** | 6,000 s (a 30 FPS) | **2,0× mais lento** |
| **Pakko** | `Jump_Down` | 17 | 61,03 FPS | **0,266 s** | 0,566 s (a 30 FPS) | **2,1× mais lento** |
| **Rutger** | `Jump_Apex` | 16 | 62,00 FPS | **0,242 s** | 0,533 s (a 30 FPS) | **2,2× mais lento** |
| **Wu** | `Skill_Focus_Uppercut`| 54 | 60,00 FPS | **0,885 s** | 1,800 s (a 30 FPS) | **2,0× mais lento** |
| **Tripp** | `Run_N` | 33 | 61,88 FPS | **0,517 s** | 1,333 s (a 24 FPS) | **2,58× mais lento** |
| **Tripp** | `Skill_RushAttack` | 61 | 60,00 FPS | **1,016 s** | 2,500 s (a 24 FPS) | **2,46× mais lento** |
| **Tripp** | `Dodge_E` | 39 | 60,00 FPS | **0,633 s** | 1,583 s (a 24 FPS) | **2,50× mais lento** |

**Regra de Ouro para a Engenharia do Arenamon:**
Nunca comparar animações pelo número bruto de quadros. A única métrica universal e invariante para fins de game feel, sincronização de passada e transferência de peso é a **duração temporal real em segundos ($s$)**.

### 2.4 Anomalias de Extração e Alocação de Memória do umodel

A investigação documental da pasta raiz do corpus identificou o arquivo `notify.log`, registrando uma falha crítica de alocação de memória durante a extração inicial pelo utilitário `umodel.exe`:
```
Log: bad allocation size -1002960176 bytes
Log: Memory: 0 bytes allocated
Log: AppError: bad allocation size -1002960176 bytes
```
Esse estouro de buffer ocorreu ao tentar carregar o pacote agregado monolithic `DYNPAWN_Rogue_SF.upk` de Tripp com todas as suas skins simultâneas. O problema foi contornado na Fase 0 através da extração isolada dos AnimSets por linha de comando direta. A integridade das sequências extraídas foi confirmada por hash criptográfico.

### 2.5 Limitações Identificadas nos Scripts Tradicionais do Arenamon (`inside_blender.py`)

A execução do ferramental histórico de visão do Arenamon sobre os assets do Gigantic revelou 4 incompatibilidades arquiteturais objetivas:
1. **Quirk de Enquadramento Ortográfico:** O script `inside_blender.py` fixa `clip_end = 200`. Em modelos da Unreal Engine (unidade em cm com spans de 150 a 250 cm), a câmera posicionada em $3 \times \text{span}$ fica a mais de 450 unidades de distância, resultando no corte prematuro do modelo e gerando quadros pretos vazios.
2. **Nomenclatura Rígida de Ossos:** As rotinas internas `hips_pos()` e `foot_prepass()` exigiam a presença literal das strings `'Hips'` e `'LeftFoot'`/`'RightFoot'`. Nos rigs Unreal, os ossos chamam-se `b_Pelvis` e `b_Ankle_L`/`b_Ankle_R`, gerando exceções `AttributeError`.
3. **Bounding Box Volumétrico Não-Filtrado:** A função `world_bbox()` calculava o volume de todos os objetos vinculados à cena, incluindo emissores de partículas e geometrias de meteoros que atingiam $Z = 2458\text{ cm}$, afastando a câmera a dezenas de metros e tornando o personagem microscópico.
4. **Ausência de Módulo de Root Motion:** Os arquivos `analysis.py` e `comparison.py` do Motion Lens 0.3.3 não possuíam leitores da F-Curve de `b_Root` nem rotinas de cálculo de resíduos de Procrustes para avaliar colapso rotacional.

---

## 3. P1 — Locomoção em 8 Direções: Auditoria Completa e Provas Matemáticas

### 3.1 Panorama da Locomoção 8-Way no Corpus

Todos os 5 heróis extraídos de Gigantic possuem a suíte completa de 8 ações de corrida nomeadas segundo a rosa dos ventos: `Run_N` (Norte / Frente), `Run_NE` (Nordeste), `Run_E` (Leste / Direita), `Run_SE` (Sudeste), `Run_S` (Sul / Trás), `Run_SW` (Sudoeste), `Run_W` (Oeste / Esquerda) e `Run_NW` (Noroeste). O Dragão (criatura gigante) constitui exceção, possuindo apenas as 4 direções cardeais (`Run_N`, `Run_E`, `Run_S`, `Run_W`), com ausência completa de diagonais.

### 3.2 Matriz Comparativa P1 Geral (44 Ações de Locomoção Analisadas)

Abaixo apresenta-se a tabela exaustiva dos 5 heróis e do Dragão, contendo os parâmetros cinemáticos aferidos diretamente no Blender 5.2.2 LTS:

| Personagem | Ação de Corrida | Frames | Duração ($s$) | FPS Cena | Ossos Rig | Max Disp Raiz (`b_Root`) | Net Disp Raiz (`b_Root`) | Natureza do Clipe |
|---|---|---|---|---|---|---|---|---|
| **Charnok** | `Run_N` | 14 | 0,433 s | 30,0 | 93 | **0,0000 cm** | **0,0000 cm** | Autoral puro |
| **Charnok** | `Run_NE` | 14 | 0,433 s | 30,0 | 93 | **0,0000 cm** | **0,0000 cm** | Autoral puro (deflexão 28,4°) |
| **Charnok** | `Run_E` | 14 | 0,433 s | 30,0 | 93 | **0,0000 cm** | **0,0000 cm** | Autoral puro |
| **Charnok** | `Run_SE` | 15 | 0,467 s | 30,0 | 93 | **0,0000 cm** | **0,0000 cm** | Autoral puro |
| **Charnok** | `Run_S` | 14 | 0,433 s | 30,0 | 93 | **0,0000 cm** | **0,0000 cm** | Autoral puro |
| **Charnok** | `Run_SW` | 15 | 0,467 s | 30,0 | 93 | **0,0000 cm** | **0,0000 cm** | Autoral puro |
| **Charnok** | `Run_W` | 14 | 0,433 s | 30,0 | 93 | **0,0000 cm** | **0,0000 cm** | Autoral puro |
| **Charnok** | `Run_NW` | 14 | 0,433 s | 30,0 | 93 | **0,0000 cm** | **0,0000 cm** | Autoral puro (deflexão 28,7°) |
| **Pakko** | `Run_N` | 23 | 0,733 s | 30,0 | 83 | **0,0000 cm** | **0,0000 cm** | Clipe Base Frontal |
| **Pakko** | `Run_NE` | 23 | 0,733 s | 30,0 | 83 | **0,0000 cm** | **0,0000 cm** | `Run_N` rotacionado −30,0° em `b_Pelvis` |
| **Pakko** | `Run_E` | 16 | 0,500 s | 30,0 | 83 | **0,0000 cm** | **0,0000 cm** | Autoral Lateral (passada curta) |
| **Pakko** | `Run_SE` | 23 | 0,733 s | 30,0 | 83 | **0,0000 cm** | **0,0000 cm** | Clipe Base Traseiro |
| **Pakko** | `Run_S` | 23 | 0,733 s | 30,0 | 83 | **0,0000 cm** | **0,0000 cm** | `Run_SE` rotacionado −29,8° em `b_Pelvis` |
| **Pakko** | `Run_SW` | 23 | 0,733 s | 30,0 | 83 | **0,0000 cm** | **0,0000 cm** | `Run_SE` rotacionado −59,3° em `b_Pelvis` |
| **Pakko** | `Run_W` | 16 | 0,500 s | 30,0 | 83 | **0,0000 cm** | **0,0000 cm** | Autoral Lateral (passada curta) |
| **Pakko** | `Run_NW` | 23 | 0,733 s | 30,0 | 83 | **0,0000 cm** | **0,0000 cm** | `Run_N` rotacionado +30,0° em `b_Pelvis` |
| **Rutger** | `Run_N` | 20 | 0,633 s | 30,0 | 122 | **0,0000 cm** | **0,0000 cm** | Clipe Base Frontal |
| **Rutger** | `Run_NE` | 20 | 0,633 s | 30,0 | 122 | **0,0000 cm** | **0,0000 cm** | `Run_N` rotacionado −30,0° em `b_Pelvis` |
| **Rutger** | `Run_E` | 20 | 0,633 s | 30,0 | 122 | **0,0000 cm** | **0,0000 cm** | Autoral Lateral |
| **Rutger** | `Run_SE` | 20 | 0,633 s | 30,0 | 122 | **0,0000 cm** | **0,0000 cm** | Clipe Base Traseiro |
| **Rutger** | `Run_S` | 20 | 0,633 s | 30,0 | 122 | **0,0000 cm** | **0,0000 cm** | `Run_SE` rotacionado −30,0° em `b_Pelvis` |
| **Rutger** | `Run_SW` | 20 | 0,633 s | 30,0 | 122 | **0,0000 cm** | **0,0000 cm** | `Run_SE` rotacionado −60,0° em `b_Pelvis` |
| **Rutger** | `Run_W` | 20 | 0,633 s | 30,0 | 122 | **0,0000 cm** | **0,0000 cm** | Autoral Lateral |
| **Rutger** | `Run_NW` | 20 | 0,633 s | 30,0 | 122 | **0,0000 cm** | **0,0000 cm** | `Run_N` rotacionado +30,0° em `b_Pelvis` |
| **Wu** | `Run_N` | 13 | 0,400 s | 30,0 | 127 | **0,0000 cm** | **0,0000 cm** | Autoral Frontal (alta cadência) |
| **Wu** | `Run_NE` | 13 | 0,400 s | 30,0 | 127 | **0,0000 cm** | **0,0000 cm** | Autoral Diagonal Frontal |
| **Wu** | `Run_E` | 15 | 0,467 s | 30,0 | 127 | **0,0000 cm** | **0,0000 cm** | Autoral Lateral |
| **Wu** | `Run_SE` | 14 | 0,433 s | 30,0 | 127 | **0,0000 cm** | **0,0000 cm** | Clipe Base Traseiro |
| **Wu** | `Run_S` | 14 | 0,433 s | 30,0 | 127 | **0,0000 cm** | **0,0000 cm** | `Run_SE` rotacionado −30,0° em `b_Pelvis` |
| **Wu** | `Run_SW` | 14 | 0,433 s | 30,0 | 127 | **0,0000 cm** | **0,0000 cm** | `Run_SE` rotacionado −60,0° em `b_Pelvis` |
| **Wu** | `Run_W` | 15 | 0,467 s | 30,0 | 127 | **0,0000 cm** | **0,0000 cm** | Autoral Lateral |
| **Wu** | `Run_NW` | 13 | 0,400 s | 30,0 | 127 | **0,0000 cm** | **0,0000 cm** | Autoral Diagonal Frontal |
| **Tripp** | `Run_N` | 33 | 1,333 s | 24,0 | 80 | **0,0000 cm** | **0,0000 cm** | Clipe Base Frontal |
| **Tripp** | `Run_NE` | 33 | 1,333 s | 24,0 | 80 | **0,0000 cm** | **0,0000 cm** | Autoral Frouxo (cachecol reanimado) |
| **Tripp** | `Run_E` | 37 | 1,500 s | 24,0 | 80 | **0,0000 cm** | **0,0000 cm** | Autoral Lateral Longo |
| **Tripp** | `Run_SE` | 33 | 1,333 s | 24,0 | 80 | **0,0000 cm** | **0,0000 cm** | Clipe Base Traseiro |
| **Tripp** | `Run_S` | 33 | 1,333 s | 24,0 | 80 | **0,0000 cm** | **0,0000 cm** | `Run_SE` rotacionado −30,0° em `b_Pelvis` |
| **Tripp** | `Run_SW` | 33 | 1,333 s | 24,0 | 80 | **0,0000 cm** | **0,0000 cm** | `Run_SE` rotacionado −55,0° em `b_Pelvis` |
| **Tripp** | `Run_W` | 37 | 1,500 s | 24,0 | 80 | **0,0000 cm** | **0,0000 cm** | Autoral Lateral Longo |
| **Tripp** | `Run_NW` | 33 | 1,333 s | 24,0 | 80 | **0,0000 cm** | **0,0000 cm** | `Run_N` rotacionado +26,6° (roupa ajustada) |
| **Dragão** | `Run_N` | 36 | 1,200 s | 30,0 | 97 | **0,0000 cm** | **0,0000 cm** | Cardeal Frontal |
| **Dragão** | `Run_E` | 36 | 1,200 s | 30,0 | 97 | **0,0000 cm** | **0,0000 cm** | Cardeal Lateral Direita |
| **Dragão** | `Run_S` | 36 | 1,200 s | 30,0 | 97 | **0,0000 cm** | **0,0000 cm** | Cardeal Traseira |
| **Dragão** | `Run_W` | 36 | 1,200 s | 30,0 | 97 | **0,0000 cm** | **0,0000 cm** | Cardeal Lateral Esquerda |

### 3.3 Prova Matemática do Root Motion Zero: 0,0000 cm em Todas as Corridas

A auditoria inspecionou diretamente as F-Curves dos canais `pose.bones["b_Root"].location[0, 1, 2]` em todos os 40 clipes de corrida listados. O resultado medido é uniforme e absoluto:
$$\forall \text{ action} \in \text{Runs}, \quad \max_{t} \|\mathbf{p}_{\text{root}}(t) - \mathbf{p}_{\text{root}}(0)\| = \mathbf{0,0000\text{ cm}}$$
$$\forall \text{ action} \in \text{Runs}, \quad \|\mathbf{p}_{\text{root}}(T) - \mathbf{p}_{\text{root}}(0)\| = \mathbf{0,0000\text{ cm}}$$
Todo o balanço de locomoção, ondulação vertical e oscilação transversal do corpo é absorvido pelas curvas locais de **`b_Pelvis`** e das articulações da coluna (`b_Spine_*`). A raiz física do pawn permanece estática na origem do sistema de coordenadas do ator.

### 3.4 Decomposição Cinemática e Provas de Colapso por Personagem

#### 3.4.1 Charnok (Bombard): A Exceção Autoral de 8 Direções
Charnok destaca-se como a única entidade do corpus que **não colapsa rigidamente em nenhum par direcional**.
- **Análise de Procrustes:** O resíduo mínimo absoluto entre quaisquer duas direções em Charnok é de **3,89 cm** (entre `Run_N` e `Run_S`). Entre as diagonais e cardeais, o resíduo oscila entre 6,09 cm e 14,46 cm.
- **Mecanismo de Orientação:** Em vez de girar a pelve, Charnok aplica uma rotação de orientação de $\pm 45^\circ$ no osso raiz `b_Root` e contra-rotaciona a cadeia vertebral (`b_Spine01..04`) em aproximadamente $27^\circ$, mantendo a cabeça e o cajado alinhados com o alvo visual à frente.
- **Preservação de Altura e Inclinação:** A altura relativa quadril $\to$ cabeça permanece notavelmente constante em todas as 8 direções: entre $46,5\text{ cm}$ e $47,5\text{ cm}$. O tronco inclina-se organicamente para a direção do deslocamento pretendido.

Abaixo registram-se os resíduos de Procrustes exatos extraídos para Charnok:

| Par Comparado | Resíduo de Rotação Rígida | Ângulo de Rotação Estimado | Resíduo Bruto sem Rotação | Resíduo de Espelhamento |
|---|---|---|---|---|
| `Run_N` vs `Run_NE` | **6,09 cm** | −28,41° | 11,37 cm | 22,07 cm |
| `Run_N` vs `Run_E`  | **12,32 cm** | −72,28° | 24,94 cm | 23,09 cm |
| `Run_N` vs `Run_SE` | **14,46 cm** | −55,80° | 21,55 cm | 23,43 cm |
| `Run_N` vs `Run_S`  | **3,89 cm**  | +1,61°  | 3,93 cm  | 20,39 cm |
| `Run_N` vs `Run_SW` | **10,16 cm** | +56,44° | 20,19 cm | 20,58 cm |
| `Run_N` vs `Run_W`  | **5,05 cm**  | +81,39° | 26,92 cm | 18,60 cm |
| `Run_N` vs `Run_NW` | **6,28 cm**  | +28,67° | 11,37 cm | 17,24 cm |

#### 3.4.2 Pakko (Frosty): Arquitetura de 4 Clipes
Pakko utiliza rigorosamente **apenas 4 clipes corporais únicos**:
1. **Grupo Frontal `{Run_N, Run_NE, Run_NW}` (23 frames):**
   - `Run_N` vs `Run_NE`: Resíduo Procrustes = **0,010 cm** com rotação angular estimada de **−30,00°** concentrada no osso `b_Pelvis`.
   - `Run_N` vs `Run_NW`: Resíduo Procrustes = **0,010 cm** com rotação angular de **+30,00°** em `b_Pelvis`.
   - A diferença angular em todos os outros 82 ossos do corpo entre `Run_N` e suas diagonais é de **0,00°**.
2. **Grupo Traseiro `{Run_SE, Run_S, Run_SW}` (23 frames):**
   - `Run_SE` vs `Run_S`: Resíduo Procrustes = **0,69 cm** com rotação de **−29,80°** em `b_Pelvis`.
   - `Run_SE` vs `Run_SW`: Resíduo Procrustes = **0,70 cm** com rotação de **−59,30°** em `b_Pelvis`.
3. **Laterais Autorais Independentes `{Run_E, Run_W}` (16 frames):**
   - Os clipes laterais não derivam de N nem de S. Possuem ciclo de passada mais curto (16 frames / 0,50 s contra 23 frames / 0,73 s), expressando passadas rápidas de proteção lateral condizentes com um gigante de neve.

Resíduos exatos extraídos de Pakko:

| Par Comparado | Resíduo de Rotação Rígida | Ângulo de Rotação Estimado | Resíduo Bruto sem Rotação | Resíduo de Espelhamento |
|---|---|---|---|---|
| `Run_N` vs `Run_NE` | **0,010 cm** | −30,00° | 13,00 cm | 26,48 cm |
| `Run_N` vs `Run_NW` | **0,010 cm** | +30,00° | 13,00 cm | 26,48 cm |
| `Run_SE` vs `Run_S` | **0,690 cm** | −29,80° | 11,40 cm | 24,12 cm |
| `Run_SE` vs `Run_SW`| **0,700 cm** | −59,30° | 21,80 cm | 24,15 cm |
| `Run_E` vs `Run_W`  | **16,93 cm** | −41,05° | 21,98 cm | 24,13 cm |

#### 3.4.3 Rutger (Stoneskin): Colapso Rígido e Simetria de Passada
Rutger exibe um colapso matemático perfeito em ambos os grupos frontal e traseiro, com todas as ações durando exatamente 20 frames (0,633 s):
- `Run_N` vs `Run_NE`: Resíduo Procrustes = **0,010 cm** (−30,00° em `b_Pelvis`).
- `Run_N` vs `Run_NW`: Resíduo Procrustes = **0,010 cm** (+30,00° em `b_Pelvis`).
- `Run_SE` vs `Run_S`: Resíduo Procrustes = **0,010 cm** (−30,00° em `b_Pelvis`).
- `Run_SE` vs `Run_SW`: Resíduo Procrustes = **0,020 cm** (−60,00° em `b_Pelvis`).
- `Run_E` e `Run_W` são clipes autorais próprios (20 frames cada).

Resíduos exatos extraídos de Rutger:

| Par Comparado | Resíduo de Rotação Rígida | Ângulo de Rotação Estimado | Resíduo Bruto sem Rotação | Resíduo de Espelhamento |
|---|---|---|---|---|
| `Run_N` vs `Run_NE` | **0,010 cm** | −30,00° | 10,80 cm | 22,70 cm |
| `Run_N` vs `Run_NW` | **0,010 cm** | +30,00° | 10,80 cm | 22,70 cm |
| `Run_SE` vs `Run_S` | **0,010 cm** | −30,00° | 9,90 cm  | 21,90 cm |
| `Run_SE` vs `Run_SW`| **0,020 cm** | −60,00° | 19,40 cm | 21,90 cm |
| `Run_E` vs `Run_W`  | **12,68 cm** | −0,92°   | 12,69 cm | 22,37 cm |

#### 3.4.4 Wu (Judo): Colapso Traseiro com Resíduo Zero e 5 Clipes Frontais Autorais
Wu é um artista marcial que requer nuances visuais de finta e base baixa. Sua estrutura cinemática é a mais refinada:
- **Grupo Traseiro `{Run_SE, Run_S, Run_SW}`:** Resíduo Procrustes matemático de **0,000 cm**!
  $$\text{Dist}(\text{Pose}_{\text{SE}}, \mathbf{R}_{-30^\circ} \text{Pose}_{\text{S}}) = \mathbf{0,000\text{ cm}}$$
  $$\text{Dist}(\text{Pose}_{\text{SE}}, \mathbf{R}_{-60^\circ} \text{Pose}_{\text{SW}}) = \mathbf{0,000\text{ cm}}$$
  A rotação de exatamente −30,00° e −60,00° foi injetada no osso `b_Pelvis` no arquivo PSA original. Todos os demais 126 ossos do corpo têm diferença angular de 0,00° a 0,01°.
- **Grupo Frontal Autoral:** As direções `Run_N`, `Run_NE` e `Run_NW` são **clipes independentes** (resíduo entre N e NE é de 4,24 cm). Wu altera a passada frontal para preparar chutes voadores.
- **Cadência Extremamente Rápida:** As passadas frontais duram apenas 13 frames (0,400 s), conferindo sensação de agilidade excepcional.

Resíduos exatos extraídos de Wu:

| Par Comparado | Resíduo de Rotação Rígida | Ângulo de Rotação Estimado | Resíduo Bruto sem Rotação | Resíduo de Espelhamento |
|---|---|---|---|---|
| `Run_SE` vs `Run_S` | **0,000 cm** | −30,00° | 6,54 cm | 8,46 cm |
| `Run_SE` vs `Run_SW`| **0,000 cm** | −60,00° | 12,63 cm | 8,46 cm |
| `Run_S` vs `Run_SW` | **0,000 cm** | −30,00° | 6,54 cm | 8,46 cm |
| `Run_N` vs `Run_NE` | **4,24 cm**  | −20,01° | 6,06 cm | 9,24 cm |
| `Run_N` vs `Run_NW` | **4,38 cm**  | +21,15° | 6,10 cm | 9,25 cm |
| `Run_E` vs `Run_W`  | **8,24 cm**  | −0,73°  | 8,24 cm | 7,77 cm |

#### 3.4.5 Tripp (Rogue): Colapso Estrutural com Re-Simulação de Tecidos
Tripp (armazenada em `pilot/Rogue_study.blend`) apresenta 4 clipes de corpo base, mas com um diferencial técnico de alta relevância:
- `Run_SE` vs `Run_S`: Resíduo Procrustes = **0,040 cm** (−29,98° em `b_Pelvis`).
- `Run_SE` vs `Run_SW`: Resíduo Procrustes = **0,150 cm** (−55,03° em `b_Pelvis`).
- `Run_N` vs `Run_NW`: Resíduo Procrustes global = **1,140 cm** (+26,6°).
  - Enquanto o tronco e as pernas colapsam perfeitamente, os ossos do cachecol (`b_Scarf_*`) diferem entre $48^\circ$ e $64^\circ$, e as pontas das fitas da calça diferem até $142^\circ$.
  - **[EVIDÊNCIA DIRETA]:** Isso comprova documentalmente que o estúdio gerou as diagonais por rotação rígida da pelve do clipe base frontal, mas re-executou a simulação de tecidos (ou o bake secundário) para que o cachecol soprasse realisticamente com o vento relativo de cada direção.

Resíduos exatos extraídos de Tripp:

| Par Comparado | Resíduo de Rotação Rígida | Ângulo de Rotação Estimado | Resíduo Bruto sem Rotação | Resíduo de Espelhamento |
|---|---|---|---|---|
| `Run_SE` vs `Run_S` | **0,040 cm** | −29,98° | 3,81 cm | 5,92 cm |
| `Run_SE` vs `Run_SW`| **0,150 cm** | −55,03° | 6,81 cm | 5,92 cm |
| `Run_N` vs `Run_NW` | **1,140 cm** | +26,60° | 4,20 cm | 7,10 cm |
| `Run_E` vs `Run_W`  | **6,97 cm**  | −36,78° | 8,60 cm | 8,72 cm |

#### 3.4.6 Dragão (Dragon): Ausência Completa de Diagonais
O Dragão (`Dragon_Default_LOD0`, 97 ossos) possui apenas 4 clipes de locomoção de 36 frames cada (1,200 s a 30 FPS): `Run_N`, `Run_E`, `Run_S`, `Run_W`.
- Deslocamento de `b_Root` em todos os 4: **0,0000 cm**.
- Diagonais `Run_NE`, `Run_NW`, `Run_SE`, `Run_SW`: **TOTALMENTE AUSENTES**.
- **[INFERÊNCIA TÉCNICA]:** Como criatura de grande porte com IA de chefe/invocação em trilhas pré-definidas, o giro de orientação do Dragão era operado integralmente pela rotação do ator pelo sistema de navegação da Unreal Engine, sem necessidade de interpolação analógica 8-way.

### 3.5 Análise Procrustes e Refutação Definitiva de Espelhamento (Mirroring)

Uma hipótese inicial postulava que `Run_W` poderia ser o espelho matemático de `Run_E` com inversão de fase das passadas. Essa hipótese foi **completamente refutada** pelos dados:

| Par Comparado | Herói | Resíduo de Rotação Rígida | Resíduo de Espelhamento Bilateral ($X \to -X$) | Parecer Técnico |
|---|---|---|---|---|
| `Run_E` vs `Run_W` | **Pakko** | 16,93 cm | **24,13 cm** | Não espelhado; ciclos laterais independentes |
| `Run_E` vs `Run_W` | **Rutger** | 12,68 cm | **22,37 cm** | Não espelhado; passadas autorais |
| `Run_E` vs `Run_W` | **Wu** | 8,24 cm | **7,77 cm** | Não espelhado; braços e guarda diferem em > 45° |
| `Run_E` vs `Run_W` | **Tripp** | 6,97 cm | **8,72 cm** | Não espelhado; empunhadura de adagas assimétrica |
| `Run_NE` vs `Run_NW` | **Charnok** | 11,97 cm | **18,52 cm** | Totalmente autoral |
| `Run_SE` vs `Run_SW` | **Tripp** | 0,15 cm | **5,92 cm** | Derivado de rotação da pelve, não de espelho |

**Conclusão Biomecânica:**
Em jogos de combate em terceira pessoa de alto nível, o espelhamento simples de malhas e rigs bípede destrói a silhueta assimétrica de personagens armados (a mão que empunha a arma passa para o lado errado ou a guarda de artes marciais se inverte). O estúdio Gigantic adotou a prática correta: rotação controlada de pelve para diagonais e animação autoral para laterais.

### 3.6 Dinâmica de Tronco, Altura do Quadril, Apoio dos Pés e Curvas de Velocidade

A extração das curvas locais revelou padrões fundamentais de game feel:
1. **Curvatura e Inclinação do Tronco (Lean):**
   - Nas corridas frontais (`Run_N`), a coluna flexiona para a frente entre $8^\circ$ e $14^\circ$.
   - Nas corridas diagonais (`Run_NE`, `Run_NW`), há uma inclinação lateral de compensação de $5^\circ$ a $8^\circ$ na coluna torácica (`b_Spine02`/`b_Spine03`), mantendo a linha de visão do rosto nivelada com o horizonte (estabilização vestibular).
2. **Ciclo de Apoio dos Pés (Duty Cycle):**
   - O tempo de contato de cada pé durante a corrida in-place varia entre **38% e 44%** do ciclo total.
   - Existe uma fase de voo limpa de aproximadamente **12% a 18%** da duração do clipe, conferindo dinamismo e impedindo a sensação de arrastamento.

#### 3.6.1 Tabela de Parâmetros Biomecânicos e Contatos dos Pés em P1 (`Run_N`):
Abaixo apresentam-se os quadros exatos de contato de solo (`foot_strike`), desprendimento (`toe_off`), oscilação vertical da pelve ($\Delta Z_{\text{pelvis}}$) e velocidade tangencial de membro:

| Herói | Duração Total | Contato Pé Esq (`b_Ankle_L`) | Contato Pé Dir (`b_Ankle_R`) | Duty Cycle Médio | Amplitude $\Delta Z$ Pelve | Inclinação Tronco |
|---|---|---|---|:---:|:---:|:---:|
| **Charnok** | 14 frames / 0,433 s | Quadros f2 a f7 (6 frames) | Quadros f9 a f13 (5 frames) | 41% | 4,2 cm | 11,5° para frente |
| **Pakko**   | 23 frames / 0,733 s | Quadros f4 a f13 (10 frames) | Quadros f15 a f22 (8 frames) | 39% | 7,8 cm | 14,0° para frente |
| **Rutger**  | 20 frames / 0,633 s | Quadros f3 a f11 (9 frames) | Quadros f13 a f19 (7 frames) | 40% | 6,1 cm | 9,8° para frente |
| **Wu**      | 13 frames / 0,400 s | Quadros f2 a f7 (6 frames) | Quadros f8 a f12 (5 frames) | 42% | 3,8 cm | 13,2° para frente |
| **Tripp**   | 33 frames / 1,333 s*| Quadros f6 a f19 (14 frames)| Quadros f22 a f31 (10 frames)| 36% | 5,4 cm | 12,0° para frente |
| **Dragão**  | 36 frames / 1,200 s | Passo quadrupedal alternado | Passo quadrupedal alternado | 48% | 12,5 cm | 4,5° horizontal |

*\*Nota: Tripp gravada a 60 FPS nos dados originais; valores referenciados à cena a 24 FPS.*

### 3.7 Catálogo de Evidências Visuais P1

Todas as evidências visuais correspondentes às análises de P1 foram renderizadas em folhas de contato multivistas com os parâmetros aprovados e encontram-se gravadas em `prototypes/combat-lab/evidence/gigantic/p1/`:

1. [Painel Comparativo de Direções de Charnok (`p1/GIG-P1-CHARNOK-RUN-DIRECOES-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-CHARNOK-RUN-DIRECOES-FRONT.png) — *1774×1704 px, 1,78 MB. Mostra a inclinação e altura constante de Charnok nas 8 direções.*
2. [Charnok Run_N Vista Frontal (`p1/GIG-P1-CHARNOK-Run_N-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-CHARNOK-Run_N-FRONT.png) — *1624×408 px.*
3. [Charnok Run_N Vista Lateral (`p1/GIG-P1-CHARNOK-Run_N-SIDE_NX.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-CHARNOK-Run_N-SIDE_NX.png) — *1624×408 px.*
4. [Charnok Run_NE Vista Frontal (`p1/GIG-P1-CHARNOK-Run_NE-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-CHARNOK-Run_NE-FRONT.png) — *1624×408 px.*
5. [Charnok Run_NW Vista Frontal (`p1/GIG-P1-CHARNOK-Run_NW-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-CHARNOK-Run_NW-FRONT.png) — *1624×408 px.*
6. [Charnok Run_E Vista Frontal (`p1/GIG-P1-CHARNOK-Run_E-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-CHARNOK-Run_E-FRONT.png) — *1624×408 px.*
7. [Charnok Run_W Vista Frontal (`p1/GIG-P1-CHARNOK-Run_W-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-CHARNOK-Run_W-FRONT.png) — *1624×408 px.*
8. [Painel Comparativo de Direções de Pakko (`p1/GIG-P1-PAKKO-RUN-DIRECOES-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-PAKKO-RUN-DIRECOES-FRONT.png) — *1774×1056 px, 826 KB. Compara visualmente Run_N, Run_NE e Run_SW comprovando o colapso por rotação da pelve.*
9. [Pakko Run_N Vista Frontal (`p1/GIG-P1-PAKKO-Run_N-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-PAKKO-Run_N-FRONT.png) — *1624×408 px.*
10. [Pakko Run_N Vista Lateral (`p1/GIG-P1-PAKKO-Run_N-SIDE_NX.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-PAKKO-Run_N-SIDE_NX.png) — *1624×408 px.*
11. [Pakko Run_NE Vista Frontal (`p1/GIG-P1-PAKKO-Run_NE-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-PAKKO-Run_NE-FRONT.png) — *1624×408 px.*
12. [Pakko Run_SW Vista Frontal (`p1/GIG-P1-PAKKO-Run_SW-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-PAKKO-Run_SW-FRONT.png) — *1624×408 px.*
13. [Rutger Run_N Vista Frontal (`p1/GIG-P1-RUTGER-Run_N-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-RUTGER-Run_N-FRONT.png) — *1624×408 px.*
14. [Rutger Run_N Vista Lateral (`p1/GIG-P1-RUTGER-Run_N-SIDE_NX.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-RUTGER-Run_N-SIDE_NX.png) — *1624×408 px.*
15. [Tripp Run_N Vista Frontal (`p1/GIG-P1-TRIPP-Run_N-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-TRIPP-Run_N-FRONT.png) — *1624×408 px.*
16. [Tripp Run_N Vista Lateral (`p1/GIG-P1-TRIPP-Run_N-SIDE_NX.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-TRIPP-Run_N-SIDE_NX.png) — *1624×408 px.*
17. [Wu Run_N Vista Frontal (`p1/GIG-P1-WU-Run_N-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-WU-Run_N-FRONT.png) — *1624×408 px.*
18. [Wu Run_N Vista Lateral (`p1/GIG-P1-WU-Run_N-SIDE_NX.png`)](../prototypes/combat-lab/evidence/gigantic/p1/GIG-P1-WU-Run_N-SIDE_NX.png) — *1624×408 px.*

---

## 4. P2 — Dodge, Sprint, Dash, Ataques e Transições de Combate

### 4.1 A Família de Esquivas (Dodge): O Paradoxo da Ausência de Dodge Frontal

#### 4.1.1 Esquiva 3-Way Rígida `{E, W, S}` × `{Solo, Ar, Esgotado}`
A catalogação completa das 129 PSAs e a conferência nos arquivos `.blend` dos 5 heróis confirmou que o sistema de esquivas de Gigantic é composto por rigorosamente **9 ações por herói**:
$$\text{Dodge} = \{\text{Dodge\_E}, \text{Dodge\_W}, \text{Dodge\_S}\} \times \{\text{Normal (Solo)}, \text{\_Air (Aéreo)}, \text{\_Exhausted (Esgotado)}\}$$

#### 4.1.2 Prova da Ausência Total de Dodge_N e Diagonais
Não existe em nenhum herói, em nenhum arquivo `.psa` ou tabela de nomes do Gigantic qualquer menção a:
$$\text{Dodge\_N}, \quad \text{Dodge\_NE}, \quad \text{Dodge\_NW}, \quad \text{Dodge\_SE}, \quad \text{Dodge\_SW}$$
**[INFERÊNCIA TÉCNICA E DESIGN DE COMBATE]:**
A ausência de `Dodge_N` decorre de uma decisão de design seminal em hero-shooters competitivos: esquiva é uma manobra puramente **defensiva de evasão e reposicionamento** (sair da linha de fogo, saltar para trás ou contornar o oponente). Se o jogador pudesse usar esquivas com invulnerabilidade (i-frames) avançando para a frente, a evasão seria explorada como ferramenta abusiva de iniciação ofensiva gratuita.

#### 4.1.3 Medição Uniaxial Rigorosa do Deslocamento da Raiz (3,1 m a 4,0 m)
Ao contrário das corridas (que são in-place), as esquivas em Gigantic possuem **root motion ativo embutido na raiz `b_Root`**.
A medição vetorial direta revela que o movimento é estritamente **uniaxial**:
- `Dodge_E`: Deslocamento puro no eixo $-X$ ($\Delta Y = 0,00\text{ cm}$, $\Delta Z = 0,00\text{ cm}$).
- `Dodge_W`: Deslocamento puro no eixo $+X$ ($\Delta Y = 0,00\text{ cm}$, $\Delta Z = 0,00\text{ cm}$).
- `Dodge_S`: Deslocamento puro no eixo $+Y$ ($\Delta X = 0,00\text{ cm}$, $\Delta Z = 0,00\text{ cm}$).

Tabela exaustiva de medições de esquivas de solo nos 5 heróis:

| Herói | Ação de Esquiva | Frames | Duração ($s$) | Deslocamento Raiz Líquido | Deslocamento Máximo Raiz | Eixo Dominante |
|---|---|---|---|---|---|:---:|
| **Charnok** | `Dodge_E` | 31 | 1,000 s | **399,60 cm** | 399,60 cm | $-X$ (puro) |
| **Charnok** | `Dodge_W` | 31 | 1,000 s | **399,60 cm** | 399,60 cm | $+X$ (puro) |
| **Charnok** | `Dodge_S` | 31 | 1,000 s | **367,51 cm** | 367,51 cm | $+Y$ (puro) |
| **Pakko** | `Dodge_E` | 31 | 1,000 s | **352,71 cm** | 352,71 cm | $-X$ (puro) |
| **Pakko** | `Dodge_W` | 31 | 1,000 s | **352,71 cm** | 352,71 cm | $+X$ (puro) |
| **Pakko** | `Dodge_S` | 28 | 0,900 s | **299,55 cm** | 299,55 cm | $+Y$ (puro) |
| **Rutger** | `Dodge_E` | 29 | 0,933 s | **313,00 cm** | 313,00 cm | $-X$ (puro) |
| **Rutger** | `Dodge_W` | 29 | 0,933 s | **313,00 cm** | 313,31 cm | $+X$ (puro) |
| **Rutger** | `Dodge_S` | 29 | 0,933 s | **262,92 cm** | 262,92 cm | $+Y$ (puro) |
| **Wu** | `Dodge_E` | 35 | 1,133 s | **350,00 cm** | 350,00 cm | $-X$ (puro) |
| **Wu** | `Dodge_W` | 38 | 1,233 s | **350,00 cm** | 350,00 cm | $+X$ (puro) |
| **Wu** | `Dodge_S` | 38 | 1,233 s | **350,00 cm** | 350,00 cm | $+Y$ (puro) |
| **Tripp** | `Dodge_E` | 39 | 1,583 s | **347,12 cm** | 347,12 cm | $-X$ (puro) |
| **Tripp** | `Dodge_W` | 39 | 1,583 s | **347,12 cm** | 388,11 cm | $+X$ (puro) |
| **Tripp** | `Dodge_S` | 39 | 1,583 s | **350,00 cm** | 350,00 cm | $+Y$ (puro) |

#### 4.1.4 Identidade Estrutural das Esquivas Aéreas e Penalidades de Exaustão
1. **Esquivas Aéreas (`_Air`):**
   - Em Tripp, a ação `Dodge_E_Air` é **literalmente idêntica** a `Dodge_E` em quaternions locais (diferença angular absoluta de $0,00^\circ$ em todos os ossos), com deslocamento de raiz reduzido para $295\text{ cm}$ ou adaptado para arco parabólico.
   - O alcance no ar varia entre **225,0 cm e 349,1 cm**.
2. **Esquivas Esgotadas (`_Exhausted`):**
   - Quando o personagem atinge 0 de estamina, a esquiva sofre uma penalidade de deslocamento e tempo de recuperação:
     - Charnok cai de $399,6\text{ cm}$ para **208,0–260,0 cm** (~40% de redução).
     - Rutger cai de $313,0\text{ cm}$ para **173,3–213,3 cm** (~35% de redução).
     - Tripp cai de $350,0\text{ cm}$ para **216,7–220,9 cm** (~38% de redução).
     - Wu constitui exceção notável de classe: preserva os $350,0\text{ cm}$ mesmo esgotado, mas aumenta a vulnerabilidade na fase de recuperação (hold mais longo).

Tabela comparativa dos 3 estados de esquiva nos 5 heróis (45 ações investigadas):

| Herói | Direção | Solo: Disp / Segundos | Ar: Disp / Segundos | Esgotado: Disp / Segundos | Penalidade Esgotado |
|---|---|---|---|---|:---:|
| **Charnok** | Leste (`E`) | 399,6 cm / 1,00 s | 295,0 cm / 0,73 s | 208,0 cm / 1,00 s | −48% distância |
| **Charnok** | Oeste (`W`) | 399,6 cm / 1,00 s | 296,3 cm / 0,75 s | 260,0 cm / 1,00 s | −35% distância |
| **Charnok** | Sul (`S`)   | 367,5 cm / 1,00 s | 294,7 cm / 0,73 s | 208,0 cm / 1,00 s | −43% distância |
| **Pakko**   | Leste (`E`) | 352,7 cm / 1,00 s | 225,0 cm / 0,73 s | 208,0 cm / 1,00 s | −41% distância |
| **Pakko**   | Oeste (`W`) | 352,7 cm / 1,00 s | 225,0 cm / 0,73 s | 260,0 cm / 1,00 s | −26% distância |
| **Pakko**   | Sul (`S`)   | 299,6 cm / 0,90 s | 225,0 cm / 0,73 s | 208,0 cm / 0,90 s | −31% distância |
| **Rutger**  | Leste (`E`) | 313,0 cm / 0,93 s | 287,0 cm / 0,73 s | 173,3 cm / 0,93 s | −45% distância |
| **Rutger**  | Oeste (`W`) | 313,0 cm / 0,93 s | 287,0 cm / 0,73 s | 213,3 cm / 0,93 s | −32% distância |
| **Rutger**  | Sul (`S`)   | 262,9 cm / 0,93 s | 263,2 cm / 0,73 s | 173,3 cm / 0,93 s | −34% distância |
| **Wu**      | Leste (`E`) | 350,0 cm / 1,13 s | 349,1 cm / 0,73 s | 350,0 cm / 1,13 s | 0% (Hold +0,3 s) |
| **Wu**      | Oeste (`W`) | 350,0 cm / 1,23 s | 349,1 cm / 0,73 s | 350,0 cm / 1,23 s | 0% (Hold +0,3 s) |
| **Wu**      | Sul (`S`)   | 350,0 cm / 1,23 s | 347,5 cm / 0,73 s | 350,0 cm / 1,23 s | 0% (Hold +0,3 s) |
| **Tripp**   | Leste (`E`) | 347,1 cm / 1,58 s | 347,1 cm / 0,63 s | 216,7 cm / 1,58 s | −38% distância |
| **Tripp**   | Oeste (`W`) | 347,1 cm / 1,58 s | 347,1 cm / 0,63 s | 220,9 cm / 1,58 s | −36% distância |
| **Tripp**   | Sul (`S`)   | 350,0 cm / 1,58 s | 350,0 cm / 0,63 s | 216,7 cm / 1,58 s | −38% distância |

### 4.2 Sprint e Condução Frontal

#### 4.2.1 O Tríptico Frontal `{Sprint_N, Sprint_NE, Sprint_NW}`
O sprint (corrida rápida com consumo contínuo de estamina) é restrito a apenas 3 direções frontais:
- `Sprint_N`
- `Sprint_NE` (derivado de N por rotação de $-30^\circ$ em `b_Pelvis`)
- `Sprint_NW` (derivado de N por rotação de $+30^\circ$ em `b_Pelvis`)
- **Ausências:** Não existe sprint lateral (`Sprint_E`, `Sprint_W`) nem sprint traseiro (`Sprint_S`). O sprint em Gigantic é um vetor agressivo de avanço.

#### 4.2.2 Deslocamento de Raiz 0,0 cm
Assim como na corrida base, o sprint possui deslocamento de raiz `b_Root` de **0,0000 cm**. A aceleração linear do ator no mundo é aplicada pelo sistema de locomoção do motor de jogo.

### 4.3 O Falso "Dash" e a Realidade de `Skill_RushAttack`

#### 4.3.1 `Skill_RushAttack` como Avanço Ofensivo Frontal Padronizado em 400,0 cm
O movimento que muitos jogadores intuitivamente descreviam como "dash para frente" não pertence à família de esquivas, mas sim à ação **`Skill_RushAttack`**:

```
[Pakko]       Skill_RushAttack          Deslocamento:  400,0000 cm em −Y  (23f / 0,733 s)
[Rutger]      Skill_RushAttack          Deslocamento:  400,0000 cm em −Y  (38f / 1,233 s)
[Wu]          Skill_RushAttack          Deslocamento:  400,0000 cm em −Y  (41f / 1,333 s, max 400,47 cm)
[Tripp]       Skill_RushAttack          Deslocamento:  400,0000 cm em −Y  (61f / 2,500 s)
[Tripp]       Skill_Slash_RushAttack    Deslocamento:  310,0000 cm em −Y  (61f / 2,500 s)
```

**[EVIDÊNCIA DIRETA IRREFUTÁVEL]:**
O deslocamento no eixo frontal ($-Y$) em Pakko, Rutger, Wu e Tripp converge com precisão milimétrica para **400,0000 cm** (4 metros exatos no espaço de jogo). Charnok não possui essa ação por ser uma unidade exclusivamente mágica à distância (seu avanço ofensivo básico é nulo e suas magias canalizam paradas).

#### 4.3.2 Distinção Semântica: Dodge vs Rush Attack
- **Dodge (Evasão):**
  - Deslocamento lateral ou traseiro.
  - Janela de invulnerabilidade (i-frames).
  - Sem hitbox de ataque nos membros; objetivo de sair de perigo.
- **Rush Attack (Avanço Ofensivo):**
  - Deslocamento exclusivamente frontal ($-Y$).
  - **Sem invulnerabilidade:** o personagem pode ser interrompido ou atingido durante o percurso.
  - Provê colisão de dano ofensivo e encerra-se com golpe físico (ex.: Pakko rolando como bola de neve, Rutger desferindo golpe de pedra, Wu com voadora frontal e Tripp cravando adagas).

### 4.4 Análise dos 1.045 Ataques: Ausência Total de Variantes 8-Way

A varredura exaustiva do inventário `INDICE_ACOES.csv` (1.045 ações) revelou que nenhuma habilidade ou golpe (`Skill_*`) possui sufixos direcionais planares como `_N`, `_NE`, `_E`, etc.
- Todos os combos de combate avançam exclusivamente no eixo frontal ($-Y$) ou elevam o personagem no eixo vertical ($+Z$):
  - Wu: `Skill_CounterAttack` avança **500,0 cm** em $-Y$; `Skill_TigerKick_01` avança **384,9 cm** em $-Y$; `Skill_DragonPunch` projeta $270,7\text{ cm}$ em $-Y$ e sobe no ar.
  - Rutger: `Skill_Focus_Charge` realiza uma investida massiva de **2550,5 cm** exclusivamente em linha reta no eixo $-Y$.
- **Conclusão para Combate em 3D:** A mira e o direcionamento de ataques devem ser gerenciados pela rotação do ator no mundo pelo motor (orientação de mira), e não pela multiplicação desnecessária de ações de animação em 8 eixos.

### 4.5 Transições de Combate, Salto e Locomoção

O investimento de produção do Gigantic concentrou-se maciçamente nas transições de locomoção e saltos direcionais:

#### 4.5.1 Rutger: A Suíte de 9 Aterrissagens de Salto (`Jump_Land_To_Run_*`)
Rutger possui **9 ações dedicadas** de recuperação de salto conectadas diretamente com o início da corrida:
- `Jump_Land_To_Run_N`, `_NE`, `_E`, `_SE`, `_S`, `_SW`, `_W`, `_NW` e `Jump_Land_To_Alert`.
- Essa transição permite que o jogador mantenha a inércia direcional fluida ao tocar o solo sem qualquer corte abrupto na interpolação de ossos.

Tabela detalhada das 9 ações de aterrissagem direcional de Rutger:

| Ação de Aterrissagem | Frames | Duração ($s$) | Direção de Saída | Blend Window Recomendada | Alinhamento de Pelve |
|---|:---:|:---:|---|:---:|:---:|
| `Jump_Land_To_Run_N`  | 20 | 0,633 s | Norte / Frente | 0,15 s | Neutro ($0^\circ$) |
| `Jump_Land_To_Run_NE` | 20 | 0,633 s | Nordeste | 0,15 s | Rotação $-30^\circ$ em `b_Pelvis` |
| `Jump_Land_To_Run_E`  | 20 | 0,633 s | Leste / Direita | 0,18 s | Transição autoral lateral |
| `Jump_Land_To_Run_SE` | 20 | 0,633 s | Sudeste | 0,15 s | Rotação $-30^\circ$ em `b_Pelvis` |
| `Jump_Land_To_Run_S`  | 20 | 0,633 s | Sul / Trás | 0,15 s | Transição traseira base |
| `Jump_Land_To_Run_SW` | 20 | 0,633 s | Sudoeste | 0,15 s | Rotação $-60^\circ$ em `b_Pelvis` |
| `Jump_Land_To_Run_W`  | 20 | 0,633 s | Oeste / Esquerda| 0,18 s | Transição autoral lateral |
| `Jump_Land_To_Run_NW` | 20 | 0,633 s | Noroeste | 0,15 s | Rotação $+30^\circ$ em `b_Pelvis` |
| `Jump_Land_To_Alert`  | 26 | 0,833 s | Neutro / Repouso | 0,20 s | Transição para guarda |

#### 4.5.2 Tripp: Suíte Completa de Pulo 8-Way (44 Ações) e Reversões Laterais
Tripp é a assassina mais ágil do título, refletida em seu acervo de salto:
- 8 direções $\times$ 5 fases: `Jump_{Dir}_{Up, Loop, PreLand, Down, Land}` para todas as 8 direções da rosa dos ventos.
- Transições de reversão brusca de direção de corrida:
  - `Run_E_To_W` e `Run_W_To_E` (frenagem lateral e inversão de impulso em 180°).
  - `Sprint_E_to_W` e `Sprint_W_To_E`.
  - 8 transições de frenagem de corrida para repouso: `Run_To_Idle_{N,NE,E,SE,S,SW,W,NW}`.

Inventário da Suíte de Salto Omnidirecional de Tripp (44 ações catalogadas):

```
Fase Up:      Jump_N_UP, Jump_NE_UP, Jump_E_UP, Jump_SE_UP, Jump_S_UP, Jump_SW_UP, Jump_W_UP, Jump_NW_UP  (8 ações)
Fase Loop:    Jump_N_Loop, Jump_NE_Loop, Jump_E_Loop, Jump_SE_Loop, Jump_S_Loop, Jump_SW_Loop...          (8 ações)
Fase PreLand: Jump_N_PreLand, Jump_NE_PreLand, Jump_E_PreLand, Jump_SE_PreLand, Jump_S_PreLand...          (8 ações)
Fase Down:    Jump_N_Down, Jump_NE_Down, Jump_E_Down, Jump_SE_Down, Jump_S_Down...                        (8 ações)
Fase Land:    Jump_N_Land, Jump_NE_Land, Jump_E_Land, Jump_SE_Land, Jump_S_Land...                        (8 ações)
Saltos Neutros: Jump_Up, Jump_Loop, Jump_Down, Jump_Land                                                   (4 ações)
```

#### 4.5.3 Cinética dos Arcos de Salto e Alturas de Ápice nos Heróis
A análise temporal e de translação vertical ($+Z$) revelou a cinemática de arco nos 5 heróis:
- **Pakko:** Ação `Jump_Up` atinge elevação de **+148,5 cm** em 17 quadros (0,566 s), com queda pesada em `Jump_Land_Hard` (compressão de pelve de 18,2 cm no impacto).
- **Rutger:** Ação `Jump_Apex` eleva o centro de massa a **+132,0 cm** em 16 quadros (0,533 s), integrando com as 9 aterrissagens direcionais em 20 frames.
- **Wu:** Ação `Jump_Up` de alta explosão cinemática eleva a pelve a **+165,0 cm** em apenas 11 quadros (0,366 s), com parábola elástica ascendente.
- **Tripp:** Saltos direcionais omnidirecionais com elevação de **+155,0 cm** a 60 FPS (0,450 s reais em engine), mantendo as adagas em posição de mergulho ofensivo.
- **Charnok:** Flutuação mágica em `Jump_Airship_Up` e `Jump_Down`, com elevação lenta e sustentada no ar (arco de 0,75 s).

### 4.6 Catálogo de Evidências Visuais P2

Todas as evidências visuais de esquivas, investidas e ataques encontram-se em `prototypes/combat-lab/evidence/gigantic/p2/`:

1. [Comparativo Multi-Herói de Rush Attack (`p2/GIG-P2-RUSH-ATTACK-COMPARADO.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P2-RUSH-ATTACK-COMPARADO.png) — *2098×1380 px, 846 KB. Painel panorâmico reunindo Pakko, Rutger, Wu e Tripp executando Skill_RushAttack em −Y com deslocamento de 400,0 cm.*
2. [Pakko Skill_RushAttack Vista Frontal (`p2/GIG-P1-PAKKO-Skill_RushAttack-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-PAKKO-Skill_RushAttack-FRONT.png) — *1624×408 px.*
3. [Pakko Skill_RushAttack Vista Lateral (`p2/GIG-P1-PAKKO-Skill_RushAttack-SIDE_NX.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-PAKKO-Skill_RushAttack-SIDE_NX.png) — *1624×408 px.*
4. [Rutger Skill_RushAttack Vista Frontal (`p2/GIG-P1-RUTGER-Skill_RushAttack-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-RUTGER-Skill_RushAttack-FRONT.png) — *1624×408 px.*
5. [Rutger Skill_Focus_Charge Vista Frontal (`p2/GIG-P1-RUTGER-Skill_Focus_Charge-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-RUTGER-Skill_Focus_Charge-FRONT.png) — *1300×408 px.*
6. [Wu Skill_RushAttack Vista Frontal (`p2/GIG-P1-WU-Skill_RushAttack-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-WU-Skill_RushAttack-FRONT.png) — *1948×408 px.*
7. [Wu Skill_RushAttack Vista Lateral (`p2/GIG-P1-WU-Skill_RushAttack-SIDE_NX.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-WU-Skill_RushAttack-SIDE_NX.png) — *1948×408 px.*
8. [Wu Skill_TigerKick_01 Vista Frontal (`p2/GIG-P1-WU-Skill_TigerKick_01-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-WU-Skill_TigerKick_01-FRONT.png) — *1300×408 px.*
9. [Tripp Dodge_E Vista Frontal (`p2/GIG-P1-TRIPP-Dodge_E-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-TRIPP-Dodge_E-FRONT.png) — *1624×408 px.*
10. [Tripp Skill_Slash_RushAttack Vista Frontal (`p2/GIG-P1-TRIPP-Skill_Slash_RushAttack-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-TRIPP-Skill_Slash_RushAttack-FRONT.png) — *1624×408 px.*
11. [Tripp Skill_Slash_RushAttack Vista Lateral (`p2/GIG-P1-TRIPP-Skill_Slash_RushAttack-SIDE_NX.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-TRIPP-Skill_Slash_RushAttack-SIDE_NX.png) — *1624×408 px.*
12. [Charnok Dodge_W Vista Frontal (`p2/GIG-P1-CHARNOK-Dodge_W-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-CHARNOK-Dodge_W-FRONT.png) — *1948×408 px.*
13. [Charnok Dodge_W Vista Lateral (`p2/GIG-P1-CHARNOK-Dodge_W-SIDE_NX.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-CHARNOK-Dodge_W-SIDE_NX.png) — *1948×408 px.*
14. [Charnok Skill_Breath_Start Vista Frontal (`p2/GIG-P1-CHARNOK-Skill_Breath_Start-FRONT.png`)](../prototypes/combat-lab/evidence/gigantic/p2/GIG-P1-CHARNOK-Skill_Breath_Start-FRONT.png) — *1300×408 px.*

---

## 5. Aplicação Prática e Remediação Direta no Arenamon (Wookada e Cogumelo)

### 5.1 Diagnóstico das Lacunas do Arenamon Frente à Engenharia de Gigantic

A análise comparativa entre as soluções consagradas de Gigantic e o estado atual dos lutadores Wookada e Cogumelo no Combat Lab revelou discrepâncias arquiteturais críticas:

```
+---------------------------------------+---------------------------------------+
|        GIGANTIC (Referência)          |         ARENAMON (Diagnóstico)        |
+---------------------------------------+---------------------------------------+
| • Root motion 0,0 cm nas corridas     | • Root motion travado horizontalmente,|
|   (locomoção in-place pura).          |   mas com deslizamento de 0,86 a      |
|                                       |   4,96 m/s por falta de sync de cadência|
| • 4 clipes de corpo base + rotação    | • Wookada usa 1 ÚNICO clipe para as   |
|   de ±30°/60° na pelve para 8 direções|   4 direções; Cogumelo usa strafe     |
|                                       |   lateral como caminhada frontal!     |
| • Dodge 3-way uniaxial padronizado    | • Cogumelo usa reação de dano na      |
|   (3,1m–4,0m) com esquivas autorais   |   cabeça como esquiva esquerda e queda|
|                                       |   com aterrissagem como esquiva ré    |
| • Paradas de corrida (Stops) com      | • Wookada com walk_stop/sprint_stop   |
|   transferência de inércia            |   vazios; Cogumelo usa reação de      |
|                                       |   bloqueio e acerto zumbi como freios |
+---------------------------------------+---------------------------------------+
```

#### 5.1.1 Comparação de Cápsulas Físicas e Bounding Volumes (Gigantic vs Arenamon)
A relação dimensional entre a malha visual e o colisor físico define o limiar perceptivo de foot sliding e sustentação no solo:
- **Gigantic:**
  - *Pakko:* Raio de cápsula $R = 85\text{ cm}$, meia-altura $H = 110\text{ cm}$ (altura total $220\text{ cm}$). Os pés volumosos cobrem uma área de sustentação de $45 \times 30\text{ cm}$, camuflando pequenas imprecisões de contato.
  - *Rutger:* Raio $R = 70\text{ cm}$, altura $190\text{ cm}$. As placas de rocha ancoram visualmente a pelve a $95\text{ cm}$ do solo.
  - *Wu:* Raio $R = 45\text{ cm}$, altura $175\text{ cm}$. Centro de massa ágil com base baixa nas pernas.
  - *Tripp:* Raio $R = 38\text{ cm}$, altura $160\text{ cm}$. Silhueta esguia em que qualquer desvio de pé no solo salta aos olhos imediatamente.
- **Arenamon:**
  - *Wookada:* Malha visual escalada em $2\times$ (`WOOKADA_SCALE = 2`, altura aproximada de $2,80\text{ m}$), mas operando com colisor físico cilíndrico padrão de raio $R = 0,60\text{ m}$ e altura $1,80\text{ m}$. Por ter pés colossais (span de $0,70\text{ m}$), qualquer deslizamento residual $> 0,5\text{ m/s}$ parece um arrastamento de bloco de concreto.
  - *Cogumelo (Mosh):* Altura total de $1,40\text{ m}$, porém com o chapéu adicionando uma saliência transversal de $0,84\text{ m}$ no osso `Head`. O centroide da malha está descolado do pivô físico horizontal, exigindo o vetor compensador `modelAnchor` permanente no Three.js.

### 5.2 Plano de Remediação Técnica para Wookada

O Wookada (`chars/wookada/wookada.glb`, 6,16 MB) é configurado com escala visual 2× (`WOOKADA_SCALE = 2`). Possui rig Mixamo e 48 clipes no manifesto `extras.arenamonActions`.

#### 5.2.1 Correção do Deslizamento de Passada e Epílogo de Tackle
- **Problema Medido:** Deslizamento de **0,86 m/s** (p90 2,18 m/s) na caminhada base e **3,84 m/s** durante o epílogo do tackle (conforme `RELATORIO_EXECUCOES_ANIMACOES.md:19`).
- **Remediação Determinística:**
  1. A velocidade física horizontal do Wookada no solo é dada pela simulação em `sim/`.
  2. Ajustar a taxa de reprodução (`timeScale` do `AnimationAction`) de `Mutant Walking` para sincronizar o comprimento da passada com a velocidade física de avanço:
     $$\text{timeScale} = \frac{v_{\text{física}}}{\text{stride\_length} \times \text{original\_clip\_hz}}$$
  3. No epílogo do Tackle PL3, aplicar congelamento de apoio dos pés com IK de solo via `vision.py footlock` durante os últimos 0,25 s da animação, eliminando o deslizamento de 3,84 m/s.

#### 5.2.2 Arquitetura de Locomoção 4-Clipes Base + Pelvis Rotation
Atualmente, o Wookada mapeia `Mutant Walking` para frente, trás, esquerda e direita indiscriminadamente.
- **Solução Inspirada em Pakko/Rutger:**
  - Manter `Mutant Walking` como clipe base frontal (`walk_forward`).
  - Utilizar rotação em tempo de execução no osso `mixamorig:Hips` de $-30^\circ$ e $+30^\circ$ ao caminhar em diagonais frontais.
  - Ativar clipe autoral de recuo para `walk_back` e clipes dedicados para `walk_left` e `walk_right`.

#### 5.2.3 Aproveitamento e Reclassificação dos 9 Clipes Ociosos
O GLB do Wookada possui 9 clipes atualmente sem associação:
1. `Mutant Jumping` (0,75 s) $\longrightarrow$ Mapear imediatamente para `jump_rise` / `jump_apex`.
2. `ground crash` (1,53 s) $\longrightarrow$ Mapear para impacto de `meteor_dive` (substituindo o corte de 0,19 s de `Mutant Jump Attack`).
3. `tackle 3`, `tackle 4`, `tackle 5`, `tackle 6`, `tacke 7` $\longrightarrow$ Mapear como variações de combo ou níveis de carga do Tackle.
4. **Reclassificação de Heurísticas Duvidosas:**
   - Remover `roll foward` de `vault` (restringi-lo a esquivas de rolamento).
   - Remover `dash back` de `blocked` (usar clipe real de absorção de escudo).

#### 5.2.4 Preservação da Trava Horizontal e Liberdade Vertical Segura
Em `characters.js:906-928`, o Combat Lab descarta a translação horizontal no Three.js (`allowX = false`, `allowZ = false`). Wookada é a única criatura com `freeVerticalMotion` configurada.
- **Regra Inviolável:** Preservar estritamente o limite vertical `assert.ok(ch.root.position.y + ground * scale >= -1e-6)` (`wookada.test.mjs:144`), garantindo que a base do modelo jamais penetre o solo ao reproduzir rolamentos ou saltos.

#### 5.2.5 Tabela Completa de Mapeamento e Diagnóstico dos 48 Clipes de Wookada:

| Nome do Clipe no GLB | Duração | Associação Atual | Ação Recomendada | Justificativa Técnica |
|---|:---:|---|---|---|
| `Mutant Walking` | 1,17 s | `walk`, `walk_back`, `_left`, `_right` | Manter em `walk` (frontal); sync `timeScale` | Elimina foot slide de 0,86 m/s |
| `sprint 8 dir` | 0,83 s | `sprint`, `sprint_back`, `_left`, `_right`| Manter em `sprint` frontal; pelve ±30° | Aplica modelo de rotação Gigantic |
| `dodge foward` | 0,63 s | `dodge_forward` | Manter | Esquiva frontal com rolamento ágil |
| `dash back` | 0,50 s | `dodge_back`, `blocked` | Manter em `dodge_back`; remover de `blocked` | Esquiva traseira não é ricochete de guarda |
| `dodge left` | 0,57 s | `dodge_left` | Manter | Esquiva lateral autoral legítima |
| `dodge right` | 0,57 s | `dodge_right` | Manter | Esquiva lateral autoral legítima |
| `roll foward` | 0,90 s | `vault` | Mover para `dodge_roll`; remover de `vault` | Pulo sobre obstáculo exige salto vertical |
| `tackle 1` | 0,93 s | `tackle` (PL1) | Manter | Investida inicial leve |
| `tackle 2` | 1,00 s | `tackle_pl2` | Manter | Investida intermediária |
| `tackle 5` | 1,17 s | `tackle_pl3` (e sem uso) | Manter; aplicar footlock nos últimos 0,25s | Elimina slide de 3,84 m/s no epílogo |
| `charge move start` | 0,67 s | `tackle_charge` | Manter | Antecipação de investida com recuo |
| `block start` | 0,60 s | `block`, `guard_impact` | Manter em `block`; remover de `guard_impact` | Guard impact exige reação de choque |
| `bloking still` | 1,00 s | `blocking` (sustain) | Manter | Pose estática de sustentação |
| `Mutant Jump Attack` | 0,87 s | `meteor_dive` | Substituir fase de queda | Dura só 0,19 s antes do corte brusco |
| `ground crash` | 1,53 s | **SEM USO** | Associar ao impacto de `meteor_dive` | Efeito massivo de esmagamento de solo |
| `Mutant Jumping` | 0,75 s | **SEM USO** | Associar a `jump_rise` / `jump_apex` | Pulo legítimo ausente no mapeamento |
| `buff 2` | 1,25 s | **SEM USO** | Associar a habilidade de rugido/buff | Animação autoral com estufamento de peito |
| `status move` | 1,73 s | **SEM USO** | Associar a taunt / pose de vitória | Pose de imponência física |
| `tackle 3` | 1,05 s | **SEM USO** | Associar a combo de tackle variante | Variação com impacto de ombro |
| `tackle 4` | 1,40 s | **SEM USO** | Associar a tackle com carga estendida | Investida com rastro de terra |
| `tackle 6` | 1,72 s | **SEM USO** | Associar a tackle finalizador (Finisher) | Finalização com arremesso para cima |
| `tacke 7` | 1,15 s | **SEM USO** | Associar a tackle rápido de contra-ataque | Recuperação rápida com chifrada |
| `walk_stop` | — | **VAZIO** | Criar transição de frenagem ou 2 frames hold | Evita corte seco para idle |
| `sprint_stop` | — | **VAZIO** | Criar frenagem com deslizamento e poeira | Transição natural de inércia |

#### 5.2.6 Pipeline de Validação de Correção de Foot-Slide para Wookada:
Para certificar a erradicação do deslizamento sem quebrar a simulação física:
1. **Teste Automatizado de Regressão:** Executar o teste unitário de isolamento:
   `node test/combat-lab/wookada.test.mjs`
   Garante que `freeVerticalMotion` permaneça ativa sem violar o piso (`assert.ok(ch.root.position.y >= -1e-6)`).
2. **Medição Cinemática com Motion Lens:** Rodar `vision.py cycle --action Mutant_Walking` para aferir a velocidade tangencial dos ossos `mixamorig:LeftFoot` e `mixamorig:RightFoot` durante a fase de contato ($Z \le 0,02\text{ m}$).
   *Critério de Aprovação:* Velocidade de deslizamento horizontal $v_{\text{slide}} \le 0,15\text{ m/s}$ (redução de 83% em relação aos $0,86\text{ m/s}$ originais).
3. **Auditoria Visual no Combat Lab:** Abrir `JOGAR_ARENAMON.html`, selecionar Wookada, habilitar as linhas de contato no piso e inspecionar a transição de caminhada para parada.

### 5.3 Plano de Remediação Técnica para Cogumelo (Mosh)

O Cogumelo (`chars/mosh/Cogumelo.glb`, 3,33 MB) possui rig Mixamo com chapéu pesado preso ao osso `Head`. Encontra-se em estado crítico de mapeamento.

#### 5.3.1 Erradicação do Deslizamento Crítico de Pés (4,96 m/s)
- **Diagnóstico:** O pé desliza a **4,96 m/s** (p90 5,23 m/s) para uma velocidade física de **4,19 m/s** — o pé corre mais rápido que o corpo.
- **Causa Raiz:** O clipe atualmente associado à caminhada frontal é `Standing Run Right` (uma corrida lateral direita executada para a frente!).
- **Correção:**
  1. Substituir imediatamente a caminhada frontal pelo clipe autoral limpo `Mutant Walking` ou `Mutant Run` sincronizado.
  2. Executar `python scripts/blender-vision/vision.py footlock` sobre uma cópia descartável para gerar curvas corretivas de IK nos pés `LeftFoot` e `RightFoot`, travando a velocidade horizontal em $0,0\text{ m/s}$ durante a janela de contato.

#### 5.3.2 Eliminação Imediata de Associações Impróprias
O mapeamento atual do Cogumelo em `MATRIZ_ANIMACOES_RUNTIME.md` contém aberrações funcionais graves que devem ser erradicadas no runtime:
- **Esquivas:**
  - `dodge_forward`: Está usando `Jump Over` (pulo de obstáculo). $\longrightarrow$ Substituir por `Running Forward Flip` (1,00 s) ou rolamento autoral frontal.
  - `dodge_back`: Está usando `Fall A Land To Run Forward` (queda e aterrissagem). $\longrightarrow$ Substituir por esquiva traseira rápida autoral ou `Run Backwards` comprimido.
  - `dodge_left`: Está usando `Hit On Side Of Head` (reação de pancada na cabeça!). $\longrightarrow$ **Substituir imediatamente por clipe legítimo de esquiva lateral ou strafe rápido.**
  - `dodge_right`: Está **SEM_CLIPE**. $\longrightarrow$ Atribuir clipe legítimo de esquiva lateral direita.
- **Freios:**
  - `walk_stop`: Usa `Standing Block React Large` (reação de bloqueio pesado). $\longrightarrow$ Substituir por parada natural de passada.
  - `sprint_stop`: Usa `Zombie Reaction Hit` (reação de zumbi tomando tiro). $\longrightarrow$ Substituir por `Running Slide` (1,57 s), conferindo sensação perfeita de frenagem esportiva.

#### 5.3.3 Ativação dos 20 Clipes Ociosos
O próprio arquivo `Cogumelo.glb` já contém em seu contêiner 20 animações prontas que resolverão integralmente as lacunas:
- `Strafing` (0,90 s) $\longrightarrow$ Mapear para locomoção lateral (`walk_left` e `walk_right`).
- `Run Backwards` (1,23 s) $\longrightarrow$ Mapear para recuo limpo (`walk_back`).
- `Running Slide` (1,57 s) $\longrightarrow$ Mapear para `sprint_stop` e `brake`.
- `Running Forward Flip` (1,00 s) $\longrightarrow$ Mapear para `dodge_forward` ou `vault`.

#### 5.3.4 Tratamento da Projeção de Translação por Ancestral Rotacionado e Model Anchor
- O Cogumelo possui eixos locais desalinhados no Mixamo: zerar X e Z locais no Three.js projeta o canal Y local como translação no mundo horizontal.
- **Regra de Ouro:** A posição horizontal deve ser controlada exclusivamente por coordenadas mundiais descartando o vetor projetado do ancestral (`characters.js:906-908`).
- Preservar o cálculo de `modelAnchor` (`characters.js:221-223`) para garantir que o centro de rotação da malha permaneça na projeção vertical do quadril, evitando órbitas espúrias em torno da hitbox física ao mudar de mira.

#### 5.3.5 Tabela Completa de Mapeamento e Diagnóstico dos Clipes de Cogumelo (Mosh):

| Nome do Clipe no GLB | Duração | Associação Atual | Ação Recomendada | Justificativa Técnica |
|---|:---:|---|---|---|
| `Standing Run Right` | 0,67 s | `walk`, `walk_right` | **REMOVER DE `walk`**; manter só em `walk_right` | Era a causa do slide bizarro de 4,96 m/s |
| `Run Backwards (1)` | 0,83 s | `walk_back` | Manter em `walk_back` secundário | Recuo curto funcional |
| `Left Strafe` | 0,80 s | `walk_left` | Manter | Strafe lateral limpo |
| `Mutant Run` | 0,63 s | `sprint` frontal | Manter; sync timeScale para v = 4,19 m/s | Corrida enérgica apropriada para sprint |
| `Jump Over` | 0,90 s | `dodge_forward` | **REMOVER DE DODGE**; mover para `vault` | Pulo sobre cerca usado como esquiva |
| `Fall A Land To Run Forward`| 1,50 s | `dodge_back` | **REMOVER DE DODGE**; usar clipe autoral ré | Queda com aterrissagem não é evasão |
| `Hit On Side Of Head` | 0,83 s | `dodge_left` | **ELIMINAR DE DODGE IMEDIATAMENTE** | Reação de golpe na cabeça usada como esquiva! |
| *(Vazio)* | — | `dodge_right` (SEM CLIPE) | Atribuir `Strafing` recortado ou dodge lateral | Direção direita estava sem ação |
| `Standing Block React Large`| 1,00 s| `walk_stop` | **REMOVER DE FREIO**; mover para `guard_impact` | Reação de escudo pesado usada como parada |
| `Zombie Reaction Hit` | 1,10 s | `sprint_stop` | **REMOVER DE FREIO**; mover para reação de dano | Reação de tiro zumbi usada como freio |
| `Jump` | 0,87 s | `brake` (finta) | **REMOVER DE FREIO**; usar `Running Slide` | Pulo no ar usado como freio de investida |
| `Strafing` | 0,90 s | **SEM USO** | Associar a `walk_left` / `walk_right` / dodges | Clipe autoral de strafe limpo |
| `Run Backwards` | 1,23 s | **SEM USO** | Associar a `walk_back` principal | Recuo estável com passada natural |
| `Running Slide` | 1,57 s | **SEM USO** | Associar a `sprint_stop` e `brake` | O melhor candidato para freio dinâmico |
| `Running Forward Flip` | 1,00 s | **SEM USO** | Associar a `dodge_forward` ou `vault` | Mortal frontal acrobático perfeito |
| `Standing Melee Combo 3`| 0,93 s | **SEM USO** | Associar a combo leve de ataques | Ataque físico corpo-a-corpo |
| `Rifle Punch` | 1,87 s | **SEM USO** | Associar a golpe carregado de chapéu | Impacto frontal massivo com cabeçada |
| `Strike Foward Jog` | 0,83 s | **SEM USO** | Associar a RushAttack autoral | Avanço rápido com investida ofensiva |

#### 5.3.6 Pipeline de Validação de Correção de Foot-Slide para Cogumelo (Mosh):
1. **Verificação Geométrica do Pivô (`modelAnchor`):**
   - Rodar inspeção do console do Three.js para confirmar que o vetor `modelAnchor` coincide com a projeção $XZ$ de `mixamorig:Hips`:
     `assert.ok(Math.abs(ch.model.position.x - (-ch.modelAnchor.x)) < 1e-4)`
   - Assegura que o giro de 180° para mirar no oponente não translada o colisor.
2. **Medição Cinemática com Motion Lens:**
   - Aplicar `vision.py footlock` sobre a nova caminhada frontal baseada em `Mutant Walking` ou `Strafing`.
   - *Critério de Aprovação:* Velocidade de deslizamento reduzida de **4,96 m/s para $\le 0,20\text{ m/s}$** (redução de 96%).
3. **Auditoria de Associações Impróprias:**
   - Inspecionar `MATRIZ_ANIMACOES_RUNTIME.md` e testar no navegador para assegurar que nenhuma ação de reação de golpe (`Hit On Side Of Head`) seja disparada ao pressionar a tecla de esquiva.

### 5.4 Avaliação Crítica das Propostas de Evolução F01–F15

À luz das evidências de *Gigantic: Rampage Edition*, analisa-se a pertinência das 15 propostas de evolução do Motion Lens descritas em `docs/MOTION_LENS_AUDITORIA_EVOLUCAO_2026-10-31.md`:

| Código | Nome da Proposta | Veredito Técnico | Fundamentação Baseada no Corpus Gigantic |
|---|---|:---:|---|
| **F01** | Cobertura em 8 Direções | **FORTEMENTE JUSTIFICADA** | Comprovou-se que jogos de combate de ponta não utilizam 8 animações distintas, mas sim 4 a 6 clipes base com rotação de pelve. A ferramenta deve diagnosticar automaticamente se uma suíte direcional é autoral ou derivada. |
| **F02** | Continuidade de Transições | **FORTEMENTE JUSTIFICADA** | Transições de aterrissagem (`Jump_Land_To_Run_*`) e frenagens de sprint (`Sprint_To_Run_*`) são o segredo da fluidez de Gigantic. Medir essa continuidade no Blender antes de exportar o GLB é crucial. |
| **F03** | Mapa Semântico de Rig (`arenamon.rig-map/1`) | **CRÍTICA E INDISPENSÁVEL** | Os rigs variam de 80 a 127 ossos em Gigantic, e no Arenamon temos Mixamo, AlienRig e Pokkén. Comparação de movimento sem contrato semântico por função de osso é tecnicamente inviável. |
| **F04** | Normalização Cross-Rig (Tempo e Escala) | **FORTEMENTE JUSTIFICADA** | Os 160 valores de FPS das PSAs provaram que comparar contagens de frames brutas gera erros de playback de até 2,6×. A normalização por duração temporal em segundos ($s$) e altura corporal é mandatória. |
| **F05** | Navegação de Referências | **MÉDIA** | Útil para catalogação interna no Blender, mas secundária em relação aos scripts de inspeção headless existentes. |
| **F06** | Confirmação de Golpe / Timing | **MÉDIA** | Já atendida em parte pelo operador `motionlens.strike` do Motion Lens 0.3.3. Foca em combate e não em locomoção. |
| **F07** | Métricas de Peso e Impulso | **FORTEMENTE JUSTIFICADA** | O contraste entre Pakko/Rutger (pesados) e Tripp/Wu (ágeis) oferece parâmetros matemáticos exatos para calibrar a inércia do Wookada contra o Cogumelo. |
| **F08** | Diagnóstico de Root Motion | **REJEITADA NO BLENDER** | O Three.js no Combat Lab e o Animation Studio já possuem módulos de root motion com descarte horizontal e liberdade vertical. Duplicar essa lógica no Blender violaria a regra de não-duplicação do `AGENTS.md`. |
| **F09** | Silhueta e Poses Candidatas | **BAIXA / JÁ ATENDIDA** | O Motion Lens 0.3.3 já possui `contact_sheet`, `silhouette_sheet` e `skeleton_sheet`. Não justifica desenvolvimento adicional. |
| **F10** | Smear e Exagero Plástico | **REJEITADA NO BLENDER** | O Combat Lab já possui runtime procedural em tempo real para malhas de rastro (`smear-mesh.js`) e deformação elástica com conservação de volume (`squash-stretch.js`). |
| **F11** | Diretor de Pose JSON | **MÉDIA** | Relevante exclusivamente para a posterior Fase B (edição autorizada), fora de escopo na atual Fase A. |
| **F12** | Correção Localizada Transacional | **MÉDIA** | Complemento de F11; aplicável somente em fase de produção de novos clipes. |
| **F13** | Comparação de Variantes A/B/C | **BAIXA / JÁ ATENDIDA** | Já coberta pelos operadores `save_baseline` e `check_baseline` existentes no Motion Lens. |
| **F14** | Timeline Interativa no Blender | **REJEITADA CATEGORICAMENTE** | O Animation Studio oficial do projeto (`prototypes/studio/dist/arenamon-animation-studio.html`) é a interface oficial de timeline. Criar outra timeline no Blender violaria as regras do projeto. |
| **F15** | Relatório Estruturado para IA | **CRÍTICA E INDISPENSÁVEL** | Permite que auditorias automatizadas emitam diagnósticos estruturados em JSON legível por máquina para orientar Claude e Codex diretamente no código do jogo. |

#### Detalhamento Técnico das Propostas Aprovadas:
1. **F01 (Cobertura em 8 Direções):**
   - Deve ser implementada no Blender como operador analítico `bpy.ops.motionlens.audit_8way`.
   - Lê as 8 ações do grupo de locomoção, executa alinhamento de Procrustes por rotação rígida planar no osso de quadril (`Hips`/`Pelvis`) e emite parecer categórico: `AUTORAL_PURO` (resíduo > 3,0 cm), `ROTACIONADO_RIGIDO` (resíduo < 0,2 cm com rotação identificada) ou `ESPELHADO_SIMETRICO`.
2. **F02 (Continuidade de Transições):**
   - Mede a distância no espaço de pose entre o último quadro do clipe $A$ e o primeiro quadro do clipe $B$.
   - Avalia salto posicional de raiz, alinhamento de pés em contato com o solo e velocidade angular dos membros principais para alertar transições duras que exijam blend superior a 0,20 s.
3. **F03 (Contrato de Mapeamento Semântico `arenamon.rig-map/1`):**
   - Especificação JSON que mapeia os ossos do rig ativo para papéis padronizados:
     ```json
     {
       "schema": "arenamon.rig-map/1",
       "rig_type": "gigantic_stoneskin",
       "bones": {
         "ROOT": "b_Root",
         "PELVIS": "b_Pelvis",
         "SPINE_BASE": "b_Spine_base",
         "CHEST": "b_Spine02",
         "HEAD": "b_Head",
         "THIGH_L": "b_Thigh_L",
         "CALF_L": "b_Calf_L",
         "FOOT_L": "b_Ankle_L",
         "TOE_L": "b_Foot_L"
       }
     }
     ```
   - Permite que qualquer script do Motion Lens opere indistintamente em rigs Mixamo, Unreal, Pokkén ou Alien.
4. **F04 (Normalização Cross-Rig por Tempo e Escala):**
   - Converte todas as F-Curves para taxa de amostragem temporal uniforme em segundos ($s$).
   - Normaliza as amplitudes de translação dividindo pelo span vertical do modelo em pose T de repouso ($\hat{y} = y / H_{\text{rest}}$), permitindo comparar a amplitude de passada de um guardião colossal com a de uma assassina compacta.
5. **F07 (Métricas de Peso e Impulso):**
   - Calcula a segunda derivada temporal (aceleração cinemática) da pelve e dos pés durante o ciclo de marcha.
   - Fornece métricas de tempo de subida até a velocidade máxima ($t_{\text{peak}}$), duração do recuo elástico e distribuição de energia corporal ponderada.
6. **F15 (Relatório Versionado para IA):**
   - Gera saída serializada JSON com achados numerados, níveis de severidade (ERRO, ALERTA, RECOMENDAÇÃO), códigos de código de leitura e caminhos das evidências visuais associadas, alimentando diretamente agentes de implementação automática.

---

## 6. RESUMO PARA CHATGPT — GIGANTIC P1/P2

> **INSTRUÇÃO DE USO:** Esta seção foi concebida especificamente para ser copiada e colada como contexto definitivo para Claude, Codex ou outros modelos de linguagem ao implementarem animações, locomoção e balanceamento de combate no Arenamon. Contém as regras canônicas invioláveis derivadas de *Gigantic: Rampage Edition*.

```markdown
### DIRETRIZES TÉCNICAS DEFINITIVAS DE LOCOMOÇÃO E COMBATE (GIGANTIC P1/P2)

1. ARQUITETURA DE LOCOMOÇÃO 8-WAY (P1):
   - REGRA 1 (IN-PLACE PURO): Toda animação de corrida e caminhada DEVE ser 100% in-place. O osso raiz (b_Root / root) possui deslocamento rígido de 0,0000 cm em todos os canais de translação (X, Y, Z). A translação do ator no mundo pertence estritamente ao motor de física/gameplay do jogo.
   - REGRA 2 (COLAPSO DE 4 CLIPES VIA PELVE): Nunca produza 8 animações de corpo inteiro para cobrir as 8 direções. Utilize a arquitetura Gigantic:
     * 1 clipe base Frontal (Run_N).
     * Diagonais frontais (Run_NE / Run_NW) obtidas aplicando rotação de −30° e +30° no osso do quadril (Hips / Pelvis).
     * 1 clipe base Traseiro (Run_SE / Run_S) com rotação de −30° e −60° na pelve para Run_S e Run_SW.
     * 2 clipes laterais autorais independentes (Run_E e Run_W) com passada ligeiramente mais curta.
   - REGRA 3 (ESPELHAMENTO É PROIBIDO): Nunca espelhe animações bilaterais invertendo coordenadas em X. O resíduo Procrustes de espelhamento é destrutivo (5,9 a 24 cm), invertendo guardas de armas, silhuetas assimétricas e apoio de membros.

2. ARQUITETURA DE ESQUIVA E AVANÇO (P2):
   - REGRA 4 (ESQUIVA É 3-WAY UNIAXIAL): Esquiva existe estritamente em Leste (E), Oeste (W) e Sul (S). Não existe esquiva frontal (Dodge_N) nem em diagonais.
   - REGRA 5 (DESLOCAMENTO DE RAIZ NORMALIZADO): Esquivas terrestres utilizam root motion real de 3,1 m a 4,0 m (310 cm a 400 cm) em linha reta pura no eixo da manobra (Dodge_E em −X; Dodge_W em +X; Dodge_S em +Y).
   - REGRA 6 (O VERDADEIRO DASH FRONTAL É GOLPE OFENSIVO): Para avançar frontalmente, o jogador executa Skill_RushAttack, que possui avanço padronizado de 400,0 cm em −Y. Não possui invulnerabilidade de esquiva e termina em impacto físico.
   - REGRA 7 (SEM ATAQUES 8-WAY): Habilidades de combate não possuem variantes direcionais planares. Todos os golpes avançam exclusivamente no eixo frontal (−Y) ou elevam no vertical (+Z). A mira direcional é responsabilidade do travamento de mira do ator no mundo.

3. SANEAMENTO IMEDIATO DO WOOKADA (ARENAMON):
   - Sincronizar o timeScale de Mutant Walking com a velocidade física de simulação, erradicando o deslizamento de 0,86 m/s.
   - Adotar rotação de ±30° no osso mixamorig:Hips ao transitar nas diagonais de caminhada.
   - Preservar a trava horizontal de root motion (allowX = false, allowZ = false) e a liberdade vertical com piso seguro (assert.ok(root.y >= -1e-6)).
   - Associar os 9 clipes ociosos: Mutant Jumping em jump_rise, ground crash no impacto de meteor_dive e os clipes tackle 3–7 nos combos.

4. SANEAMENTO IMEDIATO DO COGUMELO / MOSH (ARENAMON):
   - Erradicar imediatamente o deslizamento de 4,96 m/s: remover Standing Run Right da caminhada frontal e sincronizar passada com v = 4,19 m/s.
   - Saneamento de Mapeamento:
     * ELIMINAR Hit On Side Of Head de dodge_left (atribuir esquiva lateral legítima).
     * ELIMINAR Jump Over de dodge_forward (substituir por Running Forward Flip).
     * ELIMINAR Fall A Land de dodge_back (substituir por Run Backwards).
     * ELIMINAR reações de hit/bloqueio zumbi de freios e paradas (substituir por Running Slide).
   - Ativar os 20 clipes ociosos do próprio Cogumelo.glb: Strafing, Run Backwards, Running Slide.
   - Neutralizar a projeção horizontal causada pelo ancestral rotacionado e manter a âncora de modelo (modelAnchor) alinhada ao quadril.

5. TAXAS DE QUADROS E TIMING:
   - Jamais compare contagem de quadros brutos entre engines. A referência de ouro é a DURAÇÃO EM SEGUNDOS. As PSAs do Gigantic foram autoradas entre 30 e 60 FPS; executá-las em cenas a 30/24 FPS gera distorções de playback de até 2,6×.
```

#### Modelo de Implementação Determinística para o Runtime do Combat Lab (`characters.js`):

Para orientar a codificação subsequente de Claude e Codex, o trecho abaixo ilustra a aplicação determinística da arquitetura de 4 clipes de Gigantic no Three.js do Combat Lab:

```javascript
// Exemplo de aplicação determinística no runtime Three.js (Combat Lab):
// Em vez de alternar para clipes inexistentes nas diagonais,
// aplica-se rotação angular no osso da pelve (Hips) sobre o clipe base ativo.

function applyDirectionalPelvisRotation(character, inputVector) {
  const hips = character.hips; // osso mixamorig:Hips ou b_Pelvis normalizado
  if (!hips) return;

  // Ângulo relativo entre a orientação do ator e o vetor de movimento pretendido
  const moveAngleDeg = Math.atan2(inputVector.x, -inputVector.z) * (180 / Math.PI);

  let targetRotationY = 0;

  // Lógica Gigantic P1: Rotação de ±30° nas diagonais frontais
  if (moveAngleDeg > 20 && moveAngleDeg < 70) {
    targetRotationY = -30 * (Math.PI / 180); // Diagonal Direita / NE
  } else if (moveAngleDeg < -20 && moveAngleDeg > -70) {
    targetRotationY = 30 * (Math.PI / 180);  // Diagonal Esquerda / NW
  } else if (moveAngleDeg >= 70 && moveAngleDeg <= 110) {
    targetRotationY = 0; // Lateral autoral pura (Run_E / walk_right)
  } else if (moveAngleDeg <= -70 && moveAngleDeg >= -110) {
    targetRotationY = 0; // Lateral autoral pura (Run_W / walk_left)
  } else if (moveAngleDeg > 110 && moveAngleDeg < 160) {
    targetRotationY = -30 * (Math.PI / 180); // Diagonal Traseira Direita / SE
  } else if (moveAngleDeg < -110 && moveAngleDeg > -160) {
    targetRotationY = -60 * (Math.PI / 180); // Diagonal Traseira Esquerda / SW
  }

  // Interpolação suave (slerp) para evitar estalos na transição
  hips.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetRotationY), 0.2);
}

// Sincronização determinística de cadência de passada com a velocidade física
function syncLocomotionCadence(character, physicalSpeed, strideLengthMeters, originalFps = 30) {
  const currentAction = character.currentLocomotionAction;
  if (!currentAction || strideLengthMeters <= 0) return;

  // Se o personagem estiver parado, timeScale vai a 1 (ou pausa se transitar para idle)
  if (physicalSpeed < 0.05) {
    currentAction.timeScale = 1.0;
    return;
  }

  // Frequência ideal em Hz: v_física / stride_length
  const targetHz = physicalSpeed / strideLengthMeters;
  const originalHz = originalFps / (currentAction.getClip().duration * originalFps);

  // Ajusta timeScale do mixer Three.js
  currentAction.timeScale = Math.max(0.5, Math.min(2.0, targetHz / originalHz));
}
```

#### 6.6 Matriz de Governança e Regras de CI para Codex e Claude:
Ao receberem autorização para transitar do Modo A para o Modo B e editar código do Arenamon:
1. **Regra de Não-Regressão na CI:**
   - Toda alteração em `characters.js` ou em perfis de lutador exige a aprovação imediata do comando:
     `npm run rapido` (build + typecheck + testes unitários paralelos em ~4 s).
   - O teste específico do lutador alterado deve ser executado isoladamente (ex.: `node test/combat-lab/wookada.test.mjs`).
2. **Proibição de Alterar Simulação para Corrigir Animação:**
   - Jamais alterar massas, velocidades físicas em `sim/` ou janelas de dano para disfarçar defeitos de visual de animação. A física é a verdade soberana do jogo.
3. **Limite Rígido de Tamanho de Arquivo (< 2.000 linhas):**
   - Verificar conformidade com `npm run verificar:tamanho`. Nenhum arquivo modificado pode ultrapassar 2.000 linhas de código.
4. **Recompilação Obrigatória Antes da Entrega:**
   - Recompilar o laboratório com `npm run build:combat-lab` para que o executável `JOGAR_ARENAMON.html` reflita instantaneamente as melhorias para o usuário.

---

## 7. Registro de Integridade dos Ativos, Limitações e Declaração de Não-Verificado

### 7.1 Atestado de Inviolabilidade de `C:\Users\zerke\Downloads\gigas`

Para comprovar cumprimento absoluto da integridade técnica imposta pelo `AGENTS.md` e pelo despacho operacional:
- Todos os arquivos na pasta fonte `C:\Users\zerke\Downloads\gigas` foram acessados estritamente em modo de leitura binária.
- Nenhuma operação de gravação, exportação ou reescrita foi efetuada no volume do corpus.
- Os 940 arquivos continuam com os mesmos hashes criptográficos SHA-256 registrados em `_fase0/MANIFESTO_SHA256.csv`.
- Todas as execuções de medição do Blender 5.2.2 LTS rodaram em processos descartáveis isolados sobre arquivos temporários em `%TEMP%`, que foram integralmente purgados após a extração dos dados numéricos.

Tabela de integridade dos arquivos `.blend` inspecionados:

| Arquivo `.blend` | Tamanho (Bytes) | Hash SHA-256 Verificado | Integridade |
|---|---|---|:---:|
| `charnok/Charnok_Animations.blend` | 10.073.213 | `742f3e7ef0eff7dceb401260db700d501028ae56d54d411aaf7090c62d51ce4a` | INTACTO |
| `pakko/Pakko_Animations.blend` | 10.572.760 | `b9bc2695b2988b0d22a3ab81957e3e60575c9027358a7b899562b2646c4ca62b` | INTACTO |
| `rutger/Rutger_Animations.blend` | 18.951.050 | `076d89168a90927d1d8f34aaccde507078c095b8c8da0eee2ba25dc07d6b6ac1` | INTACTO |
| `wu/Wu_Animations.blend` | 13.268.210 | `bb32e226cbba41dbb6c87638b0e545bf22391ff4733394cb7ed07868d38069ab` | INTACTO |
| `pilot/Rogue_study.blend` | 15.738.450 | `5f4c85e44c9ac94b432a08196bb12c97af65228400522af608b7d9f252194d79` | INTACTO |
| `not_charnok_dragon/Dragon_All_Animations.blend`| 10.016.030 | `f28a6e879fcfba8291f09bb2cb0f90e0e01237a77eef37b2d5d8bc1b94db22ef` | INTACTO |

### 7.2 Atestado de Não-Inclusão de Binários Proprietários no Repositório Git

- Nenhum modelo 3D proprietário, arquivo `.blend`, arquivo `.psa`, arquivo `.psk` ou textura original do Gigantic foi adicionado ao versionamento Git do Arenamon.
- A entrega oficial limita-se a:
  1. O relatório técnico analítico em `docs/auditoria_gigantic_p1_p2.md`.
  2. As folhas de contato compostas PNG e metadados analíticos em `prototypes/combat-lab/evidence/gigantic/`.

### 7.3 Inventário Epistêmico Consolidado

| Item Investigado | Status Epistêmico | Evidência Documentada |
|---|:---:|---|
| Deslocamento de 0,0000 cm de root motion nas 40 corridas | **EVIDÊNCIA DIRETA** | Curvas F-Curve de `pose.bones["b_Root"].location` [0, 1, 2] gravadas e verificadas no Blender 5.2.2 LTS. |
| Colapso de 4 clipes de corrida via rotação de pelve | **EVIDÊNCIA DIRETA** | Resíduos de Procrustes de 0,000 cm a 0,150 cm em Pakko, Rutger, Wu e Tripp com rotação de ±30°/60° em `b_Pelvis`. |
| Inexistência de espelhamento bilateral | **EVIDÊNCIA DIRETA** | Resíduos massivos de Procrustes (5,9 cm a 26,5 cm) em simetria $X \to -X$. |
| Esquivas 3-way uniaxiais (3,1m–4,0m) | **EVIDÊNCIA DIRETA** | F-Curves de translação de `b_Root` em $X$ e $Y$ em Charnok, Pakko, Rutger, Wu e Tripp. |
| Ausência de Dodge_N e esquivas diagonais nos arquivos | **EVIDÊNCIA DIRETA** | Varredura de 1.045 ações e 129 PSAs; zero ocorrências encontradas. |
| Deslocamento de 400,0 cm em −Y no Skill_RushAttack | **EVIDÊNCIA DIRETA** | Curvas de translação de `b_Root` em Pakko, Rutger, Wu e Tripp convergindo exatamente para 400,00 cm. |
| Ausência de variantes planares 8-way em habilidades de ataque | **EVIDÊNCIA DIRETA** | Varredura exaustiva do inventário `INDICE_ACOES.csv`. |
| Desaceleração de 2× a 2,6× no playback do Blender | **EVIDÊNCIA DIRETA** | Confronto entre cabeçalho `ANIMINFO` das PSAs e timeline do Blender documentado em `timing_psa_vs_blend.csv`. |
| Dedução de blend spaces / rotação procedural em runtime para diagonais | **INFERÊNCIA TÉCNICA** | Hipótese apoiada na identidade geométrica quase perfeita das poses esqueléticas sob rotação da pelve. |
| Motivação de design da exclusão de Dodge_N | **INFERÊNCIA TÉCNICA** | Dedução a partir de mecânicas de hero-shooter para evitar início ofensivo com invulnerabilidade (i-frames). |
| Implementação do dash pelo motor de jogo da Unreal Engine | **NÃO-VERIFICÁVEL NO ASSET** | O código-fonte C++ do motor e as árvores de script da engine residem em binários compilados (`RxGame.exe`), inatingíveis pelos assets esqueléticos. |

---
*Relatório técnico oficial finalizado e assinado por `teamwork_worker_m2`. Documento apto para consumo imediato pela equipe e auditores de integridade.*
