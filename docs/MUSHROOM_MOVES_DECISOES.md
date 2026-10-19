# Arenamon — Catálogo de moves do Mushroom

> **Documento de decisões de design — fonte para implementação posterior.**  
> **Última consolidação:** 19/10/2026. **Status:** Bullet Punch com design principal aprovado; Sand Wave com especificação inicial aprovada e pendências identificadas. **Nenhum dos dois foi implementado ou testado neste documento.**  
> **Origem:** decisões explícitas do diretor nesta conversa, preservadas em ordem cronológica; informações técnicas do repositório são assinaladas separadamente.  
> **Escopo autorizado:** documentação das mecânicas e dos VFX explicitamente solicitados; **não** inclui criar animações, trabalhar em rigging, alterar o Combat Lab ou escolher novos parâmetros sem aprovação.
>
> **Regra de manutenção:** toda decisão futura aprovada deve ser incorporada aqui; o histórico não deve ser apagado. Quando uma regra anterior for substituída, registrar a substituição e usar a regra mais recente no contrato vigente.

## 1. Personagem e quatro moves — ordem informada pelo diretor

| Ordem informada | Move | Situação |
|---|---|---|
| 1 | **Emerging Stone** | **Move 1, substituindo o nome Rock Tomb**; parâmetros iniciais, projétil subterrâneo, explosão e rocha persistente agora descritos na **seção 7.1**. Detalhes adicionais de colisão, marcador e salto permanecem pendentes. **Sand Wave segue como Move 3.** |
| 2 | **Bullet Punch** | Mecânica descrita neste documento; implementação pendente. |
| 3 | **Sand Wave** | **Substitui Sand Kick**, por confirmação explícita do diretor; especificação inicial na seção 6, ainda com pendências de design. |
| 4 | **Body Slam** | Nome aprovado; gameplay ainda não especificado. |

**Identificação técnica em aberto:** o diretor chama o personagem **Mushroom**. `docs/ROSTER.md` chama o personagem cogumelo de **Mosh**, com recursos em `chars/mosh/`. A equivalência Mushroom ↔ Mosh **não foi confirmada explicitamente** nesta conversa; não substituir automaticamente o identificador do personagem no código.

**Renomeação vigente aprovada em 19/10/2026:** **Move 1: Rock Tomb → Emerging Stone**. Mudança **somente de nome**; **não** muda a identidade de Mushroom, a posição do golpe, as decisões de Bullet Punch/Sand Wave, o Move 4, nem aprova mecânica, estatística, animação, VFX ou implementação de Emerging Stone. Referências a **Rock Tomb** nas seções históricas deste documento descrevem a nomenclatura anterior e **não** restabelecem o nome antigo.

A ordem apresentada acima é a **ordem dos golpes definida pelo diretor**. Associação efetiva aos slots de loadout requer integração posterior.

## 2. Bullet Punch — contrato de gameplay vigente

### 2.1 Visão geral

O Bullet Punch é um move com **marcação manual de destino**, seguida de **preparação**, **desaparecimento físico do personagem**, **reaparecimento** e, se houver alvo elegível, **investida física PL2** equivalente ao Tackle quanto a dano e knockback.

**Segurar o botão para posicionar o marcador NÃO É o sistema Charge do Arenamon.** Não usar automaticamente a semântica de `charge` (carga de PL, soltura de outro tipo de golpe etc.).

### 2.2 Fase 1 — botão segurado: posicionamento e mobilidade

1. Ao segurar o botão, surge um **marcador de reaparecimento**, inicialmente a **3 m** de Mushroom.
2. Enquanto segura, a distância do marcador aumenta **gradualmente, com progressão quadrática** (começa mais devagar, acelera) até **10 m** em **2 s**. Os **10 m são limite rígido**; segurar por mais tempo não ultrapassa o limite.
3. A **direção do marcador é controlada independentemente da orientação corporal** de Mushroom, **usando basicamente os mesmos comandos direcionais de movimentação já existentes** no jogo; não criar esquema de controle novo sem necessidade e não presumir comportamento exato de entradas simultâneas ainda não detalhado.
4. Mushroom **pode movimentar-se enquanto posiciona o marcador**, mas sua velocidade é **reduzida em 70%** (resta **30% da velocidade normal**).
5. Enquanto o botão permanecer segurado, o marcador **acompanha a posição atual de Mushroom**, preservando a distância configurada relativa a ele.
6. O marcador **não atravessa obstáculos/limites válidos da arena**: quando a progressão encontra um bloqueio, **para no último ponto válido** e não pode avançar através do bloqueio.
7. **Pode ativar Bullet Punch a qualquer instante de um Dodge, independentemente do tempo decorrido da esquiva.** A esquiva em andamento **não sofre redução de velocidade**. Se o jogador ainda estiver segurando o botão quando a esquiva terminar, só então passa a valer a redução de **70%**.
8. **Defesa cancela o Bullet Punch sem consumir cooldown somente durante esta fase**, enquanto o botão do golpe ainda está segurado/ajustando o marcador. Como a stamina só é cobrada na soltura, não há cobrança de stamina nesta fase.
9. **O jogador solta o botão para confirmar o destino e disparar a preparação.** Se soltar enquanto ainda estiver em Dodge, a esquiva **é interrompida imediatamente** e a preparação começa sem esperar o fim da esquiva.
10. **Enquanto apenas segura o botão, não começa cooldown e não se cobra stamina.**

### 2.3 Marcador e indicação de alcance

- O marcador indica o ponto de **reaparecimento físico** após a fase de desaparecimento.
- No marcador há um **círculo visual de alcance**, que representa o **alcance físico da investida (Tackle executado)**, **não** o raio de busca.
- O círculo é **cinza** normalmente e fica **vermelho** quando houver inimigo dentro do **alcance físico indicado**.
- O raio de busca e o alcance físico da investida **são dois parâmetros diferentes**, cada qual com seu slider próprio.
- A posição do marcador durante o ajuste acompanha Mushroom; **ao soltar o botão o marcador fica fixo no mundo**, mesmo que Mushroom ainda caminhe durante a preparação.
- **Não** interpretar a mudança de cor como garantia de dano: o golpe exige posteriormente **alvo adquirido e colisão física real**.

### 2.4 Fase 2 — soltura e preparação

1. **Na soltura** começa uma preparação de **0,75 s**, valor aprovado.
2. **Nesse exato momento** cobram-se os recursos: stamina padrão de **1,5× o custo do Tackle normal** e início do cooldown padrão de **8 s**; ambos possuem sliders próprios.
3. Durante os 0,75 s de preparação Mushroom **pode se movimentar a 30% da velocidade normal** (redução de **70%**). **O marcador já não acompanha** o personagem.
4. A preparação **pode ser interrompida pelas regras normais de interrupção do Arenamon**.
5. Quando a preparação for interrompida, **mantém-se a stamina consumida e o cooldown completo de 8 s** (ou o valor do slider vigente na execução); **sem devolução de recursos**.
6. O cancelamento especial por Defesa **sem cooldown não se aplica mais** após a soltura.

### 2.5 Fase 3 — desaparecimento (sem presença física)

1. Depois dos **0,75 s de preparação**, Mushroom **desaparece** por **1,00 s inicialmente**, tempo configurável por slider.
2. Durante toda essa fase existem **VFX de speedlines**.
3. A especificação do diretor é literal: **o personagem “para de existir” durante o movimento e só “volta a existir” ao final**. Isso não é apenas invisibilidade ou invulnerabilidade visual: **não há corpo/colisor/hitbox/hurtbox fisicamente ativo** nesse intervalo.
4. Consequentemente, enquanto ausente, Mushroom **não pode receber ataques/dano, sofrer colisões ou ser selecionado como alvo**. O estado lógico indispensável para o término e o reaparecimento deve ser preservado internamente; os efeitos de speedlines podem continuar existindo visualmente.
5. **Não atribuir** duração de invulnerabilidade ao período de preparação ou ao período posterior com base nesta regra: o desaparecimento físico é uma fase distinta.

Com os padrões indicados, o reaparecimento acontece **0,75 + 1,00 = 1,75 s após a soltura**, além do tempo variável que o botão ficou segurado para ajustar o marcador.

### 2.6 Fase 4 — retorno, aquisição de alvo e investida

1. Ao concluir o desaparecimento, Mushroom **volta a existir na posição marcada**. Se o destino tiver se tornado ocupado/obstruído, **reaparece na posição válida mais próxima do marcador**.
2. No **instante do reaparecimento**, procura **o inimigo mais próximo a partir do ponto do marcador**, usando as **posições atuais** dos adversários.
3. O **raio de busca inicial é 5 m**, configurável por slider.
4. **Se não encontrar inimigo dentro do raio**, Mushroom **reaparece normalmente e NÃO executa investida**. **Stamina e cooldown são consumidos normalmente**; não conceder reembolso automático.
5. **Se encontrar um alvo**, Mushroom executa uma **investida física PL2**, começando do ponto de reaparecimento, **em linha reta na direção da posição que o alvo ocupava naquele instante**. **Não há perseguição/homing** durante o avanço.
6. A investida usa **a velocidade física do Tackle normal do Arenamon** e o mesmo perfil de **invulnerabilidade do Tackle normal** durante a investida.
7. A **distância máxima percorrida na investida é 3 m inicialmente**, configurável por um slider de **alcance físico**, separado do raio de busca de 5 m. É esse alcance físico que o círculo do marcador representa.
8. **Acertar exige colisão real**; reaparecer dentro do raio de busca **não causa dano imediato** nem cria acerto garantido.
9. **A investida termina imediatamente no primeiro acerto**, mesmo se o alvo acertado for **outro inimigo** que entre na trajetória antes do alvo selecionado.
10. Se o alvo estiver além do alcance físico, Mushroom **avança até o limite** e **pode errar**. Em caso de investida sem acerto, aplica-se **a recuperação normal do Tackle**.
11. Quando não há alvo no raio de busca, a investida **não ocorre**. A recuperação específica desse caso não foi definida em separado; não presumir que seja igual ou diferente da recuperação de uma investida executada sem acerto.

### 2.7 PL, dano, knockback e defesa

- **Power Level do Bullet Punch: PL2 fixo.**
- **Contra Tackle normal (PL1), Bullet Punch vence a disputa**. Contra outros movimentos, aplicar as regras normais de comparação de PL, Clash e Counter do Arenamon, em vez de garantir vitória universal.
- **PL2 não significa dano em dobro.**
- O dano e o knockback devem preservar **as mesmas propriedades e fórmulas do Tackle normal**, incluindo as interações já existentes com defesa, invulnerabilidade e modificadores.
- A **velocidade física da investida** é a do Tackle normal (**não** usa um slider de deslocamento novo).
- Separadamente, a **velocidade de impacto usada como parâmetro no knockback** é configurável por slider independente; seu valor inicial equivale a **1× a referência de impacto do Tackle normal**.
- **Não** criar fórmula alternativa de knockback ou força arbitrária; manter os limites e fatores da fórmula existente. A contribuição da velocidade pode saturar no teto atual da fórmula do Tackle.

## 3. Parâmetros — padrões e faixas de sliders aprovados

Em seguida à consulta sobre limites, o diretor autorizou expressamente **as recomendações do assistente para todos os sliders**, pedindo apenas que os limites não fossem baixos. Os números abaixo são, portanto, **faixas de calibração aceitas**, não valores de balanceamento definitivo.

| Parâmetro | Valor inicial | Mínimo | Máximo | Passo | Natureza |
|---|---:|---:|---:|---:|---|
| Duração do desaparecimento | **1,00 s** | **0,10 s** | **6,00 s** | **0,05 s** | Slider |
| Raio de busca de inimigos | **5,00 m** | **0,50 m** | **30,00 m** | **0,50 m** | Slider |
| Alcance físico / distância máxima da investida | **3,00 m** | **0,50 m** | **20,00 m** | **0,25 m** | Slider |
| Custo de stamina | **1,5× o Tackle** | **0×** | **5× o Tackle** | **0,1×** | Slider independente |
| Cooldown | **8,0 s** | **0 s** | **60 s** | **0,5 s** | Slider independente |
| Velocidade de impacto para knockback | **1× referência do Tackle** | **0×** | **5×** | **0,1×** | Slider independente |

**Valores e regras fixos aprovados (não pedir slider sem novo pedido):**

| Regra | Valor |
|---|---|
| Distância inicial do marcador | **3 m** |
| Distância máxima do marcador | **10 m** |
| Tempo para atingir o máximo, segurando botão | **2 s** |
| Curva de avanço do marcador | **Quadrática, acelerando** |
| Redução de velocidade na marcação (fora da esquiva) | **70%** |
| Redução de velocidade na preparação | **70%** |
| Preparação depois de soltar | **0,75 s** |
| Power Level do ataque | **PL2** |
| Velocidade física da investida | **A do Tackle normal** |
| Recuperação após investida sem acerto | **A do Tackle normal** |
| Invulnerabilidade durante a investida | **A do Tackle normal** |

**Nota técnica:** progressão quadrática significa iniciar lento e acelerar, com ponto inicial 3 m e saturação em 10 m aos 2 s. A implementação da curva deve reproduzir esses limites; não confundir com uma progressão linear.

## 4. Histórico de decisões — rastreabilidade e substituições

| Rodada | Conteúdo explicitamente aprovado |
|---|---|
| **R0 — conceito** | Preparação 0,75 s; desaparecimento 1 s com speedlines e slider; reaparecimento mais à frente; PL2; alvo próximo num raio ajustável; dano/knockback do Tackle. |
| **R1 — cinco respostas A/B/A/A/B** | Posição à frente; alvo escolhido no reaparecimento, não antes; intangibilidade durante ausência; sem alvo, reaparece sem ataque; velocidade de impacto própria mantendo fórmula do Tackle. |
| **R2 — ajuste do marcador** | **Substitui “distância fixa escolhida entre 3, 5 ou 8 m”** por marcador dinâmico de 3–10 m em 2 s ao segurar o botão; **não é Charge**; soltura confirma e começa preparação. |
| **R3 — respostas A/C/D/A/B** | Soltura inicia preparação; direção independente do corpo; movimento permitido a 30% (exceto Dodge ativo); cancelamento por defesa durante ajuste sem cooldown; curva quadrática; marcador para diante de obstrução. |
| **R4 — respostas A/A/A/D/B** | Marcador acompanha Mushroom enquanto segura; soltura durante Dodge interrompe esquiva; cancelamento por defesa gratuito somente durante ajuste; raio medido a partir do marcador; círculo no marcador cinza/vermelho; raio de busca padrão 5 m. |
| **R5 — alcance e acerto C** | Raio de busca e alcance físico são **sliders independentes**. |
| **R6 — conexão B** | Reaparecimento seguido de **investida física**, com **colisão real** para acertar. |
| **R7 — investida A/A/A/A** | Slider de distância percorrida; direção reta até alvo adquirido; velocidade física do Tackle; pode acertar antes outro inimigo na trajetória. |
| **R8 — limites e colisões B/A/A/A** | Alcance físico inicial 3 m; termina no primeiro acerto; se alvo distante, avança até o limite e pode errar; invulnerabilidade normal do Tackle durante a investida. |
| **R9 — recursos B/C/C/A/A** | Stamina própria com slider; cooldown próprio com slider; movimento a 30% na preparação; interrupções normais durante preparação; sem alvo, reaparece sem investida. |
| **R10 — cobrança B/C/B/A/A** | Custo inicial 1,5× Tackle; cooldown 8 s; ambos aplicados na **soltura/início da preparação**; ausência de alvo não devolve recursos. |
| **R11 — interrupções A/A/A/A/A** | Interrupção na preparação mantém custo e cooldown; marcador congela no mundo na soltura; destino bloqueado resolve para ponto válido mais próximo; recuperação do Tackle ao errar; referência de impacto 1× Tackle. |
| **R12 — sliders por recomendação aceita** | Faixas amplas e passos do quadro da seção 3, incluindo velocidade de impacto. |
| **R13 — PL/controle/ausência física** | PL2 **vence PL1**; direção do marcador com comandos de movimentação já existentes, independente do corpo; o personagem **“para de existir” fisicamente durante o desaparecimento** e volta apenas ao fim. |

### Substituições obrigatórias de registros anteriores

- A formulação antiga **“reaparece a uma distância fixa à frente da posição inicial”** foi refinada/substituída: agora o destino é o **marcador dinâmico de 3 a 10 m**, relativo à posição atual enquanto o botão estiver segurado e **congelado no mundo ao soltar**.
- A formulação inicial **“desaparece depois de 0,75 s do começo do move”** deve ser lida como **0,75 s depois de SOLTAR o botão**, pois existe uma fase prévia de duração variável para ajustar o marcador.
- A formulação genérica **“intangível”** foi especificada mais rigorosamente: **ausência física completa da simulação**, não simples transparência visual.
- **Rock Slide → Rock Tomb** é a correção histórica do golpe 1 e **continua válida**. Na sequência, o diretor esclareceu expressamente que **Sand Wave substitui Sand Kick (golpe 3)**, **não Rock Tomb**. A associação anterior de Sand Wave com Rock Tomb foi um erro de interpretação do assistente e está revogada; o histórico da correção fica preservado.

## 5. Pendências e limites de escopo para implementação

O design principal está definido, mas **não afirmar que a funcionalidade está pronta**. Os tópicos abaixo exigem **auditoria técnica, testes e, onde houver uma escolha de gameplay genuinamente nova, aprovação do diretor**:

1. **Controles simultâneos:** como a mesma entrada direcional controla personagem e marcador independentemente, especialmente em controles digitais/analógicos e durante Dodge. Preservar o princípio aprovado sem inventar teclas extras.
2. **Representação de ausência física:** excluir Mushroom das rotinas de seleção de alvo, colisão, projéteis, acertos e interações de entidades enquanto desaparecido; preservar apenas dados necessários ao retorno. Testar eventos e estados de transição, sem permitir golpes durante ausência.
3. **Posição válida mais próxima:** casos de borda de arena, barreiras, paredes, alvos ocupando o destino e falta de espaço; aplicar regra já aprovada e validar determinismo.
4. **Integração de PL2 com Clash/Counter:** não tratar Bullet Punch como Tackle PL1; provar em testes vitória sobre PL1, empates com PL2 e comportamento contra PL superior, de acordo com regras existentes.
5. **Dano e knockback:** preservar função/regras do Tackle e o teto de velocidade relativa; assegurar que o novo slider altere somente a referência de impacto definida, sem duplicar bônus ou alterar a velocidade física do Tackle.
6. **Cancelamentos e transições:** comprovar que ajuste iniciado no Dodge preserva velocidade enquanto a esquiva continua; soltura durante Dodge interrompe imediatamente; defesa cancela gratuitamente somente antes da soltura; preparação pode ser interrompida mantendo recursos; desaparecimento não mantém collider fantasma.
7. **Recuperação específica da ausência de alvo:** ficou definido que não executa a investida e consome recursos; não foi explicitamente especificado se há recuperação adicional ou qual seria. Resolver apenas se a implementação realmente exigir decisão.
8. **Previsão do círculo visual vs raio de busca independente:** a cor indica alcance físico, **não** confirmação de alvo selecionável pelo raio de busca; implementar sem equiparar os dois sliders.
9. **Mushroom ↔ Mosh:** confirmar o ID do personagem antes de equipar o novo move; documentação pode permanecer sob nome Mushroom.
10. **VFX:** apenas speedlines e indicador do marcador (cinza/vermelho) foram definidos; aparência detalhada, escala e estilo final dos efeitos não foram fixados.
11. **Nenhuma animação, coreografia, rigging ou produção de clipes foi solicitada.** Não adicionar trabalhos desse tipo como dependência arbitrária.

### Referências do motor consultado (não constituem implementação do Bullet Punch)

- [`prototypes/combat-lab/src/sim/moves.js`](../prototypes/combat-lab/src/sim/moves.js): registro de moves, categorias de ação, fases e efeitos; `charge` existente **não equivale** ao ajuste por botão segurado.
- [`prototypes/combat-lab/src/sim/controller.js`](../prototypes/combat-lab/src/sim/controller.js): permissões/cancelamentos, Dodge, Tackle, movimentação e cobrança/recarga de moves.
- [`prototypes/combat-lab/src/sim/combat.js`](../prototypes/combat-lab/src/sim/combat.js): cálculo de dano e lançamento do Tackle.
- [`prototypes/combat-lab/src/sim/world.js`](../prototypes/combat-lab/src/sim/world.js): sistema de entidades, acertos e comparação de PL; `TACKLE_PL = 1` é padrão do Tackle, enquanto `tacklePL(f)` pode usar PL próprio no estado da ação, conforme código consultado.
- [`prototypes/combat-lab/src/sim/physics.js`](../prototypes/combat-lab/src/sim/physics.js): integração física e resolução de contato entre lutadores.
- [`prototypes/combat-lab/src/ui/moves-panel.js`](../prototypes/combat-lab/src/ui/moves-panel.js): infraestrutura dos sliders de configuração.
- [`docs/MOVES_DECISOES_RODADAS.md`](MOVES_DECISOES_RODADAS.md) e [`docs/REVISAO_GDD_COMBATE.md`](REVISAO_GDD_COMBATE.md): regras aprovadas de combate que continuam valendo.

**Condição de entrega futura:** registrar novos parâmetros e decisões neste mesmo documento, implementar em branch apropriada após autorização, validar no Combat Lab, disponibilizar pelo portal e relatar testes e limitações. **Este commit altera apenas documentação.**

## 6. Sand Wave — especificação inicial de gameplay (rodada 19/10/2026)

**Nota de leitura atual:** menções a “Rock Tomb permanece como golpe 1” nesta seção e na decisão histórica **SW-D18** registram a nomenclatura **válida naquele momento**. O diretor posteriormente renomeou **somente o Move 1 para Emerging Stone**. **Sand Wave continua o Move 3**; nenhuma decisão funcional de Sand Wave foi alterada.

### 6.1 Nome, relação com o elenco e classificação

- **Nome solicitado:** `Sand Wave`.
- **Decisão explícita do diretor:** **Sand Wave substitui Sand Kick (item 3 da lista)**. **Rock Tomb permanece como golpe 1**, sem gameplay definido. A associação anterior de Sand Wave ao item 1 foi equivocada e foi corrigida, sem perda do histórico.
- **Tipo de execução:** **Burst** — não tratar como Charge. Há **0,25 s de preparação**.
- **Power Level:** **PL1**.
- **Custo de stamina por execução:** **2 unidades**.
- **Cooldown:** **10 segundos**.
- Estes números foram definidos diretamente pelo diretor; **não presumir sliders**, faixas ou substituições.

### 6.2 Forma, origem e elegibilidade

1. Ataque de **área retangular** (substitui o triângulo originalmente proposto), **4 m de alcance frontal (comprimento/altura do retângulo na vista superior) × 3 m de largura lateral**. O diretor **aprovou expressamente** a proporção recomendada de **4 × 3 m** e o posicionamento de Mushroom **no centro da borda traseira**, de onde se projeta a barragem. Estes são **valores iniciais**, ajustáveis por **dois sliders independentes: ALTURA (4 m, extensão à frente na vista superior) e LARGURA (3 m, extensão lateral)**. **Altura do retângulo na vista superior NÃO é a altura física do efeito de areia 3D**; conforme Rodada 8 (4A), **a área de acerto é lógica e horizontal**, com detecção por pés/ponto de apoio e contato com o chão. A altura física da areia serve **apenas à apresentação visual**, não ao cálculo de acerto.
2. O golpe projeta uma **barragem de areia** nessa área.
3. **Só pode ser ativado no chão** e o personagem precisa **continuar no chão durante os 0,25 s de preparação**. Se sair do chão na preparação, o golpe é **cancelado**, **sem reembolso da stamina ou do cooldown cobrados na ativação**. Depois de emitida a barragem, **ela continua normalmente ainda que Mushroom saia do chão**.
4. **Só pode atingir adversários no chão**. Alvos em voo/aéreos não são atingidos.
5. Em contato ofensivo válido com alvo elegível, a barragem causa **6 HP de dano fixo por inimigo por execução** (referência: **6% do HP padrão de 100**, antes de eventuais reduções por defesa), aplica **cegueira por 4 s** salvo defesa perfeita, e produz **empurrão contínuo horizontal** enquanto o alvo permanece na área ofensiva.
6. **Dano-base: 6 HP fixos**, **independente do atributo Ataque** do lançador; não multiplicar por Ataque. Respeitar as reduções aplicáveis pela defesa parcial e a anulação total pela defesa perfeita. **Empurrão-base: aceleração horizontal de 12 m/s²**, enquanto houver contato com a hitbox e durante sua janela de **0,75 s**; **não** confundir aceleração com deslocamento total garantido, impulso instantâneo, velocidade fixa ou a fórmula de knockback do Tackle. **Direção do empurrão: sempre para a frente na orientação congelada no disparo**, não radial nem lateral. **Defesa parcial reduz a aceleração em 50% (12 → 6 m/s²)**, conforme aprovado na Rodada 4.
7. **Dimensões iniciais aprovadas:** **4 m de ALTURA em vista superior (alcance frontal/comprimento)** × **3 m de LARGURA (alcance transversal/lateral)**, com **sliders independentes obrigatórios**. Conforme Rodada 4 (1C), o slider **Altura/alcance frontal** tem **mínimo 0,5 m, máximo 30 m, passo 0,25 m e padrão 4 m**; o slider **Largura** tem **mínimo 0,5 m, máximo 20 m, passo 0,25 m e padrão 3 m**. O centro da borda traseira coincide com a origem da barragem em Mushroom. **Não existe altura física de hitbox 3D a definir para determinar acertos**: pela Rodada 8 (4A), o acerto ocorre em **área lógica horizontal**, com **pés/ponto de apoio dentro do retângulo** e **estado no chão confirmado**. A altura física da areia é **somente visual** e não é controlada pelo slider de ALTURA/alcance frontal.
8. A **direção da barragem é determinada no disparo**. Uma vez disparada, a área retangular **permanece fixa durante sua execução**, sem acompanhar a rotação do lançador.
9. Cada inimigo pode **receber somente um acerto por execução** (dano e aplicação inicial da cegueira). Contato prolongado não gera danos repetidos.
10. O **empurrão aplica aceleração horizontal-base de 12 m/s² continuamente** sobre alvos elegíveis ainda em contato com a barragem **somente durante os primeiros 0,75 s**. A orientação do vetor é **para a frente na direção fixada no disparo**. Na **defesa parcial**, a aceleração é **reduzida em 50%, de 12 para 6 m/s²** (Rodada 4, 2B); a **defesa perfeita anula o empurrão**. Após esse intervalo, apenas o VFX se dissipa, **sem empurrão e sem hitbox**.
11. **Defesa parcial**: reduz **dano e empurrão** (empurrão em **50%, de 12 para 6 m/s²**), mas **não bloqueia cegueira** (4 s). **Defesa perfeita**: anula **dano, empurrão e cegueira**. Não inventar percentuais para outros efeitos fora das regras existentes.
12. **Reaplicação da cegueira por novo acerto válido de Sand Wave enquanto o debuff estiver ativo:** o cronômetro **é reiniciado para 4,00 s**, sem acumular duração e sem somar intensidade/pilhas. O contato prolongado de uma **mesma execução** não gera novos acertos nem reinícios.
13. **Rodadas 5 (2C), 6 (1B) e 7 (1A) — obstáculos e propagação:** a areia segue **os caminhos livres mais curtos** ao redor de obstáculos, **inclusive desvios laterais para fora do retângulo original**, mas **nunca atravessa paredes sólidas**. A propagação deve buscar trajetos livres que alcancem pontos elegíveis **dentro do retângulo original fixado no disparo**. O caminho pode sair **lateralmente** da região nominal para contornar uma obstrução, porém isso **não amplia a área de acerto**: somente inimigos com **pés/ponto de apoio dentro do retângulo original**, e efetivamente alcançados pela areia sem atravessar paredes, podem sofrer dano, empurrão ou cegueira. **Não supor expansão frontal, propagação ilimitada nem acertos através de obstáculos**. **Rodada 9 (1A): velocidade da frente da onda = alcance frontal configurado ÷ 0,75 s**, ao longo do **caminho livre mais curto**; desvios mais longos atrasam a chegada e podem impedir o acerto se a onda não alcançar o alvo durante a hitbox ativa. O algoritmo numérico de busca dos caminhos, desempates e tratamento de geometrias complexas permanecem para integração, sem inventar regras adicionais.
14. **Rodada 5, questão 3 (A) — múltiplos adversários:** **todos os inimigos elegíveis dentro da região retangular** podem ser atingidos na mesma execução, desde que a areia os alcance sem atravessar paredes sólidas. **Um acerto por inimigo por execução**, preservando o empurrão contínuo enquanto permanecer em contato com a hitbox ativa. Não impor máximo de alvos 1 ou 2.
15. **Rodada 5, questão 5 (A) — detecção de contato:** avaliar **a posição dos pés ou ponto de apoio no chão**; **esse ponto deve estar dentro do retângulo original de acerto**. Interseção parcial da silhueta ou apenas o centro do corpo não bastam. Alvos em voo continuam inelegíveis. O desvio lateral da areia permitido na Rodada 6 (1B) **não altera esse teste espacial**.
16. **Rodadas 6 (3A) e 7 (4A) — invulnerabilidade:** enquanto o inimigo estiver **temporariamente invulnerável**, Sand Wave **não causa dano, não aplica empurrão e não aplica/renova cegueira** nele. Se a invulnerabilidade **terminar enquanto a hitbox de 0,75 s da mesma barragem ainda estiver ativa**, Sand Wave **pode atingi-lo imediatamente após o fim da invulnerabilidade**, desde que o alvo ainda esteja elegível, alcançado pela areia e sem acerto válido anterior nessa execução. **Contato durante invulnerabilidade não deve consumir o único acerto válido**, porque nenhum efeito foi aplicado; não permitir múltiplos acertos após a vulnerabilidade voltar. Depois de expirar a hitbox, os VFX remanescentes não causam acertos.
17. **Rodada 6, questão 4 (A) — critério de chão:** utilizar o **estado físico de contato com o chão existente no motor** para a elegibilidade do lançador e dos alvos. **Ao aterrissar, o personagem volta a ser considerado no chão assim que esse contato for confirmado pelo motor**, sem período de estabilidade extra arbitrário. O requisito de pés/ponto de apoio no retângulo e as regras de cancelamento da preparação por perda do contato continuam válidos.
18. **Rodadas 7 (2C) e 8 (1B/2A) — parede sob empurrão:** se o empurrão do Sand Wave pressionar o inimigo contra uma parede sólida, o personagem **para na parede**, sem atravessá-la, e sofre **stagger de 0,30 s**, **sem dano adicional**. A **areia continua pressionando o inimigo contra a parede** enquanto existir contato efetivo com a barragem e sua hitbox estiver ativa; essa pressão cessa **ao perder contato com a barragem ou ao terminar a janela de hitbox (0,75 s)**, sem atravessar a superfície. **Não aplicar dano extra, lançamento vertical nem wall-splat automaticamente**. O comportamento de stagger consecutivo/reaplicado e as ações permitidas especificamente no stagger **não foram escolhidos** nesta rodada.
19. **Rodada 7, questão 3 (B) — interação com ataques PL1:** o Sand Wave **não neutraliza outros ataques PL1 ao entrar em contato com eles**. Cada golpe **continua funcionando conforme suas próprias regras normais**, sem introduzir neutralização mútua automática da barragem ou de seu oponente por ambos serem PL1. Não alterar as demais regras existentes de Power Level ou dos próprios golpes além dessa decisão específica.
20. **Rodadas 7 (5C) e 8 (5A) — controle direcional e ações do adversário atingido:** o **empurrão contínuo suspende temporariamente o controle de deslocamento** do alvo enquanto estiver sob contato efetivo com a barragem na **janela ofensiva de 0,75 s**. O alvo **pode atacar e defender normalmente**, mas **não pode iniciar novas esquivas enquanto estiver sob o empurrão**. O controle de deslocamento retorna ao **deixar de sofrer o empurrão ou quando a hitbox se encerra**; **não manter suspensão na dissipação visual de 0,75 s**. Mantém-se aceleração frontal de **12 m/s² (6 m/s² sob defesa parcial)** sem lançamento vertical. A regra não altera a liberdade de Mushroom após o disparo. O **stagger de parede é um estado separado**: não presumir que as permissões de ações durante empurrão se estendam ao período de stagger.

21. **Rodada 9, questão 2 (B) — repetição do stagger de parede:** o **stagger de 0,30 s não se renova apenas por pressão contínua na mesma parede**. Dentro da mesma execução, **um novo stagger somente pode ocorrer após o inimigo deixar de estar pressionado contra a parede e sofrer outra colisão válida**, sempre durante a janela ofensiva ativa. Isso **não concede um segundo acerto de dano ou cegueira**: a regra de **um acerto por inimigo por execução** permanece integralmente válida.
22. **Rodada 9, questão 3 (A) — inércia após o empurrão:** cessada a força da areia, a **velocidade física adquirida permanece** e diminui segundo **atrito e regras normais de movimentação** do motor. O controle de deslocamento retorna quando o empurrão cessa, conforme Rodada 7. Não eliminar instantaneamente a velocidade adicionada pela areia nem impor uma interpolação artificial de 0,20 s.
23. **Rodada 9, questão 4 (A) — proibições durante stagger de parede:** nos **0,30 s do estado de stagger**, o adversário **não pode iniciar ataques, defesa ou esquivas**. Esta regra de **iniciação** não deve ser interpretada como cancelamento automático de uma ação já iniciada, pois a Rodada 9 (5A) preserva as regras normais de continuidade das ações preexistentes.
24. **Rodada 9, questão 5 (A) — ações já em andamento:** **ataques, defesa e esquivas iniciadas antes do acerto válido** continuam seguindo **suas regras normais**, respeitando **invulnerabilidade, colisões e restrições de deslocamento**. Não cancelar automaticamente ações já iniciadas por efeito do Sand Wave. Enquanto durar o empurrão, a regra já aprovada de **não iniciar novas esquivas** permanece; durante stagger, as três categorias não podem ser **iniciadas**. A preservação de ações preexistentes **não suspende** as regras normais de interrupção do motor.

25. **Rodada 10, questão 4 (A) — obstáculos móveis:** quando a geometria dos obstáculos mudar **durante a propagação da mesma barragem**, os **caminhos livres mais curtos devem ser recalculados conforme as posições atuais dos obstáculos**. Isso vale quando houver obstáculos móveis relevantes; **não atravessar paredes**, **não ampliar o retângulo original fixado no disparo**, **não alterar a direção do empurrão nem a velocidade da frente (alcance frontal configurado ÷ 0,75 s)** e **não prolongar os 0,75 s da hitbox**. O algoritmo incremental e a discretização são detalhes técnicos de implementação, sujeitos a testes de determinismo; não presumir novos efeitos ou dano.

### 6.3 Cronologia e janela de colisão

| Elemento temporal | Valor aprovado | Observação |
|---|---:|---|
| Preparação (startup do Burst) | **0,25 s** | É o primeiro intervalo da ação; nesta fase é exigido contato com o chão, e pode haver interrupção. |
| Duração da barragem Sand Wave | **1,50 s** | Começa **após** os 0,25 s de preparação; hitbox por 0,75 s, seguida de dissipação por 0,75 s. |
| Hitbox da barragem | **0,75 s iniciais** | **Onda progressiva** que avança desde a emissão; em percurso sem obstáculos, a frente alcança o **alcance frontal configurado ao longo destes 0,75 s**, e não instantaneamente. Só atinge/empurra pontos já alcançados. |
| Dissipação visual sem hitbox | **0,75 s finais** | Efeitos da barragem de areia desaparecendo; sem novos acertos nessa metade. |
| Cegueira aplicada em contato | **4,00 s** | Debuff individual de duração própria, distinto do tempo em que a barragem existe. |
| **Duração total da ação/barragem** | **1,75 s** | **0,25 s preparação + 0,75 s hitbox ativa + 0,75 s dissipação**; não encurtar a barragem por inclusão da preparação. |

**Rodadas 8 (3B) e 9 (1A) — avanço espacial da hitbox:** a barragem é uma **onda progressiva**, sem cobertura instantânea do retângulo. Durante os **0,75 s de janela ofensiva**, sua frente percorre **o alcance frontal configurado em percurso livre**, com velocidade definida por **alcance frontal configurado ÷ 0,75 s** (em m/s). Ao contornar obstáculos, a mesma velocidade percorre **os caminhos livres mais curtos**, permitindo desvios laterais sem ampliar a região original de acerto. **Caminhos efetivos mais longos atrasam a chegada e podem não alcançar um alvo antes do término da hitbox.** Nenhum acerto se o ponto elegível não foi alcançado dentro dos 0,75 s; os **0,75 s finais** são apenas dissipação visual. Métodos computacionais de obtenção dos caminhos e tratamento de empates ainda precisam de integração, não de velocidade arbitrária.

**Rodada 9, questão 1 (A) — velocidade de propagação:** a velocidade da frente da areia é **alcance frontal configurado / 0,75 s** (metros por segundo). A distância percorrida é medida **ao longo do caminho livre mais curto**; quando houver desvio, o percurso maior causa **atraso proporcional** e pode impedir a chegada antes do fim da hitbox. O retângulo original de acerto continua fixo, a propagação pode contorná-lo lateralmente como já aprovado, mas **não pode acertar fora dele** ou atravessar paredes. O valor é derivado do slider de alcance frontal, **não é uma velocidade fixa de 8 m/s**.

**Separação obrigatória:** ao completar os **primeiros 0,75 s de barragem**, a **hitbox deixa de existir**, e o empurrão contínuo também **cessa**. Os VFX da areia continuam sumindo pelos **0,75 s seguintes**. Um inimigo que só entrar no **retângulo** durante a fase de dissipação não recebe dano, cegueira ou empurrão desse efeito residual. Cada alvo pode receber **no máximo um acerto (6 HP de dano-base + aplicação/reinício de cegueira, conforme defesa)** durante uma execução, embora a força de empurrão possa atuar continuamente durante o contato na janela ofensiva.

**Cronologia aprovada (Rodada 3, questão 1 A):** desde a ativação: **0,00–0,25 s preparação**, **0,25–1,00 s barragem com hitbox ativa**, **1,00–1,75 s dissipação visual, sem hitbox**. **Duração total: 1,75 s**. O debuff de cegueira tem relógio próprio de 4 s a partir do acerto elegível e pode exceder esse período.

**Recursos (Rodada 3, questão 2 A):** cobrar imediatamente na **ativação (t = 0)** os **2 pontos de stamina** e iniciar o **cooldown completo de 10 s**; não adiar a cobrança ou início do cooldown até a emissão.

**Interrupção na preparação (Rodada 3, questão 3 A):** se interrompido enquanto prepara, o Sand Wave **é cancelado e não emite barragem**, sem restituição de stamina e **sem zerar/reiniciar o cooldown** já iniciado.

**Requisito de chão (Rodada 3, questão 4 A):** só pode ser ativado no chão. **Sair do chão durante a preparação cancela o move**, com custo/cooldown já gastos. **Após a barragem ter sido lançada**, sair do chão **não a cancela**; ela permanece na direção fixada pelo disparo até encerrar seus 1,5 s, mantendo as regras de que apenas inimigos no chão podem ser atingidos.

**Disponibilidade após a emissão (Rodada 4, 5A):** a **preparação de 0,25 s é o único período obrigatório de comprometimento desta ação**. Ao lançar a barragem, Mushroom fica **livre para movimentar-se e usar outras ações imediatamente**, sem aguardar o término da hitbox ou dissipação. A barragem já emitida segue existindo independentemente pelo restante de seus 1,5 s, na direção e área travadas na emissão. Não converter esta regra em cancelamento precoce da barragem.

**Rodada 3, questão 5, resolvida na Rodada 4 (1C):** ficaram aprovadas **faixas experimentais** dos sliders independentes: **ALTURA/alcance frontal (padrão 4 m; 0,5–30 m; passo 0,25 m)** e **LARGURA (padrão 3 m; 0,5–20 m; passo 0,25 m)**. A faixa aprovada altera somente dimensões de área, não a altura física/vertical da hitbox 3D.

### 6.4 Efeito secundário de cegueira (blind/fog)

1. **O contato com a barragem** aplica uma condição de **cegueira por 4 segundos** ao adversário atingido.
2. Enquanto estiver cegado, há um **fog forte**, com **redução de 60% na iluminação do ambiente e névoa densa próxima ao limite de 10 m** (Rodada 5, 1B), aplicado **exclusivamente à câmera/visão do jogador cegado**. O raio lógico de 10 m para lock-on permanece inalterado; os demais observadores não recebem escurecimento ou fog de cegueira.
3. **Raio de visão do personagem cegado: 10 m**, usado na regra de lock-on durante a cegueira.
4. Durante os 4 s, o alvo cegado **não pode realizar lock-on em adversário que esteja fora desse raio de 10 m**, medido **a partir do próprio personagem cegado**.
5. Se o lock-on **já estiver ativo** e o oponente associado **não estiver dentro do raio de visão de 10 m**, o lock-on **deve ser desligado**.
6. Quando o adversário está **dentro** dos **10 m** do personagem cegado, esta regra de cegueira **não proíbe o lock-on por distância**; outras condições normais do motor continuam válidas.
7. **Apenas diminuir a iluminação ou desenhar fog não implementa o bloqueio de lock-on**: a restrição deve fazer parte das regras de seleção/manutenção de alvo, com desligamento efetivo do lock-on quando o alvo não puder ser visto pela regra de 10 m.
8. **A cegueira pertence ao personagem atingido**. Conforme Rodadas 4 (3B) e 5 (1B), **todos os jogadores enxergam uma nuvem de areia ao redor do personagem cegado**, mas **somente a câmera/visão do jogador efetivamente cegado** recebe **fog denso próximo ao limite de 10 m e redução de 60% da iluminação ambiental**. Não aplicar esses efeitos de câmera aos outros observadores nem alterar seu lock-on. Detalhes de curvas visuais e da nuvem permanecem técnicos, não percentuais adicionais aprovados.
9. O status continua por **4 s após sua aplicação**, mesmo se a hitbox/efeito visual de areia já tiver terminado.
9a. **Retomada de lock-on durante cegueira (Rodada 4, 4A):** se o lock-on de um personagem cegado tiver sido **desligado** porque o adversário saiu de seu raio de visão de **10 m**, **não é restaurado automaticamente** quando esse adversário voltar a entrar no raio; o jogador **precisa pressionar novamente o comando de lock-on**, e o alvo só pode ser travado se estiver elegível segundo as regras vigentes. Não religar automaticamente ao terminar a cegueira um lock-on que foi desligado por ela.
10. **Novo acerto válido em outra execução de Sand Wave:** se o alvo ainda estiver cegado, **reinicia a duração restante da cegueira para 4,00 s**. **Não soma 4 s ao tempo restante** nem cria pilhas. Repetição do contato da **mesma execução** não renova o debuff.
11. **Defesa parcial não impede a cegueira**, embora reduza o dano e o empurrão. **Defesa perfeita anula a aplicação ou renovação de cegueira** e também zera dano/empurrão desse acerto.
12. **Rodadas 5 (4B) e 6 (2A) — lock-on com múltiplos adversários durante a cegueira:** ao **pressionar manualmente o botão de lock-on**, selecionar **obrigatoriamente o adversário elegível mais próximo** dentro do raio de **10 m do personagem cegado**, **desde que haja linha de visão parcial ou total não bloqueada por parede sólida**. **Paredes sólidas bloqueiam o lock-on** quando ocultam o adversário por completo; **qualquer parte visível do adversário é suficiente para elegibilidade**, sem exigir visibilidade do centro corporal. O mais próximo deve ser escolhido **entre os elegíveis visíveis**, sem readquirir automaticamente. As regras dos personagens não cegados não mudam; integração com IA e detalhes técnicos da checagem de visibilidade ainda requerem auditoria.
13. **Rodada 6, questão 5 (A) — nuvem de areia do cegado:** a nuvem visível para todos permanece **durante os 4 s completos do debuff de cegueira**, e **desaparece quando a cegueira termina**. Se outro Sand Wave renovar validamente a cegueira, o cronômetro volta a 4 s pelas regras já aprovadas e a nuvem continua enquanto o status estiver ativo. **Não confundir** essa nuvem de status com os **1,5 s de VFX da barragem lançada**, cuja duração permanece independente.

14. **Rodada 10, questão 1 (A) — percepção da IA cegada:** durante o debuff de **4 s**, a IA obedece às **mesmas limitações de percepção de um jogador cegado**: **10 m de alcance a partir do personagem cegado** e **linha de visão sem ocultação completa por paredes sólidas** (qualquer parte visível do oponente basta, segundo SW-D45). A regra de percepção se aplica à aquisição/identificação de adversários pela IA; **não conceder conhecimento perfeito das posições fora desse alcance ou através de paredes**. Não modificar IA de personagens sem cegueira.
15. **Rodada 10, questão 2 (A) — seleção da IA cegada:** havendo vários adversários elegíveis **dentro dos 10 m e visíveis**, a IA cegada seleciona **sempre o inimigo elegível mais próximo**, como no lock-on manual já especificado para o jogador. O **desempate determinístico em distâncias exatamente iguais** é questão técnica; não inventar preferências táticas contrárias à proximidade.
16. **Rodada 10, questão 3 (A) — ausência de alvo perceptível para a IA:** se não houver inimigo elegível perceptível durante a cegueira, a IA adota **comportamento defensivo**, **priorizando proteção e reposicionamento** até perceber novamente um adversário dentro das regras de alcance e linha de visão. Não assumir perseguição baseada em informação perfeita do alvo oculto nem inventar durações, probabilidades ou deslocamentos numéricos. Ao perceber um alvo, volta a aplicar a seleção do mais próximo. As restrições de lock-on manual do jogador permanecem independentes.
17. **Rodada 10, questão 5 (E) — aparência visual:** o diretor **optou por NÃO aprovar um estilo de areia nesta rodada**. A **aparência visual final da barragem, da nuvem de cegueira e respectivas curvas de opacidade/densidade permanece PENDENTE até comparação e aprovação expressa de protótipos**. A escolha E registra **adiamento deliberado**, não aprovação das alternativas visuais A/B/C. Permanecem aprovados os parâmetros funcionais anteriores (4 s de cegueira, nuvem visível a todos durante o debuff, apenas câmera do cegado com escurecimento de 60% e fog denso próximo a 10 m).

### 6.5 Tabela de requisitos aprovados

| ID | Parâmetro ou regra | Valor definido pelo diretor |
|---|---|---|
| SW-D01 | Nome | **Sand Wave** |
| SW-D02 | Categoria de execução | **Burst** |
| SW-D03 | Preparação | **0,25 s** |
| SW-D04 | Cooldown | **10 s** |
| SW-D05 | Power Level | **PL1** |
| SW-D06 | Custo de stamina | **2** |
| SW-D07 | Geometria (revisada e aprovada) | **Retângulo lógico horizontal de 4 m de alcance frontal/altura na vista superior × 3 m de largura**, com Mushroom no centro da borda traseira. **Dois sliders independentes** para largura e alcance frontal. Pela Rodada 8 (4A), o acerto é **lógico/horizontal, por pés dentro da área e contato com chão**; a altura física da areia é apenas visual. |
| SW-D08 | Ofensiva | **Barragem de areia**, empurrão e dano baixo ao contato |
| SW-D09 | Restrição do lançador | **Somente no chão** |
| SW-D10 | Restrição dos alvos | **Somente inimigos no chão** |
| SW-D11 | Duração da barragem | **1,5 s** |
| SW-D12 | Janela ofensiva | **Primeiros 0,75 s** |
| SW-D13 | Dissipação visual | **0,75 s finais, sem hitbox** |
| SW-D14 | Cegueira | **4 s após contato** |
| SW-D15 | Visão sob cegueira | **Raio de 10 m em torno do cegado** |
| SW-D16 | Lock-on | **Impedido contra alvo fora dos 10 m; lock-on existente é desligado** se o alvo estiver fora |
| SW-D17 | Visual da cegueira | **Fog e redução de iluminação** durante o debuff |
| SW-D18 | Renomeação correta | **Sand Wave substitui Sand Kick (golpe 3)**; Rock Tomb permanece como golpe 1 |
| SW-D19 | Direção da área — Rodada 1, pergunta 2 (A) | **Fixada no disparo**, sem acompanhar a rotação do personagem durante a execução |
| SW-D20 | Acertos por alvo — Rodada 1, pergunta 3 (A) | **Um único acerto por inimigo por execução**; não repetir dano/cegueira pelo contato prolongado |
| SW-D21 | Cálculo de dano — Rodada 1, pergunta 4 (A), complementada na Rodada 2 | **6 HP de dano-base fixo, independente de Ataque**; reduções de defesa parcial e anulação por defesa perfeita conforme SW-D28 |
| SW-D22 | Empurrão — Rodada 1, pergunta 5 (B), complementada na Rodada 2 | **Aceleração horizontal-base de 12 m/s², contínua durante contato na hitbox ativa (0,75 s), sempre para a frente na orientação do disparo**; defesa parcial reduz e perfeita anula |
| SW-D23 | Dimensões do Sand Wave | **4 m de altura no diagrama/alcance frontal × 3 m de largura**, origem no centro da borda traseira. Proposta **aprovada** pelo diretor com resposta “sim”. |
| SW-D24 | Controles de dimensão (complementados na Rodada 4) | **ALTURA/alcance frontal:** padrão **4 m**, de **0,5 a 30 m**, passo **0,25 m**. **LARGURA:** padrão **3 m**, de **0,5 a 20 m**, passo **0,25 m**. Sliders independentes. |
| SW-D25 | Rodada 2, questão 1 (C) — dano | **6 HP fixos** por inimigo por execução, independente do atributo Ataque (6% do HP padrão de 100 antes da mitigação) |
| SW-D26 | Rodada 2, questão 2 (C) — força | **Aceleração horizontal-base contínua de 12 m/s²** durante contato com a hitbox ativa; não é velocidade ou deslocamento garantido |
| SW-D27 | Rodada 2, questão 3 (A) — direção do empurrão | **Sempre para a frente na direção em que Mushroom disparou a barragem**, orientação fixada na emissão |
| SW-D28 | Rodada 2, questão 4 (A) — defesa | **Parcial reduz dano e empurrão, mas não impede cegueira. Perfeita anula dano, empurrão e cegueira.** |
| SW-D29 | Rodada 2, questão 5 (A) — reaplicação | **Outro acerto válido durante cegueira reinicia duração para 4 s**, não acrescenta tempo nem stacks; o mesmo ataque só acerta uma vez por alvo |
| SW-D30 | Rodada 3, questão 1 (A) — linha temporal | **1,75 s totais:** 0,25 s de preparação + 1,50 s de barragem (0,75 s ofensivos + 0,75 s de dissipação) |
| SW-D31 | Rodada 3, questão 2 (A) — momento do custo | **Stamina 2 e cooldown 10 s cobrados/iniciados imediatamente na ativação**, antes da preparação |
| SW-D32 | Rodada 3, questão 3 (A) — interrupção | **Interrupção nos 0,25 s de preparação cancela Sand Wave, sem devolver stamina ou cooldown** |
| SW-D33 | Rodada 3, questão 4 (A) — saída do chão | **Sair do chão durante a preparação cancela o golpe; após a emissão, a barragem continua normalmente**, embora só possa atingir alvos no chão |
| SW-D34 | Rodada 4, questão 1 (C) — sliders | **Altura/alcance frontal 0,5–30 m, padrão 4 m; largura 0,5–20 m, padrão 3 m; passo de ambos 0,25 m** |
| SW-D35 | Rodada 4, questão 2 (B) — defesa parcial | **Empurrão reduzido em 50% na defesa parcial: aceleração de 12 → 6 m/s²**; defesa perfeita continua anulando-o |
| SW-D36 | Rodada 4, questão 3 (B) — fog visual | **Nuvem de areia ao redor do cegado visível a todos**; **fog de cegueira + escurecimento ambiental só para o jogador cegado** |
| SW-D37 | Rodada 4, questão 4 (A) — retorno do lock-on | **Não é automático** quando o adversário reentra no raio de **10 m**: o jogador cegado **precisa apertar o botão de lock-on novamente** |
| SW-D38 | Rodada 4, questão 5 (A) — liberdade pós-lançamento | **Imediatamente após 0,25 s de preparação, Mushroom recupera movimentação e pode executar outras ações**; a barragem já lançada permanece ativa independentemente até completar 1,5 s |
| SW-D39 | Rodada 5, questão 1 (B) — fog forte | **Redução de iluminação de 60%** na visão do jogador cegado, com **névoa densa próxima dos 10 m**; demais jogadores não sofrem redução |
| SW-D40 | Rodada 5, questão 2 (C) — obstáculos | **Areia espalha-se ao redor de obstáculos sem atravessar paredes sólidas**; Rodada 6 (1B) autorizou **trajeto lateral fora do retângulo original, mas área de acerto continua limitada ao retângulo original** |
| SW-D41 | Rodada 5, questão 3 (A) — múltiplos alvos | **Todos os adversários elegíveis dentro do retângulo**, cada um com **um único acerto por execução**, e empurrão contínuo enquanto houver contato |
| SW-D42 | Rodada 5, questão 4 (B) — lock-on | Durante cegueira, apertar lock-on escolhe **obrigatoriamente o inimigo elegível mais próximo dentre os que estão a até 10 m**, sem retomada automática |
| SW-D43 | Rodada 5, questão 5 (A) — contato | **Pés ou ponto de apoio no chão do inimigo precisam estar dentro do retângulo**; não basta qualquer parte do corpo entrar |
| SW-D44 | Rodada 6, questão 1 (B) — desvio lateral | **Areia pode sair lateralmente do retângulo para contornar obstáculos**, sem atravessar paredes; **só atinge inimigos cujos pés estejam dentro da área original** |
| SW-D45 | Rodada 6, questão 2 (A) — linha de visão | Durante cegueira, **paredes sólidas impedem lock-on em alvos totalmente ocultos; basta qualquer parte visível do adversário**, dentro dos 10 m e respeitando a seleção manual do mais próximo |
| SW-D46 | Rodada 6, questão 3 (A) — invulnerabilidade | Enquanto temporariamente invulnerável, o alvo **não recebe dano, empurrão nem cegueira** do Sand Wave |
| SW-D47 | Rodada 6, questão 4 (A) — contato com o chão | **Usar estado físico de contato com o chão do motor**; ao aterrissar, o personagem é elegível **assim que o estado de contato for confirmado**, sem atraso adicional inventado |
| SW-D48 | Rodada 6, questão 5 (A) — nuvem da cegueira | **Nuvem visível ao redor do cegado permanece pelos 4 s completos da cegueira e desaparece quando o debuff termina**, respeitando renovação do status |
| SW-D49 | Rodada 7, questão 1 (A) — trajetória de areia | **Areia segue os caminhos livres mais curtos ao redor dos obstáculos**, inclusive desvio lateral; **só atinge dentro do retângulo original**, sem atravessar paredes |
| SW-D50 | Rodada 7, questão 2 (C) — contato com parede | Empurrado contra parede, inimigo **para e recebe stagger sem dano adicional**; duração **0,30 s definida na Rodada 8 (1B)** |
| SW-D51 | Rodada 7, questão 3 (B) — outros PL1 | Sand Wave **não neutraliza ataques PL1 em contato**; cada golpe segue suas regras normais, sem neutralização mútua automática por igualdade de PL |
| SW-D52 | Rodada 7, questão 4 (A) — fim de invulnerabilidade | **Pode atingir imediatamente após expirar invulnerabilidade se hitbox ainda ativa e alvo elegível**; contato enquanto invulnerável não consome acerto válido |
| SW-D53 | Rodada 7, questão 5 (C) — controle de deslocamento | **Empurrão suspende temporariamente controle de deslocamento do adversário durante contato com hitbox ativa**; controle volta ao sair ou terminar a janela ofensiva. Rodada 8 (5A): **pode atacar e defender normalmente, mas não iniciar esquivas sob empurrão** |
| SW-D54 | Rodada 8, questão 1 (B) — duração do stagger | **0,30 s** de stagger ao ser empurrado contra parede sólida; **sem dano adicional nem lançamento vertical** |
| SW-D55 | Rodada 8, questão 2 (A) — pressão contra parede | **Empurrão continua pressionando o alvo contra a parede, sem atravessá-la**, até perder contato com a barragem ou a hitbox terminar |
| SW-D56 | Rodada 8, questão 3 (B) — avanço da onda | **Onda progressiva** alcança o **alcance frontal configurado ao longo dos 0,75 s de janela ofensiva em percurso sem obstáculos**; não é cobertura instantânea |
| SW-D57 | Rodada 8, questão 4 (A) — colisão 3D | **Área lógica horizontal**; acerto depende de **pés/ponto de apoio no retângulo e estado físico no chão**; **altura física da areia é somente visual** |
| SW-D58 | Rodada 8, questão 5 (A) — ações sob empurrão | Alvo **pode atacar e defender normalmente, mas não consegue iniciar novas esquivas enquanto está sob empurrão**; controle de deslocamento continua suspenso conforme Rodada 7 |
| SW-D59 | Rodada 9, questão 1 (A) — velocidade da onda | **Velocidade = alcance frontal configurado ÷ 0,75 s**, aplicada aos **caminhos livres mais curtos**; contornos mais longos atrasam a chegada, podendo impedir o acerto antes do fim da hitbox |
| SW-D60 | Rodada 9, questão 2 (B) — repetição do stagger | **Novo stagger de parede na mesma execução somente se o inimigo deixar de estar pressionado contra a parede e sofrer outra colisão válida**; contato contínuo não renova stagger |
| SW-D61 | Rodada 9, questão 3 (A) — inércia após empurrão | **Conservar a velocidade física adquirida** ao cessar o empurrão; ela diminui conforme **atrito e movimentação normais** do motor, sem zerar ou desacelerar artificialmente |
| SW-D62 | Rodada 9, questão 4 (A) — ações iniciadas no stagger | **Durante 0,30 s de stagger de parede não pode iniciar ataques, defesa ou esquivas**; não inventar cancelamento de ações previamente iniciadas |
| SW-D63 | Rodada 9, questão 5 (A) — ações anteriores ao acerto | **Ataques, defesa e esquivas já iniciados seguem suas regras normais**, respeitando invulnerabilidade, colisões e restrições de deslocamento; não interromper automaticamente ações pré-existentes pelo Sand Wave |
| SW-D64 | Rodada 10, questão 1 (A) — percepção da IA cegada | **IA segue as mesmas limitações de percepção do jogador cegado: raio de 10 m e linha de visão não completamente bloqueada por paredes sólidas**; não usar localização perfeita de alvos imperceptíveis |
| SW-D65 | Rodada 10, questão 2 (A) — escolha de alvo da IA | **IA cegada seleciona sempre o inimigo elegível mais próximo**, dentre os visíveis dentro dos 10 m; não introduzir preferência tática conflitante |
| SW-D66 | Rodada 10, questão 3 (A) — IA sem alvos perceptíveis | **IA cegada adota comportamento defensivo, priorizando proteção e reposicionamento até voltar a perceber algum inimigo** |
| SW-D67 | Rodada 10, questão 4 (A) — obstáculos móveis | **Recalcular os caminhos livres mais curtos conforme a geometria dos obstáculos se move**, respeitando suas posições atuais, sem atravessar paredes, expandir a área elegível ou prorrogar a hitbox |
| SW-D68 | Rodada 10, questão 5 (E) — decisão de adiar a arte | **Nenhuma direção visual final aprovada nesta rodada**; aparência da areia e fog **permanecem pendentes até comparação e aprovação de protótipos**; não tratar alternativas A/B/C como escolhidas |

### 6.6 Questões não decididas — não inventar

- **SW-P01 — colisão vertical RESOLVIDA na Rodada 8 (4A):** a área de acerto é **lógica/horizontal**, exige **pés/ponto de apoio no retângulo original** e **contato com chão confirmado**, sem hitbox física vertical adicional para determinar acertos. A **altura física da areia é exclusivamente visual** e não é controlada pelo slider **ALTURA**, que continua medindo alcance frontal em vista superior. A aparência/altura estética da areia continua para a etapa visual, mas **não é pendência de elegibilidade de colisão**.
- **SW-P03 — integração física do empurrão (Rodada 9, 3A):** **12 m/s² horizontais na direção frontal fixada**, reduzidos em **50% para 6 m/s² sob defesa parcial**, permanecem aprovados. O alvo tem **controle de deslocamento suspenso durante contato com hitbox ativa**, pode atacar e defender normalmente, e **não pode iniciar novas esquivas sob empurrão**. **Quando a força cessar, conservar a velocidade física adquirida**, que é reduzida **naturalmente por atrito e pelas regras normais do motor**, sem remoção instantânea da velocidade adicional nem amortecimento artificial em 0,20 s. Contra parede sólida, **para e sofre stagger de 0,30 s sem dano**, mantendo pressão enquanto houver contato ativo. Permanecem pendentes somente pormenores técnicos da composição vetorial da aceleração, velocidade pré-existente, atrito e colisões; **não inventar lançamento vertical ou ricochete**.
- **SW-P05 — integração técnica com contato de chão:** o critério de design foi **resolvido na Rodada 6 (4A)**: utilizar **o estado físico de contato com o chão do motor** e tornar o personagem elegível **assim que o contato de aterrissagem for confirmado**, sem atraso de estabilidade adicional. A ativação e a preparação requerem esse contato; sair do chão durante preparação cancela com recursos gastos; após a emissão a barragem persiste. A Rodada 5 exige **pés/ponto de apoio dentro do retângulo original** para atingir. Resta apenas **auditar o mapeamento técnico do estado do motor** (saltos, Dodge, voo e aterrissagem), sem inventar tolerâncias ou exceções.
- **SW-P07 — aparência visual AINDA PENDENTE por decisão expressa (Rodada 10, 5E):** o diretor **não aprovou nenhum estilo** na Rodada 10; exige **comparação e aprovação futura de protótipos**. Permanecem aprovados **60% de redução de iluminação e fog denso perto de 10 m somente na câmera do cegado** e **nuvem de areia visível a todos os jogadores durante os 4 s completos da cegueira**, com desaparecimento ao fim do debuff. Ainda não definidos aparência final da barragem/nuvem, curvas de densidade/opacidade e integração visual. **Não escolher nem certificar a direção de arte por conta própria.**
- **SW-P08 — comportamento da IA RESOLVIDO EM DESIGN (Rodada 10, 1A/2A/3A); integração técnica pendente:** o jogador cegado continua sob lock-on **manual e escolha obrigatória do mais próximo visível em 10 m**, sem reaquisição automática, e paredes sólidas barram alvos totalmente ocultos, mas **qualquer parte visível permite elegibilidade**. **A IA cegada também respeita percepção limitada a 10 m e linha de visão**, **seleciona o oponente elegível mais próximo** e, **na ausência de oponente perceptível, prioriza defesa e reposicionamento**. Não alterar IA sem cegueira nem supor localização exata de alvos imperceptíveis. Restam somente integração técnica de visibilidade, seleção, desempates determinísticos e prioridades com o controlador existente; não inventar novo comportamento de gameplay.
- **SW-P10 — relações de combate remanescentes (Rodada 9, 4A e 5A):** **defesa parcial reduz dano e empurrão (12 → 6 m/s²), sem impedir cegueira; defesa perfeita anula os três efeitos**. **Invulnerabilidade impede os três efeitos enquanto ativa**, mas o alvo pode ser atingido quando ela termina se a hitbox continuar ativa. Sand Wave **não neutraliza outros ataques PL1 por contato**. **Sob empurrão, o alvo pode iniciar ataques e defesa normalmente, mas não pode iniciar esquivas**; **ações de ataque, defesa ou esquiva já iniciadas continuam conforme as regras normais**, respeitando invulnerabilidade, colisões e restrições de deslocamento, **sem cancelamento automático pelo golpe**. Durante os **0,30 s de stagger de parede**, **nenhum ataque, defesa ou esquiva pode ser iniciado**, mas a proibição de iniciar não determina cancelamento retroativo de ações já em curso. Permanecem para auditoria apenas as interações precisas com os estados e regras existentes do motor, sem criar impedimentos adicionais.

- **SW-P11 — propagação com obstáculos móveis RESOLVIDA EM DESIGN (Rodada 10, 4A); implementação técnica pendente:** areia segue **caminhos livres mais curtos**, permitindo desvio lateral sem atravessar paredes e atingindo somente **pés/ponto de apoio dentro do retângulo original fixado no disparo**. Velocidade = **alcance frontal configurado ÷ 0,75 s**, contando percurso efetivo e limitando o acerto à janela ofensiva. **Se obstáculos se moverem durante a mesma barragem, recalcular caminhos livres mais curtos segundo suas posições atuais**. Restam detalhes técnicos do algoritmo e discretização, desempate determinístico, dinâmica das mudanças de geometria e testes de barreiras, **sem decisão adicional sobre congelar caminhos ou taxa arbitrária de atualização**; nenhuma nova propriedade de gameplay deve ser inferida.

- **SW-P12 — stagger contra parede (Rodada 9, 2B e 4A):** ao ser empurrado contra parede sólida, o alvo **para na parede e sofre stagger de 0,30 s sem dano adicional**. A areia mantém a pressão enquanto houver contato válido. O stagger **não é renovado continuamente**. **Na mesma execução, somente pode haver novo stagger se o inimigo deixar de estar pressionado contra a parede e depois sofrer outra colisão válida** durante a hitbox ativa. Durante o stagger **não pode iniciar ataque, defesa nem esquiva**; ações já em andamento seguem regras normais, sem cancelamento automático inventado. A duração e a condição de reaplicação estão **resolvidas**. Restam somente detalhes de integração com os estados físicos/temporais e resolução de eventos do motor, sem expandir a janela ofensiva.

### 6.7 Referências técnicas verificadas — não é implementação

- [`prototypes/combat-lab/src/ui/input.js`](../prototypes/combat-lab/src/ui/input.js): o lock-on do jogador usa estado `input.locked`. A nova condição de cegueira exige cancelar/bloquear lock-on de fato, e não apenas alterar a cena.
- [`prototypes/combat-lab/src/sim/controller.js`](../prototypes/combat-lab/src/sim/controller.js): interpretação de alvo por `cmd.target`, ações e restrições de execução.
- [`prototypes/combat-lab/src/sim/status.js`](../prototypes/combat-lab/src/sim/status.js): status temporários possuem duração e expiração, mas o motor consultado **não oferece uma flag `blind` pronta**; será necessário integrar a condição ao controle de alvo/visão.
- [`prototypes/combat-lab/src/view/view.js`](../prototypes/combat-lab/src/view/view.js): cena com fontes de iluminação próprias e renderizador; alteração visual exigirá preservar separação entre lógica de cegueira e apresentação.
- [`prototypes/combat-lab/src/sim/world.js`](../prototypes/combat-lab/src/sim/world.js): `area` nativa admite círculos e caixas; com a alteração **triângulo → retângulo**, estudar a forma `box` **apenas após definição explícita de comprimento/largura e origem**, respeitando regras de alvo no chão, acerto único e empurrão contínuo.

**Estado real:** documento aprovado parcialmente; **Sand Wave não foi implementado, integrado ao loadout, jogado ou testado**. Esta entrega altera somente documentação. O design do Bullet Punch nas seções 2–5 permanece inalterado.

### 6.8 Histórico desta alteração

**19/10/2026 — especificação inicial:** o diretor definiu `Sand Wave` com **10 s / PL1 / 2 stamina / Burst / 0,25 s**, área triangular de **4 m**, barragem de areia, empurrão e pouco dano, cegueira por **4 s**, visão de **10 m** para lock-on, uso e alvos apenas no chão, **1,5 s** de barragem, **0,75 s** de hitbox e **0,75 s** de dissipação. Nenhum número adicional foi autorizado.

**19/10/2026 — correção de identificação:** o diretor esclareceu: **“estou substituindo sand kick”**. Portanto, **o terceiro golpe passa a chamar-se Sand Wave**, e o primeiro golpe continua sendo **Rock Tomb**. O documento reconhece expressamente que interpretar Sand Wave como substituto de Rock Tomb foi um erro do assistente.

**19/10/2026 — estado do design:** o diretor esclareceu que Sand Wave **não está pronto** e exigiu uma rodada de perguntas. A rodada seguinte resolveu direção da área, acerto único por inimigo, dano fixo e força de empurrão contínua; **a geometria completa, valores numéricos de dano/empurrão e outros aspectos permanecem pendentes**, conforme a seção 6.6.

**19/10/2026 — revisão da forma:** o diretor determinou que **Sand Wave não é mais triangular; sua área passa a ser retangular**. O triângulo permanece mencionado somente como **histórico revogado**, não como opção vigente. Após receber explicação visual de comprimento (alcance para a frente) e largura (extensão lateral), o diretor respondeu **“sim”** à proposta de **4 m para a frente × 3 m de largura**, com Mushroom no centro da borda traseira. Em seguida pediu explicitamente **sliders de largura e altura**. Portanto, as **dimensões padrão 4 × 3 m e os dois sliders independentes estão aprovados**; 'altura' aqui é a dimensão vertical do retângulo **na planta/vista superior (alcance frontal)**, não a elevação física em 3D. Faixas e passos de slider ainda não foram aprovados. Todas as demais decisões anteriores permanecem preservadas.

**19/10/2026 — Rodada 1 (perguntas 1–5):** **1. D — pediu referência visual simples sem gerar imagem; dimensão foi resolvida posteriormente por aprovação de 4 × 3 m com sliders independentes.** **2. A — direção fixada no disparo. 3. A — um acerto por inimigo por execução. 4. A — dano fixo independente de Ataque. 5. B — empurrão contínuo durante contato com a barragem ativa.**

**19/10/2026 — Rodada 2, decisões confirmadas pelo diretor (C/C/A/A/A):** (1) **6 HP de dano fixo** sem escala por Ataque; (2) **aceleração horizontal-base contínua de 12 m/s²**; (3) **empurrão para a frente na direção fixa do disparo**; (4) **defesa parcial reduz dano e empurrão, preserva cegueira; defesa perfeita anula os três efeitos**; (5) **novo acerto válido enquanto cegado reinicia o debuff em 4 s**, sem acumular. Todos os demais requisitos seguem intactos; Sand Wave **não foi implementado nem testado**.

**19/10/2026 — Rodada 3, decisões confirmadas (A/A/A/A/Pendente):** (1) duração total de **1,75 s** = **0,25 s preparação + 1,50 s de barragem** (0,75 s hitbox, 0,75 s dissipação); (2) **2 stamina e início de 10 s de cooldown imediatamente na ativação**; (3) **interrupção na preparação cancela sem reembolso de stamina/cooldown**; (4) **sair do chão na preparação cancela, mas sair do chão após lançar a barragem não a cancela**. (5) **Limites dos sliders de altura/alcance frontal e largura ficaram pendentes naquela rodada, mas foram resolvidos na Rodada 4**. A implementação do golpe continua **não autorizada e não realizada**.


**Rodada 4 (19/10/2026) — decisões expressas C/B/B/A/A:**

1. **Sliders de geometria com faixas experimentais:** altura/alcance frontal **0,5–30 m**, inicial **4 m**, e largura **0,5–20 m**, inicial **3 m**, ambos com **passo de 0,25 m** e independentes. A "altura" do slider é alcance no plano horizontal, não a elevação física da areia.
2. **Mitigação defensiva do empurrão:** defesa parcial reduz a aceleração em **50%**, de **12 para 6 m/s²**; defesa perfeita mantém anulação integral de dano, empurrão e cegueira. Defesa parcial continua permitindo cegueira e reduzindo dano pelas regras aprovadas anteriormente.
3. **Apresentação da cegueira:** **todos os observadores enxergam uma nuvem de areia ao redor do personagem cegado**. Apenas a **câmera/visão do jogador cegado** exibe **fog de cegueira e escurecimento do ambiente**; demais jogadores não têm a própria iluminação reduzida por esse debuff.
4. **Recuperação manual do lock-on:** se o lock-on for desativado porque o alvo está fora do raio de **10 m** durante cegueira, **reentrar no raio não reativa lock-on automaticamente**; é necessário **pressionar novamente o botão de lock-on**. A restrição de alcance dos 10 m continua em vigor durante os 4 s de cegueira.
5. **Pós-lançamento:** após os **0,25 s de preparação**, Mushroom pode **se movimentar e executar outras ações imediatamente**, sem ficar preso à barragem durante o restante de sua duração. A barragem persiste independentemente até completar os **1,5 s**, conservando orientação fixa, **0,75 s iniciais de hitbox** e **0,75 s finais de dissipação**, e só acerta inimigos no chão. Permanecem aplicáveis limitações gerais do jogo que não tenham sido modificadas expressamente.

**Status:** decisão documental aprovada; Sand Wave **continua não implementado ou testado**. Preservadas as Rodadas 1–3 e os demais golpes do elenco.

**19/10/2026 — Rodada 5, decisões confirmadas (B/C/A/B/A):** 1. **Fog forte: redução de iluminação de 60% na câmera do cegado, névoa densa próxima a 10 m**. 2. **Areia espalha-se ao redor dos obstáculos sem atravessar paredes sólidas**, com modelo de propagação ainda pendente. 3. **Todos os inimigos elegíveis no retângulo**, com **um acerto por alvo por execução**. 4. Durante cegueira, **apertar lock-on escolhe obrigatoriamente o adversário elegível mais próximo dentro de 10 m**. 5. **A posição dos pés/ponto de apoio no chão precisa estar dentro do retângulo** para contato. Todas as decisões anteriores preservadas; **nenhuma autorização ou implementação de gameplay**.

**19/10/2026 — Rodada 6, decisões confirmadas pelo diretor (B/A/A/A/A):** (1) **areia pode sair lateralmente do retângulo original para contornar obstáculos, mas só atinge inimigos com pés/ponto de apoio dentro da área retangular original**, sem atravessar paredes; (2) **durante cegueira, paredes sólidas bloqueiam lock-on quando ocultam totalmente o alvo, mas basta qualquer parte visível**, mantendo seleção manual do mais próximo dentro de 10 m; (3) **invulnerabilidade temporária impede dano, empurrão e cegueira enquanto estiver ativa**; (4) **contato com o chão conforme estado físico do motor, com elegibilidade imediata no contato de aterrissagem confirmado**; (5) **nuvem de areia do cegado visível a todos durante os 4 s completos de cegueira e desaparece quando o debuff acaba**. Sem escolha de algoritmo de contorno, forma exata de visibilidade ou novas regras de combate não explicitadas. **Não implementar Sand Wave nem alterar código nesta rodada.**

**19/10/2026 — Rodada 7, decisões confirmadas pelo diretor (A/C/B/A/C):** (1) **propagação pelos caminhos livres mais curtos ao redor de obstáculos**, com desvios laterais permitidos sem aumentar o retângulo original de acerto; (2) **empurrão contra parede faz o alvo parar e sofrer breve stagger sem dano adicional**, com **duração ainda pendente**; (3) **Sand Wave não neutraliza outros ataques PL1 por contato**, cada golpe mantém suas regras normais; (4) **alvo que deixa de estar invulnerável durante hitbox ativa pode ser atingido imediatamente se elegível**, mantendo um único acerto válido por execução; (5) **empurrão suspende controle de deslocamento do alvo durante contato ativo**, restaurado ao sair da área efetiva ou terminar a hitbox. As decisões anteriores **SW-D01 a SW-D48** e os outros três golpes permanecem preservados. **Nenhuma implementação foi autorizada nesta rodada.**

**19/10/2026 — Rodada 8, decisões confirmadas pelo diretor (B/A/B/A/A):** (1) **stagger contra parede de 0,30 s sem dano extra**; (2) **a areia continua pressionando o alvo contra a parede sem atravessá-la até acabar o contato com a barragem ou a janela de hitbox**; (3) **onda de areia progressiva cobre o alcance frontal configurado ao longo de 0,75 s em percurso sem obstáculos**, sem alcance instantâneo; o tempo para contornar obstáculos continua pendente; (4) **acerto por área lógica horizontal**, dependente de **pés/ponto de apoio dentro do retângulo e estado no chão**, sendo a **altura física da areia apenas visual**; (5) **o alvo sob empurrão pode atacar e defender normalmente, mas não consegue iniciar esquivas**, mantendo suspensão do controle de deslocamento já aprovada. As decisões SW-D01–SW-D53 e demais golpes permanecem preservados. **Sand Wave não foi implementado; nenhuma alteração de código do jogo autorizada.**

**19/10/2026 — Rodada 9, decisões confirmadas pelo diretor (A/B/A/A/A):** (1) **velocidade da onda = alcance frontal configurado ÷ 0,75 s, propagada pelos caminhos livres mais curtos; caminhos desviados mais longos atrasam e podem impedir acerto**; (2) **novo stagger de parede na mesma execução somente após deixar de ser pressionado contra a parede e colidir validamente de novo**, sem renovações por contato contínuo; (3) **conservar velocidade física adquirida após terminar o empurrão**, com decaimento por atrito e regras normais; (4) **durante stagger de parede não é permitido iniciar ataques, defesa ou esquivas**; (5) **ataques, defesa e esquivas já iniciados continuam sob regras normais**, respeitando invulnerabilidade, colisões e restrições de deslocamento. **Todas as decisões SW-D01–SW-D58 e demais golpes permanecem preservados. Nenhuma implementação de Sand Wave foi autorizada nem realizada.**

**19/10/2026 — Rodada 10, decisões confirmadas pelo diretor (A/A/A/A/E):** (1) **IA cegada sujeita à mesma percepção do jogador (10 m e paredes sólidas bloqueando linha de visão integralmente)**; (2) **IA cegada seleciona sempre o adversário elegível mais próximo**; (3) **na ausência de alvo perceptível, IA cegada prioriza proteção e reposicionamento até perceber alguém novamente**; (4) **obstáculos móveis exigem recálculo dos caminhos livres mais curtos conforme sua geometria mudar durante a barragem**; (5) **opção E: direção visual deliberadamente adiada até comparação e aprovação de protótipos, sem estilo aprovado**. SW-D01–SW-D63, Rodadas 1–9 e a auditoria original são preservados; somente documentação foi alterada. **Sand Wave não foi implementado.**

### 6.9 Auditoria de encerramento — 19/10/2026 (somente documentação)

**Escopo e fonte de verdade.** Auditoria **estática**, na `main` do GitHub `Ziaker/Arenamon`, sobre a seção 6 deste documento e o código existente do Combat Lab. **Não houve implementação, simulação, build ou testes jogáveis do Sand Wave nesta auditoria.** Não são introduzidas novas escolhas de gameplay, números, efeitos ou regras; apenas classificadas as decisões já tomadas, os pontos técnicos e aquilo que ainda exige aprovação do diretor. Esta seção **não revoga** SW-D01–SW-D63 nem altera os outros golpes.

#### 6.9.1 Integridade documental — aprovada

- **Nove rodadas (1–9) registradas**, com entradas históricas individuais e decisões rastreadas. O item 5 da Rodada 3 permaneceu pendente naquela rodada, mas **foi resolvido expressamente na Rodada 4**; o histórico original continua válido.
- **63 identificadores distintos e consecutivos, SW-D01 a SW-D63, sem lacunas ou duplicações**, em uma única tabela. As regras originais e revisões aprovadas (triângulo substituído por retângulo; Sand Wave substitui Sand Kick, **não** Rock Tomb) estão preservadas.
- Cronologia, custo, cooldown, sliders, retângulo lógico, propagação por caminhos livres mais curtos e velocidade derivada do alcance, hitbox/dissipação, dano, empurrão, stagger, invulnerabilidade, defesa, cegueira e lock-on têm **parâmetros centrais documentados**.
- **Resultado:** o **registro das nove rodadas está completo**. Isso **não** equivale a certificar a especificação visual integral ou a prontidão de implementação sem integração e testes.

#### 6.9.2 Classificação das pendências existentes

| Código | Classificação na auditoria | Justificativa e próximo passo, sem presumir novas regras |
|---|---|---|
| **SW-P01** | **Resolvida em design** | Hitbox **lógica horizontal** por ponto de apoio dentro do retângulo e estado no chão, conforme Rodada 8. Altura da areia é exclusivamente visual; não exigir mais uma decisão sobre altura de colisão 3D. |
| **SW-P03** | **Integração técnica obrigatória** | Aceleração **12/6 m/s²**, suspensão direcional, conservação de inércia, contato de parede e fim da força já foram decididos. É necessário construir/testar a integração determinística ao motor sem alterar essa física aprovada. |
| **SW-P05** | **Integração técnica obrigatória** | Usar contato com chão confirmado pelo motor, com elegibilidade imediata após aterrissagem, já decidido. Auditar transições e estados reais (Dodge/voo/pouso) sem criar exceções. |
| **SW-P07** | **Direção visual ainda não finalizada** | O **escopo, 60% de redução de iluminação, fog próximo a 10 m e 4 s de nuvem visível para todos** estão aprovados. **Aparência final da nuvem e curvas de opacidade/densidade** não receberam aprovação visual específica; dependem de proposta/protótipo e decisão do diretor **caso se queira encerrar também a direção de arte**. Não são impedimento lógico para fechar as regras numéricas de gameplay. |
| **SW-P08** | **Mista: possível decisão de gameplay + integração técnica** | A seleção **manual do alvo elegível mais próximo dentro de 10 m**, com qualquer parte visível e sem paredes bloqueando totalmente o alvo, já está definida para jogador cegado. **Não está explicitamente decidido como a cegueira afeta o comportamento de aquisição/perseguição da IA**; não presumir que os bots usem o mesmo lock-on do jogador. Implementação de teste de visibilidade e desempate determinístico são técnicos. Solicitar direção específica sobre IA se necessário à certificação funcional completa. |
| **SW-P10** | **Integração técnica obrigatória** | Regras de PL1, guarda parcial/perfeita, invulnerabilidade, ações pré-iniciadas, bloqueio de novos comandos e stagger estão decididas; integrar aos estados reais do motor e testar conflitos de prioridade sem criar cancelamentos ou imunidades novos. |
| **SW-P11** | **Mista: princípio aprovado + detalhe condicional** | Caminho livre mais curto, desvio lateral, retângulo de acerto fixo, **v = alcance frontal ÷ 0,75 s** e término da hitbox já foram decididos. Busca de caminho, colisão e discretização são **técnicos**. **Se obstáculos móveis puderem alterar caminhos durante a mesma execução**, a política de recalcular trajetos ou congelar a geometria não foi aprovada; verificar se o caso existe e, se houver diferença perceptível de gameplay, submetê-lo ao diretor. |
| **SW-P12** | **Resolvida em design; integração técnica obrigatória** | Stagger **0,30 s**, sem dano extra, sem renovação por pressão contínua e reaplicável só após afastar-se da parede e colidir de novo, com proibição de iniciar ataque/defesa/esquiva, já estão decididos. Resta integrar estados, contatos e ações pré-existentes. |

#### 6.9.3 Divergências objetivas com a infraestrutura consultada

Estas divergências **não significam que o Sand Wave esteja implementado**: indicam requisitos específicos que não podem ser satisfeitos copiando diretamente os componentes genéricos atuais.

1. **Acerto base e defesa parcial — `prototypes/combat-lab/src/sim/world.js`.** A função genérica `applyHit` multiplica o dano do movimento pelo atributo **Ataque** do lançador, mas Sand Wave exige **6 HP base independentes de Ataque**. Além disso, o fluxo genérico aplica `hit.statuses` apenas no ramo sem defesa frontal, enquanto Sand Wave exige **cegueira também sob defesa parcial**. Usar esse fluxo sem adaptação causaria divergência de gameplay; **defesa perfeita** deve continuar anulando a cegueira.
2. **Área e trajetória — `prototypes/combat-lab/src/sim/world.js`.** `stepArea` usa **pulsos e colisão radial com sobreposição vertical**; não corresponde à **onda progressiva retangular lógica, com teste dos pés, rota livre mais curta, bloqueio por paredes e empurrão contínuo**. Há infraestrutura geométrica de caixas, mas isso **não** prova que a mecânica requerida esteja pronta.
3. **Empurrão, combate e stagger — `world.js` e `controller.js`.** O acerto genérico pode **zerar velocidade, encerrar ação e criar push/launch pontual**. Sand Wave exige **aceleração contínua direcional, conservação de inércia e continuidade de ações previamente iniciadas**; o stagger de parede de 0,30 s tem restrições próprias. Precisará de tratamento explícito e testes de prioridades, sem herdar knockback ou wall-splat existentes.
4. **Cegueira, lock-on e IA — `status.js`, `ui/input.js` e `sim/ai.js`.** O sistema de status suporta duração/renovação de estados; o controle de lock-on do jogador usa `locked`, porém não há evidência no código lido de uma implementação de **blind do Sand Wave**, nem das restrições de 10 m/visibilidade e redirecionamento para o alvo mais próximo quando cegado. Os comportamentos da **IA** devem ser tratados separadamente do lock-on manual.
5. **Liberdade após 0,25 s — `controller.js` e `moves.js`.** O controlador atual gerencia movimentos como ações em linha temporal. Deve-se garantir que **Mushroom fique livre após emitir a barragem**, enquanto a entidade já emitida persiste pelos **1,5 s**, sem cancelar a onda ao iniciar outra ação.

#### 6.9.4 Critérios para encerramento

- **Registro das Rodadas 1–9: COMPLETO.**
- **Regras principais de gameplay: AMPLAMENTE DEFINIDAS, com aspectos contextuais ainda a validar** (notadamente comportamento da IA cegada e eventual obstáculo móvel).
- **Direção visual final: NÃO APROVADA INTEGRALMENTE** — parâmetros de intensidade/duração já aprovados não substituem aprovação da aparência final.
- **Implementação e testes do Sand Wave: NÃO EXECUTADOS** nesta auditoria.
- **Encerramento total do move: NÃO CERTIFICADO** nesta data. Não mudar o estado para aprovado/implementado sem decisão expressa do diretor e evidências da fase apropriada.

**Próximo encaminhamento sugerido, não autorizado como nova regra:** resolver apenas as questões de direção pendentes (comportamento da IA cegada, política de obstáculos móveis *se aplicável*, aparência visual final quando houver protótipo), então fazer uma certificação de design separada. Em fase posterior e somente mediante autorização, implementar e validar cenários de regressão para alcance dos sliders, caminhos bloqueados, defesa parcial/perfeita, invulnerabilidade, controles sob empurrão, stagger, múltiplos alvos, status de cegueira e conservação de inércia.

#### 6.9.5 Atualização da auditoria após a Rodada 10 (A/A/A/A/E) — 19/10/2026

**Natureza desta atualização:** complementa a auditoria estática anterior (**6.9.1–6.9.4 preservadas como histórico**), sem apagá-la ou retroativamente atribuir decisões que não existiam na data daquela fotografia. A classificação abaixo **substitui, para o estado atual do design, as pendências contextuais anteriores**, não os registros históricos.

| Código | Classificação atual | Fundamentação atual |
|---|---|---|
| **SW-P07** | **Direção visual explicitamente PENDENTE** | **Rodada 10 (5E): nenhum estilo aprovado**; aguardar protótipos para comparação e aprovação expressa da aparência da areia/nuvem e curvas de densidade/opacidade. Intensidades, alcance lógico, público da nuvem e durações já aprovados permanecem intactos. |
| **SW-P08** | **Decisão de gameplay RESOLVIDA; integração técnica pendente** | **Rodada 10 (1A/2A/3A):** IA cegada percebe apenas adversários elegíveis a **até 10 m**, com pelo menos alguma parte visível e sem parede sólida ocultando totalmente o adversário; seleciona sempre **o mais próximo**; sem alvos perceptíveis, **prioriza proteção e reposicionamento**. Permanecem algoritmos de visibilidade, desempate e testes de IA/lock-on como detalhes técnicos. |
| **SW-P11** | **Decisão de gameplay RESOLVIDA; integração técnica pendente** | **Rodada 10 (4A):** se obstáculos mudarem de posição durante a propagação, **recalcular os caminhos livres mais curtos para a geometria atual**. Preservar retângulo fixo elegível, desvio lateral permitido, proibição de atravessar paredes, velocidade = alcance frontal ÷ 0,75 s, e janela ofensiva sem extensão. Busca de caminhos, discretização e tratamento determinístico das atualizações são técnicos. |
| **SW-P01, SW-P03, SW-P05, SW-P10, SW-P12** | **Classificação histórica mantida** | SW-P01 resolvida em design; demais requisitos físicos, de contato, combate e stagger já decididos exigem apenas trabalho de integração e testes, sem novas regras autorizadas. |

**Conferência de rastreabilidade:** Rodadas **1–10** registradas, com **SW-D01–SW-D68** consecutivas; **SW-D68 registra a escolha de ADIAR a aprovação visual**, não uma escolha de direção artística. A menção a **9 rodadas e 63 decisões** em **6.9.1 e 6.9.4** refere-se expressamente à **fotografia histórica da auditoria anterior**, agora complementada por esta seção.

**Estado após a Rodada 10:** as **decisões funcionais de gameplay levantadas nessa auditoria estão respondidas**, incluindo comportamento da IA cegada e política para obstáculos móveis. **A direção visual final permanece pendente**, pois o diretor escolheu aguardar comparação de protótipos. **Não foi emitida certificação de encerramento integral ou de prontidão de implementação**. A integração futura da mecânica e os testes não estão autorizados por este registro.

## 7. Emerging Stone — renomeação e especificação inicial do Move 1 (19/10/2026)

**Decisão expressa do diretor:** o primeiro golpe de Mushroom passa a chamar-se **Emerging Stone**, **em substituição ao nome Rock Tomb**.

| Campo | Estado vigente |
|---|---|
| Personagem | **Mushroom** (identificador técnico Mushroom ↔ Mosh continua sem confirmação) |
| Ordem no elenco | **Move 1**, sem alteração |
| Nome vigente | **Emerging Stone** |
| Nome anterior | **Rock Tomb** (que antes havia corrigido a indicação **Rock Slide**) |
| Mecânicas e parâmetros | A renomeação **isoladamente** não definiu mecânicas; **posteriormente**, o diretor forneceu o conjunto de regras de gameplay **ES-D01–ES-D18**, descrito na **seção 7.1**, com pendências especificadas na seção 7.2 |
| Visual, animação e VFX | A renomeação **não** especificou VFX; a descrição **posterior** definiu o conceito de terra emergindo e detritos ao longo do trajeto subterrâneo. Aparência final/animações detalhadas continuam não aprovadas |
| Implementação e testes | **Não autorizados nem executados** por esta alteração documental |

**Preservação e precedência histórica:** os trechos de correção de Rock Slide → Rock Tomb, a decisão **SW-D18** e os relatos das Rodadas 1–10 de Sand Wave continuam íntegros como registros das decisões anteriores. Onde constar “Rock Tomb permanece como golpe 1”, interpretar como referência **histórica, superada apenas quanto ao nome** por esta renomeação. **A posição do golpe 1 não mudou**, Sand Wave continua **substituindo Sand Kick no Move 3**, Bullet Punch continua Move 2 e Body Slam permanece Move 4 até nova decisão explícita.

**Estado da renomeação original:** após a mudança de nome, as mecânicas ainda não estavam definidas. O diretor posteriormente forneceu a especificação inicial de gameplay da **seção 7.1**, que agora prevalece para esses parâmetros sem revogar o registro histórico. **Nenhuma implementação de moves foi iniciada por esta documentação.**

### 7.1 Especificação inicial aprovada diretamente pelo diretor — Emerging Stone

**Identidade:** Emerging Stone é o **Move 1 do Mushroom**, anteriormente nomeado Rock Tomb. O diretor forneceu os parâmetros e o conceito abaixo expressamente, **sem autorizar implementação**. Os pontos não descritos não devem ser preenchidos por analogia com Bullet Punch nem com o motor.

**Precedência das decisões:** as descrições iniciais (ES-D01–ES-D18) e as Rodadas 1–2 (ES-D19–ES-D27) permanecem intactas como histórico. A **Rodada 3 (§7.6)** complementa essas decisões: objetos físicos em 5 m, incluindo paredes e obstáculos fixos (exceto chão e limites externos), são destruídos antes da rocha; paredes não protegem adversários da explosão; componente vertical inicial de 14 m/s combinado ao horizontal radial de 8 m/s na emergência; máximo três rochas por Mushroom, criando quarta destrói mais antiga. **A questão 1 da Rodada 1 continua pendente entre B e C mutuamente exclusivas, ambas não aprovadas.**

**Atualização de precedência — Rodada 5 (§7.8):** slider único **0,25×–4×**, passo **0,25×**, padrão **1×**, para prisma 3 × 3 × 3 m; sem posição válida a explosão ocorre, mas a rocha não surge; **cada ataque que atinja a rocha causa dano por PL (P0 1, P1 2, P2 3, P3 4 HP)**. **PL não afeta as outras fases do Emerging Stone, que não participa de Clash/disputas de PL**; **Reflect não funciona nem no projétil nem na explosão**. A descrição da Rodada 4 abaixo é preservada como histórico anterior; a cronologia do Normal Cast de 0,55 s segue **B/C mutuamente exclusivas, ambas não aprovadas**.

**Estado mais recente e precedência (Rodada 4, §7.7):** o projétil subterrâneo segue **trajetória reta até o marcador**, passando sob paredes e obstáculos superficiais sem ser bloqueado por estes; a rocha é um **prisma de 3 × 3 × 3 m** com **um único slider de escala proporcional de todas as dimensões**; se não couber integralmente no marcador por causa dos limites externos, é colocada **na posição válida mais próxima onde caiba**; ao chegar a **0 HP** é destruída **imediatamente**, cessando o bloqueio de movimentação e ataques. A **explosão continua centrada no marcador**, independentemente do reposicionamento da rocha (o gatilho de detonação e seu raio de 5 m permanecem). A Rodada 4 **não aprova** mínimo, máximo ou passo do slider nem modifica a velocidade de 15 m/s. **Rodada 1 questão 1 — B/C mutuamente exclusivas, ambas não aprovadas — permanece pendente.**

#### Contrato de gameplay e visual conceitual

**Nota de precedência:** os itens 1–18 e sua tabela preservam a especificação inicial. A Rodada 1, na seção **7.4**, aprovou o alcance/controle do marcador, a fórmula do dano e a direção do lançamento. A **Rodada 2**, na seção **7.5**, aprovou atingir todos os inimigos elegíveis no raio uma vez cada, destruir todos os objetos no raio antes da rocha surgir, velocidade horizontal inicial de lançamento de 8 m/s, vulnerabilidade da rocha a qualquer ataque danoso que a atinja, e lançamento vertical poderoso de personagem presente na posição de surgimento. Formulações iniciais de aspectos “ainda não explicitados” nestas matérias são históricas e foram complementadas nas seções 7.4–7.5. **A cronologia dos 0,55 s continua pendente entre duas alternativas B/C mutuamente exclusivas; nenhuma foi aprovada.**

1. **Recarga:** **9 s de cooldown** por uso.
2. **Custo:** **3 unidades de stamina** por uso.
3. **Power Level:** **ignora PL (Power Level)**. O significado de “ignorar” em cada tipo específico de confronto ainda precisa de detalhamento; não presumir neutralização, prioridade ou imunidade universal.
4. **Reflect:** **ignora Reflect**. Não aplicar reflexão automática ao projétil do Emerging Stone; detalhes de outras interações com escudos/barreiras permanecem em aberto.
5. **Dano:** **20 DMG** definido pelo diretor. Ainda não foi explicitado se é dano-base fixo ou sujeito a atributos/modificadores e defesas existentes; não converter silenciosamente em fórmula.
6. **Execução:** **Normal Cast**, com **0,55 s** especificados para o cast. Não inferir, sem aprovação, quando o jogador congela a escolha do marcador, quando os recursos são pagos ou se existe etapa de ajuste de duração variável além do cast.
7. **Marcador/seleção:** durante a **pré-carga/preparação**, o jogador seleciona a **direção/destino indicado por um marcador**, em funcionamento **similar ao marcador de Bullet Punch**. Essa similaridade **não** aprova automaticamente o mesmo alcance, velocidade de ajuste, regras de segurar/soltar botão, cancelamentos, congelamento de posição ou teletransporte do Bullet Punch.
8. **Projétil:** dispara-se um **projétil subterrâneo** que percorre o subsolo **em direção ao marcador** selecionado. **Velocidade de deslocamento: 15 m/s**.
9. **VFX de deslocamento:** o trajeto subterrâneo deve ser perceptível por **terra emergindo e detritos sendo expelidos pelo solo**, como o rastro de **uma toupeira avançando sob a terra**. Esta é uma referência conceitual obrigatória; forma artística, densidade e partículas exatas dependem de aprovação posterior.
10. **Detonação:** ao **chegar ao marcador**, o projétil **detona na região ao redor do destino**.
11. **Área de detonação:** **raio de 5 m** ao redor do ponto de detonação.
12. **Efeitos da detonação:** causa o **dano especificado de 20 DMG** ao(s) inimigo(s) validamente atingido(s) na área e os **lança para trás**. Número máximo de vítimas, vetor/fórmula/intensidade do lançamento, elegibilidade vertical e tratamento de defesa/invulnerabilidade continuam pendentes de especificação; **não inventar** valores.
13. **Rocha criada:** **junto da detonação**, **uma rocha emerge do solo**, permanecendo como **obstáculo físico no ambiente**.
14. **Resistência da rocha:** **5 HP**.
15. **Duração da rocha:** **infinita/permanente** — sem cronômetro que a faça desaparecer naturalmente. Critérios de destruição e outras regras de interação ainda precisam ser definidos.
16. **Dimensões iniciais:** a rocha é um **bloco de 3 × 3 m**, com **slider obrigatório** para ajuste de tamanho. Ainda não foram aprovados mínimo, máximo e passo do slider nem sua relação com a altura física e com os dois eixos da base.
17. **Restrição de escalada e colisão — decisão posterior aprovada (opção B):** a rocha **não pode ser escalada/subida** por locomoção terrestre e **bloqueia a passagem no chão**. **A passagem aérea por cima é permitida somente quando o personagem tiver altura suficiente para superar fisicamente o obstáculo**, sem atravessar o volume sólido da rocha. A opção B substitui, para esta questão, o estado anterior de alternativas ainda não escolhidas. **Não** foi aprovado um valor numérico de altura, a proibição geral de saltar nem o deslizamento automático para a direção livre mais próxima.
18. **Persistência espacial:** a rocha criada pela detonação **permanece no ambiente** (salvo futuras regras de destruição/remoção por interação, ainda não definidas); não substituir por VFX passageiro nem cancelar ao fim do cast.

#### Tabela de decisões iniciais explicitadas pelo diretor

| ID | Assunto | Regra expressa vigente |
|---|---|---|
| ES-D01 | Cooldown | **9 s** |
| ES-D02 | Stamina | **3 unidades** |
| ES-D03 | PL | **Ignora PL**; interações específicas ainda dependem de definição |
| ES-D04 | Reflect | **Ignora Reflect** |
| ES-D05 | Dano | **20 DMG** |
| ES-D06 | Categoria/cast | **Normal Cast, 0,55 s** |
| ES-D07 | Mira | **Selecionar direção/destino pelo marcador durante pré-carga, similar à função do marcador do Bullet Punch**, sem importar parâmetros não citados |
| ES-D08 | Projétil e velocidade | **Projétil percorre o subsolo rumo ao marcador a 15 m/s** |
| ES-D09 | VFX do trajeto | **Terra emergindo e detritos expelidos, lembrando toupeira avançando sob o solo** |
| ES-D10 | Gatilho da explosão | **Detona quando atinge o marcador** |
| ES-D11 | Raio da detonação | **5 m** |
| ES-D12 | Ofensiva da explosão | **20 DMG e lançamento para trás** dos inimigos validamente atingidos, intensidade/vetor ainda pendentes |
| ES-D13 | Criação de obstáculo | **Rocha emerge junto da detonação** |
| ES-D14 | HP do obstáculo | **5 HP** |
| ES-D15 | Persistência | **Duração infinita/permanente**, sem expiração por tempo |
| ES-D16 | Geometria/ajuste | **Bloco 3 × 3 m com slider de tamanho**; configuração exata do slider pendente |
| ES-D17 | Restrição | **Rocha não pode ser escalada/subida normalmente** |
| ES-D18 | Tratamento do pulo — opção B aprovada posteriormente | **A rocha bloqueia a passagem terrestre, mas permite passagem aérea somente por cima, quando houver altura suficiente para ultrapassá-la sem atravessar sua colisão sólida**. Mantida a proibição de escalada normal (ES-D17); sem altura numérica adicional aprovada |

### 7.2 Pontos ainda não decididos — não inventar

- **ES-P01 — cronologia do Normal Cast AINDA NÃO DECIDIDA (Rodada 1, questão 1D):** o diretor mantém **B e C como opções mutuamente exclusivas, sem escolher nenhuma**. **B:** botão segurado sem limite para ajustar marcador; soltar inicia cast de 0,55 s, seguido pelo disparo. **C:** cast de 0,55 s começa ao pressionar; marcador ajustável enquanto isso; disparo somente após completar o cast **e** soltar. **B e C não podem ocorrer simultaneamente**. Congelamento do marcador, momento de cobrança e demais transições permanecem para decisão posterior. Não importar as ações físicas de Bullet Punch.
- **ES-P02 — controle/distância APROVADOS e posicionamento do destino parcialmente resolvido (Rodadas 1 e 4):** direcionais ajustam o marcador independentemente da orientação do corpo, com distância **3–10 m**. O projétil viaja **em linha reta sob paredes e obstáculos superficiais**, sem ser bloqueado por eles (ES-D33). Se a **rocha** não couber integralmente no lugar marcado por causa dos limites externos da arena, ela surge na **posição válida mais próxima onde caiba** (ES-D36), **sem transferir automaticamente a explosão para esse ponto**. Permanecem os detalhes de controle, geométricos/operacionais de seleção e de validade em terrenos especiais; não importar outras regras de Bullet Punch.
- **ES-P03 — dano e lançamento definidos em seus parâmetros principais (Rodadas 1–3):** 20 DMG base × atributo Ataque, defesa e modificadores normais; todos os inimigos elegíveis dentro de 5 m, uma vez por explosão, **inclusive atrás de paredes**; lançamento horizontal radial **8 m/s iniciais**. Personagem no ponto de surgimento também recebe **lançamento vertical inicial 14 m/s**, sem substituir o componente horizontal (Rodada 3, 3B/4D). Continuam pendentes somente condições de elegibilidade vertical de outros alvos, invulnerabilidade e detalhes físicos/temporais da composição, sem novos efeitos aprovados.
- **ES-P04 — PL e Reflect RESOLVIDOS EM DESIGN (Rodada 5, 4D/5A); integração pendente:** somente a **rocha** é afetada pelo Power Level, ao **receber dano dos ataques que a atinjam**, calculado por P0 = 1 HP, P1 = 2 HP, P2 = 3 HP, P3 = 4 HP. Emerging Stone **não é afetado por PL no restante, não pode causar Clash ou participar de disputas de PL**. **Reflect não funciona em nenhuma fase**, incluindo o projétil subterrâneo e a explosão. Outras regras de defesa/invulnerabilidade não foram alteradas. Para ataques sem PL mapeado em P0–P3, não inventar regra.
- **ES-P05 — escala e falta de posição válida RESOLVIDAS EM DESIGN (Rodada 5, 1B/2A), integração pendente:** rocha prismática padrão **3 × 3 × 3 m**; slider proporcional único **0,25× a 4× em passos de 0,25×** (padrão 1×), dimensão de cada eixo entre **0,75 m e 12 m**. Se não couber no marcador por limites externos, usar a posição válida mais próxima onde caiba; **se não houver posição válida alguma, a explosão ocorre normalmente, mas nenhuma rocha é criada**. A explosão continua centrada no marcador; posicionamento da rocha não altera área de dano. Restam cálculo geométrico de posição válida e casos de colisões simultâneas.
- **ES-P06 — passagem aérea RESOLVIDA em regra principal (opção B); detalhes técnicos pendentes:** **bloquear passagem terrestre e permitir atravessar por cima da rocha somente se a trajetória aérea tiver altura física suficiente**, sem atravessar o volume sólido e sem permitir escalada terrestre. Não definir altura mínima numérica arbitrária: verificar colisão contra as dimensões físicas efetivas da rocha. Restam integração técnica de saltos já iniciados, movimento aéreo e contatos de borda com as regras existentes. **Não** converter essa escolha em proibição de pulo ou deslizamento automático.
- **ES-P07 — dano à rocha por Power Level RESOLVIDO EM DESIGN (Rodada 5, 3D); integração pendente:** qualquer tipo de ataque que **efetivamente atinja** a rocha causa **1 HP + 1 HP por nível de PL**: **P0 = 1 HP, P1 = 2 HP, P2 = 3 HP, P3 = 4 HP**, substituindo cálculo ordinário de dano do ataque sobre a rocha; não presumir regra para ataques sem PL P0–P3 definido. Essa nova regra supera a referência anterior restrita a “ataques danosos”. Rochas continuam com **5 HP e duração infinita** e são **destruídas imediatamente ao atingir 0 HP**, cessando bloqueio de movimentação e ataques. Máximo três simultâneas por Mushroom; quarta destrói a mais antiga. Explosão também destrói objetos dentro do raio, inclusive rochas. Não inventar prioridades para remoções simultâneas.
- **ES-P08 — destruição, oclusão e trajeto parcialmente resolvidos (Rodadas 3–4):** explosão destrói **todos os objetos físicos dentro de 5 m**, incluindo paredes e obstáculos fixos do cenário, exceto **chão e limites externos da arena**, antes de criar a rocha; personagens são alvos de dano/lançamento, não objetos destruídos. **Paredes não protegem** inimigos elegíveis da explosão em 5 m. **Projétil subterrâneo viaja em linha reta por baixo de paredes e obstáculos superficiais, sem ser bloqueado por eles**, até o marcador, à velocidade de 15 m/s; não presumir regras para obstruções exclusivamente subterrâneas não citadas. A **detonação ocorre no marcador**, enquanto o obstáculo pode ser criado na posição válida mais próxima caso não caiba ali por limites externos. Restam a integração do ambiente, condições específicas do terreno e possíveis casos sem posição válida.
- **ES-P09 — VFX e animação:** conceito do rastro de terra/detritos está descrito; visuais finais, transição da detonação e animação da rocha ainda não aprovados.

### 7.3 Histórico de aprovação e escopo

**19/10/2026 — especificação inicial de Emerging Stone recebida do diretor:** **9CD / 3STM / ignora PL / ignora Reflect / 20DMG / Normal Cast 0,55 s**, projétil subterrâneo com trilha de terra e detritos (analogia de toupeira) a **15 m/s** até **marcador ajustado na pré-carga, similar a Bullet Punch**, detonação ao chegar ao marcador com **raio de 5 m e lançamento para trás**, criação de **rocha persistente 5 HP / duração infinita / bloco 3 × 3 m com slider**, **não escalável**. As alternativas para a interação com saltos foram citadas, porém **não escolhidas**, e assim continuam pendentes. **Não foi autorizada implementação, nem foram definidos parâmetros adicionais.**

**19/10/2026 — decisão posterior de colisão com a rocha, opção B aprovada pelo diretor:** a rocha **bloqueia deslocamento terrestre**, **não é escalável por locomoção normal**, mas **pode ser ultrapassada por cima durante um salto ou deslocamento aéreo com altura suficiente**, sem atravessar a sua colisão sólida. **ES-D18 passa de alternativa pendente para opção B aprovada**; permanecem indefinidas dimensões verticais finais e detalhes técnicos de validação de altura. As opções de impedir pulos e de deslizamento automático **não** foram aprovadas. Nenhum código foi modificado.

**19/10/2026 — Emerging Stone Rodada 1 (D/A/A/B/A):** questão 1D = **NÃO DECIDIDA**; manter as alternativas de cronologia **B e C para escolha futura, mutuamente exclusivas**. Questões 2–5 aprovadas: **2A** direcionais ajustam o marcador independentemente da orientação de Mushroom; **3A** alcance de **3–10 m**; **4B** dano-base **20 × atributo Ataque**, sujeito a defesas e modificadores normais; **5A** lançamento **radialmente para fora do centro da explosão**. Registro vigente em ES-D19–ES-D22. Nenhuma implementação autorizada.

**Preservação:** as decisões e textos anteriores, incluindo **SW-D01–SW-D68**, Rodadas **1–10** do Sand Wave, Bullet Punch e o histórico da renomeação Rock Tomb → Emerging Stone, permanecem válidos e íntegros. A presente aprovação é **somente documentação**.

### 7.4 Emerging Stone — Rodada 1 (19/10/2026): decisões e escolha adiada

**Resultado declarado:** 1D / 2A / 3A / 4B / 5A. **A questão 1 está PENDENTE**: o diretor não escolheu B nem C, mas determinou manter **ambas como alternativas mutuamente exclusivas para decisão futura**. A escolha 1D **não autoriza combinar B e C** nem introduzir cronologia híbrida.

#### Questão 1 — duas alternativas NÃO aprovadas (B versus C)

- **Opção B (candidata, NÃO APROVADA):** o jogador pode manter o botão pressionado **sem limite de tempo** para ajustar o marcador. **Ao soltar**, inicia-se o **cast de 0,55 s**; o projétil é disparado após esse cast.
- **Opção C (candidata, NÃO APROVADA):** o **cast de 0,55 s inicia quando o botão é pressionado**. O marcador pode ser ajustado durante esse período; o projétil somente dispara **depois de completar 0,55 s e de soltar o botão**.
- **Regra de precedência:** essas possibilidades são **incompatíveis**, e **nenhuma é a regra vigente**; o único número de cast aprovado continua **0,55 s** (ES-D06). Segurar/soltar, cronologia final, momento exato de congelar o marcador e de descontar recursos seguem indefinidos.

#### Questões 2–5 — aprovadas

| ID | Origem | Regra vigente |
|---|---|---|
| ES-D19 | Rodada 1, questão 2 (A) — controle da mira | **Comandos direcionais ajustam o marcador independentemente da orientação do corpo do Mushroom**, pelo mesmo princípio funcional do Bullet Punch, sem importar outros parâmetros ou a ausência física daquele golpe. |
| ES-D20 | Rodada 1, questão 3 (A) — alcance da mira | **Marcador com distância selecionável de 3–10 m**, conforme a faixa documentada para Bullet Punch; **projétil permanece a 15 m/s** (ES-D08). |
| ES-D21 | Rodada 1, questão 4 (B) — dano | **20 DMG de dano-base × atributo Ataque**, sujeito às **regras normais de defesa e demais modificadores**. Complementa ES-D05 e ES-D12 sem revogá-los e não aprova ignorar defesa. |
| ES-D22 | Rodada 1, questão 5 (A) — direção do lançamento | **Lançamento radialmente para fora do centro da explosão** para inimigos atingidos; magnitude e dinâmica vertical continuam não decididas. |

**Escopo:** aprovadas quatro regras **ES-D19–ES-D22**, nenhuma regra de cronologia para a questão 1. **Todas ES-D01–ES-D18 e SW-D01–SW-D68 mantidas literalmente**, assim como as outras seções do catálogo. Não alterar o jogo, não executar implementação nem testes do golpe.

### 7.5 Emerging Stone — Rodada 2 (19/10/2026): decisões expressas

**Respostas aprovadas:** **1A / 2D / 3B / 4A / 5D**, na formulação explícita do diretor. As personalizações 2D e 5D são decisões válidas; detalhes não fornecidos **não** foram preenchidos por inferência.

| ID | Questão e escolha | Regra expressamente aprovada |
|---|---|---|
| ES-D23 | Rodada 2, questão 1 (A) — múltiplos alvos | **Todos os inimigos elegíveis dentro do raio de 5 m da explosão podem ser atingidos, uma vez cada por detonação**, sem limite arbitrário de inimigos. |
| ES-D24 | Rodada 2, questão 2 (D) — destruição de objetos | **A explosão destrói todos os objetos dentro de seu raio de 5 m antes de surgir a rocha**. Não inventar exceções nem restringir a destruição a objetos com poucos HP. A definição operacional de categorias de objetos e relação com paredes/terreno estrutural permanece para decisão; esta resposta, por si só, não escolhe um modelo de oclusão do dano sobre personagens. |
| ES-D25 | Rodada 2, questão 3 (B) — intensidade horizontal do lançamento | A detonação aplica **velocidade horizontal inicial de 8 m/s** aos inimigos atingidos, **radialmente para fora do centro da explosão** conforme ES-D22. Não converter 8 m/s em aceleração, duração ou deslocamento fixo. |
| ES-D26 | Rodada 2, questão 4 (A) — ataques contra a rocha | **Qualquer ataque que cause dano e efetivamente atinja a rocha pode danificar seus 5 HP**, sem restrição automática a ataques melee ou especiais. |
| ES-D27 | Rodada 2, questão 5 (D) — personagem no local de surgimento | **Se um personagem estiver no local onde a rocha emerge, ele é lançado para cima por um knockback poderoso**. Nenhuma velocidade, força, altura ou fórmula numérica vertical foi escolhida; não substituir por empurrão horizontal, reposicionamento da rocha ou deslocamento suave. |

**Ordem dos eventos aprovada:** o projétil atinge o marcador → a explosão **destrói todos os objetos dentro do raio antes da rocha surgir** → a nova rocha emerge. A decisão 5D estabelece o **lançamento vertical poderoso de personagem no local de surgimento**; a ordem fina desse lançamento em relação ao dano e ao knockback radial da explosão **não foi definida**. A física do lançamento horizontal radial de **8 m/s** e a do lançamento vertical poderoso não devem ser fundidas silenciosamente.

**Pontos pendentes após a Rodada 2:** definição operacional de **objetos destruíveis pela explosão** (versus personagens, terreno estrutural e limites da arena); relação entre **destruição de objetos, linha de visão e dano sobre personagens**; intensidade do knockback vertical na emergência da rocha; ordem e acumulação dos lançamentos; sliders e posicionamento da rocha; e a **Rodada 1 questão 1**, ainda com **B/C mutuamente exclusivas, ambas NÃO aprovadas**.

**Escopo da documentação:** as anteriores **ES-D01–ES-D22**, **SW-D01–SW-D68**, Rodadas 1–10 do Sand Wave, e todos os outros moves permanecem preservados. Não houve implementação, testes ou autorização para alterar código.

### 7.6 Emerging Stone — Rodada 3 (19/10/2026): decisões aprovadas

**Respostas do diretor: 1C / 2A / 3B / 4D / 5B.** A questão 4D especifica que o personagem sobre a rocha emergente sofre **lançamento horizontal E vertical**; não somente vertical. Os valores já existentes de **8 m/s horizontais radiais** (ES-D25) e o novo de **14 m/s verticais** (ES-D30) permanecem distintos. Não se inventa aceleração ou ordem temporal adicional.

| ID | Questão / resposta | Decisão aprovada |
|---|---|---|
| ES-D28 | Rodada 3, questão 1 (C) — objetos destruídos | **A explosão destrói todos os objetos físicos no raio de 5 m, incluindo paredes e obstáculos fixos do cenário, exceto o chão e os limites externos da arena**. Conforme ES-D24, essa destruição ocorre **antes** do surgimento da nova rocha. Personagens continuam sendo alvos da mecânica de dano/lançamento e não são objetos do cenário a destruir. |
| ES-D29 | Rodada 3, questão 2 (A) — paredes e acerto | **Todos os inimigos elegíveis no raio de 5 m são atingidos mesmo atrás de paredes**: paredes não protegem contra dano/lançamento da explosão. |
| ES-D30 | Rodada 3, questão 3 (B) — knockback vertical | Se um personagem estiver no local de emergência da rocha, recebe **velocidade vertical inicial de 14 m/s**, qualificando o knockback poderoso anteriormente especificado. |
| ES-D31 | Rodada 3, questão 4 (D) — componentes de knockback | A emergência da rocha **também aciona o lançamento horizontal radial**: não é apenas vertical. Aplicam-se o componente **horizontal inicial de 8 m/s** de ES-D25 e o **vertical inicial de 14 m/s** de ES-D30. Não presumir fórmula de mistura, nova força ou ordem de eventos adicional; a combinação técnica será validada depois. |
| ES-D32 | Rodada 3, questão 5 (B) — limite de rochas | **Máximo de três rochas Emerging Stone simultâneas por Mushroom. Criar uma quarta destrói a mais antiga** das rochas desse Mushroom. A duração de cada rocha continua infinita na ausência de destruição por ataques, explosões ou aplicação dessa regra de limite. |

**Ordem de efeitos expressamente mantida:** o projétil atinge seu marcador, a explosão **destrói todos os objetos elegíveis dentro de 5 m antes de surgir a rocha**, a nova rocha emerge e o personagem no ponto de surgimento sofre **lançamento vertical e horizontal**. A ordem fina de aplicação dos dois componentes de velocidade e a prioridade de remoção simultânea por explosão e limite de rochas **não foram escolhidas**.

**Pendência preservada sem alterações:** **Rodada 1, questão 1 — opção B ou C, mutuamente exclusivas e ambas NÃO APROVADAS**; a cronologia de cast de 0,55 s continua indecisa.

**Preservação e escopo:** ES-D01–ES-D27, SW-D01–SW-D68, histórico das Rodadas 1–2 de Emerging Stone e dos demais golpes, **todos preservados literalmente**. Nenhuma implementação, código ou testes foram autorizados.

### 7.7 Emerging Stone — Rodada 4 (19/10/2026): decisões expressas

**Respostas aprovadas pelo diretor: 1A / 2D / 3A / 4A / 5A.** A resposta **2D é personalizada** e determina **um prisma completo de 3 × 3 × 3 m**; usar esse termo e essas três dimensões, sem restringir a forma a um plano horizontal. A **questão 1 da Rodada 1** continua **pendente**, com opções **B/C mutuamente exclusivas e ambas não aprovadas**.

| ID | Pergunta / alternativa | Regra vigente aprovada |
|---|---|---|
| ES-D33 | Rodada 4, questão 1 (A) — trajeto do projétil | O projétil viaja pelo **subsolo em linha reta até o marcador**, passando **por baixo de paredes e obstáculos superficiais, sem ser bloqueado por eles**. Mantém a velocidade de **15 m/s** e a detonação no marcador. Não definir novas regras para estruturas profundas, barreiras subterrâneas ou desvios, que não foram objeto da escolha. |
| ES-D34 | Rodada 4, questão 2 (D) — formato e dimensões | A rocha que emerge é um **prisma completo de 3 × 3 × 3 m**, com dimensões físicas tridimensionais. A expressão anterior “bloco 3 × 3 m” fica **detalhada pelo novo valor aprovado**, sem apagar o histórico de quando a altura ainda estava pendente. |
| ES-D35 | Rodada 4, questão 3 (A) — slider | **Um único slider altera proporcionalmente todas as dimensões** do prisma (3 × 3 × 3 m como dimensões-padrão). Mínimo, máximo, passo e escala permitida não foram escolhidos nesta rodada. |
| ES-D36 | Rodada 4, questão 4 (A) — limite externo e posição válida | **Se a rocha não couber integralmente no ponto marcado por causa dos limites externos da arena, ela surge na posição válida mais próxima onde caiba por inteiro**. A explosão do projétil continua **no marcador selecionado**, pois o reposicionamento se refere à **rocha**, não à detonação. A regra para hipótese de inexistência de qualquer espaço válido não foi escolhida. |
| ES-D37 | Rodada 4, questão 5 (A) — destruição a zero HP | **Quando a rocha chegar a 0 HP, é destruída imediatamente**, e deixa de **bloquear movimento e ataques imediatamente**. Não exigir uma fase de desmoronamento nem manter detritos sólidos após destruição sem nova aprovação. |

**Restrições preservadas:** a explosão permanece com **raio de 5 m**, **20 de dano-base multiplicados pelo atributo Ataque**, **8 m/s horizontais radiais**; personagens na emergência da rocha recebem também **14 m/s verticais**; os objetos no raio (exceto chão e bordas externas) são destruídos antes de criar a rocha; a rocha tem **5 HP**, duração infinita, não permite passagem terrestre e **permite passar pelo ar por cima somente com altura suficiente**; limite de **3 rochas por Mushroom**, quarta destrói a mais antiga. **PL ignorado, Reflect ignorado**, e o **Normal Cast de 0,55 s** seguem como definidos. Nenhum novo comportamento foi inferido.

**Pendências após a Rodada 4:** configuração numérica de slider; casos sem posição válida; manejo de estruturas exclusivamente subterrâneas e superfícies incomuns; semântica de PL/Reflect; condições e momento exatos do lançamento/cobrança; integração física e testes. **Cast: opção B ou opção C da Rodada 1, ambas NÃO aprovadas, mutuamente exclusivas.**

**Preservação:** ES-D01–ES-D32, SW-D01–SW-D68, Rodadas 1–3 do Emerging Stone e o catálogo anterior permanecem **literalmente preservados**. **Não foi autorizado nem realizado desenvolvimento de código ou implementação do golpe.**

### 7.8 Emerging Stone — Rodada 5 (19/10/2026): decisões expressas

**Respostas expressas do diretor: 1B / 2A / 3D / 4D / 5A.** As respostas personalizadas 3D e 4D complementam as regras históricas com precedência na matéria de PL e dano da rocha, sem modificar a explosão ou o dano em personagens.

| ID | Pergunta / resposta | Regra expressamente aprovada |
|---|---|---|
| ES-D38 | Rodada 5, questão 1 (B) — escala | O prisma padrão **3 × 3 × 3 m** usa **slider proporcional único**, com escala **0,25× a 4×**, **passo 0,25×** e padrão 1×. Dimensões físicas de **0,75 a 12 m por eixo**. |
| ES-D39 | Rodada 5, questão 2 (A) — falta de espaço | **Se não houver nenhuma posição válida onde a rocha caiba integralmente, a explosão ocorre normalmente e nenhuma rocha é criada**. Não alterar o marcador nem a área da explosão; não reduzir a rocha ou cancelar o ataque. |
| ES-D40 | Rodada 5, questão 3 (D) — dano dos ataques à rocha | **Qualquer tipo de ataque que efetivamente atinja a rocha causa 1 HP de dano + 1 HP por nível de Power Level**: **P0 = 1 HP; P1 = 2 HP; P2 = 3 HP; P3 = 4 HP**. Essa fórmula prevalece sobre dano comum aplicado à rocha e sobre a descrição histórica que mencionava apenas ataques já danosos. Não presumir categoria para ataque sem nível PL mapeado, nem criar dano para eventos não classificados como ataques. |
| ES-D41 | Rodada 5, questão 4 (D) — relação com PL | **Apenas a rocha tem efeito relacionado ao PL, no cálculo de dano recebido segundo ES-D40**; **todo o restante do Emerging Stone não é afetado por PL, não pode causar Clash nem participar de disputas de PL**. Isso não altera defesas comuns, invulnerabilidade ou cálculo de dano-base × Ataque em personagens. |
| ES-D42 | Rodada 5, questão 5 (A) — Reflect | **Reflect não funciona em nenhuma fase do Emerging Stone, nem no projétil subterrâneo nem na explosão**. Não aplicar reflexão, redirecionamento ou efeito próprio de Reflect contra essas fases; outras mecânicas defensivas não estão incluídas nesta nova decisão. |

**Precedência documental:** a Rodada 5 especifica **dano recebido pela rocha por PL**, sem introduzir Clash e sem transferir a regra de PL ao dano sofrido por personagens. Todos os demais parâmetros das Rodadas 1–4 continuam vigentes, incluindo 9 s cooldown, 3 stamina, raio 5 m, projétil a 15 m/s, 20 dano-base × Ataque, lançamentos 8 m/s horizontal e 14 m/s vertical na emergência, prisma 3 × 3 × 3 m, 5 HP, máximo três rochas por Mushroom e destruição imediata em zero HP.

**Pendência expressa inalterada:** Rodada 1, questão 1, continua **B e C como opções mutuamente exclusivas e ambas NÃO APROVADAS** para a cronologia do Normal Cast de 0,55 s; nenhuma foi escolhida nesta rodada.

**Escopo e rastreabilidade:** somente **ES-D38–ES-D42** adicionadas, mantendo **ES-D01–ES-D37**, **SW-D01–SW-D68** e todo o histórico anterior integralmente. **Nenhuma implementação, alteração de código ou teste foi autorizado.**
