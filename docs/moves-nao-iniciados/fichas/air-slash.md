# MOVE Air Slash — `air-slash`
**Status:** conceito **aprovado** pelo responsável (prompt de 22/10/2026, sem ID no repositório) · números **NÃO homologados** · **protótipo implementado e testado em 23/10/2026** · **homologação do diretor: pendente.**
**Fonte:** prompt `PROMPT_CODEX_ARENAMON_4_MOVES_ELEMENTAIS` (22/10/2026) · **Código:** `src/sim/moves/air-slash.js` + `captureAim` em `controller.js` · **Testes:** `test/moves-air-slash.test.mjs` (14).

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | **Burst** · Projectile · **PL1 fixo** |
| Entrada | **toque** (o prompt dizia "confirmar na soltura", mas o Burst do motor confirma na pressão: decisão AS-P08, padrão provisório = pressão). Mira com alvo travado **capturada no toque**, sem perseguir |
| Cobrança | 0,8 de stamina e 6 s **no passo do toque** (Burst, MV-P11) |
| Cronologia | startup 8 passos sem hitbox; a lâmina nasce no passo 8 (índice 7); recovery 20 passos; ação de 28 passos |
| Lâmina | 1 projétil reto, 22 m/s, alcance 10 m (vida = alcance ÷ velocidade ≈ 55 passos), sem homing, `pierce 1`, PL1, `clashable`; **colide como círculo de raio 0,6 m** (AS-P02 A); o desenho é a caixa 1,20 × 0,70 × 0,22 do prompt |
| Dano | 8 HP nominais (× Ataque ÷ 20, MV-P13) |
| Knockback | H 2,5 / V 0 ⇒ empurrão de 3,75 m e 0,63 s de recuperação (EL-P04 A). Hitstop padrão de 1 passo por `impact` |
| Origem | altitude do atirador + 0,8 m; sólido no ponto de nascimento ⇒ a lâmina se dissipa (Burst gasto sem efeito) |
| Interações | Reflect, Clash lâmina × lâmina (PL1), Tackle PL1; alvo invulnerável consome a lâmina sem dano |
| Parâmetros capturados | `C.world.airSlash` copiado ao apertar (M28.4); startup/recovery configuráveis |
| VFX | crescente branco-azulado com contorno, estelas finas; arte provisória |
| Divergências do prompt | alcance 10 m × vida 0,60 s incoerentes a 22 m/s (vale o alcance); a caixa orientada não é representável pelo motor |
| Pendências | AS-P01 (fórmula), AS-P02 (colisor final), AS-P03 (cancelamentos), AS-P04 (spawn perto de parede), AS-P05 (reflexão), AS-P08 (pressão × soltura) |
