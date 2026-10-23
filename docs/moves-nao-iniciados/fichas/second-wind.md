# MOVE Second Wind — `second-wind`
**Status:** design = **proposta** (documento externo, não aprovada) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/moves-nao-iniciados/5_MOVES_GENERICOS_PROMPT.md` §7 · **Código:** `src/sim/moves/second-wind.js` · **Testes:** `test/moves-second-wind.test.mjs` (11), `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Normal · Status · **sem PL** |
| Cobrança | 0,8 de stamina e cooldown 12 s no início do cast (MV-P11) |
| Cast | 0,35 s (no documento a janela de cast é 42 passos a 120 Hz = 0,35 s: confere) |
| Efeito (5 s) | **+40% da stamina MÁXIMA por segundo** (MV-P09: o documento diz "+40%/s" sem base) via status com `tick` de 0,1 s; esquiva (C) e sprint **25% mais baratos** (novo atributo de status `mobilityCost`) |
| Não faz | recuperar HP, alterar cooldowns de Moves, dar invulnerabilidade |
| Stagger / KO | stagger não cancela; o efeito acaba na duração ou no KO |
| Coexistência | coexiste com Harden (testado); reuso renova |
| Interrupção do cast | stamina e cooldown ficam gastos, sem buff (como na proposta) |
| Parâmetros capturados | `C.world.secondWind` copiado ao iniciar o uso (M28.4): cost, cooldown, cast, duration, regenPctPerSecond, mobilityCostPct |
| VFX | anéis dourados ascendentes (`view/status-aura.js`); `reduceMotion` os congela, `noFlash` limita o brilho |
| Pendências | GM-P13 uso no ar (permitido hoje; não inventei restrição), GM-P14 stack com passivas de stamina (soma pelo mesmo `stat()` da passiva), GM-P15 visibilidade para o oponente (a aura é visível para todos) |
