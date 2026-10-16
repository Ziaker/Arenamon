# Arenamon — Registro mestre de decisões do mapa do laboratório de combate

> **Documento oficial de planejamento em andamento.** Arquivo único a ser atualizado a cada nova rodada solicitada pelo usuário. Não é especificação final nem autorização para implementar.
>
> **Status:** Rodadas 1–8 respondidas e registradas (117 respostas); Rodada 9 apresentada e **ainda não respondida** (16 perguntas).
> **Fonte de verdade das decisões:** respostas do usuário na conversa ChatGPT sobre o mapa do Arenamon. Opções rejeitadas e sugestões do assistente **não** são requisitos aprovados.
> **Repositório:** https://github.com/Ziaker/Arenamon · **Escopo:** apenas laboratório de combate `prototypes/combat-lab/`.
> **Referência do código inspecionado antes da criação:** `main` @ `a16904bd395b982225fe1eed9f87e59bc1a65421` (2026-10-15). Não significa que essas features já tenham sido implementadas.

## Regra obrigatória de manutenção do registro

1. A cada nova rodada **respondida**, acrescentar perguntas, alternativas escolhidas, observações textuais e decisões com identificadores imutáveis `R<n>.<n>` **neste mesmo arquivo**, preservando as rodadas anteriores.
2. Quando uma decisão posterior substituir uma anterior, **não apagar o histórico**: marcar o item anterior como substituído, indicar o item novo e registrar exatamente o que foi alterado. Nunca transformar uma recomendação não aprovada em decisão.
3. Manter as perguntas sem resposta e conflitos em seção específica. Atualizar contagens e o status. A disponibilidade de atualização depende de uma nova interação e de acesso de escrita ao GitHub; **não existe atualização automática de fundo**.
4. Fazer commit e verificar o arquivo no GitHub após cada atualização. Não modificar código nem outros arquivos sem solicitação explícita. A publicação remota não prova sincronização com o checkout local.
5. A rodada 9 abaixo é **questionário pendente**, não contém decisões aprovadas.

## Visão transversal de requisitos aprovados (resumo; detalhes por ID abaixo)

- **Arena:** plana e circular, raio 50 m (100 m de diâmetro); estilo de laboratório técnico minimalista; barreira de contorno invisível com sinalização discreta e rebotes configuráveis.
- **Obstáculos:** inicialmente 4 objetos geométricos destrutíveis com HP, dano por ataques/colisões, resistências por categoria de ataque, VFX selecionáveis e reaparecimento 15–30 s após destruição em nova posição válida. Inicialmente 4 indestrutíveis de blocos/cilindros/pilares, sólidos, oferecendo cobertura e rebotes. Quantidades e características definidas por seus parâmetros. Distribuições aleatórias sem sobreposição, com proteção de spawns/rotas.
- **Plataformas:** duas, posições aleatórias, topos de 3×3 m, alturas de 1 m e 1,5 m, totalmente sólidas; personagens podem subir, ficar, lutar e cair; ataques e colisões respeitam volumes tridimensionais.
- **Salto:** tecla Espaço; botão de gamepad **pendente**, embora remapeamento esteja aprovado. Altura inicial 2 m; intervalo 0,25 s após aterrissagem; sem custo de stamina; apenas em estado livre/caminhando/correndo; salto normal sem invulnerabilidade e sem ações ofensivas/defensivas durante o ar. Impulso horizontal preservado na decolagem sem correção aérea; gravidade compartilhada de referência mas ajustável independentemente; até um salto normal antes de tocar o solo (movimentos especiais podem conceder adicionais). IA poderá saltar estrategicamente.
- **Consumíveis:** 2 no início, sorteados independentemente e com tipos equiprováveis. Novas gerações em 20–40 s; no máximo 4 presentes para geração regular, suspensa quando houver 4 ou mais e temporizador reiniciado quando abre uma vaga; duração em campo 15 s. Drops de destrutíveis surgem na posição do objeto e podem exceder transitoriamente o limite. Coleta automática em todos os estados, prioridade determinística por primeiro contato. Gerar em posições acessíveis no chão ou nas plataformas. IA disputa itens por risco/valor.
- **Progressão por coleta:** Ataque, Defesa, capacidade máxima de Stamina, redução do Cooldown, Velocidade — 4 estágios **permanentes até fim da luta** por categoria, no máximo 20 estágios no total por personagem. Ataque +10% por estágio, Defesa −10 pontos percentuais de dano e empurrão por estágio, Stamina +1 ponto de capacidade por estágio (ganho simultâneo na stamina atual), Cooldown −10% de duração por estágio (só recargas iniciadas após coleta), Velocidade +5% por estágio na locomoção e distância/velocidade de esquiva. Item de categoria no máximo vira cura igual ao consumível de HP. Existem também consumíveis separados para HP e stamina. Se a cura seria recebida com HP cheio, conceder escudo temporário; detalhes pendentes. Se todos os estágios estiverem máximos e HP cheio, benefício especial pendente.
- **IA, câmera, ferramentas:** navegação/replanejamento após mudança nos obstáculos; perseguição/uso estratégico de plataformas, cobertura, line-of-sight e consumíveis; janela de tolerância do lock-on após obstrução; obstáculos transparentes quando bloqueiam câmera; ajuste vertical e afastamento por distância; indicadores de itens, HUD configurável de estágios e nova aba **Mapa**. Parâmetros visuais aplicados imediatamente; estruturais e de geração apenas na próxima partida; diagnósticos selecionáveis.

## Decisões respondidas — texto das perguntas e escolhas aprovadas

### Rodada 1 — Estrutura da arena (12 decisões)

**R1.1 — Qual é exatamente a dimensão da arena circular?**

Resposta aprovada: **B — 50 metros de raio (diâmetro 100 m).**

**R1.2 — Qual será o estilo visual inicial do mapa?**

Resposta aprovada: **A — Laboratório técnico minimalista, com formas geométricas e cores distintas.**

**R1.3 — Como serão distribuídos os 4 objetos destrutíveis?**

Resposta aprovada: **B — Quatro objetos em posições aleatórias a cada luta.**

**R1.4 — Que aparência terão os objetos destrutíveis?**

Resposta aprovada: **C — Objetos geométricos simples, sem temática definitiva.**

**R1.5 — Como os objetos destrutíveis receberão dano?**

Resposta aprovada: **A — Qualquer ataque que possa atingir o objeto.**

**R1.6 — Qual será a resistência à destruição?**

Resposta aprovada: **B — Todos possuem HP próprio e podem resistir a vários golpes.**

**R1.7 — Como os 4 obstáculos indestrutíveis serão posicionados?**

Resposta aprovada: **B — Posições aleatórias a cada partida.**

**R1.8 — Como devem funcionar os obstáculos indestrutíveis?**

Resposta aprovada: **B — Bloqueiam ataques e personagens, permitindo cobertura e rebotes.**

**R1.9 — Qual é o comportamento desejado dos dois blocos associados ao pulo?**

Resposta aprovada: **C — Ambos: ultrapassar e permanecer em cima.**

**R1.10 — Como você deseja acionar o pulo?**

Resposta aprovada: **D — Configurável, com teclado e gamepad.**

**R1.11 — Que tipo de salto deseja adicionar?**

Resposta aprovada: **A — Salto físico simples, com impulso vertical e gravidade.**

**R1.12 — Qual deve ser a relação entre objetos destrutíveis e consumíveis?**

Resposta aprovada: **B — Destruir objetos também pode liberar consumíveis.**


### Rodada 2 — Salto, plataformas e combate vertical (12 decisões)

**R2.1 — Qual deve ser o mapeamento inicial do botão de pulo?**

Resposta aprovada: **C — Espaço no teclado, mas outro botão no controle.**

**R2.2 — Qual deve ser a altura máxima do salto normal?**

Resposta aprovada: **D — Altura configurável no laboratório, com valor inicial a definir. [VALOR DEFINIDO NA R7.1: 2 m]**

**R2.3 — Como deve funcionar o movimento horizontal no ar?**

Resposta aprovada: **A — Conserva o impulso horizontal inicial, sem correção durante o salto.**

**R2.4 — O salto deve consumir stamina?**

Resposta aprovada: **C — Não consome stamina, mas possui um intervalo mínimo entre saltos.**

**R2.5 — Quantos saltos podem ser realizados antes de tocar o chão novamente?**

Resposta aprovada: **C — Um salto normal, mas movimentos especiais podem conceder saltos adicionais.**

**R2.6 — Quando o personagem pode iniciar um salto?**

Resposta aprovada: **A — Apenas livre, caminhando ou correndo; nunca durante outra ação de combate.**

**R2.7 — O que o personagem pode fazer enquanto está saltando?**

Resposta aprovada: **A — Apenas movimentar-se; nenhuma ação ofensiva ou defensiva. [INTERPRETAR JUNTO DE R2.3: sem correção horizontal]**

**R2.8 — O salto normal deve oferecer alguma proteção contra ataques?**

Resposta aprovada: **A — Nenhuma proteção especial; o personagem continua vulnerável.**

**R2.9 — Qual deve ser a geometria inicial dos dois blocos elevados?**

Resposta aprovada: **B — Dois blocos de alturas diferentes, ambos alcançáveis.**

**R2.10 — Onde os dois blocos elevados aparecerão?**

Resposta aprovada: **B — Posições aleatórias a cada partida, como os outros obstáculos.**

**R2.11 — O que deve acontecer quando o personagem estiver em cima de um bloco?**

Resposta aprovada: **A — Pode andar, defender e lutar normalmente; sair pela borda provoca queda física.**

**R2.12 — Como a IA adversária deve utilizar o salto e as plataformas?**

Resposta aprovada: **C — Pode saltar para evitar ataques, perseguir alvos e explorar plataformas.**


### Rodada 3 — Destruição, colisões e obstáculos (13 decisões)

**R3.1 — Como deverá funcionar a borda circular da arena?**

Resposta aprovada: **B — Barreira invisível com um indicador visual discreto.**

**R3.2 — O que acontece quando um personagem é arremessado contra a borda da arena?**

Resposta aprovada: **D — Intensidade, dano e resposta física configuráveis separadamente.**

**R3.3 — Qual deve ser a quantidade de objetos destrutíveis por partida?**

Resposta aprovada: **D — Quantidade configurável, inicialmente 4, com limite máximo ajustável.**

**R3.4 — Como serão definidos os tamanhos dos objetos destrutíveis?**

Resposta aprovada: **C — Tamanhos aleatórios dentro de limites configuráveis.**

**R3.5 — Como devemos definir o HP dos objetos destrutíveis?**

Resposta aprovada: **D — HP configurável individualmente pelo laboratório.**

**R3.6 — Como os ataques devem reduzir o HP dos objetos?**

Resposta aprovada: **C — Cada objeto tem uma resistência própria a diferentes categorias de ataques.**

**R3.7 — O que acontece se um personagem for arremessado contra um objeto destrutível?**

Resposta aprovada: **B — O impacto causa dano ao objeto, proporcional à força da colisão.**

**R3.8 — Como será representada visualmente a destruição?**

Resposta aprovada: **D — Efeitos de destruição selecionáveis no painel do laboratório.**

**R3.9 — Objetos destrutíveis devem reaparecer durante a mesma partida?**

Resposta aprovada: **C — Sim, após um tempo aleatório dentro de uma faixa.**

**R3.10 — Qual regra determinará a liberação de consumíveis ao destruir objetos?**

Resposta aprovada: **D — Probabilidades, quantidade e recompensas configuráveis no laboratório.**

**R3.11 — Quais formas geométricas devem compor os obstáculos indestrutíveis?**

Resposta aprovada: **B — Mistura de blocos, cilindros e pilares.**

**R3.12 — Como devem funcionar os rebotes contra os obstáculos indestrutíveis?**

Resposta aprovada: **C — Rebote dependente do ângulo de contato e da intensidade do impacto.**

**R3.13 — Que restrições devem existir na distribuição aleatória dos objetos e plataformas?**

Resposta aprovada: **D — Aplicar todas essas restrições com distâncias mínimas configuráveis: evitar sobreposição, proteger spawn dos lutadores, assegurar rotas livres.**


### Rodada 4 — Consumíveis, buffs e geração aleatória (16 decisões)

**R4.1 — Quais categorias de consumíveis devem existir inicialmente?**

Resposta aprovada: **A — Recuperação de HP, recuperação de stamina e buffs temporários. [PARCIALMENTE SUBSTITUÍDA: buffs coletáveis de atributos são permanentes durante a luta, R4-observação/R5.3; recuperações permanecem.]**

**R4.2 — Quais atributos poderão receber buffs?**

Resposta aprovada: **C — Ataque, Velocidade, resistência a dano, regeneração de stamina e velocidade de cooldown. [REFINADA: as cinco categorias evolutivas definitivas são Ataque, Defesa, capacidade máxima de Stamina, redução de Cooldown e Velocidade; regeneração de stamina não é categoria evolutiva aprovada.]**

**R4.3 — Como o jogador coleta um consumível?**

Resposta aprovada: **A — Automaticamente ao encostar nele.**

**R4.4 — Quantos consumíveis devem aparecer no começo de cada partida?**

Resposta aprovada: **B — 2 consumíveis.**

**R4.5 — Como ocorrerá a geração periódica dos consumíveis?**

Resposta aprovada: **B — Intervalos aleatórios dentro de uma faixa. [R6.1: 20–40 s]**

**R4.6 — Qual será o limite de consumíveis simultâneos espalhados no mapa?**

Resposta aprovada: **B — Máximo de 4. [R5.16/R6.7: drops de destruição podem exceder temporariamente; geração regular suspensa com 4 ou mais.]**

**R4.7 — Como o sistema determina qual consumível será gerado?**

Resposta aprovada: **A — Todos os tipos possuem a mesma probabilidade.**

**R4.8 — Quais restrições devem existir para as posições de geração?**

Resposta aprovada: **C — Evitar obstáculos, lutadores e outros consumíveis, garantindo acesso físico.**

**R4.9 — Consumíveis poderão surgir em cima das duas plataformas?**

Resposta aprovada: **B — Sim, no chão e no topo das plataformas.**

**R4.10 — O que acontece quando um consumível não é coletado?**

Resposta aprovada: **B — Desaparece depois de um tempo fixo. [R6.2: 15 s]**

**R4.11 — Como as recompensas liberadas por objetos destruídos aparecem?**

Resposta aprovada: **A — O item surge na posição do objeto destruído. [Necessário validar posição acessível se houver colisão/ocupação.]**

**R4.12 — Como devem funcionar os efeitos temporários dos buffs?**

Resposta aprovada: **D — Durações e multiplicadores de efeito configuráveis individualmente. [SUBSTITUÍDA PARA BUFFS COLETÁVEIS: os estágios são permanentes durante a luta. Outras fontes de status temporários não foram eliminadas.]**

**R4.13 — O que acontece ao coletar duas vezes o mesmo buff?**

Resposta aprovada: **B — A potência acumula, respeitando um limite. [R5: quatro estágios por categoria.]**

**R4.14 — O personagem poderá manter diferentes buffs ativos simultaneamente?**

Resposta aprovada: **A — Sim, sem limite de tipos diferentes, sujeitos ao limite de quatro estágios por categoria.**

**R4.15 — Como a IA adversária deverá lidar com os consumíveis?**

Resposta aprovada: **C — Disputa consumíveis estrategicamente, considerando valor, distância e riscos.**

**R4.16 — Como devemos controlar a aleatoriedade para testes e replays?**

Resposta aprovada: **C — Utilizar seed fixa em testes e aleatoriedade nas partidas comuns.**

**Observação adicional textual do usuário após a Rodada 4 (preservada):** “Os buffs são permanentes aumentando os status em 1 estágio até um total de 4 estágios , após isso, na nesma categoria, apenas cura hp se todos estágios forem atingidos. São atk, defesa, stamina reducao de cooldown, velocidade e recuperação imediata de vida”. A R5.10 esclarece a conversão: acontece quando *a própria categoria* já está no estágio 4; não exige que todas as categorias estejam maximizadas.


### Rodada 5 — Balanceamento, estágios e consumíveis (16 decisões)

**R5.1 — Os quatro estágios são individuais por atributo?**

Resposta aprovada: **A — Sim. Ataque, Defesa, Stamina, Cooldown e Velocidade possuem 4 estágios cada, totalizando até 20 aumentos.**

**R5.2 — Quanto tempo os estágios de melhoria permanecem ativos?**

Resposta aprovada: **A — Até o fim da luta; todos reiniciam na próxima partida.**

**R5.3 — A nova regra de permanência substitui os buffs temporários da Rodada 4?**

Resposta aprovada: **A — Sim. Todos os buffs coletáveis de atributos são permanentes durante a luta; não possuem duração.**

**R5.4 — O que exatamente significa melhorar Stamina em um estágio?**

Resposta aprovada: **A — Aumentar a capacidade máxima de stamina.**

**R5.5 — Como o aumento de Ataque deve ser calculado?**

Resposta aprovada: **B — +10% por estágio, chegando a +40%.**

**R5.6 — Como os estágios de Defesa devem melhorar o personagem?**

Resposta aprovada: **C — Redução de dano e resistência adicional ao empurrão. [R6.11: −10 pontos percentuais em ambos por estágio, até −40 p.p.]**

**R5.7 — Como melhorar a Velocidade por estágio?**

Resposta aprovada: **C — Melhorar locomoção e distância/velocidade das esquivas. [R6.12: +5% nos três por estágio.]**

**R5.8 — Como os estágios de redução de cooldown devem funcionar?**

Resposta aprovada: **B — Reduzir o tempo de recarga em 10% por estágio, até 40%. [R6.13: apenas cooldowns iniciados após a coleta.]**

**R5.9 — Como deve funcionar a recuperação imediata de HP?**

Resposta aprovada: **D — Quantidade de cura configurável, em pontos absolutos ou porcentagem. [Padrão numérico ainda pendente na R9.]**

**R5.10 — Quando um consumível de atributo deve se transformar em cura?**

Resposta aprovada: **A — Quando sua própria categoria já estiver no estágio 4.**

**R5.11 — O que acontece quando o personagem está com HP máximo e coleta um item exclusivamente de cura?**

Resposta aprovada: **C — O item concede outro benefício de recompensa. [R6.15: escudo temporário que absorve dano.]**

**R5.12 — Como os consumíveis devem ser visualmente diferenciados?**

Resposta aprovada: **B — Cada categoria tem cor, forma geométrica e símbolo próprios.**

**R5.13 — Em quais estados um personagem poderá coletar consumíveis automaticamente?**

Resposta aprovada: **A — Em qualquer estado, inclusive durante ataques, defesa, saltos e arremessos.**

**R5.14 — Os estágios de Ataque devem afetar o dano causado aos objetos destrutíveis?**

Resposta aprovada: **A — Sim. O dano aos objetos cresce com o mesmo multiplicador ofensivo do personagem.**

**R5.15 — Como resolver quando dois personagens tentam coletar o mesmo consumível praticamente ao mesmo tempo?**

Resposta aprovada: **A — O primeiro a entrar no raio de coleta recebe o item, em ordem determinística.**

**R5.16 — Qual deve ser a regra para consumíveis que aparecem por destruição quando já existem 4 no mapa?**

Resposta aprovada: **B — Recompensas de destruição podem ultrapassar temporariamente o limite.**


### Rodada 6 — Geração e balanceamento (16 decisões)

**R6.1 — Qual deve ser o intervalo inicial entre gerações aleatórias de consumíveis?**

Resposta aprovada: **B — Entre 20 e 40 segundos.**

**R6.2 — Quanto tempo um consumível permanece no mapa sem ser coletado?**

Resposta aprovada: **A — 15 segundos.**

**R6.3 — O que acontece com o temporizador de geração quando o limite de 4 consumíveis regulares é alcançado?**

Resposta aprovada: **B — O temporizador reinicia quando surgir uma vaga.**

**R6.4 — Como serão escolhidos os tipos dos 2 consumíveis iniciais?**

Resposta aprovada: **A — Sorteio independente, podendo gerar dois do mesmo tipo.**

**R6.5 — Qual deve ser o intervalo de reaparecimento dos objetos destrutíveis?**

Resposta aprovada: **A — Entre 15 e 30 segundos após a destruição.**

**R6.6 — Onde um objeto destrutível reaparece após sua destruição?**

Resposta aprovada: **B — Em outra posição aleatória válida da arena.**

**R6.7 — Como gerenciar as recompensas de destruição que ultrapassam o limite de 4 consumíveis?**

Resposta aprovada: **A — Gerações regulares ficam suspensas enquanto houver 4 ou mais itens; drops usam seu tempo normal de permanência.**

**R6.8 — Além do consumível que aumenta a stamina máxima, ainda deve existir recuperação instantânea de stamina?**

Resposta aprovada: **A — Sim. São dois consumíveis separados.**

**R6.9 — Quanto cada estágio de Stamina aumenta a capacidade máxima?**

Resposta aprovada: **B — +1 ponto de stamina por estágio.**

**R6.10 — Quando o personagem ganha um estágio que aumenta a stamina máxima, o que acontece com a stamina atual?**

Resposta aprovada: **B — Acrescenta imediatamente a diferença entre o limite antigo e o novo.**

**R6.11 — Qual deve ser a intensidade dos estágios de Defesa?**

Resposta aprovada: **B — Cada estágio reduz dano recebido e empurrão em 10 pontos percentuais, até 40%.**

**R6.12 — Quanto cada estágio de Velocidade deve melhorar a locomoção e as esquivas?**

Resposta aprovada: **A — +5% de velocidade de locomoção, distância e velocidade da esquiva por estágio.**

**R6.13 — Como os estágios de redução de cooldown afetam uma recarga que já está em andamento?**

Resposta aprovada: **B — O desconto vale somente para cooldowns iniciados após a coleta.**

**R6.14 — Quando um consumível de atributo já está no estágio 4 e se converte em cura, qual será a quantidade restaurada?**

Resposta aprovada: **A — A mesma cura de um consumível normal de HP.**

**R6.15 — Quando o HP está cheio, qual benefício alternativo deve ser concedido ao coletar um item que concederia cura?**

Resposta aprovada: **C — Um escudo temporário que absorve dano.**

**R6.16 — Se todos os cinco atributos estiverem no estágio 4 e o HP estiver completamente cheio, como resolver a coleta de mais consumíveis?**

Resposta aprovada: **C — O item concede um benefício extra específico, a ser definido. [PENDENTE: benefício extra na R9.]**


### Rodada 7 — Física, salto e plataformas (16 decisões)

**R7.1 — Qual deve ser a altura máxima inicial do salto normal?**

Resposta aprovada: **C — 2 metros.**

**R7.2 — Qual deve ser o intervalo mínimo entre saltos normais?**

Resposta aprovada: **A — 0,25 segundo após aterrissar.**

**R7.3 — Qual botão padrão do gamepad deve executar o salto?**

Resposta aprovada: **D — Outro botão, especificado nas observações. [PENDENTE: o usuário não informou o botão nas observações; retomar na R9.14.]**

**R7.4 — Qual será a altura inicial dos dois blocos elevados?**

Resposta aprovada: **B — 1 m e 1,5 m.**

**R7.5 — Qual será a área horizontal dos dois blocos elevados?**

Resposta aprovada: **A — Ambos com topo de 3 × 3 metros.**

**R7.6 — Qual modelo de colisão as plataformas devem utilizar?**

Resposta aprovada: **A — Blocos totalmente sólidos, incluindo laterais, topo e parte inferior.**

**R7.7 — Como deve funcionar o impulso horizontal ao iniciar um salto?**

Resposta aprovada: **A — Preserva exatamente a velocidade horizontal existente no momento da decolagem.**

**R7.8 — A gravidade aplicada ao salto normal será a mesma dos arremessos de combate?**

Resposta aprovada: **C — Compartilhar o padrão, mas permitir ajuste independente.**

**R7.9 — Como o personagem deve se comportar ao aterrissar após um salto normal?**

Resposta aprovada: **D — Tempo de recuperação configurável independentemente para saltos normais. [PENDENTE: valor padrão.]**

**R7.10 — O que acontece quando o personagem simplesmente caminha para fora da borda de uma plataforma?**

Resposta aprovada: **A — Entra em queda balística, preservando a velocidade horizontal anterior.**

**R7.11 — Como deve ser resolvida a colisão entre dois personagens em alturas diferentes?**

Resposta aprovada: **A — Colisão física apenas quando os volumes tridimensionais realmente se sobrepõem.**

**R7.12 — Como ataques corpo a corpo devem funcionar quando os personagens estão em alturas diferentes?**

Resposta aprovada: **A — Acertam apenas quando o alcance tridimensional real da hitbox alcança o alvo.**

**R7.13 — Como projéteis e ataques de área devem interagir com obstáculos e plataformas?**

Resposta aprovada: **A — Colisões tridimensionais reais, respeitando altura e geometria.**

**R7.14 — Personagens arremessados por ataques podem aterrissar sobre as plataformas?**

Resposta aprovada: **A — Sim. Aterrissam e permanecem sobre a plataforma quando a trajetória permitir.**

**R7.15 — Como calcular dano aos objetos destrutíveis quando um personagem colide com eles?**

Resposta aprovada: **A — Proporcional à velocidade horizontal relativa do impacto.**

**R7.16 — Como os obstáculos indestrutíveis devem se relacionar com a mecânica de pulo?**

Resposta aprovada: **B — Qualquer obstáculo suficientemente baixo pode ser ultrapassado pelo salto físico.**


### Rodada 8 — IA, câmera, combate e configuração (16 decisões)

**R8.1 — Como a IA deve navegar entre obstáculos e plataformas?**

Resposta aprovada: **C — Navegação com planejamento de caminhos e replanejamento quando objetos forem destruídos ou reaparecerem.**

**R8.2 — Como a IA deve decidir se vale a pena disputar um consumível?**

Resposta aprovada: **C — Considera os fatores anteriores e estima se a coleta oferece vantagem suficiente para justificar o risco.**

**R8.3 — A IA deverá atacar objetos destrutíveis intencionalmente para conseguir recompensas?**

Resposta aprovada: **B — Sim, mas apenas quando o objeto estiver próximo e houver oportunidade.**

**R8.4 — Como a IA deve utilizar obstáculos indestrutíveis para se proteger?**

Resposta aprovada: **C — Busca cobertura, utiliza linha de visão e reposiciona-se para atacar por outros ângulos.**

**R8.5 — Como a IA deve utilizar as duas plataformas elevadas durante o combate?**

Resposta aprovada: **C — Planeja subidas, descidas e perseguições, evitando ficar presa no topo.**

**R8.6 — O que deve acontecer com o lock-on quando um obstáculo bloqueia a visão entre os personagens?**

Resposta aprovada: **C — Mantém o alvo por um intervalo de tolerância, depois perde a trava se continuar oculto.**

**R8.7 — Como explosões e ataques de área devem danificar objetos destrutíveis?**

Resposta aprovada: **A — Qualquer objeto dentro do volume tridimensional do efeito recebe dano.**

**R8.8 — Se um projétil destruir um objeto que estava bloqueando sua trajetória, o que acontece?**

Resposta aprovada: **A — O projétil é consumido, mesmo destruindo o objeto.**

**R8.9 — Como a câmera deve reagir quando um obstáculo fica entre ela e o personagem controlado?**

Resposta aprovada: **B — Torna o obstáculo temporariamente transparente.**

**R8.10 — Como a câmera deve acompanhar saltos, quedas e plataformas?**

Resposta aprovada: **C — Ajusta altura e enquadramento para manter também o adversário visível durante combates verticais.**

**R8.11 — A arena de 100 metros deve modificar a distância e o enquadramento padrão da câmera?**

Resposta aprovada: **B — Permitir afastamento automático da câmera conforme a distância entre os personagens.**

**R8.12 — Como os consumíveis espalhados pela arena devem ser sinalizados ao jogador?**

Resposta aprovada: **B — Itens possuem indicadores flutuantes visíveis a médias distâncias.**

**R8.13 — Como os cinco atributos evolutivos e seus quatro estágios devem aparecer no HUD?**

Resposta aprovada: **D — Representações configuráveis, incluindo a possibilidade de ocultar os indicadores.**

**R8.14 — Como os novos parâmetros do mapa devem ser organizados na interface de configuração?**

Resposta aprovada: **A — Nova aba 'Mapa', com grupos para arena, objetos, plataformas, consumíveis e progressão.**

**R8.15 — Quando alterações nos parâmetros do mapa devem passar a valer?**

Resposta aprovada: **C — Parâmetros visuais imediatamente; mudanças estruturais e de geração somente na próxima partida.**

**R8.16 — Quais ferramentas de diagnóstico devem ser incluídas para verificar os novos sistemas?**

Resposta aprovada: **D — Todas essas ferramentas, individualmente ativáveis ou desativáveis: colisores/hitboxes/volumes de coleta; telemetria de geração/destruição/buffs/saltos/IA; seed, posições e falhas da geração.**

## Rodada 9 — PENDENTE DE RESPOSTAS (16 perguntas, nenhuma escolha aprovada)

**R9.1 — Qual será o valor inicial da recuperação imediata de HP? O valor continuará configurável no laboratório.**

- A — 20 pontos de HP.
- B — 25% do HP máximo.
- C — 30% do HP máximo.
- D — Outro valor inicial, definido nas observações.

**Status:** não respondida.

**R9.2 — Quanto o consumível separado de recuperação de stamina deve restaurar?**

- A — 1 ponto de stamina.
- B — 2 pontos de stamina.
- C — Toda a stamina até a capacidade máxima atual.
- D — Quantidade inicial personalizada e configurável.

**Status:** não respondida.

**R9.3 — Quanto tempo deve durar o escudo temporário concedido quando uma cura seria recebida com HP cheio?**

- A — 5 segundos.
- B — 10 segundos.
- C — 15 segundos.
- D — Duração configurável, com padrão personalizado.

**Status:** não respondida.

**R9.4 — Quanto dano o escudo deve absorver inicialmente?**

- A — Até 15 pontos de dano.
- B — Até 25 pontos de dano.
- C — Até 40 pontos de dano.
- D — Capacidade inicial configurável, com valor personalizado.

**Status:** não respondida.

**R9.5 — O que acontece quando um personagem já protegido coleta outro item que concederia escudo?**

- A — A duração reinicia, mas a capacidade não aumenta.
- B — A capacidade restante aumenta, respeitando um limite máximo configurável.
- C — O novo escudo substitui o anterior somente se oferecer mais proteção.
- D — Escudos podem formar camadas independentes, respeitando um limite configurável.

**Status:** não respondida.

**R9.6 — Como o escudo temporário deve interagir com a redução de dano da defesa?**

- A — Defesa e resistências reduzem primeiro o dano; o escudo absorve o restante.
- B — O escudo absorve o dano bruto antes das reduções defensivas.
- C — Enquanto ativo, o escudo absorve dano independentemente da defesa, mas a invulnerabilidade ainda impede o acerto.
- D — Ordem e interação configuráveis no laboratório.

**Status:** não respondida.

**R9.7 — O escudo deve proteger também contra empurrões e lançamentos?**

- A — Não. Absorve apenas dano de HP.
- B — Sim. Enquanto houver escudo, bloqueia completamente o empurrão.
- C — Reduz parcialmente o empurrão, de acordo com a proteção restante.
- D — Absorção de dano e resistência ao empurrão configuráveis separadamente.

**Status:** não respondida.

**R9.8 — Qual será o benefício especial quando todos os atributos estiverem no estágio 4 e o HP estiver cheio?**

- A — Recuperação imediata de stamina.
- B — Um escudo de proteção mais forte do que o escudo normal.
- C — Aumento temporário da regeneração de stamina.
- D — Outro benefício especial, definido nas observações.

**Status:** não respondida.

**R9.9 — Esse benefício especial poderá ser recebido repetidamente?**

- A — Sim, sempre que outro consumível elegível for coletado.
- B — Apenas uma vez por luta.
- C — Repetidamente, mas com um limite de ativações por luta.
- D — Regra individual conforme o benefício especial escolhido.

**Status:** não respondida.

**R9.10 — Como serão classificadas as resistências dos objetos destrutíveis?**

- A — Por forma de entrega: contato físico, projétil, área e colisão ambiental.
- B — Por tipo de dano definido pelos movimentos, independentemente de serem projéteis ou golpes.
- C — Combinação de tipo de dano e forma de entrega, com multiplicadores próprios.
- D — Sistema extensível de propriedades e resistências configuráveis por objeto.

**Status:** não respondida.

**R9.11 — Qual deve ser o HP inicial dos quatro objetos destrutíveis?**

- A — Todos começam com 30 HP.
- B — Todos começam com 60 HP.
- C — Todos começam com 100 HP.
- D — Valores iniciais independentes para os quatro objetos; os valores serão personalizados.

**Status:** não respondida.

**R9.12 — Como proceder quando a geração aleatória não encontrar uma posição que respeite todas as distâncias e restrições?**

- A — Adiar a geração até que exista uma posição válida.
- B — Fazer uma quantidade limitada de tentativas e, se falhar, aguardar a próxima oportunidade.
- C — Procurar sistematicamente a posição válida mais próxima da posição sorteada.
- D — Estratégia de tentativas e contingência configurável, sem permitir sobreposição inválida.

**Status:** não respondida.

**R9.13 — O que acontece com temporizadores de objetos, consumíveis e escudos quando a luta termina?**

- A — Param imediatamente quando um vencedor é determinado.
- B — Continuam durante a apresentação do resultado e reiniciam na próxima luta.
- C — A simulação para, mas os efeitos visuais podem continuar durante a transição.
- D — Comportamento configurável separadamente para simulação e efeitos visuais.

**Status:** não respondida.

**R9.14 — Qual deve ser o botão exato de pulo no gamepad? A escolha anterior foi 'outro botão', mas ele ainda não foi identificado.**

- A — Direcional digital para a esquerda.
- B — R3 (clique no analógico direito), remapeando a ação atualmente atribuída a ele.
- C — Uma combinação de dois botões, a especificar nas observações.
- D — Outro botão específico, informado nas observações, sem alterar controles existentes até definição.

**Status:** não respondida.

**R9.15 — Qual nível de testes de regressão deve ser obrigatório para a implementação?**

- A — Testes de regras, limites, colisões e progressão de atributos.
- B — Todos os anteriores, mais seeds reproduzíveis, salvamento e restauração durante partidas.
- C — Todos os anteriores, mais testes de IA, navegação, saltos, destruição e integração entre movimentos.
- D — Cobertura completa dos anteriores, mais testes no navegador, gamepad, HUD e desempenho.

**Status:** não respondida.

**R9.16 — Qual requisito de desempenho deverá orientar a validação do laboratório com o mapa de 100 metros?**

- A — Meta de 60 FPS em 1080p, em um ambiente de hardware a ser definido, preservando a simulação fixa a 120 Hz.
- B — Meta de 30 FPS em 1080p, preservando a simulação fixa a 120 Hz.
- C — Apenas medir e registrar desempenho, sem estabelecer meta mínima nesta fase.
- D — Definir metas específicas para FPS, uso de memória e quantidade máxima de entidades, com valores personalizados.

**Status:** não respondida.

## Histórico de substituições e esclarecimentos

1. **R4.1 / R4.12 → observação da R4 + R5.1–R5.3:** a descrição inicial de “buffs temporários” **não vale para consumíveis de atributos**; estes concedem estágios permanentes até o fim da luta. Status temporários associados a outros sistemas não foram proibidos.
2. **R4.2 → R5.1/R5.4/R5.6/R5.7/R5.8 + R6.9–R6.13:** a lista inicial mencionava regeneração de stamina; as cinco categorias evolutivas definitivas são Ataque, Defesa, capacidade máxima de Stamina, Cooldown e Velocidade. A recuperação imediata de HP e de stamina é consumível separado, não sexto estágio.
3. **R4.13 → R5.1:** empilhamento de buffs coletáveis concretizado em quatro estágios independentes por atributo.
4. **R5.11 → R6.15:** o benefício alternativo ao coletar cura com HP cheio é um escudo temporário (parâmetros pendentes na R9).
5. **R2.2 → R7.1:** salto configurável recebeu altura inicial de **2 m**.
6. **R2.4 → R7.2:** intervalo de salto configurado inicialmente em **0,25 s** após aterrissar.
7. **R3.9 → R6.5/R6.6:** respawn de destrutível definido como **15–30 s**, em outra posição válida.
8. **R4.5/R4.10 → R6.1/R6.2:** geração periódica em **20–40 s**, item desaparece em **15 s**.
9. **R4.6 + R5.16 → R6.3/R6.7:** o limite de quatro vale para geração regular; drops podem excedê-lo; timer regular reinicia quando há vaga.
10. **R5.5–R5.8 → R6.9–R6.13:** completados números por estágio e o tratamento dos cooldowns existentes.

## Pendências, ambiguidades e decisões NÃO tomadas

- **P1 — Botão de pulo do gamepad:** R7.3 foi opção D, **sem nome de botão nas observações**. A pergunta R9.14 visa esclarecimento. Não atribuir L3/R3/outro sem resposta do usuário.
- **P2 — Salto e movimento aéreo:** R2.3 e R7.7 especificam impulso horizontal preservado e sem correção durante o salto. R2.7 diz “apenas movimentar-se”; deve-se preservar a interpretação estrita de movimento horizontal balístico sem permitir novo direcionamento no ar. Caso isso inclua outra ação além de deslocamento prévio, pedir esclarecimento.
- **P3 — Recuperação ao aterrissar:** R7.9 aprova configuração independente, **sem tempo inicial numérico**.
- **P4 — Cura de HP:** R5.9 aprova absoluto ou percentual configurável, **sem valor padrão**; R9.1 pendente.
- **P5 — Recuperação imediata de stamina:** confirmada como item separado, **sem quantidade padrão**; R9.2 pendente.
- **P6 — Escudo temporário:** duração, HP absorvido, empilhamento, ordem de mitigação, interação com empurrões e proteção por invulnerabilidade não decididos; R9.3–R9.7 pendentes.
- **P7 — Recompensa extra de progressão total:** R6.16 aprovou benefício específico ainda indefinido; R9.8–R9.9 pendentes.
- **P8 — HP e resistências de objetos:** HP é individualmente configurável (R3.5), mas valores iniciais e classificação exata das resistências pendentes; R9.10–R9.11.
- **P9 — Falha de geração procedural:** comportamento quando não há posição válida ainda aberto; R9.12.
- **P10 — Encerramento de luta:** temporizadores, efeitos visuais e mudança de fases ainda abertos; R9.13.
- **P11 — Regressão e desempenho:** escopo obrigatório dos testes, baseline de FPS/memória e hardware de referência pendentes; R9.15–R9.16.
- **P12 — Interação ataque/defesa:** R8.7 aprova que explosões danifiquem objetos dentro do volume 3D; isso não aprova ignorar colisões tridimensionais ou fazer projéteis atravessarem bloqueios. R8.8 estabelece consumo de projétil que destrói o objeto.
- **P13 — Categoria de buff regeneração:** não inventar progressão de regeneração de stamina a partir da lista preliminar de R4.2. A implementação deve usar as cinco categorias definitivas e os consumíveis de recuperação descritos.
- **P14 — Estado técnico NÃO implementado:** mundo do laboratório em `prototypes/combat-lab/src/sim/world.js` já oferece projéteis, paredes, barreiras de movimentos e áreas; `status.js` suporta status temporários; `physics.js` usa limites quadrados; isso **não demonstra** existência das novas entidades persistentes, progressão de estágios, arena circular nem pulo independente.
- **P15 — Persistência do planejamento:** arquivo GitHub é fonte compartilhada, mas a atualização depende de solicitação em cada rodada e acesso ao repositório. Não confundir “gravado no GitHub” com “sincronizado com checkout local oficial”.

## Changelog do registro

- **Criação inicial:** Rodadas 1–8 completas (117 perguntas e escolhas), texto de observação da R4, Rodada 9 pendente (16 perguntas e todas as alternativas), índice de decisões, substituições e pendências. Nenhum código alterado por esta documentação.
