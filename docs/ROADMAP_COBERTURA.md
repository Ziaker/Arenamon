# Auditoria de cobertura do roadmap — 13/10/2026

Base auditada: commit `1b1da81` (branch `codex/jogavel-blocos`), código em `prototypes/game/`.
Evidência: `npm run verify` executado em 13/10/2026 (typecheck, 19 cenários mecânicos determinísticos, 16 cenários no Edge offline, regressão do visualizador anterior) — todos aprovados.

Legenda: **IT** implementada e testada · **IF** implementada com falhas · **P** parcial · **N** não implementada.
Nenhuma etapa está aprovada: a aprovação depende da avaliação do usuário.

| Etapa | Item | Estado | Evidência / observação |
| --- | --- | --- | --- |
| 00 | Estrutura modular (gameplay/física/entrada/câmera/render) | IT | `src/` separa controller, physics, combat, ai, input, view, ui |
| 00 | Build e testes automatizados | IT | `npm run verify` |
| 00 | Repositório privado GitHub | IT | `https://github.com/Ziaker/Arenamon` (privado), `origin` configurado |
| 00 | Recursos proprietários fora do Git | IT | `.gitignore` cobre `*.glb` e `chars/` |
| 01 | Arena com grid, limites, dois blocos, indicador frontal | IT | cenário Edge "dois blocos, câmera, layout" |
| 01 | Câmera terceira pessoa com órbita/zoom | IT | testada; sem oclusão (desnecessária na arena plana) |
| 01 | Movimento livre (não preso ao grid), timestep fixo 120 Hz | IT | cenários de movimento e 30/60/144 Hz |
| 01 | Painel de informações (HUD/F3) | IT | |
| 02 | Aceleração/desaceleração, diagonal normalizada | IT | |
| 02 | Colisão com paredes e entre combatentes, sem penetração | IT | cenário "walls slide and stable body contact" |
| 02 | Orientação para o alvo (lock-on) | IT | |
| 03 | Máquina de estados, esquivas 400/200 ms, 3 direções, esterçamento | IT | |
| 04 | Tackle, um acerto por alvo, defesa parcial/perfeita, recuo 15%/300 ms, cancelamentos | IT | |
| 05 | Dano, empurrão por normal de contato, resistência decrescente | P | fórmulas implementadas; constantes **provisórias** (HP, dano, C, referências) |
| 05 | Hit stun / anti-stunlock | N | aguarda definição no GDD |
| 06 | IA: inativa, defensiva, ofensiva, combate | IT | comportamento determinístico; qualidade de jogo não avaliada por humano |
| 07 | Menu, HUD, pausa, resultado, reinício | IT | |
| 07 | Condição de vitória definitiva | P | HP zero é **provisório** (GDD não define) |
| 08 | Refinamento por teste humano | N | depende de sessões do usuário |
| 09 | Elenco data-driven | P | perfis de atributos de teste existem; sem habilidades por personagem |
| 10 | Movimentos equipados, cooldowns, buffer | N | aguardam GDD |
| 11 | Produção visual | N | fora de escopo até aprovação do MVP |

## Decisões pendentes do usuário
1. Valores finais de HP, dano e calibração do empurrão.
2. Condição de vitória definitiva.
3. Hit stun e movimentos específicos.
4. Avaliação jogando o HTML para os marcos das Etapas 01–07.
