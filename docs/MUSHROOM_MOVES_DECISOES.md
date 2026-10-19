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

1. Ataque de **área retangular** (substitui o triângulo originalmente proposto), **4 m de alcance frontal (comprimento/altura do retângulo na vista superior) × 3 m de largura lateral**. O diretor **aprovou expressamente** a proporção recomendada de **4 × 3 m** e o posicionamento de Mushroom **no centro da borda traseira**, de onde se projeta a barragem. Estes são **valores iniciais**, ajustáveis por **dois sliders independentes: ALTURA (4 m, extensão à frente na vista superior) e LARGURA (3 m, extensão lateral)**. **Altura do retângulo na vista superior NÃO é a altura vertical da hitbox 3D**, que permanece indefinida.
2. O golpe projeta uma **barragem de areia** nessa área.
3. **Só pode ser ativado no chão** e o personagem precisa **continuar no chão durante os 0,25 s de preparação**. Se sair do chão na preparação, o golpe é **cancelado**, **sem reembolso da stamina ou do cooldown cobrados na ativação**. Depois de emitida a barragem, **ela continua normalmente ainda que Mushroom saia do chão**.
4. **Só pode atingir adversários no chão**. Alvos em voo/aéreos não são atingidos.
5. Em contato ofensivo válido com alvo elegível, a barragem causa **6 HP de dano fixo por inimigo por execução** (referência: **6% do HP padrão de 100**, antes de eventuais reduções por defesa), aplica **cegueira por 4 s** salvo defesa perfeita, e produz **empurrão contínuo horizontal** enquanto o alvo permanece na área ofensiva.
6. **Dano-base: 6 HP fixos**, **independente do atributo Ataque** do lançador; não multiplicar por Ataque. Respeitar as reduções aplicáveis pela defesa parcial e a anulação total pela defesa perfeita. **Empurrão-base: aceleração horizontal de 12 m/s²**, enquanto houver contato com a hitbox e durante sua janela de **0,75 s**; **não** confundir aceleração com deslocamento total garantido, impulso instantâneo, velocidade fixa ou a fórmula de knockback do Tackle. **Direção do empurrão: sempre para a frente na orientação congelada no disparo**, não radial nem lateral. A redução quantitativa de aceleração sob defesa parcial ainda não foi definida separadamente.
7. **Dimensões iniciais aprovadas:** **4 m de ALTURA em vista superior (alcance frontal/comprimento)** × **3 m de LARGURA (alcance transversal/lateral)**; dois controles ajustáveis de forma independente na interface. Um slider **Altura/alcance frontal** modifica o comprimento do retângulo à frente do lançador; um slider **Largura** modifica sua cobertura para os lados. O centro da borda traseira coincide com a origem da barragem em Mushroom. **Limites mínimos/máximos e incrementos desses sliders ainda não foram decididos** e não devem ser inventados. A altura física/vertical 3D necessária para a colisão com personagens no chão é **outra dimensão**, não definida por esta decisão.
8. A **direção da barragem é determinada no disparo**. Uma vez disparada, a área retangular **permanece fixa durante sua execução**, sem acompanhar a rotação do lançador.
9. Cada inimigo pode **receber somente um acerto por execução** (dano e aplicação inicial da cegueira). Contato prolongado não gera danos repetidos.
10. O **empurrão aplica aceleração horizontal-base de 12 m/s² continuamente** sobre alvos elegíveis ainda em contato com a barragem **somente durante os primeiros 0,75 s**. A orientação do vetor é **para a frente na direção fixada no disparo**. A **defesa parcial reduz a intensidade** desse empurrão; a **defesa perfeita anula o empurrão**. Após esse intervalo, apenas o VFX se dissipa, **sem empurrão e sem hitbox**.
11. **Defesa parcial**: reduz **dano e empurrão**, mas **não bloqueia cegueira** (4 s). **Defesa perfeita**: anula **dano, empurrão e cegueira**. As porcentagens exatas de redução do empurrão na defesa parcial não foram definidas e não devem ser arbitradas.
12. **Reaplicação da cegueira por novo acerto válido de Sand Wave enquanto o debuff estiver ativo:** o cronômetro **é reiniciado para 4,00 s**, sem acumular duração e sem somar intensidade/pilhas. O contato prolongado de uma **mesma execução** não gera novos acertos nem reinícios.

### 6.3 Cronologia e janela de colisão

| Elemento temporal | Valor aprovado | Observação |
|---|---:|---|
| Preparação (startup do Burst) | **0,25 s** | É o primeiro intervalo da ação; nesta fase é exigido contato com o chão, e pode haver interrupção. |
| Duração da barragem Sand Wave | **1,50 s** | Começa **após** os 0,25 s de preparação; hitbox por 0,75 s, seguida de dissipação por 0,75 s. |
| Hitbox da barragem | **0,75 s iniciais** | Atinge/empurra apenas durante a primeira metade da barragem. |
| Dissipação visual sem hitbox | **0,75 s finais** | Efeitos da barragem de areia desaparecendo; sem novos acertos nessa metade. |
| Cegueira aplicada em contato | **4,00 s** | Debuff individual de duração própria, distinto do tempo em que a barragem existe. |
| **Duração total da ação/barragem** | **1,75 s** | **0,25 s preparação + 0,75 s hitbox ativa + 0,75 s dissipação**; não encurtar a barragem por inclusão da preparação. |

**Separação obrigatória:** ao completar os **primeiros 0,75 s de barragem**, a **hitbox deixa de existir**, e o empurrão contínuo também **cessa**. Os VFX da areia continuam sumindo pelos **0,75 s seguintes**. Um inimigo que só entrar no **retângulo** durante a fase de dissipação não recebe dano, cegueira ou empurrão desse efeito residual. Cada alvo pode receber **no máximo um acerto (6 HP de dano-base + aplicação/reinício de cegueira, conforme defesa)** durante uma execução, embora a força de empurrão possa atuar continuamente durante o contato na janela ofensiva.

**Cronologia aprovada (Rodada 3, questão 1 A):** desde a ativação: **0,00–0,25 s preparação**, **0,25–1,00 s barragem com hitbox ativa**, **1,00–1,75 s dissipação visual, sem hitbox**. **Duração total: 1,75 s**. O debuff de cegueira tem relógio próprio de 4 s a partir do acerto elegível e pode exceder esse período.

**Recursos (Rodada 3, questão 2 A):** cobrar imediatamente na **ativação (t = 0)** os **2 pontos de stamina** e iniciar o **cooldown completo de 10 s**; não adiar a cobrança ou início do cooldown até a emissão.

**Interrupção na preparação (Rodada 3, questão 3 A):** se interrompido enquanto prepara, o Sand Wave **é cancelado e não emite barragem**, sem restituição de stamina e **sem zerar/reiniciar o cooldown** já iniciado.

**Requisito de chão (Rodada 3, questão 4 A):** só pode ser ativado no chão. **Sair do chão durante a preparação cancela o move**, com custo/cooldown já gastos. **Após a barragem ter sido lançada**, sair do chão **não a cancela**; ela permanece na direção fixada pelo disparo até encerrar seus 1,5 s, mantendo as regras de que apenas inimigos no chão podem ser atingidos.

**Rodada 3, questão 5:** **PENDENTE** — não foi escolhida nenhuma faixa, mínimo, máximo ou passo dos sliders independentes de **ALTURA/alcance frontal (padrão 4 m)** e **LARGURA (padrão 3 m)**. As opções de faixa sugeridas não estão aprovadas.

### 6.4 Efeito secundário de cegueira (blind/fog)

1. **O contato com a barragem** aplica uma condição de **cegueira por 4 segundos** ao adversário atingido.
2. Enquanto estiver cegado, há um efeito **fog** que **diminui a iluminação do ambiente**, criando a sensação de visão severamente limitada.
3. **Raio de visão do personagem cegado: 10 m**, usado na regra de lock-on durante a cegueira.
4. Durante os 4 s, o alvo cegado **não pode realizar lock-on em adversário que esteja fora desse raio de 10 m**, medido **a partir do próprio personagem cegado**.
5. Se o lock-on **já estiver ativo** e o oponente associado **não estiver dentro do raio de visão de 10 m**, o lock-on **deve ser desligado**.
6. Quando o adversário está **dentro** dos **10 m** do personagem cegado, esta regra de cegueira **não proíbe o lock-on por distância**; outras condições normais do motor continuam válidas.
7. **Apenas diminuir a iluminação ou desenhar fog não implementa o bloqueio de lock-on**: a restrição deve fazer parte das regras de seleção/manutenção de alvo, com desligamento efetivo do lock-on quando o alvo não puder ser visto pela regra de 10 m.
8. **A cegueira pertence ao personagem atingido**, não é uma desativação global de lock-on de todos os lutadores. O escopo exato da mudança de iluminação para cada câmera/visão do jogador ainda precisa de definição técnica, evitando afetar indevidamente jogadores que não receberam o debuff.
9. O status continua por **4 s após sua aplicação**, mesmo se a hitbox/efeito visual de areia já tiver terminado.
10. **Novo acerto válido em outra execução de Sand Wave:** se o alvo ainda estiver cegado, **reinicia a duração restante da cegueira para 4,00 s**. **Não soma 4 s ao tempo restante** nem cria pilhas. Repetição do contato da **mesma execução** não renova o debuff.
11. **Defesa parcial não impede a cegueira**, embora reduza o dano e o empurrão. **Defesa perfeita anula a aplicação ou renovação de cegueira** e também zera dano/empurrão desse acerto.

### 6.5 Tabela de requisitos aprovados

| ID | Parâmetro ou regra | Valor definido pelo diretor |
|---|---|---|
| SW-D01 | Nome | **Sand Wave** |
| SW-D02 | Categoria de execução | **Burst** |
| SW-D03 | Preparação | **0,25 s** |
| SW-D04 | Cooldown | **10 s** |
| SW-D05 | Power Level | **PL1** |
| SW-D06 | Custo de stamina | **2** |
| SW-D07 | Geometria (revisada e aprovada) | **Retângulo de 4 m de alcance frontal/altura na vista superior × 3 m de largura**, com Mushroom no centro da borda traseira. **Dois sliders independentes** para largura e altura/alcance frontal. Não confundir altura na vista superior com espessura/altura vertical da hitbox 3D. |
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
| SW-D24 | Controles de dimensão | **Slider ALTURA (alcance frontal), inicial 4 m**, e **slider LARGURA, inicial 3 m**, independentes; faixas e passos ainda pendentes. |
| SW-D25 | Rodada 2, questão 1 (C) — dano | **6 HP fixos** por inimigo por execução, independente do atributo Ataque (6% do HP padrão de 100 antes da mitigação) |
| SW-D26 | Rodada 2, questão 2 (C) — força | **Aceleração horizontal-base contínua de 12 m/s²** durante contato com a hitbox ativa; não é velocidade ou deslocamento garantido |
| SW-D27 | Rodada 2, questão 3 (A) — direção do empurrão | **Sempre para a frente na direção em que Mushroom disparou a barragem**, orientação fixada na emissão |
| SW-D28 | Rodada 2, questão 4 (A) — defesa | **Parcial reduz dano e empurrão, mas não impede cegueira. Perfeita anula dano, empurrão e cegueira.** |
| SW-D29 | Rodada 2, questão 5 (A) — reaplicação | **Outro acerto válido durante cegueira reinicia duração para 4 s**, não acrescenta tempo nem stacks; o mesmo ataque só acerta uma vez por alvo |
| SW-D30 | Rodada 3, questão 1 (A) — linha temporal | **1,75 s totais:** 0,25 s de preparação + 1,50 s de barragem (0,75 s ofensivos + 0,75 s de dissipação) |
| SW-D31 | Rodada 3, questão 2 (A) — momento do custo | **Stamina 2 e cooldown 10 s cobrados/iniciados imediatamente na ativação**, antes da preparação |
| SW-D32 | Rodada 3, questão 3 (A) — interrupção | **Interrupção nos 0,25 s de preparação cancela Sand Wave, sem devolver stamina ou cooldown** |
| SW-D33 | Rodada 3, questão 4 (A) — saída do chão | **Sair do chão durante a preparação cancela o golpe; após a emissão, a barragem continua normalmente**, embora só possa atingir alvos no chão |

### 6.6 Questões não decididas — não inventar

- **SW-P01 — limites dos sliders de dimensão e altura física (Rodada 3, questão 5 PENDENTE):** a **geometria plana está aprovada**, com **4 m de alcance frontal/altura na vista superior × 3 m de largura, origem no centro da borda traseira**, e os dois **sliders independentes de ALTURA (alcance frontal) e LARGURA** são **obrigatórios**. A Rodada 3 **não aprovou nenhuma das faixas A/B/C nem outra configuração**, portanto **mínimo, máximo e passo seguem pendentes**. A **altura vertical da hitbox no espaço 3D** não equivale ao alcance frontal; requer definição técnica compatível com 'só atinge inimigos no chão'. **A direção já está aprovada como fixa no disparo.**
- **SW-P03 — integração física do empurrão:** **12 m/s² horizontais na direção frontal fixada e por contato ativo estão aprovados**. Continua pendente apenas a **porcentagem/multiplicador de redução da aceleração na defesa parcial** (seguir padrão do motor somente se equivalência for confirmada), e como o efeito combina com velocidade existente, atrito e obstáculos na simulação. **Não** adicionar componente vertical ou outros efeitos não aprovados.
- **SW-P05 — detecção técnica de contato com o chão:** a regra de design **já está aprovada**: só ativa no chão; perder contato durante a preparação cancela com recursos gastos; depois da emissão a barragem persiste mesmo com Mushroom no ar. Resta verificar o **critério físico exato de “no chão”** em saltos, Dodge, voo e aterrissagem, sem inventar tolerâncias ou exceções.
- **SW-P07 — escopo visual:** controle de fog/iluminação por câmera/observador, para não impor cegueira visual a jogadores não atingidos; intensidade exata do escurecimento.
- **SW-P08 — lock-on/visibilidade:** critérios adicionais de obstrução e visibilidade além do raio **10 m**; efeitos sobre IA, em partidas com vários adversários, e reativação automática versus manual após alvo voltar à faixa.
- **SW-P10 — relações de combate remanescentes:** **defesa parcial (reduz dano e empurrão, não impede cegueira), perfeita (anula os três efeitos) já estão aprovadas**. Faltam esclarecer eventual percentual específico de redução do empurrão na parcial, interação com invulnerabilidade, outros golpes PL1 e interrupções onde não cobertos integralmente pelas regras existentes.

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

**19/10/2026 — Rodada 3, decisões confirmadas (A/A/A/A/Pendente):** (1) duração total de **1,75 s** = **0,25 s preparação + 1,50 s de barragem** (0,75 s hitbox, 0,75 s dissipação); (2) **2 stamina e início de 10 s de cooldown imediatamente na ativação**; (3) **interrupção na preparação cancela sem reembolso de stamina/cooldown**; (4) **sair do chão na preparação cancela, mas sair do chão após lançar a barragem não a cancela**. (5) **Limites dos sliders de altura/alcance frontal e largura PENDENTES**, sem escolha das faixas propostas. A implementação do golpe continua **não autorizada e não realizada**.
