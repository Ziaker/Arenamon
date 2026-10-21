# MOVE Quick Attack — `quick-attack`
**Status:** design = proposta/decisão da fonte (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/MOVES_GENERICOS_CATALOGO.md §2` · **Código:** `src/sim/moves/quick-attack.js` · **Testes:** `test/moves-quick-attack.test.mjs (17)`, `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Burst · Melee · **PL1** |
| Entrada | toque; **sem adversário elegível a ≤ 7 m o Move nem começa** e não cobra (MV-P17) |
| Cobrança | 0,75 de stamina e 6 s no início |
| Ação | Tackle real com movimento por fases: ida (≤ 0,16 s, 7 m ÷ tempo) → volta ao ponto de partida (≤ 0,14 s) → recuperação 0,12 s; a ida termina no 1º contato, ao chegar, ao esgotar o tempo ou ao bater em sólido; a volta não é um 2º ataque |
| Dano / Knockback | 8 HP nominais · 4 m/s H, 0 V; a defesa do alvo NÃO faz o atacante recuar (`keepOnBlock`): o retorno acontece sempre |
| Elegível | vivo, em terra, ao alcance vertical do corpo; mais próximo, desempate pelo id |
| Sliders | aba Moves › Quick Attack (10) |
| IA | não usa ainda |
| Pendências | MV-P02 (origem inacessível: para onde parar, sem teleporte), MV-P16 (i-frames do atacante = 0), MV-P17 |
