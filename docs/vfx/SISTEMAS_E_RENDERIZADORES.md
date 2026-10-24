# ARENAMON — Sistemas de VFX e renderizadores

**Inventário técnico (somente leitura), branch \`main\` @ \`052b4fe\`, 24/10/2026.** Não significa que todos os efeitos foram executados ou testados visualmente nesta auditoria.

## Composição observada no código

| Subsistema | Implementação | Integração/estado observado | Cuidado |
|---|---|---|---|
| Legado | \`prototypes/combat-lab/src/view/vfx.js\` — \`VfxSystem\` | Criado no \`view/view.js\`; \`useNewVfx=false\` no construtor | Renderizador ativo por padrão; contém \`hitD\`, eventos particulares |
| Runtime declarativo | \`src/view/vfx/{index,runtime,contract,registry,scheduler,pools,budget,presets,telemetry}.js\` | Registrado em \`view.js\`; ativado por \`useNewVfx=true\` via painel visual | Migrado parcialmente; não assumir paridade com legado |
| Definições por família | \`src/view/vfx/effects/{impact,defense,clash,landing,movement,status,environment,passives}.js\` | Registro por \`registerAllEffects\` inclui famílias importadas explicitamente em \`vfx/index.js\` | \`passives.js\` existe, mas não consta da lista \`ALL_DEFS\` usada por \`registerAllEffects\` na base consultada |
| three.quarks | \`src/view/quarks/{bridge,adapter,presets,elemental-preview,elemental-surfaces}.js\` | Ponte criada sob demanda em \`view.js\` se \`C.vfx.quarks.enabled\` | Camada adicional experimental; não substitui sozinha os outros renderizadores |
| Sólidos 3D | \`src/view/{solid-fx,solid-motion,smoke-volume}.js\` | Sistema \`SolidFx\` separado; materiais/malhas compartilhados e volumes | Custo de shader e de pixel precisa de medição real |
| Passivas atualmente conectadas | \`src/view/passive-abilities.js\` e \`src/ui/passive-banner.js\` | \`view.js\` instancia \`PassiveAbilitySystem\` | Não confundir com \`src/view/vfx/effects/passives.js\` |
| Elementais no jogo | \`src/view/elemental-fx.js\`, \`world-view.js\` | Visuais de entidades do combate | Aprovação de protótipo Quarks não significa integração automática |
| Ateliê Elemental | \`prototypes/combat-lab/elemental-lab/\`, \`src/view/quarks/elemental-preview.js\` | Página HTML offline gerada no build | Arquivos \`dist/\` são compilados, geralmente não versionados |
| Ateliê PSI/Fogo/Voador | \`prototypes/vfx-elemental/\` | Protótipo separado | Não presumir que sua arte esteja ativa no combate |
| Ateliê Areia/Pedra | \`prototypes/sand-stone-lab/\` em branch \`codex/elemental-quarks-visual\` | Material **não integrado à \`main\` auditada** | Não promover para fonte de gameplay/código oficial |

Os caminhos abreviados \`src/...\` nesta tabela são relativos a \`prototypes/combat-lab/\`, salvo quando indicado.

## Fatos verificados e incompatibilidades

- \`view.js\` instancia o sistema legado e \`VfxRuntime\`; o painel \`src/ui/visual-panel.js\` permite selecionar \`Legado (v6)\` ou \`VfxRuntime + Laser\`.
- \`VFX_IMPACTO_D.md\` documenta \`hitD\` no legado. \`src/view/vfx/effects/impact.js\` consultado contém variantes A/B/C e não a D: **não há paridade verificada**.
- \`VFX_POUSO_E_PAREDES.md\` descreve tratamentos particulares de pouso regular e impacto vertical no legado. O runtime novo contém definições genéricas para \`landing:ground\` e \`environment:wall\`, o que **não comprova** equivalência de comportamento.
- \`VFX_HABILIDADES_PASSIVAS.md\` corresponde ao subsistema \`passive-abilities.js\`. O documento \`PASSIVAS_IMPLEMENTACAO.md\` ainda cita um wrapper \`src/view/passive-vfx.js\` que **não foi encontrado** na árvore \`main\` auditada. Tratar como divergência documental, não corrigir gameplay sem pedido.
- O contrato de eventos em \`src/view/vfx/contract.js\` oferece \`adaptSimEvent\`, \`classifyVisualType\`, \`eventSeed\`, \`makeEventId\` e \`VFX_FAMILIES\`. Isso é uma base técnica, **não prova** ausência de bugs de idempotência, orientação ou pausar/replay.
- O \`registry.js\` descreve id, versão, trigger, duração, qualidade, agregação e replay. A equivalência visual entre famílias exige testes específicos.

## Verificações exigidas para uma futura migração

1. Identificar todos os eventos disparados no legado e no runtime, com resultado mecânico correspondente e identificador estável.
2. Comparar A/B/C/D, altura de plataformas, pouso regular, parede/objeto, passivas, colisões, reflexão, footstool, status e estado de pausa.
3. Comparar transparência/ordem de desenho, máscaras de acessibilidade, pooling, descarte e custo de GPU em cenários reproduzíveis.
4. Confirmar uma única saída audiovisual efetiva para cada evento; não duplicar feedback por manter renderizadores simultâneos.
5. Executar navegador e benchmark na máquina-alvo, preservando capturas e diferenças.
6. Solicitar autorização antes de tornar o runtime novo padrão ou remover legado.

**Nada dessa migração é realizado pela reorganização documental.**
