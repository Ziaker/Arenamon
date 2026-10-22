# Laboratório visual — HUD de progressão e consumíveis (propostas)

> **Decisão de 21/10/2026:** o usuário escolheu o **HUD A · Banco de Células** e a **coleção de consumíveis A · Gemas Facetadas**
> (HUD B/C e itens B/C ficam descartados, preservados só neste laboratório) e pediu o cenário do laboratório no jogo.
> A escolha já está **integrada ao jogo principal** (seção "No jogo principal" abaixo). Nenhuma regra, GDD ou mecânica mudou.

**Abrir:** `prototypes/hud-consumiveis/dist/hud-consumiveis-laboratorio.html` (duplo clique; HTML único, offline,
funciona por `file://`). Também pelo portal `ABRIR_ARENAMON.html` › Jogo Principal › **🧪 Laboratório HUD & Consumíveis**
e por `HTMLS_ARENAMON.html`.

**Código:** `prototypes/hud-consumiveis/src/` · **Build:** `npm run build:hud-consumiveis` ·
**Teste de navegador:** `npm run test:hud-consumiveis` · **Evidências:** `prototypes/hud-consumiveis/evidence/`.

## O que é

Uma arena 3D de demonstração (laboratório técnico minimalista, formas geométricas, piso com réguas de 4/8/12/16 m e
boneco de referência de 1,8 m) com **nove combinações independentes**: HUD A/B/C × coleção de consumíveis A/B/C.
Trocar um lado não reinicia o outro nem reposiciona nada. É um ambiente só, não nove.

Não implementa coleta, spawn, colisão, gravidade, progressão nem combate. Os controles de estágio e o botão
"Simular coleta" são **demonstração** (identificados na interface) e não são a mecânica oficial.

## HUD — exatamente cinco atributos (estágios 0–4)

Valores exibidos = regras aprovadas (R5.1, R5.5–R5.8, R6.9–R6.13):

| Atributo | Por estágio | Máximo (estágio 4) |
|---|---|---|
| Ataque | +10% | +40% |
| Defesa | −10 p.p. de dano e empurrão | −40 p.p. |
| Stamina máxima | +1 ponto de capacidade | +4 pontos |
| Cooldown | −10% de duração | −40% |
| Velocidade | +5% | +20% |

Não mostram HP, stamina atual, escudo, golpes, cooldowns individuais nem estados momentâneos.

| Proposta | Posição | Como mostra os estágios | Identidade |
|---|---|---|---|
| **A · Banco de Células** | canto inferior esquerdo | cinco células verticais, quatro segmentos empilhados (cheios numerados 1–4; vazios hachurados) | condensada, "bateria" de jogo de arcade |
| **B · Radar Pentagonal** | canto inferior direito | pentágono com 4 anéis; a área preenchida mostra o conjunto, pontos acesos por spoke (o 4º é losango) | pílulas redondas + gráfico radial |
| **C · Faixa de Gemas** | topo, abaixo da barra | cartões em fita, quatro losangos por atributo (cheio/vazio) | monoespaçada, cartões chanfrados |

Todas comunicam: qual atributo (ícone + sigla), estágios adquiridos e faltantes (preenchido × vazio, `n/4`), e o bônus
acumulado. Não dependem só de cor: ícones próprios, preenchido × hachurado/vazio, números e "MAX" no estágio 4 (borda dourada).
Animação ao ganhar estágio: A "carimba" o segmento, B dispara um pulso no vértice e C gira o losango. A escala do HUD
é ajustável (60–150%) e há ajuste automático para telas de 1080p+.

## Consumíveis — sete tipos oficiais × três coleções = 21 modelos 3D

Tipos: Cura de HP (20 HP), Recuperação de Stamina (2 pontos) e evolução de Ataque, Defesa, Stamina máxima, Cooldown e
Velocidade. **Cores, formas e símbolos abaixo são propostas**, não decisões (R5.12 só exige cor, forma e símbolo próprios).

| Tipo | Cor | Símbolo | A · Gemas Facetadas | B · Vinil Cartoon | C · Módulos Tech |
|---|---|---|---|---|---|
| HP | rosa-vermelho | cruz | cruz facetada | coração gordinho | cápsula médica |
| Stamina (recuperação) | amarelo | raio | raio facetado | lata de energia | célula de bateria |
| Ataque | laranja | explosão | ouriço de espinhos | estrela puffy | adaga |
| Defesa | azul | escudo | escudo facetado | escudo redondo | placa hexagonal |
| Stamina máx. | verde-água | bateria | pilar hexagonal | frasco de poção | tanque modular |
| Cooldown | violeta | relógio | ampulheta | despertador | giroscópio |
| Velocidade | ciano | chevrons | duplo chevron | foguete | turbina |

Cada coleção tem linguagem própria: **A** angular com facetas chapadas e brilho interno; **B** toon com contorno grosso e
saltitar elástico; **C** metal PBR com faixas luminosas e peças giratórias. Cada uma tem pedestal e **indicador
flutuante** próprios (R8.12): losango de vidro (A), alfinete de mapa (B) e quadro holográfico hexagonal (C). O indicador
cresce com a distância da câmera (ajustável em Controles › Tamanho do indicador). Partículas localizadas usam
**three.quarks** (podem ser desligadas); mesmo sem elas e sem animação cada item continua reconhecível.

## Controles

Barra superior: HUD A/B/C (teclas 1–3), Itens A/B/C (4–6), Ocultar HUD (H), Controles (P). Gaveta **Controles**:
estágios 0–4 por atributo, Zerar, Todos no máximo, mostrar HUD, escala do HUD, disposição (Arena com distâncias variadas
× Vitrine lado a lado), indicadores (mostrar/tamanho), animações, partículas, câmera (Inicial/Frente/Lado/Cima/Vitrine; R
reinicia), inspeção de item (clique no item ou na lista) e "Simular coleta (demonstração)".

## Isolamento

Não importa nada de `prototypes/combat-lab`, não altera física, combate, HUD oficial, câmera do jogo nem regras. Usa
`three` e `three.quarks` já presentes no projeto (empacotados no HTML).

## No jogo principal (integrado em 21/10/2026)

Abra `JOGAR_ARENAMON.html` (ou `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`). Tudo é só apresentação e vem **ligado por padrão**, com
alternância para o visual anterior em **Visualizar › Câmera, tremor e HUD** (três grupos novos) e nos mesmos sliders no Ajustes:

| O quê | Onde fica | Alternar / ajustar |
|---|---|---|
| **HUD Banco de Células** | **horizontal compacto**, sob a barra de vida de cada lutador (jogador à esquerda, adversário à direita); a versão vertical (cantos inferiores) continua como opção | `display.progress`: ligar/desligar (volta aos selos clássicos do cabeçalho), **disposição** (horizontal/vertical), de quem (jogador/adversário/**os dois**, padrão), **tamanho do jogador** e **tamanho do adversário** (independentes, 40–200%), animação. Lê `fighter.stages` e os bônus de Mapa › Progressão. |
| **Consumíveis Gemas Facetadas** | desenham os itens que a simulação já cria (7 tipos) | `display.consumables`: estilo 1 = gemas · 0 = formas clássicas, escala, altura, indicador flutuante (e tamanho), animação, centelhas three.quarks, pedestal. |
| **Cenário Laboratório técnico** | piso escuro com régua de anéis, anel de blocos, prismas fora do piso, borda luminosa | `display.scenery`: tema 1 = laboratório · 0 = visual clássico cinza, blocos, prismas, legendas, distância dos anéis, altura dos blocos, borda. |

O cenário **respeita os sliders de cenário**: raio da arena (Mapa), cores de piso/grid/fundo/paredes, espessura do piso, divisões do grid e altura/espessura das paredes
(Ajustes › Visual) viram tons e proporções sobre a paleta do laboratório; com os valores padrão aparece exatamente o visual aprovado. Plataformas, obstáculos e
destrutíveis mantêm o desenho existente. Os prismas decorativos ficam **fora** do piso para não parecerem obstáculos. Código: `view/scenery.js`,
`view/consumables-gems.js`, `view/symbols.js`, `ui/progress-hud.js`, `ui/progress-values.js`.
Testes: `test/progress-scenery.test.mjs` (unitário) e `test/progress-scenery.browser.mjs` (navegador; capturas em `prototypes/combat-lab/evidence/progress-scenery/`).

## Pendências

A integração é **visual**: a coleta, o spawn e os efeitos dos consumíveis continuam sendo os da simulação (`sim/map.js`), sem alteração. As cores, formas e símbolos da
coleção A passam a ser o visual do jogo; revisar tamanho/altura das gemas e a exposição do piso em hardware real (testes aqui usaram WebGL por software).
