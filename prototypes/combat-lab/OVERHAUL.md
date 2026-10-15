# Overhaul do laboratório de combate — relatório técnico

Branch `feat/combat-lab-overhaul`. O HTML único e offline sai do build em `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`.
As evidências estão em [`evidence/overhaul/`](evidence/overhaul/): gráficos, capturas e relatórios dos testes.

Ponto de partida: as fontes em `src/` (Etapa A, aprovada). O HTML `arenamon-combate-laboratorio_CORRIGIDO.html` foi auditado e é o dist da Etapa A com três remendos colados no fim:
- a distância passa a ser `distância × 0,4 × velocidade`;
- a máquina de estados de animação ganhou correções;
- foram adicionados grupos recolhíveis e sliders rápidos.

Os três foram reimplementados nas fontes. Os sliders rápidos ficaram de fora porque duplicavam os do Ajustes. Nenhum arquivo do jogo oficial nem do GDD foi alterado.

## 1. Física e locomoção

**Auditoria.** A locomoção antiga (`approachVelocity`) usava aceleração de 60 m/s², frenagem de 100 e reversão de 140. O personagem chegava a 4,8 m/s em 80 ms e invertia +4,8 → −4,8 em cerca de 70 ms, o que é contínuo no papel, mas visualmente instantâneo. Não havia componente lateral nem curva. Com lock-on, o corpo sempre olhava para o alvo e a câmera, ao girar, encurvava a trajetória.

**Novo controlador** (`src/sim/locomotion.js`):
- A velocidade é decomposta na direção pedida.
- Na **componente paralela**:
  - a aceleração tem curva (`accelCurve`: forte no início, suave perto do máximo);
  - acima do alvo, a frenagem de excesso reduz a velocidade;
  - a **inversão** desacelera até zero com `reversal` e só então acelera no novo sentido, inclusive dentro do mesmo passo.
- A **componente perpendicular** se dissipa pela aderência lateral (`turnGrip`), que faz o papel de resistência à mudança de direção.
- Sem comando, atuam a frenagem com curva (`brakeCurve`), o atrito viscoso (`friction`) e a velocidade residual (`residualSpeed`).
- O giro do corpo tem aceleração angular (`turnAcceleration`), e a orientação visual continua interpolada.
- O movimento diagonal é normalizado.
- Todos os parâmetros têm sliders (Ajustes › Movimento). O modelo v6 continua selecionável.

**Garantia verificada:** sem colisões ou impulsos externos, |Δv| por passo ≤ `accelerationLimit(P, vMax) · dt`.

**Teste de inversão** (`test/locomotion.test.mjs`, com CSV por passo e SVG em `evidence/overhaul/inversao-*.svg`). Colunas do CSV: tempo, posição X/Z, velocidade X/Z, velocidade desejada, aceleração aplicada, direção de entrada, orientação visual, estado e fase.

| Caso | Velocidade antes | 1º passo após o comando oposto | Passos até zero | |Δv| máx. / limite |
|---|---|---|---|---|
| Caminhada | 4,80 m/s | −0,32 m/s (continua positiva) | 15 (125 ms) | 0,317 / 0,425 |
| Sprint | 7,44 m/s | −0,32 m/s | 23 (192 ms) | 0,317 / 0,358 |
| Diagonal | 4,80 m/s | −0,32 m/s | 15 | 0,317 / 0,425 |
| Lock-on ligado | 4,80 m/s | −0,32 m/s | 15 | 0,317 / 0,425 |

Nos quatro casos a velocidade é monótona (desacelera e acelera sem oscilar) e termina estável no sentido oposto.

**Lock-on separado.**
- As setas continuam relativas à câmera (`moveFrame`).
- O referencial fica travado enquanto a seta é mantida (`frameLatch`). Com a câmera real seguindo o alvo, o lateral anda reto: a direção varia menos de 0,01 rad. Sem a trava, como no v6, a trajetória encurva.
- O lock-on cuida da câmera, da orientação (`lockFacing`: para onde anda, alvo ou híbrido) e da mira: X ou C sem direção vão para o alvo.

**IA.** A IA já usava o mesmo controlador do jogador. Mesmas intenções produzem velocidades idênticas em todos os passos (testado). Agora as intenções passam por uma suavização:
- giro máximo de `moveSmoothing` rad/s;
- retenção contra zigue-zague (`minDirectionHold`).

Ataques, esquivas, defesa e respostas a um tackle em curso passam direto. Numa luta IA × IA de 40 s, o Δv da locomoção livre dos dois lados ficou dentro do limite. As personalidades foram preservadas: o teste da IA tática continua aprovado (80% e 63% contra o v6).

**Tackle e Dodge em fases** (`src/sim/motion.js`): preparação → impulso → deslocamento → desaceleração → recuperação.
- A forma da velocidade é normalizada, e o deslocamento de cada passo é a integral da curva.
- A mistura com a velocidade de entrada é compensada pela distância restante, então a ação nunca encurta nem alonga. Colisões não são compensadas.

Resultados medidos:
- distância nominal preservada (4,800 m);
- 1º passo abaixo de 25% do pico, sem saltos (variação por passo abaixo de 25% do pico);
- velocidade final ≈ 0;
- duração exata;
- vindo de uma corrida, a velocidade continua sem queda brusca e a distância é a mesma.

Os blocos comprimem e alongam conforme a fase. Distância, duração, invulnerabilidade, colisões e cancelamentos não mudaram.

**Mudança deliberada:** a distância nominal agora usa `distanceReference` (0,4 s): distância × 0,4 s × velocidade. Ela não muda quando a duração muda, inclusive pela sincronização com clipes. Nas durações padrão o valor é idêntico (4,8 m).

**Sincronização animação × física.** Ligada, a duração do clipe ÷ velocidade define só a duração da ação, e a física distribui a mesma distância nesse tempo. Desligada, o clipe é esticado para a duração configurada. A troca de animação nunca altera velocidade nem distância.

## 2. Animações

**Defeitos encontrados na auditoria:**
- o clipe reiniciava sempre que mudava o índice;
- a variante de esquiva era recalculada a cada quadro, então o corpo girando trocava esquerda/direita;
- a camada anterior era descartada no meio do fade;
- havia root motion só parcialmente travado;
- a locomoção oscilava entre parado, andar e correr;
- a IA ligava e desligava a defesa em poucos quadros, e a telemetria no navegador mostrou "entrar/sair da defesa" piscando.

**Correções** (`src/view/characters.js`):
- A entrada de estado é identificada pela ação: o tempo da ação recomeçando ou o tipo mudando, o que é robusto ao replay.
- Detectar o mesmo estado em quadros seguidos nunca reinicia o clipe.
- O fade é feito por camadas, com um fade curto próprio para X, C e reações.
- A direção da esquiva é fixada na entrada.
- Há histerese na locomoção e na defesa.
- O root motion horizontal é descartado.

**Variantes por estado.**
- Adicionar, remover, reordenar e prever cada variante.
- O sorteio é feito na entrada, com semente determinística (lutador, estado e passo), então o replay repete a escolha.
- As associações ficam salvas neste navegador.
- Clipes incompatíveis não podem ser associados.

**+ Importar animação para biblioteca.** Adiciona clipes ao catálogo sem criar blocos. A compatibilidade é verificada pelos ossos, com nomes normalizados (por exemplo, `mixamorig:` ↔ `mixamorig`). Os clipes existentes são preservados.

**Novos estados:**
- **Sprint**: o corpo gira para as 8 direções.
- **Freio da caminhada** e **Freio do sprint**: só entram com desaceleração física real.

**Telemetria:** registra troca, tempo e porcentagem tocados, motivo, interrupção, estados anterior e seguinte e origem (jogador, IA, combate, sistema ou prévia). Pode ser exportada em JSON.

**Altura visual:**
- ajuste automático por clipe: o ponto mais baixo da malha com skinning é amostrado e há mistura nas transições;
- offset por personagem e compensação por clipe;
- o colisor e a sombra não se movem.

**Medidas com o GLB local** (`drowzee/arenamon-prototipo.glb`, 38 clipes, IA × IA):
- 10 entradas de animação para 10 ações X/C;
- 87 trocas;
- 6 cancelamentos legítimos pela defesa identificados;
- 38 clipes reimportados como compatíveis.

## 3. Mecânicas

- **IA do oponente ligada/desligada** (Partida). Desligada, o vermelho vira boneco: recebe dano e reage fisicamente, mas não se move sozinho.
- **Sprint** (C mantido depois da esquiva):
  - entra a partir de `entryFraction` da esquiva;
  - tem velocidade, aceleração, frenagem e aderência próprias;
  - consome stamina por segundo e suspende a regeneração;
  - ao soltar C, desacelera até a caminhada;
  - stamina zerada encerra o sprint e deixa o lutador exausto;
  - as speedlines são próprias.
- **Barra de stamina restaurada.** Os elementos `stamina0` e `stamina1` existiam, mas o `<meter>` nativo do Chromium com 5 px de altura quase não aparecia. Agora tem aparência própria (amarela, azul quando exausto). Testado: 7 × 178 px e atualização em tempo real.
- **Círculo de reativação do Tackle após o Dodge — divergência, preciso da sua decisão.** Nas regras não existe círculo de distância. A reativação (C → X) é decidida por tempo: início e fim da janela, em Ajustes › X e C. O anel no chão é só o desenho dessa janela temporal. Sem inventar regra, tornei configuráveis o raio, a largura e a opacidade do anel (só visual). Se você quer uma condição espacial de verdade, diga qual raio e qual referência (posição do rival ou ponto de partida da esquiva).

## 4. Sombras, VFX e tremor

**Sombras** (Visualizar):
- estilos: A quadrada (compatibilidade), B círculo simples, C círculo suave com gradiente radial;
- sliders: opacidade, raio, escala X/Z, suavidade, deslocamento, intensidade, atenuação com a altura e escala mínima no ar;
- a sombra fica sempre na posição física, rente ao chão;
- o mapa de sombras está desligado, então não há sombras duplicadas.

**VFX** (`src/view/vfx.js`): 9 tipos × 3 variantes, listados na tabela abaixo. Cada tipo tem:
- liga/desliga e variante;
- parâmetros próprios, todos usados pelas três variantes;
- prévia, botão de restaurar o padrão e preset exportável/importável;
- registro do motivo de cada disparo (Visualizar › Depuração).

Os efeitos só leem o estado e os eventos da simulação. Nenhum efeito muda regras, tempos, invulnerabilidade ou cooldowns.

Exemplos de motivo registrado: "evento impact (passo 1613: vermelho → azul)" e "colisão com o solo (vertical 7,3 m/s)".

| Tipo | Gatilho real | A | B | C |
|---|---|---|---|---|
| Hit | evento `impact` | linhas radiais + faíscas | estrela irregular + fragmentos | anéis de choque + onda no chão |
| Esquiva | ação C em curso | rastros direcionais | cortes angulares | fantasmas (pose do GLB copiada) + rastros |
| Sprint | `sprinting` | fluxo contínuo | trilhas nos pés (ossos foot/toe) | túnel localizado |
| Bloqueio | evento `partial` | faíscas na direção do ataque | escudo translúcido curvo | ondas de absorção |
| Bloqueio perfeito | evento `perfect` | flash + anel + partículas | ruptura temporal (congela só poses e tela) | escudo hexagonal que comprime e libera |
| Chão | `lastLanding` (fim do voo na física) | poeira | anel + marca no chão | estilhaços + núcleo de energia |
| Clash | evento `clash` | explosão simétrica | linhas cruzadas | compressão e liberação |
| Exaustão | `exhausted` (estado real) | setas caindo | losangos e traços | filetes e símbolos |
| Regeneração | stamina subindo de verdade | setas subindo | linhas | partículas + pulsos |

Detalhes do bloqueio perfeito B: o "congelamento" é só visual (poses e filtro na tela). A simulação não para.

**Desempenho:**
- todas as partículas estão em um InstancedBufferGeometry por modo de mistura (aditivo e normal), com atlas procedural;
- o upload é parcial;
- há limite global (`maxParticles`).

Teste com dois lutadores e 5 efeitos a cada 250 ms: pico de 445 partículas (limite 1400). O tempo de quadro foi de 49,5 → 82,8 ms, mas isso é o Edge headless com GL por software: não mede GPU real. O baseline `deb1035` tem o mesmo tempo de quadro nesse ambiente.

**Tremor:**
- perfis A seco, B amortecido e C pulso direcional;
- liga/desliga por evento: defesa, hit, chão, defesa perfeita e clash;
- sliders: amplitude, duração, frequência, amortecimento, ângulo, intensidade e limite;
- desligamento global, que também encerra os tremores em curso;
- é aplicado depois da pose do rig: testado que não altera o yaw nem o referencial das setas.

Os efeitos antigos do v6 continuam disponíveis como opção ("Efeitos legados"), mantendo funcionais os parâmetros antigos.

## 5. Propostas de HUD

As três propostas são alternáveis em Visualizar › HUD e mostram os mesmos dados reais. Só uma aparece por vez, e o HUD atual continua sendo o padrão.

- **A · Arcade Vector**:
  - barras de HP largas e angulares, com faixa de dano atrasada;
  - stamina segmentada logo abaixo;
  - quatro discos de cooldown embaixo, no centro.
- **B · Combat Halo**:
  - anéis de HP e stamina nos cantos (jogador grande embaixo à esquerda, adversário em cima à direita);
  - discos radiais em arco.
- **C · Tactical Combat**:
  - módulos compactos com HP segmentado e numérico;
  - stamina em células;
  - estados explícitos (exausto, recuperando, sprint, defesa, contra-ataque, no ar, guard stun);
  - painel de ações 2×2.

Os cooldowns são **só demonstração**: rótulos "Demo 1–4", tempo fictício, ciclo automático e botões de disparo. A fonte de dados é substituível (`setCooldownSource`), pronta para dados reais.

Testes em 1280×720, 1920×1080 e 1024×768:
- HP correto;
- 4 cooldowns, sem nomes de habilidades;
- exaustão indicada;
- dentro da arena, sem cobrir o centro.

As capturas estão em `evidence/overhaul/hud-*.png`. **Não escolhi uma proposta.**

## 6. Interface

| Aba | Conteúdo |
|---|---|
| Partida | perfis, comportamento, **IA do oponente**, IA do jogador, semente e dificuldade |
| Ajustes | física, locomoção, X, C, **Sprint**, cancelamento, stamina, combate e IA (com "Restaurar todos os padrões") |
| Personagens | modelos, estados com variantes, biblioteca, importação, altura e telemetria |
| Visualizar | VFX, tremor, sombras, câmera, HUD, altura visual, indicador C → X e depuração |
| Controles | teclas, gamepad e histórico |
| Exportar | só importação, exportação e comparação (JSON v9 com efeitos e apresentação) |

Grupos com mais de dois itens têm ▼. Os parâmetros de câmera e sombra saíram do Ajustes, sem duplicar controles.

## 7. Testes executados

- `npm run verify` completo: aprovado, exit 0, todos os protótipos do repositório.
- Laboratório:
  - `sim`: 20 testes;
  - `core`: 20 testes, 167 verificações;
  - `properties`: 202 lutas aleatórias, 484.800 passos;
  - `ai`: 8 testes;
  - `gamepatch`: 4 testes;
  - **`locomotion`: 15 testes, 67 verificações**;
  - **`animation`: 10 testes, 31 verificações**;
  - `verify.mjs`: 19 etapas no navegador;
  - **`overhaul.browser`: 111/111 verificações** (WebGL real no Edge, GLB local, VFX, HUD, sombras, tremor, sprint e desempenho).
- Ajustes em testes antigos, por mudança deliberada de comportamento:
  - 4 verificações da Etapa A que medem a curva polinomial ou o referencial do alvo agora rodam com `ETAPA_A_MOTION` (o modo antigo). As equivalentes no modo novo estão em `locomotion.test`.
  - O limite de velocidade do teste de propriedades ficou proporcional à configuração sorteada (distância fixa e duração curta dão ações mais rápidas).
  - A exceção legítima "C → X sem invulnerabilidade" foi reconhecida.
  - A asserção frágil "contagens diferentes" passou a comparar sequências de contato.
  - Os testes de navegador usam teclas disparadas dentro da página, porque o GL por software deixa os quadros em cerca de 60 ms.
- `parity.mjs`: o HTML v6 não está neste computador, então o teste foi ignorado.

## 8. Limitações e pendências

- **A aprovação visual e jogável é sua.** Valores provisórios: curvas de locomoção, fases de X/C (o tackle foi calibrado para manter a IA tática competitiva) e todos os padrões de VFX e HUD.
- O desempenho só foi medido com GL por software (headless). Falta medir numa GPU real.
- A tolerância de "tocar até o fim" no navegador é de 2 quadros (34% com quadros de 60 ms). No Node (`animation.test`), as ações vão a 100% e terminam como "ação concluída".
- As animações importadas e as associações ficam salvas por nome neste navegador. Clipes importados precisam ser reimportados a cada sessão (o arquivo não é guardado).
- O círculo de reativação do tackle depende da sua decisão (seção 3).
- O GLB `drowzee` foi usado só localmente. Ele não foi adicionado ao Git; algumas capturas de evidência o mostram.
