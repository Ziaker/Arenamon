# ARENAMON — Manual central de VFX

**Norma de consulta central e especificação transversal.** Escopo: efeitos visuais 3D do jogo principal, Moves, passivas, interações do cenário, ateliês, UI de edição e integração futura. **Não é uma autorização para modificar gameplay, substituir renderizadores ou escolher variantes artísticas.**

**Base verificada:** \`Ziaker/Arenamon\`, branch \`main\` em \`052b4fe\` (24/10/2026). Documentos que existem apenas em outras branches são classificados como fontes complementares/pendentes. O estado atual deve sempre ser reconfirmado no código antes de implementar.

## 1. Autoridade, aprovação e escopo

1. **Decisão aprovada:** exigência expressa e identificável do responsável, documentada na fonte de origem. Preservar valores, exceções, marcos e identificadores.
2. **Implementado:** comportamento que o código efetivamente apresenta na versão consultada; pode ser provisório ou divergir de uma decisão. Implementação não equivale a aprovação visual/mecânica.
3. **Proposta:** alternativa, ideia de agente ou padrão rotulado \`[proposta]\`; não converter em regra sem autorização.
4. **Histórico/substituído:** conservar a íntegra para rastreabilidade, mas não tratar um desenho anterior como especificação corrente.
5. **Não verificado:** afirmação de plano, relatório antigo ou branch não integrada sem execução independente recente.
6. **Conflito:** registrar em [DECISOES_PENDENTES.md](DECISOES_PENDENTES.md) com links e alternativas; não usar silenciosamente a regra mais conveniente.

Este manual sintetiza exigências já documentadas em [PADRAO_ATELIES_VFX](atelies/PADRAO_ATELIES_VFX.md), [REGRAS_CRIACAO_MOVES](../REGRAS_CRIACAO_MOVES.md), [AGENTS](../../AGENTS.md) e nas [especificações](efeitos/README.md). **Não revoga** esses registros. A norma complementar de outra branch, [REGRAS_PROTOTIPOS_VFX](atelies/REGRAS_PROTOTIPOS_VFX.md), permanece marcada como fonte não integrada até decisão explícita.

## 2. Contrato inegociável entre combate e apresentação

- **A simulação é a autoridade:** origem, alvo, posição física, normal de contato, altura do apoio, trajetória, sucesso/falha, PL, estado e momento do acerto. A representação não cria acerto, não prolonga hitbox, não aplica dano nem interfere em cooldown, stamina ou física.
- **Separar tempos:** timeline visual, vida de partículas, janela ofensiva, hitstop, recuperação e duração de status são conceitos distintos. O VFX pode continuar dissipando após cessar a hitbox, sem novo efeito mecânico.
- **Eventos distintos têm apresentações distinguíveis:** preparar/cancelar; disparar/errar; acertar/ser bloqueado/defesa perfeita/invulnerabilidade; Clash, Counter, Reflect; colidir com parede/chão; expirar; KO e limpeza. Nunca apresentar um hit visual quando não houve hit real.
- **Posicionamento correto:** seguir âncoras e escala do personagem, altitude de plataforma e normal do contato. Não projetar tudo em \`y=0\`. Efeitos de parede acompanham a superfície correta, não um círculo genérico no chão.
- **Uma única resposta por evento lógico:** não duplicar VFX em atualizações sucessivas, frames pausados, replay, múltiplos renderizadores ou eventos derivados. Definir identidade do evento e política de agregação.
- **Instâncias em curso preservadas:** alteração de slider/preset deve afetar novos efeitos, salvo ajuste em tempo real explicitamente contratado pelo sistema. Para Moves aplica-se a captura de parâmetros do contrato M28.4.

Fontes mecânicas: [REGRAS_CRIACAO_MOVES.md](../REGRAS_CRIACAO_MOVES.md) §§ 14, 15 e 29; [JANELAS_COMBATE_RESOLVE_HIT.md](../JANELAS_COMBATE_RESOLVE_HIT.md) para janelas; [MUSHROOM_MOVES_DECISOES.md](../MUSHROOM_MOVES_DECISOES.md) para exceções do Mushroom.

## 3. Ciclo visual obrigatório nos ateliês de ataques, projéteis e objetos

O [padrão vigente na \`main\`](atelies/PADRAO_ATELIES_VFX.md) exige seis grupos construídos, apresentados na ordem e com interruptores por fase:

| Ordem | Fase de apresentação | Pergunta a responder |
|---|---|---|
| 1 | Conjuração / surgimento | Onde e como a forma visual surge? O que ocorre se a ação falhar/cancelar? |
| 2 | Disparo / lançamento | Origem, direção, impulso, coice, clarão, ondas ou jato |
| 3 | Corpo / trajeto | Geometria, silhueta, animação, rastro e aderência à trajetória real |
| 4 | Duração / sustentação | Quanto permanece, o que varia ao longo da vida e como a sustentação cessa |
| 5 | Finalização ou contato | Diferenciar expiração, interrupção, reflexão, colisão e término normal |
| 6 | Contato / explosão / encerramento | Resultado visual apenas quando o desfecho correspondente ocorrer |

**Regra do ateliê \`main\`:** cada grupo tem interruptor próprio; desligar uma fase não apaga seus parâmetros. O grupo desabilitado permanece visível e esmaecido, deixa de executar, é omitido da legenda e seu estado entra em salvar/exportar/importar. Desligar todas as fases deve produzir feedback legível, conforme a proposta do padrão (a obrigatoriedade desse aviso está registrada como proposta no documento de 23/10).

**Não confundir grupos editoriais com seis intervalos necessariamente consecutivos na simulação.** Duração é também uma propriedade do efeito; contato e disparo podem ser eventos pontuais ou camadas associadas a outros intervalos. O ateliê de outra branch usa um relógio para partes sequenciais e trata disparo/contato separadamente. Essa implementação não altera por si só a norma de todos os outros ateliês.

**Conflito pendente:** o documento [REGRAS_PROTOTIPOS_VFX](atelies/REGRAS_PROTOTIPOS_VFX.md), exclusivo de branch, permite registrar \`n/a\` com justificativa para fases sem sentido. O padrão da \`main\` exige seis grupos construídos e desligáveis. Não eliminar nem unificar essas duas regras sem decisão. Ver [P01](DECISOES_PENDENTES.md).

## 4. Controles, sliders, presets e persistência

Cada parâmetro editável relevante deve oferecer **nome inequívoco, unidade, explicação curta do efeito observado, valor padrão, mínimo, máximo, passo, slider e campo numérico sincronizados**. Agrupar por fase e manter a possibilidade de restaurar a variante. Não criar slider decorativo sem efeito na apresentação.

Exigências registradas no [padrão de ateliês](atelies/PADRAO_ATELIES_VFX.md):

- **Faixas:** máximo usual 5× o máximo-base; Water Pulse conserva exceção 300× já registrada; ângulos em ±180°; deslocamentos, impulsos e direções que admitem inversão aceitam valores negativos, positivos e zero.
- **Presets:** não alterar aparência de padrões existentes sem pedido; novos parâmetros visuais devem permanecer neutros ou discretos até aprovação, quando assim exigido pelo padrão.
- **Disparo:** seletor Nenhum / Argola / Tiro em cone reutilizável. Preservar os valores de cada alternativa ao trocar. Argola controla dimensão e deslocamentos com sinal; cone controla orientação, partículas e impulsos com sinal.
- **Impacto de disparo:** clarão, halo, coice, ondas e jato possuem parâmetros próprios no Water Pulse e Air Slash. A relação global de composição com o seletor estava aberta no padrão da \`main\`; há uma decisão **registrada apenas em documento de outra branch** de que essa camada se soma. Ver [P02](DECISOES_PENDENTES.md).
- **Persistência:** autosave no mesmo navegador/origem, restauração, exportação JSON de todas as configurações, importação com validação, preservação das opções, erro legível para entrada inválida e aviso sobre a fragilidade do armazenamento local.
- **Exportação não é publicação:** carregar/exportar configurações de um ateliê não altera automaticamente o preset do jogo, o código nem a homologação visual.
- **Compatibilidade:** identificar esquema/versão, comportamento de migração, parâmetros desconhecidos, limites e possível perda de informação; rejeitar corrupções sem modificação parcial silenciosa.

Exigir teste de limites extremos e sinal negativo antes de afirmar compatibilidade com todos os sliders. **300× não é orçamento de desempenho aprovado.**

## 5. Linguagem visual, legibilidade e identidade

As especificações [VFX_SOLIDOS](efeitos/VFX_SOLIDOS.md), [VFX_ELEMENTAL_PSIQUICO](efeitos/VFX_ELEMENTAL_PSIQUICO.md) e [MOVES_ELEMENTAIS_VISUAL_QUARKS](efeitos/MOVES_ELEMENTAIS_VISUAL_QUARKS.md) exibem estilos diferentes e complementares.

- Para cada efeito, registrar **forma-assinatura**, composição 3D, cores, contraste, materiais, brilho, espessura, rastro, cadência, escala e ancoragem.
- Diferenças entre os Moves não podem depender exclusivamente da cor; preservar legibilidade em 720p/1080p e durante câmera dinâmica, cenário elevado, transparência/oclusão e múltiplos efeitos.
- Distinguir camada volumétrica (malha, shader, campo de distância), partículas, trails, decalque e pós-processamento. **Não declarar que todos os renderizadores existentes usam Quarks:** o legado e os VFX sólidos possuem implementações próprias.
- Referências estéticas de outros jogos são direções artísticas, não autorização para copiar recursos proprietários. Identidade definitiva e escolha entre variantes A/B/C dependem de aprovação expressa.
- Câmera e tremor pertencem ao feedback visual com contrato próprio, não modificam física nem direção mecânica. Nenhum efeito novo pode acrescentar hitstop, flash global ou shake não aprovado.

**Direção estilística de outra branch** (sombreamento chapado, paleta curta, três opções sempre disponíveis) existe em [REGRAS_PROTOTIPOS_VFX](atelies/REGRAS_PROTOTIPOS_VFX.md). Tratar como especificação candidata, não imposição universal que apague visuais anteriores.

## 6. Categorias e resultados cobertos

| Família | Exemplos e variantes | Fonte de detalhes |
|---|---|---|
| Impactos e defesa | hit, força/direção, parcial, perfeita, invulnerabilidade | [VFX_IMPACTO_D](efeitos/VFX_IMPACTO_D.md), [runtime](SISTEMAS_E_RENDERIZADORES.md) |
| Movimento/contato | dash, sprint, esquiva, vento, poeira, impacto no chão e na parede | [VFX_SOLIDOS](efeitos/VFX_SOLIDOS.md), [VFX_POUSO_E_PAREDES](efeitos/VFX_POUSO_E_PAREDES.md) |
| Passivas | ativação real, aviso visual lateral, sparkles e acompanhamento do lutador | [VFX_HABILIDADES_PASSIVAS](efeitos/VFX_HABILIDADES_PASSIVAS.md), [PASSIVAS_IMPLEMENTACAO](../PASSIVAS_IMPLEMENTACAO.md) |
| Elementais | água, fogo, voador, grama, psíquico e protótipos Quarks | [ELEMENTAIS_QUARKS](efeitos/MOVES_ELEMENTAIS_VISUAL_QUARKS.md), [ELEMENTAL_PSIQUICO](efeitos/VFX_ELEMENTAL_PSIQUICO.md) |
| Outros Moves | Sand Wave, Emerging Stone, Swift, Psyshock, Bullet Punch, Quick Attack, Riposte | [Ateliê Areia/Pedra — fonte de branch](atelies/LAB_AREIA_PEDRA.md), [MUSHROOM_MOVES_DECISOES](../MUSHROOM_MOVES_DECISOES.md) |

**As fichas de Moves continuam sendo a autoridade para a mecânica e seus parâmetros individuais.** Não transportar valores visuais experimentais diretamente para a simulação.

## 7. Renderizadores, escolhas técnicas e migração

Consulte [SISTEMAS_E_RENDERIZADORES.md](SISTEMAS_E_RENDERIZADORES.md) antes de orientar agentes a trabalhar no código. Na base auditada coexistem \`VfxSystem\` legado (padrão), \`VfxRuntime\` declarativo (selecionável), \`QuarksBridge\` opcional, \`SolidFx\` e o sistema de passivas separado. A variante D do hit e certos efeitos de pouso/parede são específicos do legado. **Não anunciar paridade sem teste.**

Para criar um efeito, identificar: evento de origem; sistema efetivamente ativo; ponto de ancoragem; código de registro; definições/presets; grupos de tuning; feedback de câmera; fallback; qualidade; descarte; testes unitários/browser; galeria de evidências; modo offline. Reaproveitamento entre sistemas exige verificação, não port automático.

## 8. Acessibilidade, desempenho e custo

- **Sem flash/pulsação:** reduzir ou neutralizar clarão e halo quando configurado, sem apagar informação essencial do efeito. A configuração exata deve seguir a fonte especializada.
- **Movimento reduzido:** atenuar velocidades, rotações, quantidade e pulsação conforme o contrato do ateliê; levar em conta \`prefers-reduced-motion\` onde implementado.
- **Qualidade:** definir limites de partículas, malhas, luzes, objetos ativos, sistemas e tempo de vida para cada família. Usar pooling/instancing quando apropriado; garantir cleanup em término, troca de cena, pausa/reset e repetição de prévia.
- **Cuidado com custo de pixel:** raymarching volumétrico, transparências e pós-processamento requerem orçamento GPU, não só contagem de draw calls. Medições em SwiftShader/headless não equivalem a testes de GPU física.
- **Extremos:** não inferir estabilidade quando todos os controles (sobretudo limite 300× de água) ficam no máximo simultaneamente. Registrá-la como pendente até benchmark reproduzível.

Valores de teto atuais existem em [VFX_SOLIDOS](efeitos/VFX_SOLIDOS.md) e em código, mas não constituem orçamento global universal aprovado.

## 9. Replay, seeds, pausa e eventos

Preferir dados de VFX derivados de eventos reais, congelados quando necessário; aleatoriedade visual reproduzível com seed associada ao evento. Verificar idempotência, ordenação, ausência de duplicidade, resultado igual após pausa/retomada e descarte após \`reset\`. Não usar o renderizador como relógio de decisão mecânica. Replay integral e regras de preparação pertencem à documentação de combate; VFX deve ser compatível com esse contrato sem alterá-lo.

O módulo \`src/view/vfx/contract.js\` existente normaliza eventos; o registro declarativo declara trigger, âncora, duração, variante, qualidade, agregação e política de replay. Consulte os arquivos antes de reutilizar: não presumir que todas as famílias e extras estejam migrados.

## 10. Ficha mínima por efeito

Cada especificação deve declarar:

1. **Identidade:** id estável, Move/evento, autoria/origem, estado (proposta/aprovado/implementado), versão e sistema-alvo.
2. **Eventos:** gatilhos reais, resultados (hit/erro/bloqueio/etc.), âncora/altitude/normal e relação com status.
3. **Storyboard:** seis grupos de ateliê ou exceções pendentes; fases visuais e eventos sem contato; duração e dissipação.
4. **Visual:** geometria/partículas, paleta, silhueta, materiais, rastro, câmera, PL, 3 alternativas se forem requeridas.
5. **Controles:** todos os sliders com padrão, faixas, unidade, passo, dependências, ligar/desligar e efeito real.
6. **Persistência:** esquema JSON, autosave, importar/exportar, snapshots de instâncias, comportamento em replay.
7. **Garantias:** sem interferência mecânica, acessibilidade, budget, limpeza e fallback.
8. **Evidências:** código e commit, casos de testes, capturas da versão exata, benchmark medido e aceite do responsável; indicar claramente o que não foi verificado.

## 11. Aceite e processo de desenvolvimento

- **Antes:** localizar fontes de verdade no repositório/branch, verificar mudanças em andamento, comparar regras aprovadas e propostas, registrar conflitos e dependências.
- **Durante:** implementar só o efeito/ateliê solicitado; separar visual de mecânica; manter versões A/B/C não aprovadas como alternativas; validar mudanças em sliders, pós-efeitos, limpeza e controle de acesso offline.
- **Testar:** unidade/integração de evento e âncora; navegador real com opções, todos os controles, estados, pausa/reset, importação inválida, acessibilidade, erro de console; evidências comparáveis e métricas de desempenho quando exigidas.
- **Entrega:** links no portal conforme [AGENTS.md](../../AGENTS.md), documentação versionada, comandos executados, diff, limitações e confirmação do commit remoto. **Não relatar testes de um documento histórico como testes desta tarefa.**
- **Homologação:** prova automatizada ≠ aprovação de estética. Escolha final de variante, troca de tecnologia, regras novas e valores ainda indefinidos ficam com o responsável.

## 12. Questões abertas e limites do manual

Não resolver unilateralmente: fases \`n/a\` versus seis construídas; composição do disparo; extras não aprovados; direção artística final; escopo de Quarks; paridade do VfxRuntime; reconciliação entre documentação de passivas e implementação; integração de ateliês exclusivos de branches; metas de GPU. Registro central em [DECISOES_PENDENTES.md](DECISOES_PENDENTES.md).

**Este arquivo é o mapa normativo consolidado; as fichas e decisões originais não foram condensadas a ponto de perder dados específicos.** Em caso de dúvida, consulte o documento original, a matriz e o código da versão correta, e solicite decisão.
