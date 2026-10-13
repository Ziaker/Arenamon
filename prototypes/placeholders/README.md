# Ímpeto — laboratório de blocos

O laboratório agora contém somente o Ímpeto. Lastro e Vésper foram removidos das definições anatômicas, das poses, da construção geométrica e da interface. As capturas antigas específicas desses personagens e da comparação foram excluídas. O laboratório Croagunk, seus modelos e o GDD não foram alterados.

## Abrir

Abra por duplo clique `dist/criaturas-laboratorio.html`. O nome do arquivo foi mantido para preservar o caminho já aberto no navegador. Funciona offline, sem servidor ou arquivos auxiliares.

## Estado atual

Personagem construído exclusivamente com blocos, sem rosto ou acessórios. Permanecem 14 ações, três intensidades, câmera orbital e vistas, pausa, repetição, avanço por quadro, linha do tempo, silhueta, articulações e captura PNG.

As animações do Ímpeto não foram redesenhadas nesta revisão. Foi removido o conteúdo dos outros personagens, preservando a avaliação do movimento atual.

## Melhorias propostas, ainda não implementadas

1. **Apoios dos pés:** controlar contato, saída pela ponta e chegada pelo calcanhar. Hoje o pé permanece horizontal e o alcance da perna limita a passada, sem contatos persistentes.
2. **Quadril e peso:** acrescentar transferência lateral sobre a perna de apoio e contrarrotação entre quadril e peito. Hoje a rotação está concentrada no peito.
3. **Corrida:** coordenar impulso, fase aérea e aterrissagem com os braços. Hoje a altura do corpo e o trajeto dos pés são calculados separadamente.
4. **Poses por ação:** separar tackle da esquiva frontal, orientar o apoio conforme a direção e reservar uma pose clara de contato para o ataque. Hoje compartilham a maior parte das poses.
5. **Continuidade:** ligar a aterrissagem à recuperação e depois à postura de combate, conservando a velocidade visual dos membros nas transições. Hoje a recuperação é um clipe separado e o loop pontual reinicia a demonstração.
6. **Movimento residual:** aplicar atraso à pose final de locomoção, não apenas ao vocabulário de poses estáticas, para que cabeça e braços acompanhem de fato cada passada.

Prioridade sugerida: corrida e apoios, depois tackle e esquivas. Conservar os blocos simples e os tempos mecânicos.

## Fontes

- `src/anatomy.ts`: proporções do Ímpeto.
- `src/rig.ts`: blocos, pivôs e solução das pernas.
- `src/poses.ts`: poses-chave.
- `src/animation.ts`: aplicação visual, locomoção e intensidade.
- `src/curves.ts`, `src/states.ts`: curvas e estados.
- `src/motion.ts`: movimento demonstrativo separado da animação.
- `src/stage.ts`, `src/main.ts`, `src/template.html`: câmera, reprodução e interface.

## Validação

Verificação TypeScript, build e `verify.mjs` exercitam o laboratório de um único personagem. O teste amostra 14 ações × 3 intensidades × 17 instantes, verifica o piso, os controles, o carregamento em file:// offline, a ausência de personagens adicionais e as janelas mecânicas. Resultados em `validation/report.json`; capturas em `validation/`.

Esquiva de 400 ms, invulnerabilidade nos primeiros 200 ms, recuo de 15% em 300 ms. A distância demonstrativa é 1,6 m. Não há combate real, adversário ou sistema de dano. Passar nos testes técnicos não representa aprovação da qualidade da animação.

Para desenvolvimento, a partir da raiz:

```text
node node_modules/typescript/bin/tsc --noEmit -p prototypes/placeholders/tsconfig.json
node prototypes/placeholders/build.mjs
node prototypes/placeholders/verify.mjs
```
