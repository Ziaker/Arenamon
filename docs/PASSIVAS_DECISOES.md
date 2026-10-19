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

## Pontos pendentes — não aprovados

- Identidade, números, magnitude, duração, gatilhos e cooldowns de cada passiva.
- Catálogo e critérios concretos de resolução para cada combinação de efeitos incompatíveis ou mutuamente exclusivos; casos não previstos permanecem sem regra aprovada.
- Unidades e conversão para efeitos de natureza diversa, regras de arredondamento específicas quando exigido inteiro, interações entre modificadores incompatíveis e tratamento de casos especiais não cobertos por restrições preexistentes.
- Comportamento das passivas em KO, respawn, pausas, hitstop e demais estados; a definição é individual, mas as regras concretas ainda não foram aprovadas.
- Interface de seleção, apresentação visual e implementação técnica.

## Governança deste documento

- Registrar **somente decisões explícitas aprovadas pelo diretor**; manter o restante como pendência ou proposta.
- Em cada nova rodada aprovada, atualizar este documento no GitHub e conferir sua persistência na branch correspondente antes de afirmar que a decisão foi registrada.
- Preservar integralmente as decisões anteriores. Não implementar o sistema sem autorização específica.
