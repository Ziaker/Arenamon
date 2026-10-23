# MOVE Water Pulse — `water-pulse`
**Status:** conceito **aprovado** pelo responsável (prompt de 22/10/2026, sem ID no repositório) · números **NÃO homologados** · **protótipo implementado e testado em 23/10/2026** · **homologação do diretor: pendente.**
**Fonte:** prompt `PROMPT_CODEX_ARENAMON_4_MOVES_ELEMENTAIS` (22/10/2026) · **Código:** `src/sim/moves/water-pulse.js` + `projectile-util.js` · **Testes:** `test/moves-water-pulse.test.mjs` (15), `test/ai-elemental.test.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | **Charge** · Projectile · **PL1/PL2/PL3 pela carga** (PL2 em 90 passos, PL3 em 180) |
| Entrada | segurar carrega até 1,5 s (180 passos a 120 Hz), soltar dispara; defesa/C (≥0,2 s)/golpe/perda de apoio interrompem. Direção 3D e alvo travado capturados **na soltura** |
| Cobrança | 1,0 de stamina **e** 9 s de recarga na **ativação** da carga (norma universal; `cooldownOnStart`). Interromper mantém a recarga cheia |
| Emissão | **no passo da soltura** (decisão provisória WP-P08 A); recuperação de 0,30 s (36 passos) a partir da soltura |
| Projétil | 1 esfera, raio 0,38 m, 14 m/s, alcance 12 m (vida = alcance ÷ velocidade ≈ 103 passos), sem homing, `pierce 1`, `clashable`, PL fixo da carga |
| Dano | 6 / 9 / 12 HP nominais por PL; final = nominal × Ataque ÷ 20 (MV-P13), gravado no disparo; reflexão recalcula com o Ataque do refletor |
| Knockback | H 2 / 3 / 4, V 0. **No motor, V = 0 é empurrão de 1,5 × H metros (3,0 / 4,5 / 6,0 m) com 0,63 s de recuperação** (EL-P04 A) |
| Origem | altitude do atirador (chão, plataforma, voo) + 0,8 m; sólido no ponto de nascimento ⇒ **falha com reembolso** (sem teletransporte) |
| Interações | Reflect (PL ≤ barreira reflete; PL maior destrói e é neutralizado), Clash/Counter de projétil e de Tackle, Harden anula o empurrão |
| Parâmetros capturados | `C.world.waterPulse` copiado ao apertar (M28.4); sliders na aba Moves › Water Pulse |
| VFX | esfera de água com núcleo, dois anéis em órbita (cor do PL) e gotas; arte provisória |
| SFX | pendente |
| Divergências do prompt | alcance 12 m × vida 1,0 s eram incoerentes a 14 m/s (vale o alcance); sem teto para projéteis no motor; "emissão no passo 12" não é suportada pelo Charge |
| Pendências | WP-P01 (fórmula base × efetivo), WP-P02 (mobilidade), WP-P03 (reembolso na interrupção), WP-P04 (retenção máxima de 0,30 s: não implementada), WP-P06 (teto) |
