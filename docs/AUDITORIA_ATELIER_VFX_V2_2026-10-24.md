# Auditoria: PADRAO_ATELIES_VFX v2.0 × Atelier Areia/Pedra (24/10/2026)

Escopo: documento [PADRAO_ATELIES_VFX.md](PADRAO_ATELIES_VFX.md) v2.0 contra `prototypes/sand-stone-lab` (v1.32.0). Evidência: `npm run test:sand-stone` (inclui `dead-controls`, `stone-trail`, `panel-model`) e capturas em `prototypes/sand-stone-lab/evidence/fases-24-10/`.

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

## Ainda NÃO aplicado (não foi feito, nem verificado)
1. **Camada Recoil & Flash (§4.6)**: não existe. O `shot-effect.ts` é de outro agente, com trabalho ainda não commitado; mexer nele agora conflitaria.
2. **Tema por elemento nos disparos (§4.x, anti-«carimbo»)** e ponte cinética: os 6 disparos usam a mesma cor/forma em Areia e Pedra.
3. **Renomear `sustain` → `hold`** (e migrar `sustainOn` nos presets salvos): o nome ainda é `sustain` por dentro; na tela a fase aparece como «Duração em cena/Permanência».
4. **Texto exato do aviso amarelo** e **slider na faixa base com campo numérico até 5×**: parcial; não conferido controle a controle.
5. **Gradiente de ≥3 cores por efeito** e legenda «carga» do Psyshock: não auditado.
6. **Capturas frontal e lateral por efeito**: só a câmera padrão foi gravada.
7. **Restaurar de fábrica global**: existe «Restaurar padrão da opção» (uma proposta); o reset de todos os controles do efeito não existe.
8. Desempenho em GPU real do novo trajeto (56 torrões instanciados, 1 draw call) não foi medido.

## Ambiguidades do documento (sugestão de ajuste)
- §4.5 (linha ~134) diz o disparo acompanha o corpo, mas o §4.1 fala em «fase própria»: definir qual vale.
- «Hold» não tem duração padrão por efeito: hoje cada categoria usa o seu (Stone 1,85 s, Sand 0).
