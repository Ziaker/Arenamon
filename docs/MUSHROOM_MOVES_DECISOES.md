# Arenamon — Catálogo de moves do Mushroom

> **Documento de decisões de design — fonte para implementação posterior.**  
> **Última consolidação:** 19/10/2026. **Status do Bullet Punch:** design aprovado nas regras descritas abaixo; **não implementado nem testado**.  
> **Origem:** decisões explícitas do diretor nesta conversa, preservadas em ordem cronológica; informações técnicas do repositório são assinaladas separadamente.  
> **Escopo autorizado:** documentação das mecânicas e dos VFX explicitamente solicitados; **não** inclui criar animações, trabalhar em rigging, alterar o Combat Lab ou escolher novos parâmetros sem aprovação.
>
> **Regra de manutenção:** toda decisão futura aprovada deve ser incorporada aqui; o histórico não deve ser apagado. Quando uma regra anterior for substituída, registrar a substituição e usar a regra mais recente no contrato vigente.

## 1. Personagem e quatro moves — ordem informada pelo diretor

| Ordem informada | Move | Situação |
|---|---|---|
| 1 | **Rock Tomb** | Nome aprovado; gameplay ainda não especificado. O diretor corrigiu expressamente **Rock Slide → Rock Tomb**. |
| 2 | **Bullet Punch** | Mecânica descrita neste documento; implementação pendente. |
| 3 | **Sand Kick** | Nome aprovado; gameplay ainda não especificado. |
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
- **Rock Slide** foi corrigido para **Rock Tomb** e não é o move planejado.

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
