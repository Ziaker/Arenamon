# Arenamon — Registro de moves do Mushroom

> **Estado:** especificação de design parcial — decisões registradas; **não implementadas** neste documento.  
> **Data das decisões:** 18/10/2026 (America/Sao_Paulo).  
> **Fonte das decisões:** instruções e respostas do diretor nesta conversa, não deduções de código.  
> **Repositório consultado:** `Ziaker/Arenamon`, branch `main`, commit `f961a85dafc8698d741c9ee3d0a15f00b367985c`.  
> **Escopo:** regras de gameplay dos moves e VFX explicitamente solicitados. Nenhuma definição de animação, rigging, coreografia ou troca de modelo.

## 1. Personagem e conjunto de moves

O diretor identificou o novo personagem como **Mushroom** e determinou estes quatro moves, nesta ordem:

| Slot informado | Move | Estado das decisões específicas |
|---|---|---|
| 1 | **Rock Tomb** | Nome definido; mecânica não discutida nesta rodada. **Substitui Rock Slide**, mencionado inicialmente por engano. |
| 2 | **Bullet Punch** | Mecânica parcialmente definida, conforme seção 2. |
| 3 | **Sand Kick** | Nome definido; mecânica não discutida nesta rodada. |
| 4 | **Body Slam** | Nome definido; mecânica não discutida nesta rodada. |

**Identidade pendente:** o documento `docs/ROSTER.md` registra um cogumelo autoral como **Mosh** e existe a pasta `chars/mosh/`. Ainda **não houve confirmação explícita** de que o Mushroom citado pelo diretor corresponde a esse registro. Não associar automaticamente os moves a `Mosh` nem a qualquer recurso de personagem até confirmar.

**Importante:** a numeração acima registra a ordem em que o diretor listou os quatro golpes; a vinculação técnica aos slots equipáveis do Combat Lab deve respeitar a confirmação de identidade e a integração existente.

## 2. Bullet Punch — requisitos explicitamente definidos

### 2.1 Sequência temporal

1. **Ao iniciar o move:** começa uma **preparação de 0,75 segundo**.
2. **Após os 0,75 s:** o personagem **desaparece**, acompanhado de **efeitos visuais de speedlines**.
3. **Enquanto desaparecido:** permanece **intangível e não recebe ataques**. A fase de desaparecimento dura **1,00 segundo por padrão**, com **slider para ajustar sua duração**.
4. **Ao terminar o desaparecimento:** o personagem **reaparece em uma posição fixa mais à frente da posição inicial** e desfere o ataque caso haja alvo elegível.
5. **Busca do alvo:** o inimigo mais próximo é selecionado **no instante do reaparecimento**, considerando as **posições atuais**, dentro de um **raio configurável por slider**.
6. **Sem alvo dentro do raio:** o personagem **reaparece à frente normalmente, mas não acerta ninguém**.

Com os valores iniciais expressamente indicados, o reaparecimento ocorre **1,75 s após o início** (0,75 s de preparação + 1,00 s de desaparecimento). Isso **não determina** uma duração de recuperação posterior; essa regra permanece aberta.

### 2.2 Propriedades ofensivas

- **Power Level fixo: PL2.**
- **Dano:** mesmas propriedades/regras de dano do **Tackle** existente no Arenamon.
- **Knockback:** mesmas propriedades/regras de knockback do **Tackle** existente no Arenamon.
- **Velocidade de impacto:** **configurável**, por slider, usada como parâmetro no cálculo de knockback com a fórmula do Tackle; **não** substituir a fórmula por um empurrão arbitrário.
- O PL2 **não** foi definido como multiplicador de dano; não introduzir dano ×2 sem autorização.

### 2.3 Decisões em alternativas — respostas confirmadas pelo diretor

| ID | Pergunta | Resposta escolhida | Regra |
|---|---|---|---|
| BP-D01 | Onde Mushroom reaparece? | **A** | Uma distância fixa à frente da posição inicial. |
| BP-D02 | Quando procura o inimigo mais próximo? | **B** | No instante do reaparecimento, usando as posições atuais. |
| BP-D03 | Durante o desaparecimento | **A** | Fica intangível e não recebe ataques. |
| BP-D04 | Se nenhum inimigo estiver dentro do raio | **A** | Reaparece à frente, sem acertar ninguém. |
| BP-D05 | Componente de velocidade no knockback | **B** | Usa uma velocidade de impacto configurável, mantendo a fórmula do Tackle. |

### 2.4 Sliders expressamente solicitados

| Parâmetro | Valor inicial aprovado | Faixa, passo e demais regras |
|---|---|---|
| Duração do desaparecimento | **1,00 s** | **Ainda não definidos.** |
| Raio de busca do inimigo mais próximo | **Não definido** | Slider solicitado; valor inicial, faixa e passo pendentes. |
| Velocidade de impacto para a fórmula do Tackle | **Não definido** | Slider solicitado; valor inicial, faixa e passo pendentes. |

A **distância fixa de reaparecimento** foi aprovada como conceito em BP-D01, mas **nenhuma distância numérica foi aprovada**. Foram oferecidas posteriormente as opções de **3 m**, **5 m**, **8 m** ou **outro**; **o diretor ainda não escolheu nenhuma**. Não assumir nem implementar um desses números como aprovado; não há decisão sobre tornar essa distância um slider.

### 2.5 Referências técnicas verificadas (não são decisões novas)

O código existente na `main`, consultado no commit identificado no cabeçalho, contém:

- [`prototypes/combat-lab/src/sim/combat.js`](../prototypes/combat-lab/src/sim/combat.js): `resolveHit` contém a resolução de dano do Tackle, defesa frontal/perfeita e o cálculo do lançamento. No código consultado, o cálculo de knockback usa `R.launchHorizontal`, `X.launchAttackBase`, `X.launchAttackWeight`, `X.launchAttackReference`, `X.launchClosingCap`, `X.launchClosingMultiplier` e `knockbackTaken`; a velocidade de aproximação participa do termo `closing`. Reutilizar essas regras **sem criar fórmulas alternativas**.
- [`prototypes/combat-lab/src/sim/world.js`](../prototypes/combat-lab/src/sim/world.js): o Tackle tem **PL1** no sistema atual. A compatibilização do **Bullet Punch PL2** com Clash/Counter precisa seguir as regras existentes.
- [`prototypes/combat-lab/src/sim/moves.js`](../prototypes/combat-lab/src/sim/moves.js), [`controller.js`](../prototypes/combat-lab/src/sim/controller.js), [`game.js`](../prototypes/combat-lab/src/sim/game.js): registro, controle, linha do tempo e efeitos dos moves. O movimento de `dash` já existente **não deve ser considerado automaticamente equivalente** ao desaparecimento/reaparecimento pedido.
- [`prototypes/combat-lab/src/ui/moves-panel.js`](../prototypes/combat-lab/src/ui/moves-panel.js): interface de parâmetros existente. Os sliders novos são requisito de implementação futura, **não foram criados**.

A fórmula de `resolveHit` depende da geometria e velocidade relativas de um contato de Tackle. A reutilização no ataque de reaparecimento deve preservar o comportamento de dano/knockback sem tratar a transição invisível como uma colisão comum. **A implementação exata não foi decidida nem executada.**

## 3. Pendências explícitas — não presumir respostas

| ID | Informação ainda necessária |
|---|---|
| BP-P01 | **Distância numérica do reaparecimento** e, se aplicável, referencial exato de “à frente” (orientação no início do move, orientação no reaparecimento ou outro). |
| BP-P02 | **Raio de aquisição** do inimigo: valor inicial, limites, passo e ponto central de medição (posição inicial, posição de reaparecimento ou outro). |
| BP-P03 | **Slider de duração do desaparecimento:** mínimo, máximo e passo. |
| BP-P04 | **Slider de velocidade de impacto:** unidade, valor inicial, mínimo, máximo e passo; interpretação exata da velocidade relativa no termo `closing`. |
| BP-P05 | **Custo de stamina e cooldown** do Bullet Punch. |
| BP-P06 | **Regras de interrupção/cancelamento** durante preparação e desaparecimento; condição de invulnerabilidade durante a preparação; eventuais janelas de recuperação após reaparecer. |
| BP-P07 | **Destino obstruído ou inválido:** parede, barreira, limite de arena, colisão com lutadores e falta de espaço livre. |
| BP-P08 | **Geometria do acerto** e relação entre seleção de alvo, raio configurável e posição final; o que ocorre se o alvo estiver elegível mas fora do contato físico imediato. |
| BP-P09 | Detalhamento visual das **speedlines**, além de sua presença obrigatória na fase invisível. |
| BP-P10 | **Confirmação da identidade** Mushroom ↔ Mosh no repositório, antes de vincular o move a recursos concretos. |
| BP-P11 | Eventuais ajustes das interações do PL2 com Clash/Counter para este tipo específico de golpe, se não cobertos integralmente pelas regras já existentes. |

**Não aprovados:** qualquer valor das opções de distância propostas pelo assistente, sliders ou limites não definidos, regras adicionais de defesa/cancelamento e comportamentos criados apenas como sugestão.

## 4. Limites e estado de implementação

- O diretor **não pediu animações**. Não adicionar decisões ou tarefas de rigging, coreografia ou produção de clipes.
- As **speedlines** são **VFX explicitamente solicitados** e, portanto, parte da especificação.
- **Este arquivo registra decisões; não é implementação.** Nada aqui comprova que Bullet Punch já esteja programado, equipado ou testado.
- Qualquer alteração posterior deve identificar quais decisões foram novas ou revisadas, preservar as anteriores e manter **pendências** separadas de **requisitos aprovados**.

## 5. Histórico desta rodada

1. Diretor informou a adição do personagem denominado **Mushroom** e quatro moves, inicialmente **Rock Slide**, **Bullet Punch**, **Sand Kick**, **Body Slam**.
2. Diretor corrigiu **Rock Slide → Rock Tomb**.
3. Diretor definiu a primeira versão do Bullet Punch: preparação de 0,75 s, desaparecimento com speedlines por 1 s ajustável, reaparecimento à frente, alvo mais próximo dentro de raio ajustável, PL2, dano e knockback do Tackle.
4. Diretor selecionou expressamente as cinco respostas **A, B, A, A, B**, detalhadas em **BP-D01–BP-D05**.
5. A escolha posterior da distância **não aconteceu**; nenhuma das sugestões (3 m, 5 m, 8 m ou outro) foi aprovada.
6. Diretor determinou que **todas as informações sejam catalogadas num documento no GitHub**, para preservar a rastreabilidade das decisões. Esta primeira versão do registro cumpre somente a **documentação** do que já está conhecido.
