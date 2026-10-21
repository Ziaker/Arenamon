# VFX e avisos das habilidades passivas

O jogo principal exibe uma única placa lateral no formato `Ability: NOME` quando uma habilidade passiva realmente é ativada. O nome vem da passiva equipada, como **Regenerator**, **Stamina** ou **Rough Skin**. Os nomes **Órbita**, **Prisma** e **Ressonância** permanecem somente nos botões de prévia visual.

## Comportamento no jogo

- A notificação do jogador entra pela extrema esquerda; a do adversário entra pela extrema direita.
- A placa fica na mesma altura do aviso original, a 34% do topo da arena.
- A placa tem interior branco em relevo, moldura metálica de 3 px, sombra e três animações selecionáveis: **Reflexo**, **Pulso** e **Luz no contorno**.
- A largura responsiva varia de **210 a 270 px** e a altura é **46 px**.
- O prefixo `Ability:` usa 11 px e o nome usa 18 px na configuração padrão. O nome pode ser ajustado de 80% a 160% no painel **Visualizar → Habilidades passivas**.
- Todas as habilidades usam o mesmo efeito: sparkles brancos ao redor do lutador por **0,5 s**.
- Os sparkles usam a posição, a altura visual e a orientação atuais de cada lutador. Eles continuam presos ao personagem enquanto ele se move e quando a simulação está pausada.
- As malhas são criadas uma vez e reutilizadas nas ativações seguintes.

Os três nomes de prévia alteram somente a demonstração manual. Durante a luta, a placa e os sparkles respondem aos eventos reais sem alterar bônus, cooldowns ou regras de combate documentados em `PASSIVAS_DECISOES.md`.

## Como conferir

1. Abra `JOGAR_ARENAMON.html`.
2. Inicie um combate e ative uma passiva para ver o nome real na lateral do respectivo lutador.
3. Abra **Visualizar → Habilidades passivas**.
4. Escolha as habilidades, a animação da moldura e o tamanho do texto.
5. Use os botões de prévia para repetir qualquer efeito durante a partida.

A evidência automatizada está em `prototypes/combat-lab/evidence/passive-abilities/index.html`.

## Verificações

- `node prototypes/combat-lab/test/passive-abilities.test.mjs`
- `node prototypes/combat-lab/test/passive-abilities.browser.mjs`
- `npm run build:combat-lab`
- `npm run typecheck`
