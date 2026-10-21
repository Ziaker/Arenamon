# MOVE Bullet Punch — `bullet-punch`
**Status:** design = proposta/decisão da fonte (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/MUSHROOM_MOVES_DECISOES.md §2–3` · **Código:** `src/sim/moves/bullet-punch.js + followMarker (aim-marker.js)` · **Testes:** `test/moves-bullet-punch.test.mjs (18)`, `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Normal · **PL2** fixo (não é Charge) |
| Marcador | SEGUE o lutador: 3 m → 10 m em 2 s (quadrático), direção do input independente do corpo, para antes de obstáculo/borda; corpo a 30%; defesa cancela sem custo; pode abrir DURANTE uma esquiva (sem lentidão nela) e soltar a interrompe |
| Cobrança | 1,5× o custo do Tackle e 8 s na SOLTURA; marcador fixa no mundo; preparação 0,75 s a 30% (interrupção mantém custo) |
| Ausência | por 1 s o lutador NÃO EXISTE (`f.absent`): sem corpo, colisão, acerto nem seleção como alvo (nenhum colisor fantasma); speedlines |
| Retorno | no marcador (ou ponto válido mais próximo); procura o adversário mais próximo A PARTIR DO MARCADOR (raio 5 m); sem alvo: reaparece sem investida, recursos gastos; com alvo: investida PL2 em linha reta rumo à posição dele, até 3 m ou o 1º acerto, com a física do Tackle (MV-P34); velocidade de impacto com slider próprio |
| Sliders | aba Moves › Bullet Punch (13) |
| Pendências | recuperação sem alvo não definida; MV-P34 |
