# MOVE Guard Break — `guard-break`
**Status:** design = proposta/decisão da fonte (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/5_MOVES_GENERICOS_PROMPT.md §4` · **Código:** `src/sim/moves/guard-break.js` · **Testes:** `test/moves-guard-break.test.mjs (16)`, `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Charge · Melee · **PL1 / PL2 / PL3** pela carga (<50% / <100% / 100% de 1 s) |
| Cobrança | 1,0 de stamina e 10 s **ao iniciar a carga**; interromper mantém os dois (regra Charge) |
| Ação | ao soltar vira um Tackle real de 0,7 s com o PL da carga; avança 2,6 m (MV-P20) |
| Dano / Knockback | 6 HP nominais, **não cresce com o PL** (MV-P19) · 2 m/s H, 0 V contra quem não defende |
| Contra guarda comum | derruba a guarda, **guard stun de 0,5 s** (MV-P18), dano reduzido, sem empurrão; o atacante segue o golpe (não recua) |
| Defesa perfeita | anula dano e stun (GM-P05 proposta) e o atacante recua; i-frames anulam tudo; Harden anula o knockback mas não o stun (GM-P06) |
| Clash | PL3 vence Tackle PL1; PL3 × PL3 disputa |
| Sliders | aba Moves › Guard Break (14) |
| Pendências | GM-P04…P07; MV-P18…P20 |
