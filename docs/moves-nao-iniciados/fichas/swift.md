# MOVE Swift — `swift`
**Status:** design = proposta catalogada (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação: pendente.**
**Fonte:** `docs/MOVES_GENERICOS_CATALOGO.md` §3 · **Código:** `src/sim/moves/swift.js` (reusa o motor de projéteis de `world.js`) · **Testes:** `test/moves-swift.test.mjs` (16), `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Burst · Projectile · **PL1** (Clash/Counter como as pedras: PL1 × PL1 anula) |
| Entrada / cobrança | toque; stamina 0,8 e cooldown 7 s no início do uso (MV-P11); `aim: 'target'` |
| Estrelas | 3 (slider), saem à frente do lançador com espaçamento lateral; colisores e acertos individuais |
| Velocidade / alcance | 15 m/s / 12 m (vida = alcance ÷ velocidade) |
| Dano | 3 HP nominais por estrela; final = nominal × Ataque ÷ referência (MV-P13); defesa/escudo/i-frames pelo `applyHit` |
| Knockback | 0,3 m/s H por acerto, teto **0,9 m/s por alvo e execução**, V = 0 |
| Homing | só com lock-on: 0,25 s a 90°/s, cada estrela persegue um ponto próprio da caixa do alvo; sem lock-on: leque frontal de 20° (provisório) |
| Reflexão | pelo Reflect: dono troca, homing cancelado, dano recalculado com o Ataque do refletor (sem duplicar) |
| Ação | 0,25 s de duração da ação (recuperação do Burst; provisório MV-P14) |
| Parâmetros capturados | `C.world.swift` copiado no início do uso; estrelas já no ar guardam `captured`/dano/velocidade (M28.4) |
| VFX | malha de estrela branco-dourada (duas pirâmides cruzadas + núcleo) com giro; fragmentação ao acertar herda do VFX de pedras |
| SFX | pendente |
| Pendências | MV-P13 (dano nominal vs Ataque), MV-P14 (recuperação do Burst), IA (M10) |
