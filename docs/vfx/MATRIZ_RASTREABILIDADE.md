# ARENAMON — Matriz de rastreabilidade de VFX

Base: \`main\` @ \`052b4fe\`, inspecionada em 24/10/2026. **Status** distingue norma registrada, fonte de branch, implementação vista no código, limitação e homologação. "Teste existente" não significa "teste executado nesta auditoria".

| ID | Assunto | Fonte documental / origem | Código/teste identificado | Status e ressalva |
|---|---|---|---|---|
| VFX-01 | Fases de ateliê, sliders, autosave e limites | [Padrão de Ateliês](atelies/PADRAO_ATELIES_VFX.md), \`main\` | \`elemental-lab/\`; \`test/elemental-*.browser.mjs\` | **Norma registrada**; adoção desigual, conforme seção 8 do original |
| VFX-02 | Regra complementar de estilo/3 opções/fases \`n/a\` | [Regras de Protótipos](atelies/REGRAS_PROTOTIPOS_VFX.md), branch \`docs/regras-prototipos-vfx\` (blob \`41784057\`) | Não integrado à \`main\` | **Candidato**, não homologado pela simples cópia |
| VFX-03 | 24 opções Areia/Pedra, fases e controles | [Ateliê Areia/Pedra](atelies/LAB_AREIA_PEDRA.md), \`codex/elemental-quarks-visual\` (blob \`7829367d\`) | \`prototypes/sand-stone-lab/\` só na branch; \`timelines.test.mjs\` no branch | **Material exclusivo de branch**; plano alega testes, não executados aqui |
| VFX-04 | Arquitetura de fases do laboratório externo | [Plano 24/10](historico/PLANO_VFX_FASES_AREIA_PEDRA_2026-10-24.md), blob \`d8644b80\` | \`src/phases.ts\`, \`src/shot-effect.ts\` apenas em branch | **Plano e relatório histórico**, não base de aprovação global |
| VFX-05 | Água, Fogo, Vento, Seed Bomb: prévias Quarks | [Visual Quarks](efeitos/MOVES_ELEMENTAIS_VISUAL_QUARKS.md), \`main\` | \`src/view/quarks/\`, \`test/elemental-quarks.browser.mjs\`, \`elemental-variants.browser.mjs\` | **Protótipo visual** com revisões históricas dentro do mesmo documento |
| VFX-06 | Water Pulse: 40+13 controles, exceção 300× | [Visual Quarks](efeitos/MOVES_ELEMENTAIS_VISUAL_QUARKS.md); [Padrão](atelies/PADRAO_ATELIES_VFX.md) | \`test/elemental-water-controls.browser.mjs\`; \`elemental-shot.browser.mjs\` | **Documentado**; desempenho nos extremos simultâneos não confirmado |
| VFX-07 | PSI/Fogo/Voador: propostas A/B/C e exportação | [Elemental Psíquico](efeitos/VFX_ELEMENTAL_PSIQUICO.md), \`main\` | \`prototypes/vfx-elemental/\`; \`npm run test:vfx-elemental\` | **Laboratório**, não aprovação de arte no jogo |
| VFX-08 | VFX sólidos 3D, poeira/vento/fumaça | [Sólidos](efeitos/VFX_SOLIDOS.md), \`main\` | \`src/view/{solid-fx,solid-motion,smoke-volume}.js\`; \`test/solid-vfx*.mjs\`, \`solid-motion.test.mjs\` | **Implementação descrita**; medições Headless/SwiftShader não equivalem a GPU física |
| VFX-09 | Impacto D: direção normal, dano/impulso | [Impacto D](efeitos/VFX_IMPACTO_D.md), \`main\` | \`src/view/vfx.js\` (\`hitD\`); \`test/vfx.test.mjs\` | **Legado presente**; runtime novo sem variante D observada |
| VFX-10 | Pouso regular e impacto vertical em parede | [Pouso/Paredes](efeitos/VFX_POUSO_E_PAREDES.md), \`main\` | \`src/view/vfx.js\`; \`src/view/vfx/effects/{landing,environment}.js\` | **Legado específico**; runtime novo tem efeitos básicos, sem equivalência demonstrada |
| VFX-11 | Passivas: lateral e sparkles 0,5s | [Passivas VFX](efeitos/VFX_HABILIDADES_PASSIVAS.md), \`main\` | \`src/view/passive-abilities.js\`, \`src/ui/passive-banner.js\`, \`test/passive-abilities*.mjs\` | **Implementação ligada ao jogo** identificada; não confundir com outra estrutura |
| VFX-12 | Passivas: wrapper mencionado em doc antiga | [PASSIVAS_IMPLEMENTACAO](../PASSIVAS_IMPLEMENTACAO.md) | \`src/view/passive-vfx.js\` ausente na \`main\`; \`src/view/vfx/effects/passives.js\` presente | **Divergência documental**, requer revisão específica |
| VFX-13 | Contrato visual read-only e replay | [Regras de Moves](../REGRAS_CRIACAO_MOVES.md); [código do runtime](SISTEMAS_E_RENDERIZADORES.md) | \`src/view/vfx/{contract,registry,runtime}.js\`, \`test/vfx.test.mjs\` | **Contratos disponíveis**, idempotência plena não auditada funcionalmente |
| VFX-14 | Sand Wave e Emerging Stone: mecânica ≠ dissipação | [MUSHROOM_MOVES_DECISOES](../MUSHROOM_MOVES_DECISOES.md) | \`src/sim/moves/{sand-wave,emerging-stone}.js\`; \`test/moves-*.test.mjs\` | **Mecânica rege VFX**; laboratório de branch não altera esses parâmetros |
| VFX-15 | Moves genéricos: apresentação por Move | [REGRAS_CRIACAO_MOVES](../REGRAS_CRIACAO_MOVES.md), [MOVES_GENERICOS_CATALOGO](../MOVES_GENERICOS_CATALOGO.md) | \`src/sim/moves/\`, \`src/view/\` | **Regras por Move preservadas**; sem migração de documentação mecânica |
| VFX-16 | Acessibilidade: sem flash, movimento reduzido | [Padrão](atelies/PADRAO_ATELIES_VFX.md), [Regras de Moves](../REGRAS_CRIACAO_MOVES.md) | \`src/view/vfx.js\`, \`src/view/quarks/\`, \`src/ui/visual-panel.js\` | **Contrato documentado**; cobertura por família requer teste |
| VFX-17 | Portal e documentação offline | [AGENTS](../../AGENTS.md) | \`ABRIR_ARENAMON.html\`, \`HTMLS_ARENAMON.html\` | **Obrigação de entrega**, não implica que \`dist/\` esteja versionado |
| VFX-18 | Aprovação estética e qualidade em GPU física | Fontes e galerias vinculadas acima | Testes históricos de navegador/capturas | **Não comprovada nesta auditoria**; não homologar por inferência |

## Pendências rastreáveis

- **P01:** grupos de seis fases sempre construídos × declaração \`n/a\` permitida em fonte de branch.
- **P02:** camada de impacto de disparo se soma ao seletor × pendência explícita na \`main\`.
- **P03:** estilo final e regras gerais de Quarks fora do domínio dos ateliês.
- **P04:** paridade dos renderizadores e Impacto D.
- **P05:** fonte de verdade das passivas e documento antigo citando wrapper ausente.
- **P06:** limites de desempenho medidos em GPU real e combinação de sliders extremos.
- **P07:** aprovação artística e integração das 24 propostas Areia/Pedra.
- **P08:** documentação de estado atual por Move versus versões históricas dentro do mesmo arquivo.

Detalhes e evidências em [DECISOES_PENDENTES.md](DECISOES_PENDENTES.md). As fontes integrais permanecem acessíveis pelos links da tabela e pelo histórico Git. **Nenhum teste foi executado por esta matriz.**
