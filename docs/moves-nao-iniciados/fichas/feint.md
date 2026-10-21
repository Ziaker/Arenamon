# MOVE Feint — `feint`
**Status:** design = proposta/decisão da fonte (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/5_MOVES_GENERICOS_PROMPT.md §5` · **Código:** `src/sim/moves/feint.js + `pressFeint` em controller.js` · **Testes:** `test/moves-feint.test.mjs (16)`, `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Burst · Trick · **sem PL** (não é Tackle: não entra em Clash/Counter) |
| Cobrança | 0,30 de stamina e 3 s na confirmação; o custo da ação cancelada NÃO volta (MV-P26) |
| Efeito | cancela Tackle/Lunge/Guard Break já solto/Quick Attack ainda na antecipação (≤ 0,133 s, nenhum acerto feito) ou qualquer carga em curso (Guard Break, Tackle carregado, Charge) e recua 0,25 m para trás ou para o lado do input com i-frames de 2 a 10 passos |
| Fora da janela | o Move é gasto sem efeito e a ação anterior CONTINUA (punível, MV-P21) |
| Encadeia | a partir de 0,033 s (MV-P23) |
| Sliders | aba Moves › Feint (8) |
| Pendências | GM-P08/P09; MV-P21/P22/P23/P26 |
