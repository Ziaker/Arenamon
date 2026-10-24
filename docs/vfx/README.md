# ARENAMON — Central documental de VFX

**Entrada oficial para agentes e desenvolvedores.** Consulte primeiro [MANUAL_VFX.md](MANUAL_VFX.md). Este diretório reúne normas, especificações especializadas, inventário dos renderizadores, proveniência e histórico, sem modificar a simulação nem homologar propostas.

- **Base auditada:** branch \`main\` no commit \`052b4fe19b094aadc57972c43b8311d361ee5f8f\`, em 24/10/2026.
- **Atenção:** há documentos exclusivos das branches \`docs/regras-prototipos-vfx\` e \`codex/elemental-quarks-visual\`. Estão identificados como fontes de consulta, não como merges ou aprovações.
- **Regra de precedência:** a aprovação expressa e rastreável do responsável não pode ser substituída silenciosamente por uma implementação, protótipo ou proposta. Divergências ficam abertas na [matriz](MATRIZ_RASTREABILIDADE.md).

## Navegação

| Necessidade | Documento |
|---|---|
| Criar ou revisar qualquer VFX | [MANUAL_VFX.md](MANUAL_VFX.md) |
| Entender legado, runtime, Quarks, sólidos e passivas | [SISTEMAS_E_RENDERIZADORES.md](SISTEMAS_E_RENDERIZADORES.md) |
| Identificar aprovação, código, testes, fontes e lacunas | [MATRIZ_RASTREABILIDADE.md](MATRIZ_RASTREABILIDADE.md) |
| Pendências que exigem decisão humana | [DECISOES_PENDENTES.md](DECISOES_PENDENTES.md) |
| Efeitos existentes e especificações detalhadas | [efeitos/README.md](efeitos/README.md) |
| Normas e laboratórios de prototipação | [atelies/README.md](atelies/README.md) |
| Planos, origens, revisões e material de outras branches | [historico/README.md](historico/README.md) |
| Método, escopo, limitações e validação da auditoria | [AUDITORIA_CONSOLIDACAO_2026-10-24.md](AUDITORIA_CONSOLIDACAO_2026-10-24.md) |

## Política de manutenção

1. Escrever regras gerais apenas no **manual**; documentos especializados mantêm valores, formas, variantes e particularidades próprias.
2. Cada mudança normativa identifica a decisão de origem, data, status, impacto e referências ao código/testes. Não basta uma nova descrição em um arquivo de efeito.
3. Não remover histórico, números, alternativas, exceções ou pendências só para eliminar duplicidade. Referencie os originais em vez de reescrevê-los.
4. VFX não define acerto, hitbox, dano, stamina, i-frame, estados de combate, física ou tempo mecânico.
5. Novas especificações podem descrever *propostas*. Apenas aceitação explícita do responsável altera status de aprovação.
6. Paths antigos em \`docs/\` são redirecionamentos de compatibilidade; use os links desta pasta em novos documentos.
7. Preserve o protocolo de trabalho e entrega de [AGENTS.md](../../AGENTS.md). Para Moves, mantenha [REGRAS_CRIACAO_MOVES.md](../REGRAS_CRIACAO_MOVES.md) como autoridade mecânica, com este manual para o audiovisual.

**Nota de integridade:** esta reorganização é exclusivamente documental. Testes executados ou aprovações artísticas anteriores só são citados como alegações registradas nas fontes; não são certificados novamente por esta mudança.
