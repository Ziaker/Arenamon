# MOVE Riposte — `riposte`
**Status:** design = proposta/decisão da fonte (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/5_MOVES_GENERICOS_PROMPT.md §6` · **Código:** `src/sim/moves/riposte.js + `riposteIntercept` em entity.js` · **Testes:** `test/moves-riposte.test.mjs (15)`, `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Normal · Status + Melee · **PL1** só no contra-golpe |
| Cobrança | 0,8 de stamina e 8 s no toque (MV-P11) |
| Postura | 0,65 s; janela de contra-ataque 0,13–0,30 s |
| Na janela | qualquer acerto elegível (Tackle, projétil, laser, área) é ANULADO (dano e knockback) e o contra-golpe sai NA HORA (MV-P24): Tackle PL1 rumo a quem atacou (6 HP nominais, 3 m/s H, alcance 1,6 m — MV-P25) com i-frames até o fim da janela |
| Não anula | Guard Break (triângulo tático); agarrões (não existem ainda) |
| Sem acerto | a janela fecha e o resto do cast é recuperação exposta |
| Sliders | aba Moves › Riposte (9) |
| Pendências | GM-P10…P12; MV-P24/P25 |
