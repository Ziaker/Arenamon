# PROMPT PARA CODEX — IMPLEMENTAR EMERGING STONE (MUSHROOM, MOVE 1)

> **STATUS DESTE DOCUMENTO: PRONTO PARA ENVIO A UM AGENTE; IMPLEMENTAÇÃO NÃO INICIADA NESTA ORGANIZAÇÃO.**  
> **Última decisão de design aprovada:** ES-D103, **cronologia C**.  
> **Contrato canônico:** [`docs/MUSHROOM_MOVES_DECISOES.md`](../MUSHROOM_MOVES_DECISOES.md), IDs **ES-D01–ES-D103**, seção **7.21** e diretiva universal de cobrança.  
> **Repositório:** `Ziaker/Arenamon`. Workspace oficial documentado em `AGENTS.md`.  
> **Aviso:** a cópia deste prompt em uma conversa com o agente serve para pedir a execução **naquele momento**; a mera criação do arquivo neste PR não autoriza alterar o gameplay agora.

## INÍCIO DO PROMPT A SER ENVIADO

Você é o agente responsável pela **implementação integral, verificável e jogável** do golpe **Emerging Stone** (Move 1 de **Mushroom**) no jogo de combate 3D Arenamon. Sua missão é realizar a implementação real e integrada, nunca uma simulação, demonstração isolada ou resposta especulativa.

**Antes de escrever uma linha de código, faça auditoria de leitura do repositório oficial** e leia **integralmente**:
- `AGENTS.md`, `README.md`, `prototypes/combat-lab/MOVIMENTOS.md` e a implementação atual de `prototypes/combat-lab/src/`;
- **todo** `docs/MUSHROOM_MOVES_DECISOES.md`, com foco no **Emerging Stone e ES-D01–ES-D103**, **incluindo as 17 rodadas, ES-D103 e precedências mais recentes**;
- `docs/MOVES_DECISOES_RODADAS.md` para contratos transversais, `docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md` para arena/plataformas, `docs/MOVES_TEST_MATRIX.md` e os testes, física, world, UI, VFX, estado e renderização atuais;
- histórico e implementação de Reflect/Psyshock, **somente para aprender o padrão de integração sem importar mecânicas incompatíveis**, e código existente de Tackle para física/acerto, não para atribuir Power Level ao Emerging Stone.

A especificação aprovada prevalece sobre conveniência do código, suposições da IA ou documentação histórica superada. **Uma decisão antiga marcada como pendente não se sobrepõe a ES-D103 nem a decisões posteriores**. Não reescreva o catálogo de decisões, nem “resolva” lacunas escolhendo por conta própria valores de gameplay. Se uma restrição do motor impedir o contrato, mostre o trecho concreto, proponha solução que o respeite e implemente a solução não controversa. Peça decisão ao diretor **apenas diante de contradição realmente insolúvel que exija nova regra**, e não sobre mecânicas óbvias de gravidade, plataformas, colisão, transição de estado, atualização de apoio e outras consequências físicas já inerentes ao motor. **Nunca pergunte outra vez quando cobrar recursos.**

### 1. Integração e limites

- Integrar Emerging Stone **no mesmo Combat Lab e pipeline de movimentos do jogo atual**, usando as APIs e convenções que realmente existirem em `src/sim/`, `src/ui/`, `src/view/`, testes e `config`. **Não criar um segundo motor**, física fictícia, colisores apenas visuais, outro jogo ou uma prova HTML desconectada.
- Respeitar a simulação determinística/step fixo existente (o laboratório usa, conforme seus documentos, **120 Hz**); validar esse dado no código atual antes de assumir. Respeitar pausa, reinício de rodada, replay, save/load, IA, status, lock-on, camera, HUD e gerenciamento de entidades quando aplicáveis.
- Criar o registro/slot do Move 1 do Mushroom **somente depois de auditar a identidade `Mushroom` ↔ `Mosh` no código e no roster**: a equivalência não foi homologada expressamente no catálogo. Não renomear automaticamente personagem, asset, slots ou outros moves; documentar a solução mínima compatível com a identidade atualmente carregada.
- **Não implementar nem modificar os outros moves** (Bullet Punch, Sand Wave, Body Slam, Quick Attack, Swift, Harden, Spikes, Bounce, Reflect, Psyshock), exceto adaptação genuinamente compartilhada e comprovada necessária, sempre protegida por testes de regressão.
- A implementação deve funcionar em **3D real**, com corpos físicos/colliders, normais de apoio, plataformas inclinadas/móveis, paredes, tetos, buracos, múltiplos suportes e entidades destruíveis, e não somente em X/Z de forma ilusória.

### 2. Máquina de estados do comando — ES-D103, opção C OFICIAL

**Este é o fechamento definitivo da única cronologia que estava pendente. B está rejeitada.**

1. **Pressionar** o botão inicia imediatamente o **cast físico de 0,55 s** (`Normal Cast`). Não converter esse golpe para `Charge` e **não debitar stamina/cooldown ao pressionar**.
2. O marcador de destino pode continuar sendo ajustado enquanto o botão estiver pressionado, sujeito às regras de validade, alcance e suporte aprovadas.
3. **Disparar só depois de ambas as condições ocorrerem**: cast de 0,55 s concluído **E** botão solto com destino confirmado. Se soltar antes dos 0,55 s, completar o tempo restante; se completar o tempo antes da soltura, aguardar a soltura. **Não reiniciar o cast na soltura nem disparar por completar o cast enquanto o botão continua segurado.**
4. **Regra universal de custo aprovada:** para **todo move não-Charge**, recursos e cooldown são cobrados **após confirmar alvo/destino e soltar o botão, na preparação e antes do disparo**. Para **Charge**, apenas como exceção global, cobram-se na ativação da carga. O Emerging Stone consome **3 stamina** e inicia cooldown de **9 s**. A cronologia C **não** antecipa a cobrança para a pressão inicial. Em interrupção após cobrança, **não reembolsar**.
5. Na mira, aplicar deslocamento de acordo com as condições existentes; **durante o cast ativo de 0,55 s a velocidade de Mushroom é 30% da velocidade normal**. Quando mira e cast coincidirem, a limitação do cast prevalece. Não inventar lentidão extra após acabar o cast se a mira ainda estiver aberta.
6. Pode iniciar no **chão ou no ar**, mas **precisa estar apoiado ao concluir os 0,55 s**; caso contrário cancela. **Perder contato com apoio existente durante o cast também cancela**. Não cancelar cast iniciado no ar *só por ter iniciado no ar*. Resolver isso por detecção real de transições de apoio, não `grounded` artificial.
7. Interrupção antes do disparo cancela; manter debitação ou não conforme custo **efetivamente cobrado**, sem refazer a regra universal. Depois de disparar, Mushroom fica livre para **mover, atacar e defender** sem precisar aguardar detonação. O projétil prossegue independentemente do lançador.

**Teste obrigatório em milissegundos/ticks:** solte antes de 0,55 s, solte depois de 0,55 s, segure prolongadamente, confirme marcador inválido, morra após disparo, seja interrompido antes/depois da cobrança, inicie cast no ar e pouse antes do término, pouse e volte a perder apoio, sofra perda de plataforma durante cast. Nenhum desses casos pode duplicar cobrança, disparo ou lançamento.

### 3. Marcador de mira e telegraph

- Controle direcional do marcador independente da orientação corporal de Mushroom. Alcance selecionável **3–10 m de distância tridimensional**, inclusive diferença de altura: nem somente distância horizontal nem distância percorrida sobre o solo.
- Enquanto mira, marcador acompanha a **plataforma móvel** escolhida. Se plataforma desaparecer **antes de confirmar**, conserva a **última posição válida em coordenadas do mundo**, mas continua sujeito à faixa de alcance no instante da confirmação.
- Se Mushroom se mover e destino sair da faixa, **marcador não muda de posição**, fica **vermelho/inválido para o jogador** e **não permite confirmação** até voltar à faixa; não teleportar marcador para o limite.
- Ao confirmar, destino **fica fixo em coordenadas do mundo**; plataforma continuar se movendo, desaparecer ou ser destruída não desloca o destino após confirmação. A explosão ocorre na posição confirmada mesmo sem a plataforma; o surgimento da rocha ainda requer posição física válida.
- **Adversários não enxergam o marcador durante mira**. Da confirmação **até detonar**, enxergam o ponto **mesmo através de paredes/obstáculos**. O jogador precisa de feedback legível para alcance e invalidade, sem introduzir informações ocultas contrárias a isso.
- Preparar teste com plataforma em movimento em todos os três momentos: ajuste, confirmação e percurso do projétil.

### 4. Projétil subterrâneo real na lógica, virtual na travessia

- Origem é a **posição real atual de Mushroom no instante de disparo**, nunca a posição antiga do início da mira/cast. Velocidade **15 m/s**, caminho em **linha reta virtual** até o marcador, inclusive se a origem estiver sobre plataforma elevada.
- Paredes/obstáculos/buracos/abismos **não interrompem nem desviam** o projétil; sem percurso curvo ou queda obrigatória até o solo. Rastro de terra aparece **somente onde o caminho realmente atravessa solo**, reaparecendo após lacunas. Em ar/vazio, não inventar terra material.
- **Rastro, detritos e trajetória não causam dano, contato ofensivo ou hit stun** antes da detonação. Não há Clash, efeitos por Power Level nem Reflect sobre o trajeto/explosão de Emerging Stone.
- Depois de disparado, persiste até detonar mesmo se Mushroom for derrotado **durante a mesma rodada**; mas **ao terminar a rodada**, remove-se imediatamente sem detonar posteriormente. Remover também VFX/marcador associados corretamente, sem entidades órfãs.
- Testar origens, distâncias e marcadores em superfícies elevadas, buracos e plataformas desaparecidas.

### 5. Detonação e elegibilidade de personagens

- Alcance contra personagens: **5 m de distância HORIZONTAL em relação à detonação, independente da diferença de altura**. Atingir todos os inimigos elegíveis **uma única vez por explosão**, inclusive através de paredes.
- Elegíveis **somente personagens fisicamente apoiados em superfícies sólidas no instante da detonação**, incluindo plataformas elevadas e topo de rochas; personagem no ar não sofre **dano da explosão**.
- Se a explosão destruir a própria plataforma do alvo: **avaliar apoio e aplicar o dano/knockback de explosão antes de remover a plataforma; depois perder apoio e cair por gravidade normal mantendo impulsos**.
- Dano nominal **20 de dano-base × atributo Ataque**, respeitando defesa e modificadores existentes, sem criar nova fórmula de dano. Lançamento horizontal radial para fora do centro com **velocidade inicial 8 m/s**.
- A **emergência física da rocha** é um evento distinto: aplicar **lançamento inicial horizontal 8 m/s e vertical 14 m/s** ao personagem que tiver **primeira interseção válida com o colisor progressivo já exposto**, uma única vez por personagem por emergência, **inclusive personagens aéreos**. Esse lançamento não significa que personagem aéreo recebeu o dano da explosão; **não aplicar dano extra de contato da rocha**.
- **Defesa mantida/perfeita não impede deslocamento físico pela rocha emergente**, mas as regras defensivas normais continuam aplicáveis ao **dano da explosão**, sem imunidades novas.
- Se lançado contra parede/teto, resolver a colisão sólida normal: **sem atravessar, ricochete obrigatório, dano ambiental extra ou knockback especial**.

### 6. Explosão contra cenário, destruição e restauração

- Destruir **objetos físicos do cenário** afetados pelo **raio HORIZONTAL de 5 m independente da altura**, incluindo paredes, obstáculos fixos e plataformas elevadas/móveis. **Se QUALQUER parte do volume físico de objeto tocar a área de destruição, destruir o objeto INTEIRO**, não apenas uma seção nem somente se seu centro estiver dentro.
- **Chão/terreno principal da arena e limites externos são indestrutíveis**. Não atribuir essa imunidade automaticamente às plataformas.
- Ordem de efeitos: **avaliar apoio dos personagens → aplicar efeitos válidos da explosão → destruir objetos atingidos (inclusive rochas) → criar nova rocha se houver lugar válido → aplicar limite de três rochas às remanescentes**. Não retirar a mais antiga antes de descobrir quais já foram destruídas pela explosão.
- Personagens em plataformas destruídas perdem apoio e **caem pela gravidade normal com knockbacks existentes**; sem teleporte, queda suspensa, dano adicional de desabamento nem criação de piso ilusório.
- Objetos estruturais do cenário destruídos **retornam somente na rodada seguinte**. Ao restaurar plataforma que interpenetre personagens, efetuar **despenetração mínima sem dano**. Não regenerar rochas invocadas.
- Poeira/fragmentos decorrentes da destruição são **apenas VFX, sem colisão ou dano**, removidos após o efeito breve. Não gerar detritos físicos temporários que atrapalhem movimentação.

### 7. Surgimento da rocha, geometria, colisão e física de apoio

- Prisma-base **3 × 3 × 3 m** em escala física real do motor, controle de **escala proporcional única de 0,25× a 4×**, com **passo 0,25×**, valor padrão **1×**. Preservar proporções, inclusive no collider, topo, base e alcance real.
- Para criar: **toda a base deve estar fisicamente apoiada em superfície sólida** e todo o volume precisa ficar **sem sobreposição com objetos sólidos sobreviventes** e dentro dos limites externos. Em rampa/escada/terreno irregular, orientar a base acompanhando **inclinação representativa dos pontos reais de apoio**, sem dispensar apoio integral; não resolver com um plano imaginário quando faltar geometria física.
- Se não couber no marcador, procurar **posição válida mais próxima** respeitando limites, apoio integral e ausência de sobreposição; **a explosão continua onde o marcador foi confirmado**, independentemente da posição alternativa da rocha. Se nenhuma posição válida existir, **explosão ocorre, sem rocha**.
- **Empilhamento permitido**, inclusive sobre rochas de **outro Mushroom**, com apoio integral da base da superior; rochas mantêm proprietário próprio e limite de três separadamente para cada invocador. Topo da rocha sólida permite **pousar, ficar de pé e saltar de novo**, inclusive durante emergência nas partes do topo já expostas; **não permite escalada terrestre pelas faces laterais**.
- Rocha leva **0,40 s para emergir**. Sua **colisão cresce progressivamente com a altura efetivamente exposta**, não com volume final instantâneo nem só ao fim. Partes expostas **podem ser atacadas desde o início** e topo exposto pode sustentar personagens acompanhando subida **sem dano extra**. A primeira interseção válida aplica lançamento **uma vez**, não continuamente por frame. Evitar penetrar personagens ou plataformas via animação sem resolução física.
- Cada rocha tem **5 HP**. Dano por hit válido que a atinja: **P0=1, P1=2, P2=3, P3=4 HP**; ataque **sem PL** é considerado **P0 SOMENTE para dano à rocha**, 1 HP por hit válido. **Cada hit realmente válido** de ataque multihit conta; não causar dano a cada frame apenas por overlap. Reflexão/Clash por PL não se aplicam ao Emerging Stone.
- Rachaduras progressivas e legíveis representam perda de HP, **sem diminuir colisor** nem alterar resistência real antes de 0. **Destruição imediata quando HP atinge zero**.
- **Até 3 rochas simultâneas por Mushroom**, criação da quarta destrói a mais antiga **dentre as que sobraram depois da detonação**. Duração sem timeout **durante a rodada**, mas **todas removidas ao fim da rodada**, inclusive após KO do lançador; KO não as destrói antecipadamente.
- Rocha sobre plataforma móvel **acompanha fisicamente os movimentos da plataforma**. Se em direção a parede indestrutível ou borda externa, **parar o movimento da plataforma quando necessário para impedir penetração da rocha**; não teleportar/destruir arbitrariamente a rocha. Colisão lateral com personagem = **despenetração mínima, sem dano/knockback extra**, ressalvado único lançamento da emergência.
- Se apoio de rocha desaparecer (plataforma ou rocha inferior), **avaliar se toda a base ainda está sustentada por outros suportes**. **Se sim, rocha permanece. Se não, destruir imediatamente**, podendo propagá-lo pela pilha de rochas dependentes. Sem queda ou suspensão da própria rocha nessa situação. Personagens que estavam sobre rocha destruída **caem normalmente preservando impulsos**, sem lançamento, dano ou teleporte extra.

### 8. HUD, parâmetros e cenários rápidos de teste

- Adicionar controle acessível pela interface já existente, com destaque para **escala do prisma 0,25×–4×, passo 0,25×**, e todo parâmetro ajustável que o documento canônico exigir. Separar valores fixos aprovados de sliders propostos; **não inventar ranges ou defaults de sliders** que não estejam homologados.
- Capturar parâmetros na execução conforme contrato transversal atual; **mover slider durante projétil/rocha ativos não deve retroativamente alterar entidades existentes**. Novos usos capturam os valores vigentes.
- A interface deve mostrar estado de mira, invalidez/vermelho, cast, soltura, cooldown, stamina, quantidade de rochas, HP/rachaduras, status de apoio, fase de projétil, detonação e efeito de emergência. Não criar poluição visual fora da área adequada.
- Em **Cenários** do Combat Lab, adicionar presets de teste instantâneos que cubram os casos abaixo, incluindo visualização repetível e controles de seleção. Abertura de cenário não deve exigir terminal para o usuário.

### 9. Matriz mínima de regressão e testes automatizados

Implementar testes unitários/determinísticos e, quando cabível, testes de navegador, **além** dos testes existentes, para:

1. Cast C: pressionar, segurar e soltar **antes** de 0,55 s, **depois** de 0,55 s e exatamente na borda do tick; **um único disparo**, sem cast duplo.
2. Stamina 3 e cooldown 9 s cobrado somente após confirmação/soltura e antes do disparo; não cobrar antes da entrada autorizada; interrupção pós-gasto não reembolsa.
3. Cast iniciado aéreo, pouso antes do fim, falta de apoio ao fim, perda de apoio no meio e cast sobre plataforma destruída.
4. Mobilidade 30% enquanto o cast está ativo; recuperação de controle completo após disparo.
5. Movimento de Mushroom enquanto mira; marcador fora do alcance fica no lugar e inválido/vermelho; sem confirmação indevida.
6. Distância do marcador em 3D, incluindo diferença vertical e limites 3/10 m exatos.
7. Plataforma móvel seguindo marcador na mira; perda da plataforma antes e após confirmação; marcador confirmado imóvel no mundo.
8. Ocultação para adversário durante a mira e visibilidade após confirmação **através** de parede até detonação.
9. Projétil nasce onde Mushroom realmente está no disparo; deslocamento reto 15 m/s; atravessa buracos, paredes e plataformas; rastro só em solo e **sem dano de trajeto**.
10. KO depois de disparar não cancela, mas fim de rodada remove projétil e marcador **sem detonação tardia**.
11. Explosão de 5 m **horizontais** independente da altitude; alvo apoiado na plataforma recebe dano uma vez; alvo aéreo **não recebe** dano da explosão.
12. Suporte de plataforma destruída: elegibilidade e dano antes de destruir; queda normal após; preservar knockback.
13. Cenário destrutível por **qualquer interseção de volume** com cilindro horizontal de 5 m; exceções para piso principal e paredes externas.
14. Restauração apenas na rodada seguinte, despenetração mínima de personagens sobrepostos, sem regenerar rochas.
15. Explosão mantém posição original mesmo se rocha procurar lugar livre; explosão sem rocha se não houver posição válida.
16. Prisma em rampas, degraus, plataformas estreitas, superfícies multi-inclinadas e bordas; **apoio integral** e orientação representativa.
17. Escala proporcional 0,25×/1×/4× refletida em malha, colisão, altura do salto, topo e detecção de espaço.
18. Rocha empilhada em própria rocha e rocha de adversário; propriedade e três rochas por invocador independentes.
19. Sobreposição com objeto sobrevivente: procurar lugar válido; não destruir obstáculo fora do alcance.
20. Emergência 0,40 s, collider e topo progressivos; ataque à parte exposta; invulnerabilidade inexistente; morte da rocha durante a emergência.
21. Lançamento da primeira interseção válida **uma vez só** a 8 m/s horizontal e 14 m/s vertical, inclusive aéreo; sem acerto extra da explosão.
22. Defesa mantida/perfeita não permite atravessar rocha nem suprimir deslocamento físico aprovado; defesa da **explosão** ainda segue sistema normal.
23. Aterrissar, permanecer, saltar e pular por cima do topo sem escalada lateral; sustentação durante subida.
24. Choque do lançado contra teto/parede sem novo dano ou ricochete especial.
25. A rocha suporta e se move com plataforma móvel, barra seu avanço se houver parede indestrutível; despenetração mínima de personagens, sem dano no contato lateral.
26. Dano por PL P0–P3 e ausência de PL tratado como P0 só para rocha; multihit conta hits válidos e não frames de contato.
27. Rachaduras e HP coerentes, collider sem shrink antes do zero; eliminação ao zerar.
28. Explosão elimina rochas antigas **antes de criar nova e aplicar limite de três**; sem remoção antecipada desnecessária.
29. Destruir apoio inferior causa cascata **somente nas rochas efetivamente sem suporte integral**; suporte múltiplo remanescente conserva rocha.
30. Personagem sobre rocha destruída cai com gravidade, sem teleporte nem knockback novo.
31. KO não remove rochas antecipadamente; fim de rodada remove **todas**, sem VFX/colisores residuais.
32. Reprodução determinística de mesmo cenário/seed e recuperação de save/load/rollback onde o motor suportar isso.
33. Regressões de **Tackle, Dodge, Guard, Perfect Guard, Reflect, Psyshock, plataformas, câmera, IA, multiplayer local, replay, controles, cenários e HUD**: não introduzir mudanças silenciosas.

Asserções devem testar posição, velocidade, altimetria, contato, suporte, HP, propriedade, ordem de eventos, tempo de tick e estado visual, **não apenas ausência de exceptions**. Validar em 120 Hz se essa for a frequência atual do motor, com tolerância numérica explicada. Para qualquer regra comprovadamente impossível de testar no browser atual, descrever a limitação concreta em vez de afirmar sucesso.

### 10. Entrega, testes e aceitação

1. Trabalhar conforme `AGENTS.md`, sem tocar o checkout oficial ocupado por outro agente, sem apagar alterações locais nem criar clones/worktrees permanentes fora do local oficial.
2. Criar branch/PR e commits rastreáveis. Implementar mudanças apenas após auditoria, com testes determinísticos antes de declarar funcionalidade pronta.
3. Atualizar `prototypes/combat-lab/` e o painel de **Cenários**, com controles adequados, portal `ABRIR_ARENAMON.html` e documentação de código/limitações.
4. Rodar `npm run build:combat-lab`, testes específicos de combate, navegador e `npm run verify` conforme as exigências do repositório; declarar os números reais de testes e distinguir **não executado** de **passou**. Acesso final pelo jogo/atalho oficial, sem exigir CMD para quem vai experimentar.
5. Incluir no relatório final uma **matriz ES-D01–ES-D103** cruzando cada decisão com arquivo/função implementada, cenário automático e evidência de validação; indicar literalmente qualquer ponto não cumprido ou interpretação que exija nova decisão. Provar também que a diretriz universal de cobrança permaneceu idêntica.
6. **Não afirmar que “está pronto” somente porque compila**. Critério de conclusão: interação jogável realmente funciona em cenários 3D com saltos, inclinações, bordas, plataformas móveis, destruição/restauração, suporte múltiplo, knockback, colisores dinâmicos, animação progressiva, cobrança e rollback onde pertinente.
7. Disponibilizar ao usuário o link do PR, o commit, os arquivos realmente alterados e o HTML já recompilado para testar. **Não promover para `main` nem afirmar homologação do golpe sem aprovação explícita do diretor** se esta for a política de trabalho vigente.

**Não pergunte como cobrar recursos. Não simplifique física 3D para um plano 2D. Não invente mecânicas óbvias ausentes da simulação. Não mexa em outros moves por conveniência. Não entregue código sem teste e evidência.**

## FIM DO PROMPT

**Observação do arquivista:** este arquivo é um **brief de execução futura**, não código e não documentação de uma implementação já realizada. Para decisões vigentes e precedências exatas, consultar a fonte integral [`../MUSHROOM_MOVES_DECISOES.md`](../MUSHROOM_MOVES_DECISOES.md). Em caso de diferença, prevalecem a escolha direta **C (ES-D103)** e as 103 regras registradas, não formulações resumidas acima.
