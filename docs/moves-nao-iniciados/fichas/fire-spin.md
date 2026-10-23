# MOVE Fire Spin — `fire-spin`
**Status:** conceito **aprovado** pelo responsável (prompt de 22/10/2026, sem ID no repositório) · números **NÃO homologados** · **protótipo implementado e testado em 23/10/2026** · **homologação do diretor: pendente.**
**Fonte:** prompt `PROMPT_CODEX_ARENAMON_4_MOVES_ELEMENTAIS` (22/10/2026) · **Código:** `src/sim/moves/fire-spin.js` + extensões de `area` em `world.js` (apoio, oclusão) · **Testes:** `test/moves-fire-spin.test.mjs` (14).

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | **Normal** · Field · PL1 declarado na zona (sem Clash: áreas não disputam, decisão provisória FS-P01 A) |
| Entrada | segurar abre o marcador (3 m à frente, setas movem a 8 m/s, corpo parado), soltar confirma; inválido (fora de alcance 3D de 5 m, sem apoio, em parede ou sobre personagem) cancela **sem custo** |
| Cobrança | 1,0 de stamina e 11 s no passo da confirmação |
| Cronologia | cast 0,4 s (48 passos): a zona nasce no passo 48 (índice +47) depois de **revalidar** o local; recovery 0,2 s (24 passos); ação total 72 passos |
| Zona | cilindro de 1,6 m de raio × 2,4 m, sobre o apoio escolhido (plataformas valem), vida 2,4 s (288 passos, em tempo local: cada `impact` congela o mundo 1 passo de hitstop) |
| Pulsos | 4, em idade local 0 / 0,6 / 1,2 / 1,8 s; 2 HP nominais cada (× Ataque ÷ 20, MV-P13), **1 acerto por alvo por pulso**; sem teto acumulado (o teto de 8 HP do prompt = 4 × 2, redundante) |
| Knockback / stun | 0 / 0; **sem guard stun por padrão** (FS-P07 A: com o valor do motor, 0,514 s, a guarda trava ≈83% do tempo) |
| Oclusão | paredes e obstáculos entre o centro e o alvo bloqueiam o pulso (plano XZ; slider) |
| Apoio | perder o apoio (plataforma destruída) remove a zona (`fieldLost`) |
| Limite | 1 zona por dono (a nova substitui a antiga; slider `maxActive`) — FS-P04 provisório |
| Reflect / objetos | os pulsos ignoram o Reflect (não são `explosion`); objetos destrutíveis no volume levam dano por pulso (R8.7) |
| Parâmetros capturados | `C.world.fireSpin` copiado ao abrir o marcador (M28.4) |
| VFX | coluna translúcida, chamas em espiral, brasas, anel no chão e anel de pulso a cada pulso; arte provisória |
| Pendências | FS-P02 (oclusão em Y), FS-P05 (cancelamentos/falha), FS-P06 (ar), FS-P07 (hit stun multi-hit) |
