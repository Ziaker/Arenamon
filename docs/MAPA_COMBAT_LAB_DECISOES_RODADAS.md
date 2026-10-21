# Arenamon — Registro mestre de decisões do mapa do laboratório de combate

> **Documento oficial de planejamento em andamento.** Arquivo único a ser atualizado a cada nova rodada solicitada pelo usuário. Não é especificação final nem autorização para implementar.
>
> **Status:** Rodadas 1–11 respondidas e registradas (**152 respostas aprovadas**). Rodada 11 aprovada integralmente (9 respostas), auditoria de pendências atualizada e especificação técnica V1 acrescentada sem implementação. **Diretriz vigente posterior à Rodada 9:** desconsiderar integralmente gamepad no planejamento do mapa; preservar referências antigas só por rastreabilidade, sem exigir decisão nem teste para esse dispositivo.
> **Fonte de verdade das decisões:** respostas do usuário na conversa ChatGPT sobre o mapa do Arenamon. Opções rejeitadas e sugestões do assistente **não** são requisitos aprovados.
> **Repositório:** https://github.com/Ziaker/Arenamon · **Escopo:** apenas laboratório de combate `prototypes/combat-lab/`.
> **Referência do código inspecionado antes da criação:** `main` @ `a16904bd395b982225fe1eed9f87e59bc1a65421` (2026-10-15). Não significa que essas features já tenham sido implementadas.

## Regra obrigatória de manutenção do registro

1. A cada nova rodada **respondida**, acrescentar perguntas, alternativas escolhidas, observações textuais e decisões com identificadores imutáveis `R<n>.<n>` **neste mesmo arquivo**, preservando as rodadas anteriores.
2. Quando uma decisão posterior substituir uma anterior, **não apagar o histórico**: marcar o item anterior como substituído, indicar o item novo e registrar exatamente o que foi alterado. Nunca transformar uma recomendação não aprovada em decisão.
3. Manter as perguntas sem resposta e conflitos em seção específica. Atualizar contagens e o status. A disponibilidade de atualização depende de uma nova interação e de acesso de escrita ao GitHub; **não existe atualização automática de fundo**.
4. Fazer commit e verificar o arquivo no GitHub após cada atualização. Não modificar código nem outros arquivos sem solicitação explícita.
6. **Escopo vigente de controles:** somente teclado para salto e demais decisões do mapa; todas as exigências anteriores referentes a gamepad estão desconsideradas por ordem expressa posterior do usuário. **Não voltar a perguntar ou atribuir botão de gamepad nesta sequência.** Referências históricas devem permanecer arquivadas como escolhas anteriores, não requisitos ativos. A publicação remota não prova sincronização com o checkout local.
5. As Rodadas 1–11 contêm 152 respostas aprovadas. A versão original e redundante da Rodada 10 permanece arquivada, sem respostas e sem força normativa; a Rodada 10 revisada contém as dez decisões válidas. Antes de apresentar qualquer nova pergunta, auditar todas as 152 escolhas para evitar repetição.

## Visão transversal de requisitos aprovados (resumo; detalhes por ID abaixo)

- **Arena:** plana e circular, raio 50 m (100 m de diâmetro); estilo de laboratório técnico minimalista; barreira de contorno invisível com sinalização discreta e rebotes configuráveis.
- **Obstáculos:** inicialmente 4 objetos geométricos destrutíveis com **30 HP cada** (HP individual configurável), dano por ataques/colisões, resistências por forma de entrega (contato físico, projétil, área, colisão ambiental), VFX selecionáveis e reaparecimento 15–30 s após destruição em nova posição válida. Inicialmente 4 indestrutíveis de blocos/cilindros/pilares, sólidos, oferecendo cobertura e rebotes. Quantidades e características definidas por seus parâmetros. Distribuições aleatórias sem sobreposição, com proteção de spawns/rotas.
- **Plataformas:** duas, posições aleatórias, topos de 3×3 m, alturas de 1 m e 1,5 m, totalmente sólidas; personagens podem subir, ficar, lutar e cair; ataques e colisões respeitam volumes tridimensionais.
- **Salto:** tecla Espaço no teclado. Gamepad **fora de escopo por determinação posterior à R9** (a escolha histórica de mapeamento não constitui pendência). Altura inicial 2 m; intervalo 0,25 s após aterrissagem; sem custo de stamina; apenas em estado livre/caminhando/correndo; salto normal sem invulnerabilidade e sem ações ofensivas/defensivas durante o ar. Impulso horizontal preservado na decolagem sem correção aérea; gravidade compartilhada de referência mas ajustável independentemente; até um salto normal antes de tocar o solo (movimentos especiais podem conceder adicionais). IA poderá saltar estrategicamente.
- **Consumíveis:** 2 no início, sorteados independentemente e com tipos equiprováveis. Novas gerações em 20–40 s; no máximo 4 presentes para geração regular, suspensa quando houver 4 ou mais e temporizador reiniciado quando abre uma vaga; duração em campo 15 s. Drops de destrutíveis surgem na posição do objeto e podem exceder transitoriamente o limite. Coleta automática em todos os estados, prioridade determinística por primeiro contato. Gerar em posições acessíveis no chão ou nas plataformas. IA disputa itens por risco/valor.
- **Progressão por coleta:** Ataque, Defesa, capacidade máxima de Stamina, redução do Cooldown, Velocidade — 4 estágios **permanentes até fim da luta** por categoria, no máximo 20 estágios no total por personagem. Ataque +10% por estágio, Defesa −10 pontos percentuais de dano e empurrão por estágio, Stamina +1 ponto de capacidade por estágio (ganho simultâneo na stamina atual), Cooldown −10% de duração por estágio (só recargas iniciadas após coleta), Velocidade +5% por estágio na locomoção e distância/velocidade de esquiva. Item de categoria no máximo vira cura igual ao consumível de HP. Existem também consumíveis separados de recuperação imediata de **20 HP** e **2 pontos de stamina**. Se a cura seria recebida com HP cheio, conceder escudo temporário de **10 s** e **até 40 pontos de absorção por aplicação**, com acúmulo de capacidade até teto configurável; escudo absorve **dano bruto antes da Defesa** e não protege contra empurrões ou lançamentos. Quando todos os cinco atributos estão no estágio 4 e HP cheio, benefício especial é **recuperação imediata de stamina**, concedido repetidamente a cada consumível elegível. Quantidades/tetos complementares pendentes.
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

## Rodada 9 — Balanceamento, escudos, casos-limite e validação (16 decisões aprovadas)

**R9.1 — Qual será o valor inicial da recuperação imediata de HP? O valor continuará configurável no laboratório.**

- A — 20 pontos de HP.
- B — 25% do HP máximo.
- C — 30% do HP máximo.
- D — Outro valor inicial, definido nas observações.

**Resposta aprovada:** **A — 20 pontos de HP.**

**R9.2 — Quanto o consumível separado de recuperação de stamina deve restaurar?**

- A — 1 ponto de stamina.
- B — 2 pontos de stamina.
- C — Toda a stamina até a capacidade máxima atual.
- D — Quantidade inicial personalizada e configurável.

**Resposta aprovada:** **B — 2 pontos de stamina.**

**R9.3 — Quanto tempo deve durar o escudo temporário concedido quando uma cura seria recebida com HP cheio?**

- A — 5 segundos.
- B — 10 segundos.
- C — 15 segundos.
- D — Duração configurável, com padrão personalizado.

**Resposta aprovada:** **B — 10 segundos.**

**R9.4 — Quanto dano o escudo deve absorver inicialmente?**

- A — Até 15 pontos de dano.
- B — Até 25 pontos de dano.
- C — Até 40 pontos de dano.
- D — Capacidade inicial configurável, com valor personalizado.

**Resposta aprovada:** **C — Até 40 pontos de dano.**

**R9.5 — O que acontece quando um personagem já protegido coleta outro item que concederia escudo?**

- A — A duração reinicia, mas a capacidade não aumenta.
- B — A capacidade restante aumenta, respeitando um limite máximo configurável.
- C — O novo escudo substitui o anterior somente se oferecer mais proteção.
- D — Escudos podem formar camadas independentes, respeitando um limite configurável.

**Resposta aprovada:** **B — A capacidade restante aumenta, respeitando um limite máximo configurável.**

**R9.6 — Como o escudo temporário deve interagir com a redução de dano da defesa?**

- A — Defesa e resistências reduzem primeiro o dano; o escudo absorve o restante.
- B — O escudo absorve o dano bruto antes das reduções defensivas.
- C — Enquanto ativo, o escudo absorve dano independentemente da defesa, mas a invulnerabilidade ainda impede o acerto.
- D — Ordem e interação configuráveis no laboratório.

**Resposta aprovada:** **B — O escudo absorve o dano bruto antes das reduções defensivas.**

**R9.7 — O escudo deve proteger também contra empurrões e lançamentos?**

- A — Não. Absorve apenas dano de HP.
- B — Sim. Enquanto houver escudo, bloqueia completamente o empurrão.
- C — Reduz parcialmente o empurrão, de acordo com a proteção restante.
- D — Absorção de dano e resistência ao empurrão configuráveis separadamente.

**Resposta aprovada:** **A — Não. Absorve apenas dano de HP.**

**R9.8 — Qual será o benefício especial quando todos os atributos estiverem no estágio 4 e o HP estiver cheio?**

- A — Recuperação imediata de stamina.
- B — Um escudo de proteção mais forte do que o escudo normal.
- C — Aumento temporário da regeneração de stamina.
- D — Outro benefício especial, definido nas observações.

**Resposta aprovada:** **A — Recuperação imediata de stamina.**

**R9.9 — Esse benefício especial poderá ser recebido repetidamente?**

- A — Sim, sempre que outro consumível elegível for coletado.
- B — Apenas uma vez por luta.
- C — Repetidamente, mas com um limite de ativações por luta.
- D — Regra individual conforme o benefício especial escolhido.

**Resposta aprovada:** **A — Sim, sempre que outro consumível elegível for coletado.**

**R9.10 — Como serão classificadas as resistências dos objetos destrutíveis?**

- A — Por forma de entrega: contato físico, projétil, área e colisão ambiental.
- B — Por tipo de dano definido pelos movimentos, independentemente de serem projéteis ou golpes.
- C — Combinação de tipo de dano e forma de entrega, com multiplicadores próprios.
- D — Sistema extensível de propriedades e resistências configuráveis por objeto.

**Resposta aprovada:** **A — Por forma de entrega: contato físico, projétil, área e colisão ambiental.**

**R9.11 — Qual deve ser o HP inicial dos quatro objetos destrutíveis?**

- A — Todos começam com 30 HP.
- B — Todos começam com 60 HP.
- C — Todos começam com 100 HP.
- D — Valores iniciais independentes para os quatro objetos; os valores serão personalizados.

**Resposta aprovada:** **A — Todos começam com 30 HP.**

**R9.12 — Como proceder quando a geração aleatória não encontrar uma posição que respeite todas as distâncias e restrições?**

- A — Adiar a geração até que exista uma posição válida.
- B — Fazer uma quantidade limitada de tentativas e, se falhar, aguardar a próxima oportunidade.
- C — Procurar sistematicamente a posição válida mais próxima da posição sorteada.
- D — Estratégia de tentativas e contingência configurável, sem permitir sobreposição inválida.

**Resposta aprovada:** **C — Procurar sistematicamente a posição válida mais próxima da posição sorteada.**

**R9.13 — O que acontece com temporizadores de objetos, consumíveis e escudos quando a luta termina?**

- A — Param imediatamente quando um vencedor é determinado.
- B — Continuam durante a apresentação do resultado e reiniciam na próxima luta.
- C — A simulação para, mas os efeitos visuais podem continuar durante a transição.
- D — Comportamento configurável separadamente para simulação e efeitos visuais.

**Resposta aprovada:** **A — Param imediatamente quando um vencedor é determinado.**

**R9.14 — Qual deve ser o botão exato de pulo no gamepad? A escolha anterior foi 'outro botão', mas ele ainda não foi identificado.**

- A — Direcional digital para a esquerda.
- B — R3 (clique no analógico direito), remapeando a ação atualmente atribuída a ele.
- C — Uma combinação de dois botões, a especificar nas observações.
- D — Outro botão específico, informado nas observações, sem alterar controles existentes até definição.

**Resposta aprovada:** **D — Outro botão específico, informado nas observações, sem alterar controles existentes até definição.**

**R9.15 — Qual nível de testes de regressão deve ser obrigatório para a implementação?**

- A — Testes de regras, limites, colisões e progressão de atributos.
- B — Todos os anteriores, mais seeds reproduzíveis, salvamento e restauração durante partidas.
- C — Todos os anteriores, mais testes de IA, navegação, saltos, destruição e integração entre movimentos.
- D — Cobertura completa dos anteriores, mais testes no navegador, gamepad, HUD e desempenho.

**Resposta aprovada:** **D — Cobertura completa dos anteriores, mais testes no navegador, gamepad, HUD e desempenho.**

**R9.16 — Qual requisito de desempenho deverá orientar a validação do laboratório com o mapa de 100 metros?**

- A — Meta de 60 FPS em 1080p, em um ambiente de hardware a ser definido, preservando a simulação fixa a 120 Hz.
- B — Meta de 30 FPS em 1080p, preservando a simulação fixa a 120 Hz.
- C — Apenas medir e registrar desempenho, sem estabelecer meta mínima nesta fase.
- D — Definir metas específicas para FPS, uso de memória e quantidade máxima de entidades, com valores personalizados.

**Resposta aprovada:** **A — Meta de 60 FPS em 1080p, em um ambiente de hardware a ser definido, preservando a simulação fixa a 120 Hz.**

**Observações adicionais enviadas pelo usuário na Rodada 9:** nenhuma. **Histórico R9.14:** a opção D foi escolhida sem informar botão. **Diretriz posterior prevalente:** o usuário instruiu ignorar gamepad completamente; este tópico deixou de ser uma pendência e não deve ser retomado.

## Rodada 10 — Revisada: casos-limite e integração (10 respostas aprovadas)

**R10.1 — Se o escudo tiver menos capacidade que o dano bruto recebido, como calcular o dano que ultrapassa a proteção?**

- A — Consumir o escudo e aplicar a Defesa normalmente somente ao excedente.
- B — Consumir o escudo e descontar o excedente diretamente do HP, sem Defesa.
- C — O golpe que destrói o escudo não causa dano ao HP, mesmo com excedente.
- D — Outro procedimento, especificado nas observações.

**Resposta aprovada:** **A — Consumir o escudo e aplicar a Defesa normalmente somente ao excedente.**

**R10.2 — Quando outro consumível acrescenta proteção ao escudo já ativo, o que acontece com a duração de 10 segundos?**

- A — Renova a duração total para 10 segundos.
- B — Conserva apenas o tempo restante original.
- C — Cada acréscimo possui sua própria expiração de 10 segundos.
- D — Outra regra, especificada nas observações.

**Resposta aprovada:** **A — Renova a duração total para 10 segundos.**

**R10.3 — Como os quatro estágios de Defesa devem combinar sua redução de 10 pontos percentuais por estágio com a defesa básica que o personagem já possui?**

- A — Somar a redução percentual após a mitigação básica, com mínimo de 0 dano.
- B — Aplicar a redução dos estágios ao dano bruto e depois a defesa básica.
- C — Somar os percentuais de mitigação existentes e dos estágios em uma única redução, com limite máximo a definir.
- D — Outra fórmula, especificada nas observações.

**Resposta aprovada:** **A — Somar a redução percentual após a mitigação básica, com mínimo de 0 dano.**

**R10.4 — Quando todos os estágios estão no máximo e HP e stamina já estão cheios, o que acontece com o consumível que concederia stamina adicional?**

- A — É coletado e consumido, mesmo sem benefício adicional.
- B — Permanece no cenário até que a recuperação possa ser aproveitada.
- C — Concede o escudo temporário já aprovado, respeitando o limite acumulado.
- D — Outro resultado, especificado nas observações.

**Resposta aprovada:** **C — Concede o escudo temporário já aprovado, respeitando o limite acumulado.**

**R10.5 — Personagens derrotados (HP = 0) ainda podem coletar um consumível por colisão no mesmo passo da simulação?**

- A — Não. A derrota impede a coleta.
- B — Sim, caso a coleta ocorra antes da confirmação da derrota e cure o personagem.
- C — Podem coletar, mas a derrota não é revertida.
- D — Outra regra de prioridade, especificada nas observações.

**Resposta aprovada:** **A — Não. A derrota impede a coleta.**

**R10.6 — Se não existir nenhuma posição válida para gerar um objeto ou consumível, mesmo após a busca pelo local mais próximo, como agir?**

- A — Adiar a geração e refazer a busca quando o cenário mudar.
- B — Cancelar essa ocorrência e aguardar o próximo intervalo programado.
- C — Continuar tentando periodicamente até surgir uma posição válida.
- D — Adotar políticas diferentes para objetos e consumíveis, especificadas nas observações.

**Resposta aprovada:** **A — Adiar a geração e refazer a busca quando o cenário mudar.**

**R10.7 — Se um lutador atravessa o ponto onde um destrutível acabou de ser destruído pelo próprio impacto, o que ocorre com seu movimento restante?**

- A — A colisão interrompe o impulso daquele contato, mesmo após a destruição.
- B — O lutador continua com o impulso residual após o objeto desaparecer.
- C — Atravessa apenas se a velocidade do impacto superar um limiar configurável.
- D — Outra regra de interação, especificada nas observações.

**Resposta aprovada:** **A — A colisão interrompe o impulso daquele contato, mesmo após a destruição.**

**R10.8 — Colidir com um objeto destrutível deve também causar dano ao lutador que sofreu o impacto?**

- A — Não. O objeto perde HP e o lutador sofre apenas a resposta física.
- B — Sim, dano ao lutador proporcional à velocidade relativa do impacto.
- C — Sim, mas apenas acima de uma velocidade mínima configurável.
- D — A reação e o dano ao lutador são configuráveis por objeto.

**Resposta aprovada:** **B — Sim, dano ao lutador proporcional à velocidade relativa do impacto.**

**R10.9 — Os dois consumíveis iniciais devem ser posicionados considerando a igualdade de acesso entre os lutadores?**

- A — Não. Basta cumprir as restrições de geração e acessibilidade já aprovadas.
- B — Sim. Sortear posições aproximadamente equidistantes dos dois pontos de início.
- C — Sim. Garantir um item acessível mais próximo de cada lutador.
- D — Aplicar um critério de equilíbrio de distâncias configurável.

**Resposta aprovada:** **A — Não. Basta cumprir as restrições de geração e acessibilidade já aprovadas.**

**R10.10 — Ao coletar um estágio de Velocidade durante um salto ou lançamento balístico, ele altera o impulso horizontal já em curso?**

- A — Não. Aumenta a velocidade das próximas ações, preservando integralmente a trajetória atual.
- B — Sim. Escala imediatamente a velocidade horizontal aérea em 5% por estágio recém-adquirido.
- C — Aplica o bônus à velocidade atual somente quando o personagem aterrissar.
- D — Comportamento diferente para salto voluntário e lançamento, especificado nas observações.

**Resposta aprovada:** **A — Não. Aumenta a velocidade das próximas ações, preservando integralmente a trajetória atual.**

**Observações adicionais do usuário na Rodada 10:** nenhuma. Escolhas da versão original arquivada não contam como decisões. A exclusão de gamepad permanece vigente.

## Rodada 11 — Spawn, proteção, drops e colisões (9 decisões aprovadas)

**R11.1 — Como devem ser estabelecidas as posições iniciais dos dois lutadores na arena circular?**

- A — Dois pontos fixos e opostos no chão, próximos à região central.
- B — Dois pontos opostos sorteados a cada partida, com separação equilibrada e posições válidas.
- C — Dois pontos independentes sorteados em uma região inicial central, respeitando separação mínima.
- D — Posições e padrão de sorteio configuráveis, respeitando as restrições já aprovadas.

**Resposta aprovada:** **B — Dois pontos opostos sorteados a cada partida, com separação equilibrada e posições válidas.**

**R11.2 — Quando um lutador perde o HP restante ao colidir com o cenário após ser arremessado, a quem atribuir essa derrota?**

- A — Ao adversário que causou o arremesso responsável pela colisão.
- B — Ao ambiente, sem atribuir a derrota ao adversário.
- C — Ao último adversário que causou dano, desde que o contato tenha ocorrido recentemente.
- D — Regra de atribuição configurável para diferentes tipos de impacto.

**Resposta aprovada:** **C — Ao último adversário que causou dano, desde que o contato tenha ocorrido recentemente.**

**R11.3 — O escudo de HP deve absorver dano periódico de status, como queimadura ou veneno, além de golpes diretos?**

- A — Sim. Todo dano que reduziria HP, inclusive dano periódico e ambiental, passa primeiro pelo escudo.
- B — Não. O escudo absorve apenas dano direto causado por ataques.
- C — Absorve ataques diretos e colisões ambientais, mas dano periódico atravessa o escudo.
- D — A proteção é configurável por categoria de fonte de dano.

**Resposta aprovada:** **A — Sim. Todo dano que reduziria HP, inclusive dano periódico e ambiental, passa primeiro pelo escudo.**

**R11.4 — Se uma cura de 20 HP começar com a vida abaixo do máximo, mas ultrapassar o HP máximo, o que fazer com o excedente?**

- A — Recupera somente até o HP máximo, descartando o excedente.
- B — Recupera o HP e converte apenas o excedente numérico em pontos de escudo.
- C — Recupera o HP e concede o escudo completo de 40 pontos sempre que houver excedente.
- D — Tratamento do excedente configurável, sem alterar a regra já aprovada para HP previamente cheio.

**Resposta aprovada:** **B — Recupera o HP e converte apenas o excedente numérico em pontos de escudo.**

**R11.5 — Qual geometria de colisão deve determinar a coleta automática de itens em diferentes alturas?**

- A — Distância esférica tridimensional entre o item e o personagem.
- B — Distância horizontal e tolerância vertical separadas, ambas configuráveis.
- C — Sobreposição real entre um volume tridimensional de coleta do item e o corpo do personagem.
- D — Formato e dimensões configuráveis individualmente por consumível.

**Resposta aprovada:** **A — Distância esférica tridimensional entre o item e o personagem.**

**R11.6 — Quando um objeto destrutível se rompe acima do piso, como o consumível liberado se comporta verticalmente?**

- A — Aparece no ponto de destruição e cai fisicamente até uma superfície válida.
- B — Aparece no ponto de destruição e flutua nessa altura pelos 15 segundos de permanência.
- C — Surge diretamente na superfície acessível mais próxima do ponto da destruição.
- D — O comportamento do drop é configurável por categoria de objeto.

**Resposta aprovada:** **A — Aparece no ponto de destruição e cai fisicamente até uma superfície válida.**

**R11.7 — Quando um projétil atinge a borda invisível da arena circular, qual deve ser a resposta padrão?**

- A — Colide e é destruído no limite.
- B — Ricocheteia conforme as propriedades físicas e direção de contato.
- C — Pode atravessar a borda, mas deixa de interagir com o combate fora da arena.
- D — Cada tipo de projétil define se colide, ricocheteia ou atravessa o limite.

**Resposta aprovada:** **B — Ricocheteia conforme as propriedades físicas e direção de contato.**

**R11.8 — Como os temporizadores de consumíveis, respawn e escudos devem reagir à pausa e ao hitstop durante a luta?**

- A — Todos ficam congelados durante pausa e hitstop.
- B — Congelam na pausa, mas continuam avançando durante o hitstop.
- C — Congelam na pausa; durante o hitstop, apenas efeitos de combate pausam, enquanto gerações do mapa avançam.
- D — Relógios de simulação e efeitos configuráveis, preservando determinismo dos testes.

**Resposta aprovada:** **A — Todos ficam congelados durante pausa e hitstop.**

**R11.9 — O reaparecimento de um objeto destrutível deve apresentar algum aviso visual antes de o colisor sólido voltar a existir?**

- A — Não. O objeto reaparece instantaneamente na posição válida.
- B — Sim. Indicador discreto no chão aparece brevemente antes de materializar o objeto.
- C — Sim. Uma prévia translúcida do objeto aparece antes de se tornar sólida.
- D — Aviso, duração e aparência configuráveis no laboratório.

**Resposta aprovada:** **C — Sim. Uma prévia translúcida do objeto aparece antes de se tornar sólida.**

**Observações adicionais do usuário nesta rodada:** nenhuma. A palavra “recentemente” em R11.2 continua sem janela de tempo definida; não inventar intervalo.

### Auditoria prévia de não redundância para a Rodada 11 (histórico)

- **R11.1:** R3.13/R10.9 — Restrições de geração e igualdade dos consumíveis não determinam posições de spawn dos lutadores.
- **R11.2:** R3.7/R7.15/R10.8 — Dano físico ambiental definido; autoria de derrota ainda não.
- **R11.3:** R9.6/R10.1 — Escudo em dano bruto e excedente definidos; status periódicos não citados.
- **R11.4:** R5.11/R6.15/R9.1 — HP previamente cheio gera escudo; excedente quando HP inicialmente parcial não decidido.
- **R11.5:** R4.3/R5.13 — Coleta automática em qualquer estado aprovada; alcance tridimensional ainda não.
- **R11.6:** R4.11 — Drops nascem na posição de destruição; movimento vertical posterior não definido.
- **R11.7:** R3.1/R8.8 — Bordas e consumo por impacto em destrutível definidos; impacto do projétil com limite da arena não.
- **R11.8:** R9.13 — Temporizadores congelam ao fim da luta, mas não há regra formal durante pausas/hitstop.
- **R11.9:** R3.8/R6.5 — VFX de destruição e respawn definidos; aviso visual prévio de reaparecimento ainda não.

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

11. **R5.9 → R9.1:** cura imediata padrão de **20 HP**, ainda configurável.
12. **R6.8 → R9.2:** stamina recuperada pelo consumível próprio: **2 pontos**.
13. **R6.15 → R9.3–R9.7:** escudo alternativo a cura com HP cheio especificado como **10 s/40 pontos iniciais**, capacidade acumulável até teto configurável, dano bruto absorvido antes da Defesa, sem resistência a empurrão.
14. **R6.16 → R9.8–R9.9:** recompensa na progressão total e HP cheio passa a ser **recuperação imediata de stamina**, repetível (valor a esclarecer na R10).
15. **R3.5/R3.6 → R9.10–R9.11:** quatro destrutíveis começam com **30 HP**, resistências separadas por categoria de entrega; parâmetros individuais continuam configuráveis.
16. **R3.13 → R9.12:** quando ponto sorteado é inválido, procurar **sistematicamente o ponto válido mais próximo**, mantendo restrições.
17. **R9.13:** temporizadores param imediatamente ao fim da luta.
18. **R9.15–R9.16 → retirada posterior parcial:** manter todos os testes de integração, regressão, navegador, HUD, IA e desempenho; retirar apenas o componente **gamepad** por determinação expressa posterior, sem descartar o restante. Meta 60 FPS/1080p com simulação de 120 Hz permanece.
19. **R7.3 + R9.14 → instrução expressa posterior:** o usuário retirou **todo gamepad do escopo do mapa**. Preservar opções antigas apenas como histórico; cancelar qualquer pendência ou pergunta para especificar controle e não tornar testes de gamepad obrigatórios neste escopo.

20. **R10.1–R10.2:** excedente ao fim do escudo passa pela Defesa; nova proteção renova sua duração para 10 s.
21. **R10.3:** redução adicional por estágios de Defesa ocorre após a mitigação básica, com dano mínimo de zero. A fórmula exata poderá requerer teste para compatibilidade, não outra aprovação do conceito.
22. **R10.4–R10.5:** evolução total com HP e stamina cheios concede escudo; derrotados (HP zero) não coletam consumíveis.
23. **R10.6:** geração sem posição válida é adiada até mudança no cenário.
24. **R10.7–R10.8:** colisão que quebra destrutível ainda interrompe impulso naquele contato; impacto causa também dano ao lutador proporcional à velocidade relativa.
25. **R10.9:** dois consumíveis iniciais seguem apenas as restrições espaciais existentes; não impor distribuição equidistante dos lutadores.
26. **R10.10:** ganhar estágio de Velocidade no ar não modifica trajetória balística em curso; bônus aplica-se apenas a ações posteriores.

27. **R11.1:** dois pontos iniciais opostos sorteados a cada partida, com separação equilibrada e posições válidas.
28. **R11.2:** derrota por colisão ambiental é atribuída ao último adversário que causou dano *recentemente*; a duração da janela de autoria ainda não foi definida.
29. **R11.3:** todo dano que reduziria HP (inclusive status periódicos e ambiente) primeiro passa pelo escudo.
30. **R11.4:** cura que ultrapassaria o HP máximo converte **somente o excedente numérico** em pontos de escudo, respeitando a capacidade acumulável. Regra de HP previamente cheio permanece.
31. **R11.5:** a coleta é decidida pela **distância esférica 3D** entre personagem e item.
32. **R11.6:** drop surge no ponto de destruição e **cai fisicamente** até superfície válida.
33. **R11.7:** projétil que atinge borda circular ricocheteia conforme propriedades físicas e normal de contato.
34. **R11.8:** temporizadores de consumíveis, respawn e escudos congelam na pausa e no hitstop.
35. **R11.9:** destrutível reaparece somente após exibir **prévia translúcida** antes do colisor tornar-se sólido.

## Auditoria de pendências após as 11 rodadas — classificação por prioridade

**Decisões funcionais fechadas:** geometria/limites da arena, posicionamento validado, saltos e plataformas, dano a objetos/colisão, tipos de itens e probabilidades, progressão, coleta 3D, limites e timers, escudos/mitigação, IA/câmera, spawn dos lutadores e projéteis no perímetro, pausa/hitstop e VFX de respawn. Esses temas **não devem ser novamente submetidos como decisões de princípio**.

**Lacuna comportamental real:** R11.2 usa o termo **“recentemente”** para atribuir uma derrota ao último adversário que causou dano. Não há intervalo, nem regra de expiração, nem definição de como contabilizar impactos em cadeia. Pode ser especificado como parâmetro de janela de crédito na fase de implementação, mas não pode ser declarado numérico como aprovado.

**Parâmetros já definidos como configuráveis, sem valor inicial obrigatório aprovado:** recuperação normal de aterrissagem R7.9; teto de escudo R9.5; resistências quantitativas individuais dos destrutíveis R9.10; duração de aviso translúcido R11.9; raio da esfera de coleta R11.5; distância de separação inicial de lutadores R11.1; escolhas de câmera, materiais, danos e física descritas no laboratório. Não criar rodadas repetitivas apenas para atribuir números arbitrários a essas opções.

**Pendências de validação técnica (não são perguntas de game design):** testar reprodução por seed/save/replay, geometria circular e plataformas 3D, determinismo de coleta e timers, integração de dano de status com escudo, rendimento em 1080p e passo fixo a 120 Hz, navegação IA/oclusão de câmera, regressão do sistema anterior. Não afirmar que a funcionalidade está implementada. Meta aprovada 60 FPS; hardware de referência ainda por medir.

**Possíveis integrações a especificar tecnicamente sem alterar o design:** ordem dos eventos do mesmo passo, comportamento em colisões e múltiplas fontes de dano simultâneas, preservação de autoria dos projéteis ricocheteados, teste de acessibilidade após reaparecimento. Devem seguir decisões anteriores e exigir nova aprovação apenas se surgir escolha de comportamento incompatível com elas.

**Fora de escopo:** gamepad, por ordem posterior do usuário; não propor nova pergunta sobre ele.

## Pendências, ambiguidades e decisões NÃO tomadas

- **P1 — CONTROLE FORA DO ESCOPO (resolvido por retirada):** por instrução expressa posterior à R9, gamepad foi totalmente excluído do planejamento do mapa; não há botão ou mapeamento pendente e não se deve repor exigências relacionadas. O salto por teclado Espaço permanece aprovado.
- **P2 — Salto e movimento aéreo:** R2.3 e R7.7 especificam impulso horizontal preservado e sem correção durante o salto. R2.7 diz “apenas movimentar-se”; deve-se preservar a interpretação estrita de movimento horizontal balístico sem permitir novo direcionamento no ar. Caso isso inclua outra ação além de deslocamento prévio, pedir esclarecimento.
- **P3 — Recuperação ao aterrissar:** R7.9 aprova configuração independente, **sem tempo inicial numérico**.
- **P4 — Cura de HP:** R9.1 definiu **20 HP** como padrão (R5.9 mantém a cura configurável em pontos ou porcentagem). **Resolvida quanto ao valor inicial.**
- **P5 — Recuperação imediata de stamina:** R9.2 definiu **2 pontos**, item distinto do aumento permanente de capacidade. **Resolvida quanto ao valor inicial.**
- **P6 — Escudo temporário:** R9.3–R9.7 e R10.1–R10.2 definiram **10 s, até 40 pontos por aplicação, capacidade acumulável até teto configurável, duração renovada integralmente a 10 s em nova coleta, dano bruto absorvido antes da Defesa, excedente mitigado pela Defesa normal, sem bloquear empurrões/lançamentos**. R11.3 esclareceu que **todo dano ao HP**, incluindo dano periódico de status e ambiental, atravessa primeiro o escudo. R11.4 converte somente excedente numérico de cura em escudo quando HP começa abaixo do máximo. O teto do escudo e outras intensidades permanecem configuráveis; não repetir pedido de valores arbitrários.
- **P7 — Recompensa extra de progressão total:** R9.8–R9.9 aprovaram **recuperação imediata de stamina repetível** a cada consumível elegível; R10.4 determina que **quando HP e stamina já estão cheios** o consumível concede o **escudo temporário existente**, respeitando teto. Não presumir quantidade numérica distinta para a recuperação especial de stamina, nem solicitar padrão sem necessidade.
- **P8 — HP e resistências de objetos:** R9.10–R9.11 definiram **30 HP inicialmente por destrutível**, com resistências por **contato físico, projéteis, área e colisão ambiental**. Multiplicadores numéricos de resistência continuam configuráveis e sem valores iniciais aprovados; não reapresentar a classificação por categoria já aprovada.
- **P9 — Falha de geração procedural:** R9.12 exige procurar sistematicamente a **posição válida mais próxima da sorteada**; R10.6 determina **adiar a geração e tentar novamente quando o cenário mudar**, sem gerar itens ou obstáculos em posições inválidas. Regras de acessibilidade anteriores mantidas.
- **P10 — Temporizadores de partida:** R9.13 determina que os temporizadores de objetos, itens e escudos **parem imediatamente na definição do vencedor**; R11.8 manda congelar **todos durante pausas e hitstop**. Questões de animações pós-partida não foram especificamente alteradas.
- **P11 — Regressão e desempenho:** R9.15 exige cobertura completa, incluindo **navegador, HUD, IA, seeds, replay e desempenho**; a exigência relativa a gamepad foi **retirada por ordem posterior**. R9.16 define **meta de 60 FPS a 1080p**, preservando física de passo fixo a **120 Hz**, mas ainda falta hardware de referência, a ser definido apenas quando for viável medir desempenho, sem repetir a meta aprovada.
- **P12 — Interação ataque/defesa:** R8.7 aprova que explosões danifiquem objetos dentro do volume 3D; isso não aprova ignorar colisões tridimensionais ou fazer projéteis atravessarem bloqueios. R8.8 estabelece consumo de projétil que destrói o objeto.
- **P13 — Categoria de buff regeneração:** não inventar progressão de regeneração de stamina a partir da lista preliminar de R4.2. A implementação deve usar as cinco categorias definitivas e os consumíveis de recuperação descritos.
- **P14 — Estado técnico NÃO implementado:** mundo do laboratório em `prototypes/combat-lab/src/sim/world.js` já oferece projéteis, paredes, barreiras de movimentos e áreas; `status.js` suporta status temporários; `physics.js` usa limites quadrados; isso **não demonstra** existência das novas entidades persistentes, progressão de estágios, arena circular nem pulo independente.
- **P15 — Persistência do planejamento:** arquivo GitHub é fonte compartilhada, mas a atualização depende de solicitação em cada rodada e acesso ao repositório. Não confundir “gravado no GitHub” com “sincronizado com checkout local oficial”.

## Pergunta de planejamento retirada por instrução expressa (preservada somente para auditoria)

- **Motivo:** após receber a Rodada 10, o usuário determinou “MEU DEUS IGNORA GAMEPAD”. Isso substitui exigências anteriores de mapear, testar ou perguntar sobre gamepad no contexto do mapa Arenamon; não altera os controles existentes do jogo por si só.
- **Consequência:** a pergunta originalmente mostrada como R10.1 foi **cancelada sem resposta** e substituída por uma pergunta sobre o tempo de tolerância do lock-on. O registro das alternativas originais segue apenas abaixo, sem efeito normativo:

**R10.1 — Qual botão padrão específico deverá ser usado no gamepad para o salto independente?**

- A — D-pad para cima (direcional digital ↑), sem alterar comandos já ocupados.
- B — R3 (pressionar o analógico direito), verificando o comportamento atual antes de atribuir.
- C — D-pad para a esquerda (direcional digital ←).
- D — Outro botão ou combinação, especificado textualmente nas observações.

**Status:** não respondida.

- **Não extrapolar:** não modificar implementações de entrada do jogo. Esta atualização foi somente documental.

## Arquivo histórico do questionário anterior da Rodada 10 (não respondido)

> Este questionário foi **substituído** porque continha perguntas repetidas e solicitação de números em parâmetros já definidos como configuráveis. O conteúdo abaixo é apenas histórico: **nenhuma escolha foi respondida ou aprovada**.

### Rodada 10 — versão original substituída (SEM RESPOSTAS) QUESTIONÁRIO PENDENTE (16 perguntas, sem respostas)

**Questão antiga 10.1 — Por quanto tempo a trava de alvo deve ser mantida quando um obstáculo bloqueia continuamente a linha de visão?**

- A — 0,5 segundo.
- B — 1 segundo.
- C — 2 segundos.
- D — Tempo de tolerância configurável com valor padrão informado nas observações.

**Status:** não respondida.

**Questão antiga 10.2 — Qual deve ser o tempo inicial de recuperação após um salto normal, antes de poder agir novamente?**

- A — 0 s (controle terrestre imediato; intervalo de 0,25 s para outro salto permanece).
- B — 0,10 s.
- C — 0,20 s.
- D — Outro valor numérico informado nas observações, mantendo o parâmetro configurável.

**Status:** não respondida.

**Questão antiga 10.3 — Qual limite inicial de capacidade acumulada deve ser usado para o escudo, considerando que cada aplicação fornece até 40 pontos?**

- A — Até 60 pontos de escudo acumulado.
- B — Até 80 pontos.
- C — Até 120 pontos.
- D — Outro teto inicial informado nas observações, sempre configurável.

**Status:** não respondida.

**Questão antiga 10.4 — Se o escudo não for suficiente para absorver o dano bruto inteiro, como tratar o excedente?**

- A — Escudo absorve sua capacidade restante; o dano excedente passa então pela mitigação normal de Defesa.
- B — Escudo absorve sua capacidade restante; o excedente atinge o HP diretamente, sem Defesa.
- C — O golpe que esgota o escudo causa zero dano ao HP, mesmo com excedente.
- D — Regra configurável, com comportamento inicial detalhado nas observações.

**Status:** não respondida.

**Questão antiga 10.5 — Quanto deve restaurar a recompensa especial de stamina recebida com HP cheio e todos os atributos no estágio 4?**

- A — Os mesmos 2 pontos do consumível comum de stamina.
- B — Preenche completamente a stamina até o máximo atual.
- C — Restaura 1 ponto, independentemente do item comum.
- D — Quantidade específica informada nas observações.

**Status:** não respondida.

**Questão antiga 10.6 — Se o personagem já estiver com todos os estágios e HP e stamina máximos, o que ocorre ao receber a recompensa especial de stamina?**

- A — A coleta acontece, mesmo sem benefício imediato.
- B — O item permanece disponível, sem ser coletado.
- C — Concede escudo temporário seguindo as regras já aprovadas.
- D — Outra consequência específica, informada nas observações.

**Status:** não respondida.

**Questão antiga 10.7 — Se um item tocar um personagem derrotado, com HP igual a zero, como a coleta deve ser resolvida?**

- A — Não concede benefícios; personagens derrotados não podem coletar itens.
- B — Cura ainda pode ocorrer no mesmo passo e impedir a derrota se processada antes do encerramento.
- C — O personagem derrotado pode receber item, mas isso não reverte a derrota.
- D — Ordem de processamento e exceções configuráveis, com regra inicial especificada.

**Status:** não respondida.

**Questão antiga 10.8 — O que acontece quando um drop de destruição surge em posição bloqueada ou fisicamente inacessível?**

- A — Tenta o ponto livre válido mais próximo do objeto destruído.
- B — Drop não é criado caso o ponto exato esteja inválido.
- C — Tenta posições próximas e, se nenhuma for válida, concede o benefício diretamente ao destruidor.
- D — Estratégia configurável sem permitir itens presos em colisores.

**Status:** não respondida.

**Questão antiga 10.9 — O que fazer se nenhum local válido existir sequer após a busca sistemática aprovada para geração de objetos ou itens?**

- A — Adiar a geração e repetir a busca quando o cenário mudar.
- B — Cancelar somente aquela ocorrência e aguardar o próximo intervalo regular.
- C — Aguardar vaga e tentar a cada passo da simulação até conseguir.
- D — Tratar cada categoria (objetos, plataformas, consumíveis) com regras de contingência separadas.

**Status:** não respondida.

**Questão antiga 10.10 — Como definir as probabilidades iguais entre as categorias de consumíveis depois de considerar HP, stamina e cinco atributos?**

- A — Todos os 7 tipos possuem exatamente a mesma probabilidade nas gerações regulares.
- B — Sorteio primeiro entre recuperação e evolução, depois entre tipos dentro de cada grupo.
- C — HP, stamina e cinco evoluções possuem pesos ajustáveis, inicialmente iguais.
- D — Outro agrupamento explicitado nas observações.

**Status:** não respondida.

**Questão antiga 10.11 — Ao reaparecer um destrutível ou ser criado um novo obstáculo, como preservar rotas e segurança durante o combate?**

- A — Apenas aceitar posições que não colidam com jogadores, itens e obstáculos e preservem caminhos livres.
- B — Exigir também uma distância mínima configurável das trajetórias previstas dos jogadores.
- C — Impedir reaparecimento próximo a personagens, independentemente das condições de rota.
- D — Usar a regra de posições válidas anterior com testes de conectividade e margens adicionais configuráveis.

**Status:** não respondida.

**Questão antiga 10.12 — Como o pulo independente deve coexistir com o salto/vault atualmente associado à esquiva?**

- A — Permanecem ações separadas, com controles, intervalos e comportamento físico próprios.
- B — A esquiva aérea passa a usar a mesma física do pulo normal.
- C — O novo pulo substitui completamente o vault da esquiva.
- D — Coexistência configurável no laboratório, preservando o comportamento existente por padrão.

**Status:** não respondida.

**Questão antiga 10.13 — Como a IA deve reagir quando seu caminho planejado fica indisponível por bloqueio temporário ou reaparecimento de objetos?**

- A — Recalcula imediatamente uma nova rota válida.
- B — Aguarda brevemente e recalcula se o bloqueio persistir.
- C — Tenta contornar localmente antes de solicitar novo planejamento de caminho.
- D — Estratégia e intervalos configuráveis, sempre impedindo aprisionamento permanente.

**Status:** não respondida.

**Questão antiga 10.14 — Como devem ser configuradas as resistências iniciais dos destrutíveis por categoria de impacto?**

- A — 100% de dano para contato físico, projéteis, área e colisão ambiental.
- B — Contato 100%, projéteis 100%, área 50% e colisão ambiental 100%.
- C — Contato 100%, projéteis 75%, área 75% e colisão ambiental 125%.
- D — Tabela inicial de multiplicadores personalizada, informada nas observações e editável por objeto.

**Status:** não respondida.

**Questão antiga 10.15 — Como escolher um equipamento de referência para verificar a meta de 60 FPS em 1080p?**

- A — Definir hardware de referência futuramente; testes já devem medir FPS e tempos de quadro.
- B — Usar o computador local do usuário como referência, após obter suas especificações.
- C — Definir perfis mínimo e recomendado de hardware em rodada futura.
- D — Outro alvo concreto, indicado nas observações.

**Status:** não respondida.

**Questão antiga 10.16 — Como deve ser validada a sincronização entre o arquivo GitHub e o checkout local oficial após cada atualização documental?**

- A — Confirmar o commit remoto e deixar a sincronização local pendente até haver acesso à pasta oficial.
- B — Exigir confirmação de `git fetch`/`git pull` no checkout local antes de considerar a rodada concluída.
- C — Confirmar o commit remoto, e solicitar sincronização local apenas antes da implementação.
- D — Outro procedimento explícito, indicado nas observações.

**Status:** não respondida.




## Especificação técnica consolidada — V1 de planejamento (SEM IMPLEMENTAÇÃO)

> **Escopo deste capítulo.** Tradução operacional das 152 decisões aprovadas nas Rodadas 1–11. A resposta mais recente do usuário prevalece quando há refinamento ou substituição. Os registros numerados acima são a fonte primária. Os rótulos [APROVADO], [PROPOSTA TÉCNICA] e [LACUNA] têm significados distintos. Este capítulo não autoriza modificar código nem mudar outras regras do combate.
>
> **Base da inspeção técnica remota:** main de Ziaker/Arenamon no commit b8aeec6e8b6794894c010b9a8f194bf48615bb7f, consultada antes desta especificação. Foram examinados módulos de simulação, física, mundo, status, IA, ajustes, câmera e entrada do laboratório de combate. Isso **não equivale** a executar ou testar o projeto localmente. Revalidar a main e o checkout oficial antes de qualquer futura implementação.

### A. Contrato de escopo e arquitetura

**[APROVADO]** Transformar o mapa técnico do laboratório de combate em arena **circular** de raio **50 m** (diâmetro **100 m**), sem temas visuais definitivos, contendo **4 destrutíveis, 4 obstáculos indestrutíveis e 2 plataformas** inicialmente. Quantidades/tamanhos/posicionamento seguem parâmetros que o usuário aprovou como configuráveis. A implementação não pode alterar silenciosamente mecânicas de esquiva, ataques, cooldowns ou status fora dos pontos de integração expressamente aprovados. O gamepad foi **excluído do escopo deste trabalho** por ordem posterior, mantendo somente o pulo por **Espaço** no teclado. [R1, R3.3–R3.5, diretriz posterior a R9]

**[APROVADO]** Meta: **60 FPS em 1080p** e simulação física de passo fixo **120 Hz**, sujeita a teste em hardware explicitamente identificado em relatório. Exige testes de regressão, IA, navegador, HUD, seeds, replay/save e desempenho; não exige novos testes específicos de gamepad no escopo do mapa. [R9.15–R9.16]

**[PROPOSTA TÉCNICA]** Construir componentes da arena e das mecânicas novas sem transformar o registro de aprovação em uma autorização para refazer o sistema de combate. Garantir estado serializável e parâmetros editáveis. Aplicar decisões aprovadas sem inventar variáveis numéricas para os parâmetros que o usuário definiu como configuráveis.

### B. Cenário, spawns e colisão

**[APROVADO]**
- Borda circular com barreira invisível e indicação visual discreta. Força, rebote e dano por impactos dos lutadores na borda configuráveis. Projéteis ricocheteiam na borda segundo direção e propriedades físicas. [R3.1–R3.2, R11.7]
- Quatro destrutíveis iniciais geométricos, **30 HP** inicialmente cada, com valores individuais editáveis. Recebem dano de movimentos e impactos; resistências separadas em contato físico, projétil, área e colisão ambiental; bônus de Ataque do lutador afeta objetos. [R1.3–R1.6, R3.3–R3.7, R5.14, R9.10–R9.11]
- Quatro indestrutíveis de formatos mistos (caixas, cilindros e pilares), posicionados aleatoriamente. Bloqueiam corpos/ataques, oferecem cobertura e rebotes coerentes com a normal e intensidade do impacto. [R1.7–R1.8, R3.11–R3.12]
- Duas plataformas sólidas em todas as faces, com topo de **3 × 3 m**, a alturas **1 m** e **1,5 m**. Personagens podem pousar fisicamente nelas, combater e caminhar até cair. Obstáculos baixos adicionais podem ser ultrapassados por salto físico. [R1.9, R2.9–R2.11, R7.4–R7.6/R7.14/R7.16]
- Lutadores iniciam em dois pontos opostos **sorteados** e válidos, com separação equilibrada. Objetos/itens/plataformas respeitam ausência de sobreposição inválida, segurança dos spawns e caminhos acessíveis. Para ponto inválido, localizar sistematicamente a posição válida mais próxima; se nenhuma existir, **adiar** a geração até mudança do cenário, sem aceitar uma posição inválida. [R3.13, R9.12, R10.6/R10.9, R11.1]
- Lutadores, golpes corpo a corpo, projéteis e áreas respeitam **volumes reais tridimensionais**, inclusive alturas e plataformas; um golpe não alcança um alvo separado verticalmente se sua hitbox não o tocar. [R7.11–R7.13]

**[PROPOSTA TÉCNICA]** Expor uma consulta única de colisão/ocupação 3D para a simulação, geração de itens, IA e depuração. Em particular, não substituir todas as consultas físicas por distância plana no eixo XZ. A escolha de estrutura de navegação, algoritmo de busca e representação geométrica ainda não foi feita pelo usuário.

### C. Salto, lançamento e aterrissagem

**[APROVADO]** Salto normal iniciado pela tecla **Espaço**, somente em estado livre/caminhando/correndo, sem gasto de stamina, sem i-frames e sem ataque/defesa durante o salto normal. Altura inicial **2 m**, gravidade relacionada à gravidade existente porém ajustável de forma independente; **um salto normal por sequência aérea**, podendo movimentos especiais conceder outros. Intervalo de novo salto: **0,25 s após aterrissar**. Recuperação ao pousar é configurável independentemente; valor inicial não aprovado. [R2.1–R2.8, R7.1–R7.2/R7.8–R7.9]

**[APROVADO]** Preservar **exatamente** a velocidade horizontal na decolagem, sem redirecioná-la em voo. Caminhar para fora de plataforma causa queda balística com a velocidade horizontal anterior. Lutadores lançados também podem aterrissar fisicamente nas plataformas. Coletar estágio de Velocidade em voo não altera a trajetória já iniciada, afetando as próximas ações. [R2.3, R7.7/R7.10/R7.14, R10.10]

**[LACUNA CONTROLADA]** A expressão “apenas movimentar-se” de R2.7 deve ser lida em conjunto com R2.3 e R7.7: não pressupor direção horizontal aérea adicional. O mecanismo já existente de vault na esquiva não foi explicitamente aprovado para substituição. Se a integração do salto exigir mudança de um comportamento anterior, relatar o conflito específico em vez de redefinir a esquiva por conta própria.

### D. Destruição, impacto, respawn e drops

**[APROVADO]** Ataques com alcance/volume correto causam dano a objetos; explosões atingem objetos dentro de seu volume tridimensional, e projétil que destrói objeto bloqueador é **consumido** no impacto. [R1.5, R8.7–R8.8]

**[APROVADO]** Lutador lançado que atinge objeto destrutível danifica o objeto de acordo com **velocidade horizontal relativa**, e também recebe dano proporcional à velocidade relativa do choque. Se o impacto destrói o objeto, o impulso daquele contato permanece interrompido, mesmo que o colisor desapareça depois. [R3.7, R7.15, R10.7–R10.8]

**[APROVADO]** Destrutíveis reaparecem **15–30 s** após serem destruídos, em **outra posição válida**, após mostrar **prévia translúcida** antes de se tornarem sólidos. Efeitos de destruição são selecionáveis. [R3.8–R3.9, R6.5–R6.6, R11.9]

**[APROVADO]** Destruição pode liberar consumíveis com probabilidade, quantidade e recompensa configuráveis. Drop surge **no local da destruição** e **cai fisicamente** até superfície válida. Drops podem temporariamente exceder o máximo de quatro itens que bloqueia novas gerações regulares. [R1.12, R3.10, R4.11, R5.16, R11.6]

**[APROVADO]** Derrota causada por choque ambiental é atribuída ao **último adversário que causou dano recentemente**. [R11.2]

**[LACUNA]** A palavra “recentemente” não possui duração definida; nem todos os multiplicadores de resistência de objetos receberam valor padrão. Esses aspectos são parâmetros a documentar/medir na fase técnica; não declaralos como decisões numéricas aprovadas.

### E. Consumíveis, spawn, coleta e timers

**[APROVADO]**
- Sete tipos: cura de HP, recuperação imediata de stamina, evolução de Ataque, Defesa, Stamina máxima, redução de Cooldown e Velocidade. Na geração regular, tipos com **probabilidade igual**. Cores, formas e símbolos próprios. [R4.1–R4.2/R4.7, R5.12, R6.8]
- **Dois itens iniciais** sorteados independentemente, inclusive com repetição de tipo, sem impor equidistância entre os lutadores; apenas restrições de posição válida. Gerar regularmente a intervalos aleatórios de **20–40 s**. Duração de cada item no chão/plataforma: **15 s** sem coleta. Quando houver **quatro ou mais itens**, suspender a geração regular; reiniciar o contador quando surgir vaga. Drops de destruição podem exceder esse limite e continuam sujeitos a seus ciclos próprios. [R4.4–R4.6, R6.1–R6.4/R6.7, R10.9]
- Itens surgem no piso ou nas plataformas, acessíveis. Coleta automática em **qualquer estado** do lutador por **distância esférica tridimensional**. Em disputa simultânea, primeiro a entrar no raio ganha, com desempate determinístico. Lutador derrotado (**HP igual a zero**) não coleta nem revive por coleta. [R4.3/R4.8–R4.9, R5.13/R5.15, R10.5, R11.5]
- Cura normal de **20 HP**, recuperação imediata de **2 pontos de stamina**, sempre respeitando a capacidade atual. Cura com HP previamente cheio concede escudo. Cura que começou com HP parcial e ultrapassa o máximo converte **somente o excedente numérico** em pontos de escudo. [R9.1–R9.2, R11.4]
- Timers de itens, reaparecimento e escudos ficam **congelados durante pausas, hitstop e após definição do vencedor**. [R9.13, R11.8]

**[PROPOSTA TÉCNICA]** Separar o relógio de geração regular do de drops, e guardar IDs, tick, posição, tipo, origem e estado dos itens. O snapshot/replay precisa incluir o estado do gerador pseudoaleatório. Garantir que a contagem de itens bloqueie geração regular quando drops temporários elevarem o total a quatro ou mais.

### F. Progressão por estágios permanentes na luta

**[APROVADO]** Cada personagem pode manter **quatro estágios em cada uma das cinco categorias**, somando no máximo **20 melhorias**, zeradas ao fim da luta. Os estágios de coleta não têm duração temporária. [R4-observação, R5.1–R5.3]

| Atributo | Regra de evolução aprovada | Referência |
| --- | --- | --- |
| Ataque | +10% por estágio, até +40%; dano aos destrutíveis recebe o bônus | R5.5/R5.14 |
| Defesa | −10 pontos percentuais de dano e empurrão por estágio, até −40 p.p.; mitigação adicional aplicada **depois** da Defesa básica, sem dano negativo | R6.11/R10.3 |
| Stamina máxima | +1 à capacidade por estágio e +1 simultâneo à stamina atual, sem passar do novo máximo | R5.4/R6.9–R6.10 |
| Cooldown | Redução de 10% da duração por estágio, até 40%, somente para cooldown iniciado após a coleta; recarga em curso não muda | R5.8/R6.13 |
| Velocidade | +5% por estágio, até +20%, à locomoção e distância/velocidade da esquiva; não altera impulso de voo existente | R6.12/R10.10 |

**[APROVADO]** Quando o item pertence a categoria já no estágio 4, ele se converte em cura igual à de HP comum. Com todas as cinco categorias no estágio máximo e **HP cheio**, o benefício especial repetível é **stamina imediata**. Se **HP e stamina estão ambos cheios**, esse benefício se converte em escudo dentro do teto aprovado como configurável. [R5.10, R6.14/R6.16, R9.8–R9.9, R10.4]

**[LACUNA]** A recuperação especial de stamina não recebeu quantidade numérica exclusiva, distinta da recuperação normal de dois pontos. Não afirmar que é preenchimento total sem aprovação. Regeneração de stamina não é uma sexta categoria de estágio.

**[PROPOSTA TÉCNICA]** Representar estágios em estrutura serializável própria, separada dos status temporários. O sistema atual em status.js exige duração positiva; não simular permanência de estágios usando duração artificialmente enorme. Calcular corretamente o teto de stamina por personagem e combinar modificadores existentes sem alterar suas regras fora de escopo.

### G. Escudo e sequência de cálculo de dano

**[APROVADO]**
1. Item elegível de cura com HP cheio concede proteção inicial de **40 pontos de dano**, com duração **10 segundos**.
2. Coleta adicional elegível soma proteção restante **até teto configurável** e **renova os 10 segundos completos**.
3. Escudo intercepta **todo dano ao HP**, inclusive status periódico e impacto ambiental, absorvendo **dano bruto antes da Defesa**.
4. Se um dano supera a capacidade do escudo, consumir essa capacidade; **somente o excedente** passa à mitigação básica da Defesa e depois à redução adicional dos estágios, com mínimo de zero.
5. Escudo não impede **empurrões nem lançamentos**; a resposta cinética permanece sujeita às próprias regras aprovadas.
6. Quando a cura inicia abaixo do HP máximo e o ultrapassa, somente o excesso numérico vira escudo. [R9.3–R9.7, R10.1–R10.2, R11.3–R11.4]

**[LACUNA]** Teto de proteção acumulada foi determinado como **configurável**, não com valor inicial numérico aprovado. Não inventar teto nas afirmações de design.

**[PROPOSTA TÉCNICA]** Canalizar dano direto, dano periódico e dano ambiental ao mesmo pipeline testável de cálculo para garantir que nenhuma dessas fontes ignore o escudo. Na hipótese de invulnerabilidade, respeitar as regras existentes do movimento; não declarar a invulnerabilidade alterada por este documento.

### H. IA, câmera, interface e telemetria

**[APROVADO]**
- IA usa planejamento de caminhos e replanejamento após mudança dos objetos, reconhece cobertura/linha de visão, planeja subida/descida e perseguição nas plataformas, e disputa itens avaliando utilidade, distância e risco. Pode atacar destrutíveis **oportunisticamente** se próximos, sem deslocar toda sua estratégia para farm de itens. [R2.12, R4.15, R8.1–R8.5]
- Lock-on preserva alvo temporariamente durante oclusão e então desativa; o valor da tolerância temporal continua indefinido. [R8.6]
- Câmera torna objetos temporariamente transparentes quando ocultam o personagem, faz ajuste de altura para enquadrar adversário e acompanha distância entre os dois com afastamento automático. [R8.9–R8.11]
- Consumíveis têm indicadores flutuantes a médias distâncias; HUD da progressão é **configurável**, inclusive opção de ocultar estágios. Ferramentas de depuração individualmente ativáveis: hitboxes/colisores/volumes de coleta, decisões de IA, geração/destruição/buffs, seed, posições e falhas. [R8.12–R8.13/R8.16]
- Nova aba **Mapa** com grupos de arena, objetos, plataformas, consumíveis e progressão. Mudanças visuais aplicam-se **imediatamente**; alterações estruturais e de geração só passam a valer **na próxima luta**. [R8.14–R8.15]

**[PROPOSTA TÉCNICA]** Assegurar fonte comum de acessibilidade, colisão e oclusão ao planejamento da IA e à simulação. Manter indicação clara na aba Mapa do parâmetro efetivo da luta e do parâmetro editado que só terá efeito no próximo reset.

### I. Pontos de integração verificados na main — ainda NÃO implementados

| Código inspecionado | Observação constatada | Trabalho futuro sugerido, sem aprovação para executar |
| --- | --- | --- |
| sim/game.js | Passo fixo, ciclo de luta, reset, snapshot, pipeline de física/mundo/status | Integrar clocks de mapa, itens, progressão e escudo sem romper ordem de eventos ou replay |
| sim/physics.js | Limites físicos cartesianos ligados a arenaHalf, simplificação de altitude | Arena circular, plataformas e contatos tridimensionais reais |
| sim/world.js | Entidades projectile, barrier, wall, area | Destrutíveis, obstáculos persistentes, drops, colisão ambiental e respawn |
| sim/status.js | Status periódicos e temporários, exigência de duration positivo | Não converter estágios permanentes em status temporários; integrar dano periódico ao escudo |
| sim/ai.js e sim/tactics.js | Trechos de decisão de borda por limites quadrados | Navegação, caminhos e previsão de colisão com limite circular e obstáculos dinâmicos |
| view/rig.js | Rig acompanha câmera e já tem zoom e foco em lutadores | Adicionar oclusão com transparência e enquadramento vertical |
| ui/tuning.js | Catálogo, abas, ajustes e presets | Aba Mapa e estado de configurações visuais imediatas versus estruturais futuras |
| ui/input.js | Entradas existentes de teclado e outras ações | Inserir salto por Espaço sem mudar demais comandos ou reabrir dispositivos fora de escopo |

**[PROPOSTA TÉCNICA]** Antes de escrever código, nova auditoria de diferenças entre main remota e pasta local oficial é mandatória. Nenhuma das linhas desta tabela constitui evidência de feature nova já funcional.

### J. Matriz mínima de aceitação e regressão — testes A REALIZAR

| ID | Cenário | Condição observável exigida |
| --- | --- | --- |
| MAP-T01 | Geração da arena | Raio 50 m e limite circular; sinalização visual e física coerentes |
| MAP-T02 | Seeds repetidas | Mesma seed e estado inicial geram mesmas posições, categorias e sequência de eventos |
| MAP-T03 | Conteúdo inicial | 4 destrutíveis, 4 indestrutíveis, 2 plataformas, 2 itens e 2 lutadores opostos, todos válidos |
| MAP-T04 | Geração sem espaço | Ponto mais próximo válido usado; ausência total de espaço adia criação sem sobreposição |
| MAP-T05 | Colisão em alturas diferentes | Só volumes 3D que se tocam produzem dano/contato |
| MAP-T06 | Salto e borda de plataforma | Salto 2 m, impulso aéreo preservado, queda balística, pouso físico e intervalo 0,25 s |
| MAP-T07 | Dano contra destrutível | HP/categorias respeitados, bônus Ataque aplicado, projétil consumido ao destruir bloqueador |
| MAP-T08 | Impacto do lutador com destrutível | Danos a objeto/lutador, impulso interrompido mesmo após quebra do objeto |
| MAP-T09 | Respawn | Tempo 15–30 s, nova posição válida, prévia translúcida antes do colisor sólido |
| MAP-T10 | Drop em altura | Nascimento na posição de quebra e queda física até superfície válida |
| MAP-T11 | Capacidade de geração regular | Suspende com 4+ itens inclusive drops excedentes; retorna quando abre vaga |
| MAP-T12 | Coleta por disputa | Volume esférico 3D; desempate determinístico; KO não recebe item |
| MAP-T13 | Vinte estágios máximos | Quatro por categoria; sem status artificial de duração; zeram ao fim da luta |
| MAP-T14 | Buffs no momento da coleta | Cooldown já em andamento e velocidade aérea já em curso não mudam |
| MAP-T15 | Cura parcial com excedente | HP respeita máximo e apenas pontos excedentes viram escudo |
| MAP-T16 | Escudo contra golpes, DOT e ambiente | Dano bruto passa pelo escudo, excedente é mitigado pela Defesa, impulso não bloqueado |
| MAP-T17 | Escudo reaplicado | Capacidade somada até teto configurável; tempo retorna a 10 s |
| MAP-T18 | Progressão total e stamina cheia | Recuperação especial de stamina; se cheia, conversão em escudo |
| MAP-T19 | Pausa, hitstop e fim de luta | Temporizadores de escudo, itens e reaparecimento não avançam |
| MAP-T20 | IA e cenários dinâmicos | Desvia, usa cobertura, itens e plataformas, recalcula após alterações de objetos |
| MAP-T21 | Câmera e HUD | Transparência de oclusores, foco vertical, zoom por distância e indicadores configuráveis |
| MAP-T22 | Ajustes na mesma luta | Visual muda imediatamente; estrutura/geração só no próximo início |
| MAP-T23 | Save e replay | Estado de RNG, itens, estágios, escudo, objetos e timers preservado e reprodutível |
| MAP-T24 | Desempenho | Medição real de FPS/frametimes em 1080p, simulação 120 Hz, hardware de referência registrado |

**Nota de honestidade:** os 24 itens acima são *casos previstos* de validação. **Nenhum deles foi executado** para esta especificação. Aprovação de requisito não equivale a prova de qualidade, implementação ou desempenho.

### K. Plano técnico de execução futuro (PROPOSTA, NÃO AUTORIZADO)

1. Auditar checkout local oficial, status Git, diferenças para main e invariantes/testes já existentes; não sobrescrever alterações paralelas.
2. Construir camada geométrica circular, colisões 3D reais, plataformas e validação de posições. Testar antes de introduzir consumíveis.
3. Integrar objetos persistentes, destruição, reaparecimento e drops; registrar eventos determinísticos.
4. Introduzir pulo independente com Espaço, preservar vault/esquiva preexistentes, aterrissagem física e gravidade parametrizável.
5. Integrar itens, geração, coleta esférica, estágios permanentes, stamina, cura e conversão de itens no máximo.
6. Centralizar o pipeline de escudos, dano periódico/ambiental, Defesa, empurrão e atribuição de derrota.
7. Integrar IA adaptativa, câmera, HUD e aba Mapa com separação de parâmetros efetivos/pendentes.
8. Executar matriz MAP-T01–T24, regressão do combate anterior, testes no navegador e medição de FPS/frametime no hardware escolhido; documentar resultados reais, falhas e desvios antes de solicitar aprovação.

**Não bloquear a especificação por lacunas numéricas em parâmetros já declarados configuráveis.** Não atribuir valor oficial ao intervalo “recentemente” da R11.2, ao teto de escudo ou ao multiplicador inicial de resistência sem decisão. Se a implementação revelar uma divergência de comportamento que não pode ser resolvida a partir das escolhas anteriores, trazer **somente essa divergência** ao usuário, sem reiniciar questionários ou alterar decisões silenciosamente.


## Changelog do registro

- **Criação inicial:** Rodadas 1–8 completas (117 perguntas e escolhas), texto de observação da R4, Rodada 9 pendente (16 perguntas e todas as alternativas), índice de decisões, substituições e pendências. Nenhum código alterado por esta documentação.

- **Atualização após Rodada 9:** 16 decisões adicionadas (R9.1–R9.16), todas as alternativas apresentadas mantidas; total 133 decisões aprovadas de Rodadas 1–9; Rodada 10 incluída como questionário pendente de 16 perguntas. R9.14 continua sem identificação do botão de gamepad. Nenhum código alterado.

- **Ajuste de escopo após Rodada 9 (ordem expressa do usuário):** desconsiderar gamepad na especificação do mapa e em perguntas futuras. Questão originalmente R10.1 foi cancelada sem resposta e preservada em seção histórica; substituída por questão de tolerância do lock-on. Itens históricos R1.10/R2.1/R7.3/R9.14 preservados com prevalência da nova diretriz. Requisito de testes de gamepad da R9.15 retirado, permanecendo os demais testes. Nenhum código foi modificado.

- **Revisão de qualidade do questionário da Rodada 10:** após o usuário apontar repetições, realizada auditoria das Rodadas 1–9. As 16 perguntas pendentes originais foram arquivadas sem resposta; Rodada 10 ativa substituída por 10 perguntas genuinamente não resolvidas (escudo, defesa cumulativa, itens com barras cheias, K.O. no mesmo passo, ausência de local válido, efeitos de destruição e coleta em voo). Nenhuma decisão R1–R9 foi alterada e nenhum código foi modificado.

- **Rodada 10 revisada aprovada:** 10 decisões (R10.1–R10.10) incorporadas, todas alternativas originais revisadas mantidas, total 143 respostas aprovadas. Rodadas 1–9 preservadas byte a byte. A versão original redundante da Rodada 10 continua arquivada como não respondida. Próxima rodada só após auditoria de redundância. Exclusão do gamepad mantida. Nenhuma implementação de código.

- **Preparação da Rodada 11:** nove perguntas ainda não respondidas registradas no mesmo arquivo após auditoria de redundância; cada uma vinculada a IDs anteriores para explicar a diferença. Rodadas 1–10 preservadas, total de decisões aprovadas continua 143. Não implica autorização para implementação.

- **Rodada 11 aprovada:** 9 decisões (R11.1–R11.9) incorporadas, total **152 respostas aprovadas**; alternativas originais preservadas e auditoria de pendências classificada. Rodadas 1–10 inalteradas no texto de perguntas/respostas. R11.2 mantém termo «recentemente» sem número inventado. Nenhum código alterado.

- **Especificação técnica V1 (2026-10-16):** síntese das 152 respostas aprovadas, separando decisões, propostas técnicas e lacunas; mapeamento de módulos reais, matriz de 24 casos de aceitação e plano futuro, sem alterar código ou decisões de rodada. Inspeção da main em b8aeec6e8b6794894c010b9a8f194bf48615bb7f.

- **Decisão visual (2026-10-21):** o usuário escolheu, no laboratório `prototypes/hud-consumiveis/` (`docs/HUD_CONSUMIVEIS_LAB.md`), o **HUD A · Banco de Células** (progressão dos 5 atributos, estágios 0–4) e a **coleção A · Gemas Facetadas** (7 consumíveis em 3D) e pediu o **cenário "Laboratório técnico"** do laboratório também no jogo, com alternância para o visual clássico. Complementa R5.12 (cor, forma e símbolo próprios por categoria) e R8.12 (indicadores flutuantes); não altera nenhuma regra. As cores, formas e símbolos de cada tipo passam a ser os da coleção A. Integrado ao jogo principal em Visualizar (HUD, consumíveis, cenário). As propostas B e C do laboratório continuam disponíveis só no laboratório.
