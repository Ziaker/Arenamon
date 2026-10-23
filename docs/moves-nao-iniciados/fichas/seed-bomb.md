# MOVE Seed Bomb — `seed-bomb`
**Status:** conceito **aprovado** pelo responsável (prompt de 22/10/2026, sem ID no repositório; **substitui o Power Whip**, rejeitado) · números **NÃO homologados** · **protótipo implementado e testado em 23/10/2026** · **homologação do diretor: pendente.**
**Fonte:** prompt `PROMPT_CODEX_ARENAMON_4_MOVES_ELEMENTAIS` (22/10/2026) · **Código:** `src/sim/moves/seed-bomb.js` + esfera 3D, `y` herdado e `detonateOnly` em `world.js` · **Testes:** `test/moves-seed-bomb.test.mjs` (17).

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | **Normal** · Projectile + Field instantâneo (M22.7 B: projétil explosivo e explosão = uma entidade ofensiva) · PL1 fixo |
| Entrada | marcador de 8 m (3D) com **apoio sólido sob o destino** (não mira o ar); soltar confirma; inválido cancela sem custo |
| Cobrança | 1,0 de stamina e 8 s no passo da confirmação |
| Cronologia | cast 0,3 s (36 passos): a semente sai no passo 36 (índice +35); recovery 0,2 s (24 passos); ação de 60 passos |
| Arco | tempo de voo 0,65 s (78 passos), gravidade 17,5 (a do salto/Bounce; **o prompt não definia**), velocidade 3D máx. 20 m/s. Fórmula com correção da integração semi-implícita do motor (erro de pouso medido < 0,05 m). **Destino que exigir mais que a máxima FALHA** (sem corrigir a trajetória em silêncio) |
| Semente | raio 0,24 m, vida 1,25 s; **só detona** (ao tocar corpo ou superfície); sem contato até o fim da vida, dissolve **sem explodir**. O motor detecta o chão pelo centro e a plataforma pelo raio: a mira já compensa |
| Explosão | **esfera 3D** de 1,8 m (SB-P04 B), **nasce na altitude do impacto** (`y` herdado), oclusão por paredes (slider), radial a partir do centro; **um único evento de dano por alvo**: 10 HP nominais (× Ataque ÷ 20, MV-P13) |
| Knockback | H 3 / V 1 (V = 1 m/s sob a gravidade do motor é um salto de ≈1 cm) |
| Reflexão | a semente reflete antes de explodir; o dono e o dano da explosão passam a ser os de quem refletiu |
| Interações | defesa só protege com o centro da explosão no arco frontal; explosão destrói/é barrada pelo Reflect (M22.5); objetos destrutíveis no volume levam dano (R8.7) |
| Parâmetros capturados | `C.world.seedBomb` copiado ao abrir o marcador (M28.4) |
| VFX | semente facetada com folhas, esfera verde expansiva com malha e folhas lançadas; arte provisória |
| Pendências | SB-P01 (fórmula), SB-P02 (alvo/marcador inválido), SB-P05 (reflexão: provisório), SB-P08 (ar), SB-P09 (cancelamentos) |
