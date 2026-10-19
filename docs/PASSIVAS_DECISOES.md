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

## Pontos pendentes — não aprovados

- Identidade, números, magnitude, duração, gatilhos e cooldowns de cada passiva.
- Regras para substituição da seleção durante uma partida ou entre partidas.
- Possibilidade de equipar duplicatas, quando aplicável.
- Interações e prioridades entre duas passivas equipadas.
- Limites de empilhamento e relação com buffs, debuffs e atributos.
- Comportamento das passivas em KO, respawn, pausas, hitstop e demais estados; a definição é individual, mas as regras concretas ainda não foram aprovadas.
- Interface de seleção, apresentação visual e implementação técnica.

## Governança deste documento

- Registrar **somente decisões explícitas aprovadas pelo diretor**; manter o restante como pendência ou proposta.
- Em cada nova rodada aprovada, atualizar este documento no GitHub e conferir sua persistência na branch correspondente antes de afirmar que a decisão foi registrada.
- Preservar integralmente as decisões anteriores. Não implementar o sistema sem autorização específica.
