# Auditoria e consolidação documental de VFX — 24/10/2026

## Escopo verificado e execução

- Fonte de partida: \`Ziaker/Arenamon\`, \`main\` @ \`052b4fe19b094aadc57972c43b8311d361ee5f8f\`, \`package.json\` versão 1.22.1 na leitura inicial.
- Inspecionados: árvore Git, sete documentos principais, [REGRAS_CRIACAO_MOVES](../REGRAS_CRIACAO_MOVES.md), documentos de passivas, fontes do legado, runtime, Quarks, sólidos e interface de seleção de renderizador.
- Conferidas fontes exclusivas: \`docs/regras-prototipos-vfx\` (\`REGRAS_PROTOTIPOS_VFX.md\`), \`codex/elemental-quarks-visual\` (\`LAB_AREIA_PEDRA.md\` e plano datado). **Somente documentação** copiada, não runtime ou protótipos.
- Acesso e mutação realizados diretamente no GitHub; o checkout local oficial e seu \`git status\` não estavam disponíveis. **Nenhum teste de jogo/browser, benchmark ou aprovação visual foi executado nesta tarefa.**

## Método de consolidação

1. Preservar especificações detalhadas em \`docs/vfx/efeitos/\` e o padrão de ateliês em \`docs/vfx/atelies/\`.
2. Manter arquivos de encaminhamento nos sete caminhos originais, para compatibilidade de referências antigas.
3. Copiar material de branches com identificação expressa de proveniência, distinguindo observação, declaração histórica e aprovação.
4. Corrigir **somente links Markdown relativos** necessários devido ao novo diretório dos documentos transferidos.
5. Criar [manual central](MANUAL_VFX.md), [inventário de sistemas](SISTEMAS_E_RENDERIZADORES.md), [matriz](MATRIZ_RASTREABILIDADE.md), [pendências](DECISOES_PENDENTES.md) e índices.
6. Atualizar apenas links/entradas documentais diretamente atingidos no portal e documentos de índice do repositório.
7. Validar árvore, conteúdo, links e diff via GitHub; resultados no PR e fechamento da tarefa.

## Inconsistências e limites encontrados

- Históricos de versões convivem com descrições correntes em \`MOVES_ELEMENTAIS_VISUAL_QUARKS.md\`.
- Padrão da \`main\` possui regras e \`[proposta]\` no mesmo documento; norma de outra branch acrescenta regras potencialmente conflitantes.
- Impacto de disparo: composição aberta na \`main\`, definida em registro de outra branch, sem adoção global presumida.
- \`VfxRuntime\` não apresenta paridade comprovada do legado; impacto D e variantes específicas de pouso/parede merecem revisão.
- \`PASSIVAS_IMPLEMENTACAO.md\` contém referência a wrapper ausente em \`main\` (\`src/view/passive-vfx.js\`).
- Benchmarks de todos os máximos simultâneos, GPU física e qualidade artística **não** foram confirmados.
- Branches examinadas podem seguir recebendo commits depois do snapshot auditado; reavaliar antes de integrar código.

## Garantias e não alterações

- Nenhum arquivo-fonte de jogo, simulação, shader, efeito, dependência ou configuração foi alterado.
- Não houve merge dos ramos externos ou descarte de decisões anteriores.
- A reorganização não transforma proposta visual, variante A/B/C, teste antigo ou relatório de agente em aprovação do responsável.
- Não foram renumeradas rodadas, alterados danos, marcos de tempo, cores, unidades ou regras mecânicas.

Veja [README.md](README.md) para o índice e [DECISOES_PENDENTES.md](DECISOES_PENDENTES.md) para conflitos deixados explícitos.
