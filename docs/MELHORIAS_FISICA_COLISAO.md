# Melhorias de movimentação, colisão, física e hitbox (versão 1.13.0)

Origem: análise com as skills `physics-tuning`, `game-feel` e `performance-optimization` +
uma **varredura medida** do jogo (30 partidas IA×IA em mapas aleatórios, ≈105 mil passos, com o oráculo
geométrico da Fase 5). Tudo está na branch `feat/ferramentas-open-source`. Cada mudança tem teste e um
**interruptor visível em Ajustes** (nome e unidade), então dá para comparar antes × depois.

## O que a medição achou

| Situação | Antes | Depois |
|---|---|---|
| Penetração andando no chão | 1 cm | 0 |
| Penetração no salto voluntário | 11 cm (tolerância de montagem de 25 cm, de propósito) | 0–11 cm |
| **Lançado por golpe contra plataforma** | **até 1,00 m (atravessava)** | **≤ 23 cm (só a tolerância de montagem)** |
| Alcance do tackle por ângulo (0° / 22,5° / 45°) | 5,7 / 5,8 / **6,2 m** | 5,7 / 5,7 / 5,7 m |
| Normal do golpe a 45° | (0, 1) — quantizada no eixo | (0,71; 0,71) — linha dos centros |
| Sobreposição lutador × lutador > 5 cm | 13 passos em 100 mil | todos explicados (salto da esquiva por cima do rival) |
| Tunelamento (parede 0,2 m, projéteis, barreiras) | não testado | não ocorre até 90 m/s (lançado) / 150 m/s (projétil) |

## O que mudou (e onde ligar/desligar)

| # | Mudança | Padrão | Controle em Ajustes |
|---|---|---|---|
| 1 | **Lançado colide com a lateral de sólidos** (a regra “passa por cima se o apogeu supera o topo” vale só para o salto voluntário) | **ligado** | Plataformas e salto → *Lançados colidem com a lateral de sólidos* |
| 2 | **Contato lutador × lutador circular** (alcance igual em todos os ângulos; normal na linha dos centros). Alinhado a um eixo é idêntico ao antigo | **circular** | Ajustes → *Pegada do contato lutador × lutador* (0 = quadrada, legado) |
| 3 | **Hitbox espacial do golpe**: esfera à frente do atacante; cada janela da animação pode trazer a sua (`contract.shapes[i] = {forward, radius}`); overlay **Hitbox espacial do golpe** na aba de visualização | desligado | *Hitbox espacial do golpe (experimental)* (liga, distância e raio) |
| 4 | **Interpolação do desenho** entre o passo anterior e o atual (só visual; a simulação é restaurada) | **ligada** | *Interpolação do desenho* (liga e “não suavizar saltos maiores que”) |
| 5 | **Tolerância de montagem** em sólidos agora é parâmetro (antes fixa em 0,25 m) | 0,25 m (igual) | Plataformas e salto → *Tolerância de montagem em sólidos* |
| 6 | Testes de tunelamento para lutadores, projéteis e barreiras (nenhum bug achado) | — | — |
| 7 | Sobreposição lutador × lutador investigada: só ocorre no salto da esquiva por cima do rival (intencional) → virou invariante de teste | — | — |
| 8 | **Obstáculos/destrutíveis**: projéteis e áreas usavam uma caixa girada (`angle`) que não existe no desenho nem na colisão dos lutadores → agora todos usam a mesma caixa alinhada aos eixos | **corrigido** | — |
| + | **Hitstop por faixa de dano** (golpe forte congela mais; skill `game-feel`) | desligado (fixo, como antes) | Combate → *Hitstop por dano* (acréscimo e dano de referência) |

Arquivos principais: `sim/map.js` (colisão com sólidos), `sim/physics.js` (`overlap`, tolerância de apoio),
`sim/combat.js` (`hitShapeOf`/`hitShapeAllows`), `sim/interpolation.js` + `main.js` (interpolação),
`sim/game.js` (pose anterior, hitstop por dano), `sim/world.js` (caixas sem rotação), `view/view.js` (overlay),
`sim/config.js` + `ui/tuning*.js` + `ui/actions-drawer.js` (controles), `sim/animation-combat-windows.js` (contrato com `shapes`).

## Testes novos (todos na suíte `npm run test:combat-lab:unit`; atalho `npm run test:physics`)

- `collision-invariants.test.mjs` — varredura de partidas: chão ≤ 2 cm, salto ≤ tolerância, lançado ≤ tolerância, ninguém
  abaixo do chão/fora da arena, sobreposição entre lutadores só no salto por cima, projétil × caixa.
- `contact-shape.test.mjs` — alcance por ângulo (quadrado × circular), normais, simetria de `overlap()`.
- `hitbox-shapes.test.mjs` — esfera frontal, raspão lateral, forma própria da janela, modo legado.
- `interpolation.test.mjs` — ponto médio, teletransporte, voo, restauração exata, simulação idêntica ligada × desligada.
- `tunneling.test.mjs` — parede fina, projétil rápido, barreira; mostra o limite quando `contactStep` é absurdo.
- `hitstop-tiers.test.mjs` — hitstop fixo por padrão e por faixa de dano com o acréscimo.
- No navegador: `post-game.browser.mjs` confere que todos os controles existem e que o jogo roda com tudo ligado.

## O que NÃO foi feito (e por quê)

- **Câmera por “trauma” decaindo**: a câmera cinemática ZZZ é sistema aprovado; mexer exige decisão sua.
- **IA/Yuka usando o salto para fugir**: mudaria o balanceamento da IA; fica como proposta.
- **Suavização visual da montagem de plataformas**: o `groundOffset` fica em `view/characters.js`, que outro agente
  estava editando; o parâmetro de tolerância (item 5) já permite reduzir o afundamento (medido: 0,12 m → penetração do salto ≤ 13 cm).
- **Medição em GPU real** da interpolação/pós: os testes automáticos rodam em renderização por software.

## Decisão que depende de você

Dois padrões mudam o comportamento do combate em diagonais e em lançamentos: **contato circular** e **lançado colide com
sólidos**. Ambos passam em toda a suíte (54 arquivos de teste) e têm interruptor para voltar ao antigo. O que mais vale
**jogar para sentir**: tackle na diagonal (alcance 0,5 m menor que antes a 45°) e interpolação em monitor de alta taxa.
