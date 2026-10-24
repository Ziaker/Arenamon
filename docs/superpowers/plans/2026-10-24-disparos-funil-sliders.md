# Disparos: funil real, sliders do padrão e atraso — Plano

> Executado de forma nativa nesta sessão (pedido do responsável: correções rápidas).

**Meta:** cumprir PADRAO_ATELIES_VFX §3–§4 nos disparos do atelier Areia/Pedra: afunilamento visível (perfil + offset focal + largura horizontal), cone/jato desenhados como funil, e todos os sliders que o documento lista, mais «Atraso do disparo».
**Spec:** docs/PADRAO_ATELIES_VFX.md (§3, §4.1–4.5, §5).

## Restrições globais
- Todo controle novo nasce neutro (visual padrão não muda; disparo padrão = Nenhum).
- Nenhum slider morto (dead-controls + shot-sliders), todos com unidade e texto de ajuda.

## Revisão (o que mais morde)
1. Atraso > 0 não pode criar nada antes da hora (teste: stage vazio até o atraso).
2. Raio final < inicial afina; > inicial abre (teste mede a malha do funil).
3. Offset focal negativo não gera raio negativo.

## Tarefas
- [x] T1 `shot-effect.ts`: `shotDelay`; funil (`funnelGeometry`, perfis linear/parabólico/exponencial, offset focal, largura horizontal `shotSquash`) usado por Cone (4.2) e Jato (4.4); `shotConeAngle`, `shotContraction`.
- [x] T2 `shot-effect.ts`: Burst `shotBladeWidth`, `shotFan`; Estrela `shotCoreThickness`.
- [x] T3 `config.ts`/`panel-model.ts`: linhas, textos, visibilidade por tipo, rótulos do perfil, Rocha esconde tudo.
- [x] T4 testes (`shot.test`, `funnel.test`), build, capturas, commit.
