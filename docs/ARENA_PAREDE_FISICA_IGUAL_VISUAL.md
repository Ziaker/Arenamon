# Arena: parede física = parede visual, consumíveis sempre dentro

Data: 2026-10-20 · Branch: `feat/salto-footstool` · Protótipo: `prototypes/combat-lab`

## Problema relatado
O battleground parecia grande demais e "infestado de paredes invisíveis": o lutador
parava antes de chegar na parede visível, e consumíveis podiam aparecer fora da área
por onde os personagens conseguiam andar.

## Causa raiz
`clampToArena` (sim/physics.js) aceitava `C.test.arenaHalf` — o meio-lado da **arena
quadrada legada** — como cap da arena circular, desde que fosse menor que o raio
oficial. Se esse valor viesse menor numa sessão salva (ou via painel "Arena e
simulação"), o lutador travava num círculo invisível menor que a parede desenhada.
Enquanto isso, a validação de spawns usava `C.map.arenaRadius` (o valor da parede
visual) — então itens/objetos podiam nascer na faixa inacessível entre os dois raios.

## Correção
- Novo helper único `effectiveArenaRadius()` (sim/map.js): o raio oficial
  `C.map.arenaRadius`, reduzido **apenas** pelo cap técnico explícito de cenários de
  teste `C.test.circleCap`. O `arenaHalf` legado NUNCA limita a arena circular.
- `clampToArena` (lutadores), o cálculo de espaço de separação de colisores e o limite
  de projéteis (sim/world.js) usam esse mesmo raio.
- `isValidSpawnPosition` (consumíveis, obstáculos, destrutíveis, plataformas, spawns de
  lutadores e respawns) valida contra o raio efetivo: tudo nasce dentro da área
  alcançável, com a margem de 2 m da borda.

Resultado: piso, anél/parede visual, limite físico e área de spawn usam **o mesmo
número** — o tamanho do battleground é exatamente onde está a parede, em qualquer raio
configurado no painel (Ajustes › Mapa › Arena circular › Raio).

## Decisão de tamanho mantida
O raio padrão continua 32,5 m (`MAP_DEFAULTS.arenaRadius`), a redução de ~35% aprovada
(50 → 32,5). Se o jogo abrir com a sessão antiga restaurada (banner "Sessão anterior
restaurada"), o valor restaurado vale para física E visual juntos — ajuste o slider de
raio se quiser outro tamanho.

## Testes
- `map.test.mjs`: novo "Parede física coincide com a parede visual" (limite exato em
  `arenaRadius − halfExtent`), novo "ArenaHalf legado NÃO cria parede invisível" e o
  teste de estresse de 100 seeds agora exige destrutíveis/obstáculos/plataformas/
  consumíveis dentro do raio efetivo − 2 m.
- `moves-contract.test.mjs`: o caso "projétil: limite da arena" agora documenta que
  `arenaHalf` **não** afeta a arena circular (era o comportamento antigo das paredes
  invisíveis).
- `physics3d.test.mjs` (cap explícito `circleCap`) e toda a cadeia
  `npm run test:combat-lab:unit`: aprovados.
