# MOVE Spikes — `spikes`
**Status:** design = proposta/decisão da fonte (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/MOVES_GENERICOS_CATALOGO.md §5` · **Código:** `src/sim/moves/spikes.js + trap.js + aim-marker.js` · **Testes:** `test/moves-spikes.test.mjs (18)`, `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Normal · Field · **PL1** ofensivo (sem Clash: não é Tackle nem projétil) |
| Entrada | **mira por marcador**: segurar abre o marcador (3 m à frente, setas o movem a 8 m/s, corpo parado — MV-P29), soltar confirma; marcador inválido (fora do alcance 3D de 5 m, sem apoio, em parede ou personagem) vermelho, não volta sozinho e soltar CANCELA sem custo (MV-P30) |
| Cobrança | 1 de stamina e 10 s na confirmação; cast 0,4 s |
| Armadilha | entidade `trap`: 1,2 m de raio, 8 s, sobre o apoio escolhido (plataformas valem); armação 0,25 s (MV-P31); 1 acionamento: 6 HP nominais, sem knockback; o dono não aciona; invulnerável não aciona; defesa perfeita consome |
| Perda de apoio | a armadilha some sem efeito (MV-P05); dano comum para Sturdy |
| Sliders | aba Moves › Spikes (15) |
| VFX | cones cristalinos em anel que brotam em 0,25 s, piscam no último segundo; marcador verde/vermelho |
| Pendências | MV-P05, MV-P29…P31 |
