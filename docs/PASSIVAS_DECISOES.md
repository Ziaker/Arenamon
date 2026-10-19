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

## Pontos pendentes — não aprovados

- Identidade, números, magnitude, duração, gatilhos e cooldowns de cada passiva.
- Prioridades, ordem de aplicação e conflitos entre efeitos incompatíveis das duas passivas equipadas.
- Unidades e conversão para efeitos de natureza diversa, regras de arredondamento específicas quando exigido inteiro, interações entre modificadores incompatíveis e tratamento de casos especiais não cobertos por restrições preexistentes.
- Comportamento das passivas em KO, respawn, pausas, hitstop e demais estados; a definição é individual, mas as regras concretas ainda não foram aprovadas.
- Interface de seleção, apresentação visual e implementação técnica.

## Governança deste documento

- Registrar **somente decisões explícitas aprovadas pelo diretor**; manter o restante como pendência ou proposta.
- Em cada nova rodada aprovada, atualizar este documento no GitHub e conferir sua persistência na branch correspondente antes de afirmar que a decisão foi registrada.
- Preservar integralmente as decisões anteriores. Não implementar o sistema sem autorização específica.
