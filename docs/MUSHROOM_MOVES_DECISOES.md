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
| 1 | **Rock Tomb** | Nome confirmado após correção de **Rock Slide**; gameplay ainda não especificado. **Não foi substituído por Sand Wave.** |
| 2 | **Bullet Punch** | Mecânica descrita neste documento; implementação pendente. |
| 3 | **Sand Wave** | **Substitui Sand Kick**, por confirmação explícita do diretor; especificação inicial na seção 6, ainda com pendências de design. |
| 4 | **Body Slam** | Nome aprovado; gameplay ainda não especificado. |

**Identificação técnica em aberto:** o diretor chama o personagem **Mushroom**. `docs/ROSTER.md` chama o personagem cogumelo de **Mosh**, com recursos em `chars/mosh/`. A equivalência Mushroom ↔ Mosh **não foi confirmada explicitamente** nesta conversa; não substituir automaticamente o identificador do personagem no código.

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

### 6.6 Questões não decididas — não inventar

- **SW-P01 — colisão vertical RESOLVIDA na Rodada 8 (4A):** a área de acerto é **lógica/horizontal**, exige **pés/ponto de apoio no retângulo original** e **contato com chão confirmado**, sem hitbox física vertical adicional para determinar acertos. A **altura física da areia é exclusivamente visual** e não é controlada pelo slider **ALTURA**, que continua medindo alcance frontal em vista superior. A aparência/altura estética da areia continua para a etapa visual, mas **não é pendência de elegibilidade de colisão**.
- **SW-P03 — integração física do empurrão (Rodada 9, 3A):** **12 m/s² horizontais na direção frontal fixada**, reduzidos em **50% para 6 m/s² sob defesa parcial**, permanecem aprovados. O alvo tem **controle de deslocamento suspenso durante contato com hitbox ativa**, pode atacar e defender normalmente, e **não pode iniciar novas esquivas sob empurrão**. **Quando a força cessar, conservar a velocidade física adquirida**, que é reduzida **naturalmente por atrito e pelas regras normais do motor**, sem remoção instantânea da velocidade adicional nem amortecimento artificial em 0,20 s. Contra parede sólida, **para e sofre stagger de 0,30 s sem dano**, mantendo pressão enquanto houver contato ativo. Permanecem pendentes somente pormenores técnicos da composição vetorial da aceleração, velocidade pré-existente, atrito e colisões; **não inventar lançamento vertical ou ricochete**.
- **SW-P05 — integração técnica com contato de chão:** o critério de design foi **resolvido na Rodada 6 (4A)**: utilizar **o estado físico de contato com o chão do motor** e tornar o personagem elegível **assim que o contato de aterrissagem for confirmado**, sem atraso de estabilidade adicional. A ativação e a preparação requerem esse contato; sair do chão durante preparação cancela com recursos gastos; após a emissão a barragem persiste. A Rodada 5 exige **pés/ponto de apoio dentro do retângulo original** para atingir. Resta apenas **auditar o mapeamento técnico do estado do motor** (saltos, Dodge, voo e aterrissagem), sem inventar tolerâncias ou exceções.
- **SW-P07 — implementação visual remanescente:** **redução de 60% da iluminação e fog denso próximo dos 10 m apenas na câmera do cegado** estão aprovados. **Todos veem a nuvem de areia ao redor do cegado, durante os 4 s completos do status, e ela desaparece quando o debuff acaba** (Rodada 6, 5A). Restam curvas de densidade/opacidade, aparência exata da nuvem e integração por câmera; a duração **não** está mais pendente.
- **SW-P08 — integração de lock-on/visibilidade:** durante a cegueira, lock-on **é desligado fora dos 10 m**, exige **novo comando manual** e **seleciona o adversário elegível mais próximo**. A Rodada 6 (2A) definiu que **paredes sólidas impedem lock-on em alvos completamente ocultos**, mas **basta alguma parte visível do adversário**; não exigir visão do centro. Permanecem integração técnica do teste de visibilidade, IA e eventual desempate entre alvos igualmente próximos; **o critério de obstrução já está decidido**. Não mudar seleção de jogadores não cegados.
- **SW-P10 — relações de combate remanescentes (Rodada 9, 4A e 5A):** **defesa parcial reduz dano e empurrão (12 → 6 m/s²), sem impedir cegueira; defesa perfeita anula os três efeitos**. **Invulnerabilidade impede os três efeitos enquanto ativa**, mas o alvo pode ser atingido quando ela termina se a hitbox continuar ativa. Sand Wave **não neutraliza outros ataques PL1 por contato**. **Sob empurrão, o alvo pode iniciar ataques e defesa normalmente, mas não pode iniciar esquivas**; **ações de ataque, defesa ou esquiva já iniciadas continuam conforme as regras normais**, respeitando invulnerabilidade, colisões e restrições de deslocamento, **sem cancelamento automático pelo golpe**. Durante os **0,30 s de stagger de parede**, **nenhum ataque, defesa ou esquiva pode ser iniciado**, mas a proibição de iniciar não determina cancelamento retroativo de ações já em curso. Permanecem para auditoria apenas as interações precisas com os estados e regras existentes do motor, sem criar impedimentos adicionais.

- **SW-P11 — propagação ao redor de obstáculos (Rodada 9, 1A):** permanece aprovado que a areia segue **caminhos livres mais curtos**, podendo sair **lateralmente** da área original sem atravessar paredes, mas somente atinge **pés/ponto de apoio dentro do retângulo original**. A velocidade aprovada é **alcance frontal configurado ÷ 0,75 s**, aplicada ao comprimento do caminho livre mais curto; **desvios mais longos atrasam a chegada e podem impedir o acerto** se o percurso não for vencido na janela ofensiva. Não existe velocidade fixa universal de 8 m/s nem prorrogação dos **0,75 s ofensivos**. Resolvido o princípio de cálculo do atraso: restam **detalhes técnicos do algoritmo de caminhos, obstáculos móveis, desempate de trajetos e discretização espacial**, sem arbitrar novas mecânicas.

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
