# MOVE Lunge — `lunge`
**Status:** design = proposta/decisão da fonte (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/5_MOVES_GENERICOS_PROMPT.md §3` · **Código:** `src/sim/moves/lunge.js` · **Testes:** `test/moves-lunge.test.mjs (14)`, `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Burst · Melee · **PL1** (Clash/Counter como o Tackle PL1) |
| Entrada | toque no slot; a pressão é a confirmação (MV-P11) |
| Cobrança | 0,75 de stamina e 6 s de cooldown no início do uso |
| Ação | UM Tackle real (`def.tackle`): colisão, defesa parcial/perfeita, i-frames do alvo e janelas são os do Tackle; avança 3,5 m em 0,6 s e fica onde parou |
| Dano / Knockback | 8 HP nominais (× Ataque ÷ 20, MV-P13) · 4 m/s horizontal, 0 vertical (empurrão deslizante, não voo) |
| I-frames do atacante | 0,133 s no começo (MV-P10, desligável por slider) |
| Cancelável | a partir de 0,45 s; janela ativa 0,19–0,26 s só vale com "janelas de combate" ligadas |
| Sliders | aba Moves › Lunge (11 controles) |
| VFX/SFX | os do Tackle; SFX pendente |
| IA | não usa ainda |
| Pendências | homologação dos números; MV-P10 (conversão de quadros do documento-fonte) |
