# Revisão do GDD de combate (proposta, Etapa A)

Documento de revisão do `GDD_Pokemon_Arena_Fighter_v0_1.docx`. **Não substitui o GDD.** Ele lista quais regras do GDD v0.1 o núcleo da Etapa A substitui, as decisões novas tomadas pelo responsável e o que continua pendente. Nada aqui é definitivo até a avaliação jogável do responsável.

Implementação: `prototypes/combat-lab` (branch `feat/combat-core-etapa-a`). O jogo oficial (`prototypes/game`) **não foi alterado**.

> **Etapa A aprovada pelo responsável em 14/10/2026**, após avaliação jogável no laboratório. Os itens marcados como "Provisório" fazem parte do que foi aprovado; os **valores** continuam ajustáveis. A aprovação vale para o laboratório: o jogo oficial só muda numa tarefa própria, autorizada à parte (ver seção 3).

Status de cada item:
- **Decidido:** decisão explícita do responsável.
- **Alinhado ao GDD:** correção para seguir o GDD v0.1.
- **Provisório:** implementado para teste, aguardando aprovação.
- **Pendente:** não implementado.

## 1. Regras do GDD v0.1 substituídas

| # | GDD v0.1 | Etapa A | Status |
|---|---|---|---|
| 1.1 | O tackle é uma propriedade da esquiva frontal. Esquiva e investida compartilham duração, custo, invulnerabilidade e esterçamento. | **X** é o tackle, uma ação própria em 8 direções. **C** é a esquiva, que nunca causa dano. Cada uma tem duração, custo, invulnerabilidade, distância, curva, esterçamento, transição, encadeamento, recuperação e requisitos próprios (`actions.tackle` e `actions.dodge`). | Decidido |
| 1.2 | O impacto depende da orientação do corpo. | O impacto depende da **trajetória real** do X. Cada ação acerta cada alvo no máximo uma vez. | Decidido |
| 1.3 | A esquiva só pode ser cancelada depois de 200 ms. | O cancelamento **C → X** é permitido desde o primeiro passo da esquiva. A janela é configurável (`actions.cancel.windowStart/windowEnd`). Não existe X → C nem outros cancelamentos novos. | Decidido |
| 1.4 | — | No C → X: o custo de C fica gasto e X cobra o próprio custo. Sem stamina suficiente, não há cancelamento e a esquiva continua intacta. A direção é a pedida; sem direção, X continua na direção de C. | Decidido |
| 1.5 | — | Por padrão, a invulnerabilidade de X no cancelamento é **só o resto da de C**, sem janela extra. O slider `actions.cancel.invulnerability` compara com "nenhuma" e "janela completa de X". | Decidido |
| 1.6 | — | O C → X no ar parte da altura atual e desce em `actions.cancel.airDescent` (0,18 s), sem teletransporte. A velocidade é contínua: a transição suave de 0,06 s parte da velocidade inteira de C. | Provisório (valores) |
| 1.7 | O clash (tackle contra tackle) não tem dano definido. | Cada lutador recebe **30% do dano que o tackle do adversário causaria** (`rules.clashFraction`). Os dois são lançados para trás e para cima. | Decidido |
| 1.8 | A esquiva salta sobre o adversário. | C só salta quando a trajetória cruza o adversário. As outras esquivas ficam no chão. | Provisório |
| 1.9 | — | **Buffer de entrada:** X ou C pedidos até 100 ms antes de serem permitidos saem no primeiro passo permitido. Não permite nada que já não fosse permitido: só antecipa a entrada. Um toque em D descarta o pedido (`actions.buffer.window`; 0 desliga). | Provisório |

## 2. Correções alinhadas ao GDD v0.1

| # | Regra | Situação anterior no laboratório | Agora |
|---|---|---|---|
| 2.1 | Sem ataque durante o recuo (8.2) | X saía durante o recuo. | X é bloqueado no recuo. C e D continuam permitidos (`actions.*.fromRecoil`). |
| 2.2 | Tackle guardado durante o guard stun (5) | X saía durante o guard stun. | X fica guardado e sai quando o stun acaba. Segurar D não descarta o pedido; um novo toque em D substitui o pedido. |
| 2.3 | A defesa não desloca o defensor | — | Verificado: deslocamento de 0 m do contato ao fim do guard stun. |
| 2.4 | Defesa perfeita e esquiva perfeita | — | Preservadas, cobertas por cenários e testes. A esquiva perfeita seguida de C → X aplica o bônus uma única vez. |

## 3. Pendências (Etapa B em diante; não implementadas)

- **Fórmula de empurrão do GDD:** 60% Ataque e 40% velocidade de impacto, com resistência da Defesa R(D) = 0,5·D/(D+Dmed). A Etapa A **mantém o lançamento aéreo** atual (provisório). A Etapa B vai propor uma reconciliação entre Ataque, velocidade relativa e Defesa com esse lançamento. O empurrão no chão não substitui o lançamento sem aprovação.
- **Jogo oficial:** a migração foi autorizada e feita na branch `feat/game-etapa-a` (seção 5). Aguarda a avaliação jogável do responsável.
- Os valores dos sliders são do v6 ou provisórios e precisam de ajuste jogável.

## 4. Compatibilidade

- O modo `V6_COMPAT` (`src/sim/config.js`) reproduz o v6 passo a passo: 16 execuções e 76.800 passos idênticos. Ele serve só para comparação e não substitui os testes do comportamento novo.
- Os JSONs v5, v6 e v7 são migrados na importação com um relatório dos campos convertidos e ignorados. Exemplo: `rules.dodge` vira `actions.dodge.duration` e `actions.tackle.duration`.

## 5. Aplicação ao jogo oficial (`prototypes/game`, branch `feat/game-etapa-a`)

Autorizada pelo responsável em 14/10/2026: migração integral das regras mecânicas da Etapa A, em branch própria e sem merge na `main`. **Aguarda avaliação jogável.**

**Levado ao jogo:**
- X e C como ações independentes (`ACTIONS` em `src/config.ts`), com os valores que o jogo já usava;
- C → X, inclusive no ar;
- regras de recuo e guard stun;
- defesa sem deslocar o defensor;
- defesa perfeita e esquiva perfeita com contra-ataque;
- clash de 30%;
- salto de C;
- buffer de entrada;
- X nas 8 direções pela tecla **X**.

**Comportamentos do jogo que mudaram por causa da Etapa A:**
- **C deixou de ser ofensiva.** Antes, toda esquiva era o tackle.
- **A defesa parcial deixou de empurrar o defensor.** A Etapa A e o item 2.3 pedem defensor sem deslocamento; a fórmula de empurrão continua a mesma e vale para o impacto e o clash.
- **O evento "invulnerável" sai uma vez por tackle,** pela regra de um contato por ação. Antes podia se repetir a cada passo de contato.
- **A tecla X deixou de ser reservada** e passou a ser o tackle. A/S/D/Z continuam reservadas.

**Diferenças que continuam em relação ao laboratório, por restrição ou por decisão:**

| Tema | Laboratório (Etapa A) | Jogo | Motivo |
|---|---|---|---|
| Resposta física ao impacto | lançamento aéreo, hitstop e recuperação ao aterrissar | empurrão no chão do GDD (60/40 + Defesa), sem hitstop | Não mudar a fórmula de empurrão nem fazer a Etapa B |
| Clash | 30%, os dois lançados para trás e para cima | 30%, os dois empurrados para trás no chão (mesmo empurrão do GDD) | O jogo não tem lançamento aéreo; adicioná-lo seria Etapa B |
| Tecla de defesa | D | F | Controle já existente no jogo, preservado |
| Invulnerabilidade de X no C → X | padrão "resto de C", com slider para comparar "nenhuma" e "janela de X" | fixa em "resto de C" (o padrão aprovado) | O jogo não recebe os controles de ajuste |
| Recuperação após ação exausta | sim (do v6) | não | Não faz parte da Etapa A |
| Ajustador, replay, IA tática, sobreposições | sim | não | Fora do escopo da migração |
| Arena e velocidade base | 32 m e 4,8 m/s (valores do v6) | 20 m e 4 m/s | Valores do jogo, preservados |

**Testes:**
- `prototypes/game/etapa-a.test.mjs`: 16 cenários e 124 verificações "esperado × obtido".
- `prototypes/game/test.mjs`: 20 cenários, atualizados para X e C.
- `prototypes/game/locomotion.test.mjs`: 15 cenários.
- `prototypes/game/verify.mjs`: 21 cenários no Edge pelo teclado real. Entre eles: X nas 8 direções, C saltando sem dano e C → X.
