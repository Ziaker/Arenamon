# MOVE Bounce — `bounce`
**Status:** design = proposta/decisão da fonte (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/MOVES_GENERICOS_CATALOGO.md §6` · **Código:** `src/sim/moves/bounce.js (+ gancho de passo `registerStepHook`)` · **Testes:** `test/moves-bounce.test.mjs (17)`, `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Charge · Trick + Melee · **PL1/PL2/PL3** (<50% / <100% / 100% de 1,2 s) |
| Cobrança | 1,2 de stamina e 12 s **ao iniciar a carga** |
| Ação | salto balístico REAL (voo com gravidade 17,5, sem arrasto): picos 1,5 / 2,5 / 3,5 m, até 6 m de distância (alvo travado mais perto limita); tetos, plataformas e sólidos vêm da física de voo; sem invulnerabilidade |
| Golpe | contato na descida (corpo + 0,3 m, mesma altura) e impacto do pouso (raio 1,4 m), uma vez por alvo, pela função de acerto das entidades: 12 HP nominais, 3 m/s H e 6 m/s V |
| PL | contra Tackle ofensivo: PL maior vence; igual anula os dois; menor perde (MV-P27) |
| Recuperação | 0,25 s após o pouso |
| Só no chão | MV-P04 (estados aéreos especiais pendentes) |
| Sliders | aba Moves › Bounce (15) |
| Pendências | MV-P04, MV-P27, MV-P28 |
