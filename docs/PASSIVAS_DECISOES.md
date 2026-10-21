# Arenamon — Decisões oficiais sobre habilidades passivas

> **Situação:** design em discussão. Este arquivo registra decisões explícitas do diretor; não autoriza implementação, balanceamento ou alteração das regras de combate existentes.
>
> **Repositório:** `Ziaker/Arenamon` · **Registro iniciado:** 2026-10-19.

## Rodada 1 — Disponibilidade e seleção (aprovada)

1. Todos os personagens têm acesso a um conjunto de **habilidades passivas genéricas**, disponível para seleção no pré-jogo.
2. Cada personagem possui **exatamente duas habilidades passivas únicas e próprias**, também disponíveis para seleção no pré-jogo.
3. O jogador pode **equipar somente duas passivas no total por partida**, escolhidas entre as genéricas e as duas únicas do personagem.
4. As combinações permitidas são:
   - duas passivas genéricas;
   - uma passiva genérica e uma passiva única;
   - as duas passivas únicas do personagem.
5. Não é obrigatório equipar qualquer passiva única. Não se pode ultrapassar o limite de duas passivas equipadas.

## Rodada 2 — Categorias de funcionamento (opção D aprovada)

O sistema admite tipos diferentes de passivas, conforme a definição individual de cada habilidade:

- **Permanente:** produz um efeito contínuo enquanto estiver válida.
- **Condicional:** produz um efeito quando a condição especificada for satisfeita.
- **Automática com cooldown:** é disparada automaticamente por um evento definido e fica sujeita a recarga.

**Nota de escopo:** a opção D aprova a coexistência desses tipos no sistema; não fixa valores, condições, durações, cooldowns nem determina se uma mesma passiva poderá misturar diferentes tipos de funcionamento.

## Rodada 3 — Interação com estados de combate (opção C aprovada)

- O funcionamento das passivas é **individualizado**.
- Cada passiva especificará em quais estados de combate pode funcionar, ser ativada ou permanecer suspensa.
- **Não existe, por esta decisão, uma suspensão global automática de todas as passivas** em estados como hit stun, guard stun, esquiva ou interrupções.
- A interação efetiva com cada estado será definida para cada passiva, sem presumir imunidades, exceções ou efeitos não aprovados.

## Rodada 4 — Disponibilidade das passivas genéricas (opção A aprovada)

- **Todas as passivas genéricas estão liberadas desde o início do jogo.**
- Todas podem ser selecionadas no pré-jogo, respeitando o limite geral de **duas passivas equipadas** e as demais regras aprovadas.
- Não é necessário desbloquear passivas genéricas por progressão, conquistas ou desafios.
- Esta decisão **não define** quais serão as passivas genéricas nem suas características ou quantidades.

## Rodada 5 — Duplicatas no equipamento (opção A aprovada)

- **Não é permitido equipar duas cópias da mesma habilidade passiva.**
- Os dois espaços de equipamento devem conter **habilidades passivas diferentes**.
- A proibição aplica-se tanto às passivas genéricas quanto às passivas únicas do personagem, sem exceções aprovadas.
- Permanecem válidas as combinações da Rodada 1 e o limite de duas passivas equipadas no total.

## Rodada 6 — Momento de seleção e troca das passivas (opção A aprovada)

- As **duas passivas são selecionadas exclusivamente antes do início da partida**, durante a preparação pré-jogo.
- A combinação de passivas equipadas **permanece fixa durante toda a partida**.
- **Não é permitido substituir passivas durante o combate**, nem em eventuais intervalos ou transições que pertençam à mesma partida.
- O jogador poderá escolher outra combinação **na preparação da partida seguinte**, respeitando as regras de disponibilidade, quantidade e proibição de duplicatas já aprovadas.
- Esta decisão não define a interface de seleção nem os demais detalhes de implementação.

## Rodada 7 — Acúmulo dos efeitos de passivas (opção A aprovada)

- Quando **duas passivas diferentes equipadas** concedem benefícios compatíveis sobre o mesmo atributo ou efeito de combate, **esses benefícios são somados diretamente (acúmulo aditivo)**.
- Benefícios compatíveis não são combinados por multiplicação sequencial e não se descarta o menor benefício apenas por incidirem sobre o mesmo atributo.
- Esta regra de acúmulo não modifica o limite de duas passivas, a proibição de equipar duplicatas nem os critérios individuais de ativação e suspensão já aprovados.
- **Escopo ainda indefinido:** valores, base de cálculo de bônus percentuais, arredondamento, limites máximos, interação com buffs/debuffs de outras fontes, precedência entre efeitos incompatíveis e fórmulas específicas permanecem sujeitos a decisões posteriores. Não presumir fórmulas ou exceções.

## Rodada 8 — Interação das passivas com modificadores externos (opção A aprovada)

- Fica aprovado o **acúmulo aditivo universal** dos modificadores **compatíveis** que incidam sobre o mesmo atributo ou efeito de combate, **independentemente da origem**.
- A regra inclui os efeitos das passivas equipadas e os modificadores externos, como **buffs, debuffs, efeitos de golpes e benefícios coletados na arena**, quando incidirem sobre o mesmo atributo e forem compatíveis.
- Modificadores positivos e negativos compatíveis entram na mesma soma; por exemplo, bônus de +10% e +15% com penalidade de -5% correspondem a um modificador líquido de **+20 pontos percentuais**, desde que usem a mesma base de cálculo.
- Não separam-se camadas multiplicativas apenas por causa da origem do modificador; tampouco um efeito temporário substitui automaticamente o efeito de uma passiva apenas por agir sobre o mesmo atributo.
- **Permanece indefinido:** a base numérica de referência para percentuais, a ordem de aplicação entre modificadores de unidades diferentes, os limites e arredondamentos, além das interações entre efeitos incompatíveis. A aprovação desta rodada não altera mecanismos já aprovados de duração, ativação, suspensão ou expiração dos efeitos.

## Rodada 9 — Base de cálculo dos modificadores percentuais (opção A aprovada)

- **Todos os modificadores percentuais compatíveis de um atributo usam como referência o atributo-base original do personagem, antes da aplicação dos modificadores.**
- Os bônus e as penalidades percentuais compatíveis são **somados entre si**, conforme as Rodadas 7 e 8, e sua soma é aplicada **uma única vez sobre o atributo-base**.
- Os modificadores **absolutos** (em unidades do atributo, não em %) são **somados separadamente** e não são ampliados pelos percentuais.
- Para modificadores compatíveis expressos nestas duas categorias, a relação aprovada é: **valor resultante = atributo-base + (atributo-base × soma algébrica dos percentuais) + soma algébrica dos modificadores absolutos**; os percentuais são convertidos para fração decimal nessa expressão.
- **Exemplo ilustrativo:** velocidade-base de 100 unidades, bônus percentuais combinados de +20% e bônus absoluto de +30 unidades resultam em **150 unidades**, e não em 156.
- **Não definido nesta rodada:** valores ou definição específica de cada atributo-base no sistema, limites mínimos/máximos, arredondamentos e resolução de efeitos incompatíveis ou de natureza diversa. Não presumir novas regras para esses casos.

## Rodada 10 — Limites adicionais dos atributos modificados (opção A aprovada)

- **Não serão introduzidos novos limites mínimos ou máximos para atributos em decorrência do sistema de passivas ou do acúmulo aditivo aprovado nas Rodadas 7–9.**
- A soma dos modificadores compatíveis poderá produzir o valor resultante de acordo com a fórmula aprovada, **respeitando exclusivamente as restrições já existentes e aplicáveis às mecânicas do jogo**.
- Não se cria, por esta decisão, um teto universal de bônus, um limite da soma dos modificadores, nem novos limites individuais por atributo ou por efeito.
- A decisão **não revoga limites já existentes**, nem aprova mudanças em velocidade, defesa, dano, recuperação, cooldowns ou qualquer outra mecânica específica.
- **Continuam pendentes** regras de arredondamento, tratamento de unidades diferentes, efeitos incompatíveis e casos especiais não resolvidos pelas restrições preexistentes. Não introduzir implicitamente novos limites para esses casos.

## Rodada 11 — Precisão e arredondamento dos atributos (opção A aprovada)

- **Manter integralmente a precisão dos valores fracionários nos cálculos dos atributos modificados.** Não arredondar ou truncar automaticamente o valor resultante em cada etapa de cálculo ou ao combinar modificadores.
- **O arredondamento só ocorre quando uma mecânica específica ou a apresentação exigir valor inteiro**, respeitando a regra própria dessa mecânica ou apresentação. Esta decisão não cria método universal de arredondamento.
- A regra vale para o resultado dos modificadores percentuais e absolutos definidos nas Rodadas 7–9 e não introduz novos limites, conforme a Rodada 10.
- **Exemplo ilustrativo:** atributo-base 87 com modificador de +15% produz **100,05**; esse valor fracionário é preservado para cálculos subsequentes até que uma operação concreta exija representação inteira.
- **Continuam pendentes:** regras de arredondamento específicas para cada situação que exija inteiro, aspectos de representação numérica da implementação e tratamento de unidades/efeitos incompatíveis. Não alterar o funcionamento já aprovado de mecânicas particulares.

## Rodada 12 — Ativação simultânea de passivas (opção A aprovada)

- **As duas passivas equipadas são acionadas independentemente quando um mesmo evento de combate satisfaz os gatilhos de ambas**, desde que cada uma também cumpra seus próprios requisitos e restrições individuais de ativação.
- O acionamento de uma passiva **não impede automaticamente** o acionamento da outra apenas por terem sido disparadas pelo mesmo evento.
- A decisão **não estabelece ordem de resolução**, prioridade de processamento, precedência entre efeitos nem critérios para resolver conflitos ou alterações de estado causadas pelos efeitos ativados. Esses aspectos permanecem pendentes de aprovação posterior.
- Permanecem válidas a seleção fixa de duas passivas distintas (Rodadas 1, 5 e 6), as regras individuais de funcionamento por estado (Rodadas 2 e 3) e os princípios de combinação de modificadores aprovados nas Rodadas 7–11.
- Esta decisão **não autoriza implementação** nem define casos específicos de ativação de qualquer passiva.

## Rodada 13 — Resolução simultânea de passivas (opção A aprovada)

- Quando as duas passivas equipadas são acionadas por **um mesmo evento de combate**, seus requisitos e condições de ativação são **avaliados a partir do mesmo estado de referência desse evento**, sem prioridade de uma posição de equipamento sobre a outra.
- Os efeitos das passivas acionadas que sejam **compatíveis** são **aplicados conjuntamente**, em resolução simultânea, sem sequência privilegiada entre os dois espaços.
- Uma passiva **não perde seu acionamento apenas por um efeito da outra ser processado antes**, pois as condições de ambas se referem ao mesmo estado do evento.
- A resolução conjunta de modificadores compatíveis respeita o acúmulo aditivo e a base de cálculo já aprovados nas Rodadas 7–11, sem criar fórmulas adicionais.
- **Permanece pendente:** como resolver efeitos que sejam incompatíveis, mutuamente exclusivos ou que provoquem conflitos na atualização do estado. A opção A não define regras de desempate, prioridade entre efeitos incompatíveis, nem comportamento particular de passivas ainda não especificadas.
- Esta decisão mantém a ativação independente aprovada na Rodada 12, **sem autorizar implementação**.

## Rodada 14 — Resolução de conflitos entre passivas (opção C aprovada)

- **Conflitos entre efeitos de passivas simultaneamente acionadas serão resolvidos por regras específicas de cada combinação de efeitos incompatíveis.**
- **Não haverá uma prioridade global** entre categorias de efeitos, valores numéricos de prioridade atribuídos universalmente às passivas, nem desempate automático por posição no equipamento, decorrentes desta decisão.
- Quando uma combinação de passivas produzir efeitos incompatíveis, mutuamente exclusivos ou que disputem a mesma alteração de estado, **a regra dessa interação deverá ser definida e aprovada durante o projeto das passivas envolvidas**, antes de implementar tal combinação.
- **Não se aprova anulação mútua automática**, prevalência fixa de um efeito ou outro, nem resultados específicos para combinações ainda não definidas.
- **Efeitos compatíveis continuam seguindo a ativação independente e a resolução simultânea das Rodadas 12–13**, bem como as regras de acúmulo e cálculo das Rodadas 7–11.
- **Permanecem pendentes:** o catálogo das combinações incompatíveis, o resultado exato de cada conflito e o tratamento de eventuais interações novas ou não previstas. Nenhuma mecânica foi autorizada para implementação.

## Rodada 15 — Independência da recarga das passivas (opção B aprovada)

- **Passivas com cooldown possuem recarga independente da redução de cooldown aplicada às outras habilidades do personagem.**
- **Modificadores de redução de cooldown usados em outras habilidades não reduzem nem aceleram a recarga dessas passivas.**
- Os tempos de recarga e as condições de acionamento de cada passiva continuam sujeitos à sua definição individual; esta rodada não estabelece valores nem regras adicionais de início, pausa ou reinício de cooldown.
- Esta regra específica delimita a aplicação dos modificadores de cooldown e não altera o acúmulo aditivo universal **entre efeitos compatíveis** aprovado nas Rodadas 7–9, nem as demais decisões anteriores.
- **Não implementar** esta decisão antes de autorização específica.

## Rodada 16 — Início do cooldown das passivas (opção B aprovada; substitui a opção A enviada anteriormente)

- **O cooldown das passivas automáticas com recarga começa somente após o término do efeito produzido pela ativação**, e não no instante em que a passiva é acionada.
- Enquanto o efeito ainda estiver ativo, **a contagem do cooldown correspondente ainda não começou**. Assim, para uma passiva hipotética com efeito de 5 segundos e cooldown de 20 segundos, a recarga começa após os 5 segundos de efeito e termina 20 segundos depois, ressalvadas eventuais regras específicas já existentes de temporização.
- Esta decisão preserva a **independência da recarga das passivas** aprovada na Rodada 15: modificadores de redução de cooldown de outras habilidades não aceleram sua recarga.
- **Não definido nesta rodada:** como determinar o término em passivas de efeito instantâneo, efeitos permanentes ou sem duração definida; interações com término antecipado, interrupção, suspensão, KO, respawn ou reativação antes de terminar o efeito. Esses casos devem ser submetidos a decisões específicas, sem suposições automáticas.
- Esta é exclusivamente uma decisão de design; **não autoriza implementação** nem estabelece durações ou cooldowns concretos para qualquer passiva.

## Rodada 17 — Início da recarga após término antecipado do efeito (opção A aprovada)

- Se o efeito produzido por uma passiva com cooldown **terminar antes da duração originalmente prevista**, a contagem do cooldown **começa imediatamente no momento do término efetivo do efeito**.
- **Não se aguarda a duração originalmente planejada** para iniciar a recarga: o instante de referência é o término real, mesmo quando antecipado.
- Exemplo meramente ilustrativo: uma passiva com duração prevista de 5 segundos e cooldown de 20 segundos cujo efeito termine efetivamente após 2 segundos começa a recarregar no segundo 2 e, sem outras interferências, conclui a recarga no segundo 22.
- A regra detalha a Rodada 16 (cooldown iniciado ao término do efeito) e preserva a Rodada 15 (recarga independente dos modificadores de cooldown das outras habilidades).
- **Permanece indefinido** quais efeitos podem terminar antecipadamente, por quais causas e sob quais condições; esta decisão **não autoriza interromper, dissipar, cancelar ou remover** efeitos que não tenham essa possibilidade aprovada.
- Casos de efeito instantâneo, permanente, sem duração definida, suspensão sem término efetivo, KO/respawn e outras particularidades continuam pendentes, sem inferir soluções por analogia.
- Este registro é exclusivamente documental: **não autoriza implementar mecânicas**.

## Rodada 18 — Início do cooldown das passivas com efeito instantâneo (opção A aprovada)

- Para uma passiva automática com cooldown cujo **efeito seja instantâneo**, a recarga **começa imediatamente após a aplicação do efeito**, no próprio evento que acionou a passiva.
- **Não é necessário aguardar o término da ação de combate associada** ao evento para iniciar o cooldown quando o efeito instantâneo já tiver sido aplicado.
- Esta regra concretiza, para efeitos instantâneos, o princípio aprovado na **Rodada 16** (cooldown iniciado ao término do efeito) e é compatível com a **Rodada 17** (término efetivo, inclusive antecipado, como referência para o início da recarga).
- Continua válida a **Rodada 15**: a recarga da passiva não é acelerada pelos modificadores de redução de cooldown aplicáveis a outras habilidades.
- **Não definido nesta rodada:** duração numérica de qualquer cooldown, tratamento de acionamento cujo efeito seja impedido ou não aplicado, multiplicidade de efeitos instantâneos dentro de uma mesma ativação, ou regras para efeitos contínuos, permanentes ou suspensos. Nenhuma dessas situações deve receber uma regra por suposição.
- Esta decisão trata exclusivamente do início da recarga e **não autoriza implementação**.

## Rodada 19 — Comportamento da duração durante suspensão temporária (opção C aprovada)

- **Cada passiva define individualmente como sua duração se comporta durante uma suspensão temporária de seu efeito.** Não há regra global única que imponha a pausa ou a continuidade do cronômetro de duração para todas as passivas.
- Ao especificar cada passiva, deverá ser aprovado se, enquanto o efeito estiver suspenso, **(a)** o cronômetro de duração fica pausado, preservando o tempo restante para uma eventual retomada, ou **(b)** o cronômetro continua avançando, podendo chegar ao término durante a suspensão.
- A suspensão temporária de um efeito **não equivale automaticamente ao término efetivo**. O começo da recarga continua obedecendo às Rodadas 16–18: ocorre quando o efeito efetivamente termina, conforme as regras aprovadas aplicáveis a esse efeito.
- A escolha de pausar ou continuar a contagem **não determina, por si só, quando uma passiva é suspensa, quais estados provocam suspensão, nem as condições de retomada ou encerramento**. Essas definições permanecem individualizadas, de acordo com a Rodada 3.
- **Ainda não definidos:** quais passivas admitem suspensão, suas condições de retomada, seu comportamento em KO/respawn, o tratamento de efeitos permanentes ou sem duração e os respectivos efeitos na recarga quando aplicáveis. Não pressupor nenhuma dessas regras.
- Esta rodada registra exclusivamente a decisão de design: **não autoriza implementação**.

## Rodada 20 — Novo gatilho enquanto o efeito anterior permanece ativo (opção A aprovada)

- **Enquanto o efeito de uma passiva permanecer ativo, novos gatilhos dessa mesma passiva são ignorados.** A habilidade não se reativa em resposta a esses eventos.
- O novo gatilho **não reinicia nem prolonga a duração** do efeito em andamento e **não cria uma segunda instância** dele.
- A duração do efeito anterior **continua seguindo as regras que já lhe são aplicáveis**, incluindo a suspensão e o comportamento individual do cronômetro aprovados na Rodada 19, quando cabíveis. A presente decisão não reinicia a contagem.
- A passiva continua sujeita ao início do cooldown **no término efetivo do efeito**, conforme as Rodadas 16–18; ignorar um gatilho durante o efeito ativo não antecipa nem reinicia esse cooldown.
- A regra afeta **somente a reativação da própria passiva** e não impede a ativação independente de uma outra passiva equipada no mesmo evento, preservando as Rodadas 12 e 13.
- **Permanecem pendentes** as regras concretas de passivas cujo efeito esteja suspenso, permanente, instantâneo ou com término não definido, além de outros casos não cobertos pelo conceito de efeito anterior ativo. A Rodada 20 não presume condições de retomada nem altera as decisões individuais já aprovadas.
- Este registro é estritamente documental e **não autoriza implementação**.

## Rodada 21 — Continuidade do cooldown durante estados de combate (opção A aprovada)

- **Uma vez iniciada, a contagem do cooldown de uma passiva continua avançando normalmente durante todos os estados de combate do personagem**, inclusive estados que restrinjam suas ações, como hit stun e guard stun.
- **Entrar ou permanecer em um estado de combate incapacitante não pausa nem congela automaticamente a recarga** já iniciada, e sair desse estado não reinicia o cronômetro.
- A continuidade do cooldown **não autoriza a ativação da passiva em um estado no qual suas regras individuais proíbam o acionamento**. As condições de funcionamento por estado continuam sujeitas à Rodada 3.
- Permanecem preservadas as Rodadas 15–18: o cooldown da passiva é independente dos modificadores de recarga de outras habilidades e começa quando o efeito efetivamente termina, nos casos e condições já aprovados.
- **Não definido nesta rodada:** a contagem em KO e respawn, pausas globais do jogo, hitstop e situações especiais de paralisação do tempo que não sejam simplesmente estados de combate; tampouco se estabelecem regras novas para duração ou suspensão do efeito ativo, objeto da Rodada 19.
- Esta é exclusivamente uma decisão documental; **não autoriza implementação**.

## Rodada 22 — Zerar cooldowns das passivas no respawn (opção C aprovada)

- **Ao retornar à luta após um KO (no respawn), todos os cooldowns restantes das passivas equipadas são zerados.** A recarga pendente deixa de existir nesse momento.
- **As passivas ficam prontas para nova ativação no respawn**, mas somente podem ser acionadas quando seus respectivos gatilhos e demais condições individuais de funcionamento forem satisfeitos, conforme as Rodadas 2 e 3. **O respawn, por si só, não aciona automaticamente uma passiva.**
- A regra de zerar cooldowns no respawn é uma **exceção específica** à continuidade da contagem durante estados de combate aprovada na Rodada 21, sem revogar aquela decisão para os demais estados.
- Esta decisão **não estabelece se o cooldown continua avançando ou fica pausado durante o período de KO anterior ao respawn**: independentemente da contagem nesse intervalo, qualquer recarga ainda pendente é eliminada ao ocorrer o respawn.
- **Permanece pendente** o destino de efeitos de passivas que estejam ativos no momento do KO ou do respawn, bem como a interação desses efeitos com a regra da Rodada 20 (não reativar uma passiva enquanto seu efeito anterior permanecer ativo). A prontidão da recarga não substitui as restrições de acionamento já aprovadas.
- A decisão aplica-se exclusivamente aos cooldowns das passivas; **não altera cooldowns de golpes ou outras habilidades**, nem define sua duração, seus gatilhos, a ocorrência do respawn ou regras de KO.
- Esta rodada registra somente uma decisão de design e **não autoriza implementação**.

## Rodada 23 — Encerramento dos efeitos ativos das passivas ao ocorrer KO (opção A aprovada)

- **No momento em que o personagem sofre um KO, todos os efeitos ativos de suas passivas são encerrados imediatamente.**
- **Os efeitos encerrados pelo KO não são preservados, pausados para retomada nem continuam consumindo duração para retornar após o respawn.** O personagem retorna sem os efeitos que estavam ativos antes do KO.
- Esse encerramento é **um término efetivo do efeito** para os fins da regra de início do cooldown das Rodadas 16–17. Entretanto, **no respawn, todos os cooldowns restantes das passivas são zerados**, conforme a Rodada 22, independentemente do tempo transcorrido desde o KO.
- **O KO não remove nem troca as passivas equipadas** e não representa, por si só, novo gatilho de ativação no respawn. Permanecem válidas as restrições de seleção e acionamento das Rodadas 1–6 e 20–22.
- Esta decisão define o destino dos **efeitos ativos no instante do KO**. Permanecem pendentes as regras específicas de passivas permanentes ou condicionais que não produzam um efeito ativo temporário, assim como situações de suspensão prévia, pausas globais, hitstop e contagem do cooldown durante o intervalo entre KO e respawn.
- A decisão **não estabelece valores de duração nem novas regras de KO, respawn ou ativação**, e **não autoriza implementação de mecânicas**.

## Rodada 24 — Pausa do cooldown das passivas durante hitstop (opção A aprovada)

- **Quando ocorrer hitstop, a contagem do cooldown já iniciado de uma passiva fica pausada durante todo o intervalo de hitstop.**
- **Enquanto durar o hitstop, o tempo restante de recarga permanece congelado**; ao terminar o hitstop e a simulação ser retomada, o cooldown **prossegue do ponto em que estava**, sem reiniciar e sem descontar o intervalo interrompido.
- Esta decisão cria uma **exceção temporal específica para o hitstop** à continuidade da recarga durante os estados de combate, aprovada na Rodada 21. A recarga continua normalmente em estados como hit stun e guard stun quando não há hitstop.
- A regra afeta **somente a contagem do cooldown das passivas durante o hitstop**. Não estabelece se a duração dos efeitos ativos continua ou é pausada durante hitstop, nem determina gatilhos, novas ativações ou outros comportamentos de passivas nesse intervalo.
- Permanecem válidas a independência de cooldown da Rodada 15, as regras de início da recarga das Rodadas 16–18, o encerramento dos efeitos no KO da Rodada 23 e o zeramento dos cooldowns no respawn da Rodada 22.
- **Continuam pendentes** a contagem durante pausas globais do jogo e o período entre KO e respawn, além dos demais casos especiais ainda não aprovados. Esta rodada registra apenas a decisão de design e **não autoriza implementação**.

## Rodada 25 — Pausa da duração dos efeitos ativos durante hitstop (opção A aprovada)

- **Durante o hitstop, o cronômetro de duração de todos os efeitos ativos das passivas fica pausado.** Nenhum tempo de duração é consumido enquanto perdurar essa interrupção.
- **Ao terminar o hitstop e a simulação retomar**, a contagem da duração desses efeitos **continua a partir do tempo restante que havia antes do hitstop**, sem reinício, renovação ou extensão adicional além da pausa.
- Exemplo ilustrativo: uma proteção com **3 segundos de duração restante** ao começar o hitstop mantém esses **3 segundos restantes** até o fim da interrupção e somente então volta a consumir duração.
- A regra é **geral para a duração dos efeitos ativos** durante hitstop e complementa a Rodada 24, que já havia aprovado a pausa dos **cooldowns** das passivas nesse intervalo. Isso não altera a definição individual do comportamento da duração durante **outras formas de suspensão**, conforme a Rodada 19.
- A pausa do cronômetro **não determina, por si só, se o efeito permanece funcional durante hitstop**, se novos gatilhos são avaliados nesse intervalo ou se existem condições específicas de ativação e suspensão. Esses aspectos continuam pendentes e não devem ser presumidos.
- Permanecem válidas as regras anteriormente aprovadas de término de efeito, início do cooldown e KO/respawn. **Esta decisão é exclusivamente documental e não autoriza implementação.**

## Rodada 26 — Permanência dos efeitos ativos durante hitstop (opção A aprovada)

- **Durante o hitstop, todos os efeitos já ativos das passivas permanecem aplicados ao estado do personagem**, incluindo bônus, penalidades, proteções e demais modificadores em vigor. Eles não são removidos nem temporariamente suspensos apenas pela ocorrência do hitstop.
- **O estado dos efeitos já aplicados é preservado enquanto durar essa interrupção**, sem desaparecimento temporário ou necessidade de reaplicação quando o jogo retomar a simulação.
- Permanecem integralmente válidas as Rodadas 24–25: **o cooldown das passivas e os cronômetros de duração dos efeitos ativos ficam pausados durante hitstop** e retomam suas respectivas contagens com o tempo restante após a interrupção.
- A permanência dos efeitos **não significa que ocorram novos cálculos, ativações, gatilhos ou eventos de combate durante hitstop**. A possibilidade de novos gatilhos e a forma de processá-los nesse intervalo **continuam pendentes**, sem autorização para presumir seu funcionamento.
- Esta decisão **não substitui regras específicas de KO, respawn, término real de efeitos ou suspensões por outras causas**, preservando as Rodadas 3, 19 e 22–23. Conflitos entre efeitos incompatíveis continuam sujeitos à aprovação individual prevista na Rodada 14.
- Esta rodada registra exclusivamente uma decisão de design e **não autoriza implementação de mecânicas**.

## Rodada 27 — Ativação imediata de passivas por gatilhos durante hitstop (opção C aprovada)

- **Novos gatilhos que efetivamente ocorram durante hitstop podem acionar imediatamente as passivas correspondentes nesse mesmo intervalo**, desde que seus requisitos e condições individuais de ativação sejam satisfeitos.
- **O hitstop, por si só, não bloqueia a ativação** de uma passiva elegível, tampouco impõe o armazenamento obrigatório do gatilho para processamento após a retomada da simulação.
- A decisão **não cria novos gatilhos nem obriga que eventos de combate inexistentes sejam produzidos durante o hitstop**: apenas estabelece como são tratados gatilhos que realmente ocorram e sejam válidos nesse intervalo.
- Permanecem válidas as regras individuais de funcionamento por estado (Rodada 3), a ativação independente e a resolução simultânea quando houver acionamento pelo mesmo evento (Rodadas 12–13), a resolução particular de conflitos (Rodada 14) e a proibição de reativar a mesma passiva enquanto seu efeito anterior permanecer ativo (Rodada 20).
- **O cooldown já iniciado e a duração dos efeitos ativos continuam pausados durante hitstop**, conforme as Rodadas 24–25, e os efeitos anteriores permanecem aplicados ao personagem, conforme a Rodada 26. A permissão de uma nova ativação não revoga essas regras temporais.
- **Permanece pendente** o momento de aplicação/execução dos efeitos gerados por uma ativação ocorrida durante o hitstop quando a sua natureza exigir processamento próprio, além de interações ainda não aprovadas com o relógio da simulação, conflitos específicos e eventos encadeados. Não presumir uma solução para essas situações apenas a partir da permissão de ativação.
- Esta aprovação é exclusivamente documental e **não autoriza implementar mecânicas**.

## Rodada 28 — Aplicação imediata dos efeitos de passivas acionadas durante hitstop (opção A aprovada)

- **Quando uma passiva for validamente acionada durante hitstop, os efeitos produzidos por essa ativação são aplicados imediatamente**, ainda durante o mesmo intervalo de hitstop, observadas todas as condições e restrições individuais da passiva.
- **A aplicação dos efeitos não é adiada até a retomada da simulação.** Por exemplo, se o efeito acionado conceder uma proteção temporária, essa proteção já passa a integrar o estado do personagem durante o hitstop.
- **Os cronômetros de duração dos novos efeitos temporários permanecem congelados enquanto perdurar o hitstop**, retomando a contagem somente após seu término, conforme a Rodada 25. Os efeitos aplicados permanecem em vigor durante a interrupção, conforme a Rodada 26.
- Para um **efeito instantâneo** efetivamente aplicado, permanece a regra da Rodada 18 de início do cooldown após sua aplicação; se esse cooldown já tiver começado durante o hitstop, sua **contagem permanece pausada** até terminar a interrupção, conforme a Rodada 24.
- Permanecem válidas a ativação imediata de gatilhos válidos da Rodada 27, a independência de acionamentos e a resolução simultânea de efeitos compatíveis das Rodadas 12–13, os conflitos individualizados da Rodada 14 e a impossibilidade de reativar a mesma passiva enquanto seu efeito anterior permanecer ativo, conforme a Rodada 20.
- **Não se aprovam, por esta rodada, novos gatilhos, movimentações, avanços da simulação, execução automática de eventos encadeados ou regras de desempate entre efeitos incompatíveis.** O comportamento concreto dessas situações não definido anteriormente permanece pendente.
- Esta é uma decisão exclusivamente documental e **não autoriza implementação de mecânicas**.

## Rodada 29 — Encadeamento imediato de ativações de passivas durante hitstop (opção A aprovada)

- **Se o efeito de uma passiva aplicado durante hitstop produzir efetivamente um novo evento que satisfaça o gatilho de outra passiva, essa outra passiva pode ser acionada imediatamente, ainda durante o mesmo hitstop**, desde que todos os seus requisitos e restrições individuais de ativação sejam atendidos.
- **O novo acionamento não é automaticamente adiado para o fim do hitstop nem descartado somente por ser derivado de uma ativação anterior**; seus efeitos seguem a regra de aplicação imediata já aprovada na Rodada 28.
- **Exemplo ilustrativo:** uma passiva recupera HP imediatamente durante hitstop; se a recuperação constituir um gatilho válido para a outra passiva equipada, ela também pode ser acionada e ter seu efeito aplicado nesse mesmo intervalo. O exemplo não cria nem aprova gatilhos concretos de passivas ainda não definidas.
- Mantêm-se a **ativação independente e a resolução conjunta dos efeitos compatíveis** das Rodadas 12–13, as **regras específicas para conflitos incompatíveis** da Rodada 14, as restrições individuais por estado da Rodada 3 e a **proibição de reativar a mesma passiva enquanto seu próprio efeito anterior permanecer ativo** aprovada na Rodada 20.
- Continuam válidas as Rodadas 24–26: **cooldowns já iniciados e durações de efeitos ativos ficam pausados durante hitstop, sem remover os efeitos aplicados**. Para efeitos instantâneos, aplicam-se as regras de início da recarga das Rodadas 16–18, sem avanço do respectivo cronômetro até terminar o hitstop.
- **Permanece pendente uma regra explícita de proteção contra ciclos de ativações infinitos, reentrância e cadeias sem término**. A opção A não aprova quantidade máxima de acionamentos, bloqueio de ciclos, critérios de desempate, ordem de execução de gatilhos encadeados concorrentes nem criação de eventos de combate que não ocorram de fato. Essas decisões deverão ser tratadas separadamente antes de eventual implementação.
- Este registro é exclusivamente uma decisão de design e **não autoriza implementação de mecânicas**.

## Pontos pendentes — não aprovados

- Identidade, números, magnitude, duração, gatilhos e cooldowns de cada passiva.
- Catálogo e critérios concretos de resolução para cada combinação de efeitos incompatíveis ou mutuamente exclusivos; casos não previstos permanecem sem regra aprovada.
- Unidades e conversão para efeitos de natureza diversa, regras de arredondamento específicas quando exigido inteiro, interações entre modificadores incompatíveis e tratamento de casos especiais não cobertos por restrições preexistentes.
- Comportamento específico de passivas permanentes e condicionais sem efeito ativo temporário, efeitos previamente suspensos, contagem de cooldown durante o intervalo KO–respawn, pausas globais e demais situações não aprovadas; as Rodadas 24–25 pausam a recarga e a duração dos efeitos ativos durante hitstop, a Rodada 26 mantém seus efeitos aplicados, a Rodada 27 permite ativações imediatas por gatilhos válidos, a Rodada 28 determina a aplicação imediata dos efeitos correspondentes e a Rodada 29 permite ativação em cadeia imediata durante esse intervalo. Continuam pendentes as proteções contra ciclos infinitos e reentrância, a ordem de processamento de eventos encadeados concorrentes, interações especiais com a simulação e demais casos específicos. A Rodada 23 encerra os efeitos ativos no KO e a Rodada 22 zera os cooldowns no respawn.
- Interface de seleção, apresentação visual e implementação técnica.

## Governança deste documento

- Registrar **somente decisões explícitas aprovadas pelo diretor**; manter o restante como pendência ou proposta.
- Em cada nova rodada aprovada, atualizar este documento no GitHub e conferir sua persistência na branch correspondente antes de afirmar que a decisão foi registrada.
- Preservar integralmente as decisões anteriores. Não implementar o sistema sem autorização específica.
