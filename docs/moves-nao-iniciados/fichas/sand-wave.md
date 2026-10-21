# MOVE Sand Wave — `sand-wave`
**Status:** design = proposta/decisão da fonte (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/MUSHROOM_MOVES_DECISOES.md §6 (SW-D01…D68)` · **Código:** `src/sim/moves/sand-wave.js + sand.js + vision.js` · **Testes:** `test/moves-sand-wave.test.mjs (24)`, `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Burst · PL1 · só no chão |
| Cobrança | 2 de stamina e 10 s na ATIVAÇÃO; preparação 0,25 s (sair do chão/interrupção cancela sem devolver) |
| Barragem | retângulo 4 (frente) × 3 m fixado no disparo, origem no centro da borda traseira; 1,5 s (0,75 s de hitbox + 0,75 s de dissipação); onda progressiva a (alcance ÷ 0,75) m/s pelo CAMINHO LIVRE MAIS CURTO (grade 0,25 m, recalculada a cada 6 passos), contorna sólidos e nunca os atravessa |
| Alvos | adversários em terra com os PÉS no retângulo original e alcançados pela onda; 6 HP fixos (não escalam com o Ataque), 1 acerto por alvo; invulnerável não gasta o acerto; parcial reduz dano/empurrão e NÃO impede a cegueira; perfeita anula tudo |
| Empurrão | 12 m/s² (6 na parcial) para a frente da direção fixada enquanto há contato na janela; suspende deslocamento e esquiva (pode atacar/defender); velocidade ganha se mantém e decai pelo atrito |
| Parede | para, stagger de 0,30 s sem dano; não repete enquanto pressionado |
| Cegueira | 4 s (reinicia, não soma); lock-on só em quem o cegado enxerga (10 m + linha de visão, basta uma parte do corpo); lock-on desligado não volta sozinho; IA cegada sem alvo perceptível fica defensiva (MV-P33); nuvem de areia visível a todos; fog 60% só na câmera do cegado |
| Sliders | aba Moves › Sand Wave (17) |
| Pendências | SW-P07 (arte NÃO aprovada: formas provisórias); MV-P32/P33 |
