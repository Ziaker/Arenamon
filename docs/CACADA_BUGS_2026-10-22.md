# Caçada de bugs de 22/10/2026 — v1.20.1

Método: revisão independente por três revisores (Moves/mira, visuais/VFX, IA/navegação) com reprodução por script, mais varredura aleatória própria (`prototypes/combat-lab/test/fuzz-partidas.mjs`, 5 lotes × 25–30 partidas por rodada, mapas variados, os 15 Moves, navegação ligada, IA nos dois lados). Cada defeito corrigido tem teste de regressão em `prototypes/combat-lab/test/bugs-cacada.test.mjs` (12 testes; confirmados como **falhando no código anterior** e passando agora). Verificação técnica; a aprovação visual é do responsável.

## Corrigidos

| # | Gravidade | Defeito | Causa | Correção |
|---|---|---|---|---|
| V1 | **Alta** | **Plataformas e caixas nunca ficavam translúcidas de verdade** (era a causa real do pedido «o objeto não fica transparente»; só o número da opacidade mudava) | O material nascia opaco: o shader `#define OPAQUE` força alfa 1 e mudar `transparent` sem `needsUpdate` não recompila (verificado em GPU real) | `checkOcclusion` marca `needsUpdate` ao virar transparente; teste de **pixel real** no navegador (azul 190 com oclusão × 66 sem) |
| V2 | Alta | Destrutíveis e rochas só chegavam a ~77% de opacidade, nunca aos 25% configurados | O desenho zerava a opacidade para 1 a cada quadro antes do easing | Opacidade só é reposta ao sair da prévia «ghost» |
| V3 | Média | Prévia «ghost» do destrutível podia aparecer opaca | O ramo ghost não ligava `transparent` | Liga `transparent` e `needsUpdate` |
| V4 | Média/baixa | Poeira, vento e corrida do VFX sólido nasciam no chão, enterrados, em cima de plataformas | Só `fire()` aplicava a altura do apoio | Poeira, vento, corrida e esquiva usam a altitude do lutador |
| V5 | Baixa/média | Estilhaços de golpe em alvo lançado quicavam num «chão» invisível na altura do alvo | `floor` somava a altitude de voo | `floor` usa o apoio (`groundY`), `y` usa a altitude |
| V6 | Baixa | `VfxSystem.fire()` sem `try/finally` deixava `lift`/`emitting` sujos se um efeito lançasse exceção | — | `try/finally` |
| V7 | Baixa | Círculo de alcance recriava a geometria todo quadro com espessura < 0,02 m (valor importado) | Comparação sem o mínimo | Compara com o valor efetivo |
| V8 | Baixa | Arestas do objeto ficavam nítidas com o objeto translúcido; ~250 alocações por quadro no teste de oclusão; `params` do burrow recriado por filho; explosão do Riposte lia `params` de outra ação | — | Arestas acompanham; teste sem alocação; içado; valida `def.riposte` |
| M1 | Média | **Bullet Punch atravessava paredes e obstáculos** e acertava o alvo atrás | A corrida invisível só era conferida no ponto de chegada | A corrida para no último ponto livre (como o Quick Attack) |
| M2 | Média | Bullet Punch **subia plataforma alta de graça** na chegada; `maxRise` era um slider morto | `getGroundHeight` com referência no alvo | Apoio vale até `maxRise` acima de onde o lutador estava |
| M3 | Média/baixa | Com **defesa (D) segurada**, tocar o slot do Quick Attack/Bullet Punch não fazia nada | O círculo de alcance desligava a guarda e a defesa o cancelava no passo seguinte | `guardSuppressed` como nos demais Moves |
| M4 | Baixa | **Dois Bullet Punch simultâneos:** o lutador 0 nunca acertava (alvo «ausente») | `targetOf` exigia alvo presente | Alvo em corrida invisível vale |
| M5 | Média | **Quem estava na corrida invisível podia ser pisado** (footstool) | A física do footstool não conferia `absent` | `b.absent` nas duas rotinas |
| N1 | **Alta** (rara) | **TypeError no planejador de navegação** se uma plataforma/obstáculo/rocha sumisse no meio da rota (92 de 256 execuções no cenário provocado; no jogo: golpe que destrói destrutível, explosão do Emerging Stone) | O caminho guardava índices de nós do grafo antigo; `main.js` não trata exceção no passo: o jogo congelaria | Assinatura do grafo no estado: muda → replaneja; nó inexistente → replaneja |
| N2 | Alta (desempenho) | Rocha do Emerging Stone subindo **reconstruía o grafo a cada passo por 0,4 s** (passo médio 0,08 → 13 ms, máx. 41 ms) | A altura que cresce entrava na assinatura | O grafo usa a altura FINAL da rocha |
| N3 | Média | **IA quase nunca subia a borda** (18% das vezes): largava sozinha | A guarda/esquiva do comando da IA contava como «soltar» | Pendurada, a IA espera em silêncio, sobe com Espaço + parede e larga de propósito se o topo estiver bloqueado |
| N4 | Média | A navegação **sobrescrevia o movimento de Moves em uso** (marcador do Emerging Stone arrastado, Lunge com direção trocada) e o salto da rota roubava o instante do Move | `acting` ignorava o slot 0, botão segurado, mira, carga e ação de Move | `acting` cobre tudo isso; salto da rota não toma o lugar de um Move |
| N5 | Média/baixa | Lunge, Swift, Spikes, Sand Wave e Quick/Bullet Punch **eram disparados no vazio** contra alvo inalcançável (só o Tackle era suprimido) | `suppressBlockedAttacks` só zerava o tackle | Também suprime esses Moves |
| N6 | Média | **IA nunca subia numa caixa de 2,2 m** (o obstáculo padrão): quem ficasse em cima ficava imune | `jumpMargin` 0,35 deixava o alcance do salto em 2,05 m | `jumpMargin` 0,1 (slider existente): a IA chega ao topo de 2,2 m |
| N7 | Baixa | IA do Emerging Stone ficava parada e soltava por tempo (mediana a 4,5 m do alvo) | O código dizia «mira o marcador» mas não movia | Depois do cast, conduz o marcador até o rival |

## Verificados e saudáveis (sem achado)
- Varredura aleatória: **0 achados em ~600 partidas** (NaN, fora da arena, stamina, ação/voo/mira/carga/pendurado presos, lutadores sobrepostos, exceções) depois das correções; antes, só os estados acima.
- Save/load com mira aberta, preparação, ausência e chegada reproduz o futuro bit a bit; valores extremos de `cast`/`vanish`; mira de alcance em esquiva, vault e no ar; slots 0–3; nenhum estado preso.
- Cenários de navegação (muro, corredor, rotas, plataforma, completo) 25/25; plataformas de 0,5 a 2,0 m 15–16/16; ledge pendurado no máximo 0,9 s.

## Conhecidos e NÃO corrigidos (baixa gravidade)
- Transparência em pilares/cilindros usa a caixa circunscrita (pode marcar oclusão por um canto que o cilindro não cobre).
- A IA do Spikes erra o marcador com a aceleração suave (24 m/s²); em todos os casos medidos ela já cancelava por alvo além do alcance (comportamento anterior).
- `nearestFree` do Bullet Punch usa o círculo da arena no fallback em arena quadrada (a física corrige no passo seguinte).
- Rochas do Emerging Stone (3 m) continuam inalcançáveis para a IA (acima do salto).
- O anel de blocos do cenário e a parede da arena continuam sem transparência.
- `npm test` completo ponta a ponta não foi rodado; `combat-windows` depende do `validation/personagem-studio.glb` local.
