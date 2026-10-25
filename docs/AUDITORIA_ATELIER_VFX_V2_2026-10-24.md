# Auditoria: PADRAO_ATELIES_VFX v2.0 × Atelier Areia/Pedra (24/10/2026)

Escopo: documento [PADRAO_ATELIES_VFX.md](PADRAO_ATELIES_VFX.md) v2.0 contra `prototypes/sand-stone-lab` (v1.33.0). Evidência: `npm run test:sand-stone` (inclui `dead-controls`, `stone-trail`, `panel-model`) e capturas em `prototypes/sand-stone-lab/evidence/fases-24-10/`.

## Corrigido nesta rodada
| Item | Antes | Agora |
|---|---|---|
| Emerging Stone: trajeto subterrâneo | só linha laranja fina e calombo pequeno | calombo maior, faixa de terra revirada que cresce até o alvo, 56 torrões expelidos ao longo do caminho, poeira mais cheia; some após o contato; desligar «Corpo e trajeto» apaga tudo (`stone-trail.test.mjs`) |
| Fraturas pretas do Stone | espinhos pretos visíveis o tempo todo | opacidade acompanha a carga (invisíveis em t=0, plenas na erupção, somem na finalização) |
| Sliders mortos | 17 controles sem efeito no desenho | 476 controles verificados, todos mudam o desenho (`dead-controls.test.mjs`); os que não se aplicam ficam escondidos (`notUsed`) |
| Resultado da prévia (acerta/expira/interrompido) | só no Sand | Sand, Swift, Psyshock, Quick Attack, Bullet Punch (`outcome.ts`); escondido onde não se aplica (Stone, Riposte, Rocha) |
| Fases desligáveis e permanência parada | parcial | PhaseClock com `freeze`; as 24 propostas têm linha do tempo |
| `panel-model.test.mjs` | esperava 3 tipos de disparo | cobre os 6 tipos e a regra de controles escondidos |

## Cumprido (conforme o documento)
Seis fases com interruptor, seletor de disparo 0..5, afunilamento métrico, slider+número, exportar datado, importar com relatório, autosave, «Sem flash», «Movimento reduzido», portal/HTMLS, capturas, build offline.

## Aplicado na 2ª rodada (v1.33.0)
- **Recoil & Flash (§4.6)**: 5 controles novos na fase Disparo, todos nascem em 0 (visual padrão intacto) e somam a qualquer opção, inclusive «Nenhum»: clarão frontal, halo, coice do núcleo, ondas de choque (0–4) e jato de escape para trás. «Sem flash» zera o clarão. Teste: `recoil-theme.test.mjs`.
- **Tema por elemento (§7.3)**: Areia/Pedra = terra (grãos), Swift = estrela, Psyshock = psíquico, Bullet Punch = aço, Quick Attack = vento, Riposte = lutador. Cada um tem gradiente núcleo claro / corpo saturado / rastro escuro e a partícula do próprio Move (ponte cinética). Só vale com disparo ligado.
- **`sustain` → `hold`**: renomeado em código, painel e testes; presets e salvamentos antigos (`sustainOn`) migram sozinhos (`hold-migration.test.mjs`).

## Ainda NÃO aplicado (não foi feito, nem verificado)
1. Texto exato do aviso amarelo e slider na faixa base com campo numérico até 5×: parcial; não conferido controle a controle.
2. Gradiente de ≥3 cores nos efeitos próprios de cada Move (só os disparos têm o gradiente garantido) e legenda «carga» do Psyshock.
3. Capturas frontal e lateral por efeito: só a câmera padrão foi gravada.
4. Restaurar de fábrica global: existe «Restaurar padrão da opção» (uma proposta), não o reset de todos os controles do efeito.
5. «Coice do núcleo» move um núcleo próprio da camada, não a arma/corpo do Move.
6. Desempenho em GPU real não medido (trajeto do Stone: 56 torrões instanciados; camada Recoil: até 7 malhas pequenas).

## Ambiguidades do documento (sugestão de ajuste)
- §4.5 (linha ~134) diz o disparo acompanha o corpo, mas o §4.1 fala em «fase própria»: definir qual vale.
- «Hold» não tem duração padrão por efeito: hoje cada categoria usa o seu (Stone 1,85 s, Sand 0).
