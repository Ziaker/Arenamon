# MOVE Emerging Stone — `emerging-stone`
**Status:** design = proposta/decisão da fonte (números NÃO homologados) · implementado e testado em `feat/moves-novos` · **homologação do diretor: pendente.**
**Fonte:** `docs/MUSHROOM_MOVES_DECISOES.md §7 (ES-D01…D103) e EMERGING_STONE_PROMPT_IMPLEMENTACAO.md` · **Código:** `src/sim/moves/emerging-stone.js + stone.js` · **Testes:** `test/moves-emerging-stone.test.mjs (26)`, `test/moves-new.browser.mjs`.

| Campo | Valor |
|---|---|
| Categoria / Tipo / PL | Normal · sem PL |
| Cronologia C (ES-D103) | pressionar INICIA o cast de 0,55 s (corpo a 30%); o marcador se ajusta (3–10 m, 3D); dispara só com cast concluído E botão solto com destino válido; pode começar no ar mas precisa estar apoiado ao concluir; perder o apoio no cast cancela |
| Cobrança | 3 de stamina e 9 s só no disparo (antes do projétil); sem reembolso |
| Projétil | entidade `burrow`: nasce onde o lutador está no disparo, linha reta 3D a 15 m/s, atravessa paredes/buracos, sem dano no trajeto; persiste se o dono for derrotado (o laboratório encerra a rodada no KO, então ele é descartado sem detonar) |
| Explosão | raio HORIZONTAL de 5 m, através de paredes: adversários APOIADOS levam 20 nominais (× Ataque ÷ 20, MV-P13) e empurrão radial de 8 m/s, uma vez; no ar não; depois destrói o cenário tocado INTEIRO (paredes, obstáculos, plataformas, destrutíveis — não renascem na rodada) e cria a rocha |
| Rocha | destrutível do mapa: prisma 3×3×3 m × escala (0,25–4×), emerge em 0,40 s com o colisor crescendo; base integralmente apoiada e sem sobrepor sólidos, senão o lugar válido mais próximo (a explosão fica no marcador); sem lugar, só a explosão; 5 HP (golpe válido: sem PL 1, P1 2, P2 3, P3 4); primeira interseção lança uma vez (8 H/14 V) sem dano; topo sustenta; perda de apoio destrói em cascata; 3 por dono (a mais antiga que sobrou sai); fim de rodada remove tudo |
| Sliders | aba Moves › Emerging Stone (23) |
| NÃO feito nesta entrega (declarado) | plataformas MÓVEIS (o mapa atual só tem plataformas fixas); rampas/terreno inclinado (as plataformas do motor são planas); trilha de terra e VFX final; HUD dedicado de rochas/fase; cenários rápidos no painel de Cenários; atraso de visibilidade do marcador para adversários além do ocultamento do anel (o anel do adversário não é desenhado, mas a IA não usa o Move ainda); empilhar sobre rocha de OUTRO dono funciona pela mesma regra de apoio, mas não tem teste dedicado |
| Pendências | MV-P35; ES-* que exigem decisão (ver ficha); homologação |
