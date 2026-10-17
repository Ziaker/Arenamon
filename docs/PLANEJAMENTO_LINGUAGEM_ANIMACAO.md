# Arenamon — Linguagem de Prompts de Animação (planejamento e registro de decisões)

> **Estado:** especificação preliminar em elaboração; **não é uma autorização para implementação**.
>
> **Data de abertura:** 16/10/2026.
> **Repositório:** Ziaker/Arenamon.
> **Área:** direção de animações 3D para criaturas (Blender/IA) e possível interoperabilidade com o Arenamon.
> **Procedência:** proposta original e aprovações explícitas do diretor na conversa; detalhes não votados ficam identificados como **PROPOSTA** ou **PENDENTE**.
>
> **Preservação:** este documento é independente do GDD, do registro de Moves e do mapa da arena. Não substitui nem altera qualquer decisão daqueles documentos.

## 1. Objetivo e motivação

Construir uma forma concisa, reutilizável e verificável de **dirigir a criação de animações 3D por IA**, sem depender de comandos Python escritos pelo diretor. Cada prompt pode descrever poses, intenção, duração das fases em frames, princípios de animação e indicações de eventos de combate. O caso de uso central é a animação de criaturas para Arenamon, inclusive personagens com anatomias não humanas, utilizando agentes como Claude ou Antigravity conectados ao Blender.

**Não está aprovado:** interpretador, arquitetura, integração automática, formato de arquivo, sintaxe completa, padrões artísticos, nível de autonomia ou alterações no runtime. Esses elementos deverão ser deliberados.

## 2. Origem da ideia — proposta do diretor (não equivale à aprovação da gramática definitiva)

Modelo imaginado:

    Animação de soco uppercut

    [Start X]
    - Descrição da preparação de X frames.

    [Mid X]
    - Descrição da ação principal após o Start.
    [Smear 5-18]
    {Hitbox 5-8}

    [End X]
    - Descrição da recuperação após o Mid.

O diretor propôs:
- Organizar o movimento em **Start, Mid e End** com duração declarada em frames.
- Dar a cada fase uma descrição em linguagem natural.
- Ativar um princípio/efeito visual em intervalos específicos e depois cessar sua contribuição, sem romper a continuidade.
- Usar marcações de hitbox para indicar quando o volume ofensivo vermelho estaria ativo e poderia causar dano **como objetivo futuro**. A atribuição real de dano pelo jogo **não está implementada apenas com esses metadados**, conforme ` 6.

As formas `[Start X]` e `[Start: X]` ainda são alternativas de escrita: nenhuma sintaxe textual exata foi homologada.

## 3. Decisões explícitas aprovadas

| ID | Decisão | Evidência da aprovação | Estado |
|---|---|---|---|
| LAN-001 | **Intervalos relativos à fase:** um modificador inserido em Start, Mid ou End usa frames locais dessa mesma fase; não usa o início global da animação. | `Aprovado: os modificadores usam frames locais à etapa.` | **APROVADA** |
| LAN-002 | **Intervalos inclusivos na linguagem do diretor:** tanto o frame inicial como o final fazem parte da janela, e uma futura conversão interna deverá acontecer automaticamente. | `Aprovado: intervalos inclusivos, incluindo início e fim, com conversão interna automática.` | **APROVADA** |
| LAN-003 | **Frames locais numerados a partir de 1; primeiro frame de cada etapa = 1.** | `1A — Começar em 1. O primeiro frame de cada etapa sempre será o frame 1.` | **APROVADA — Rodada 1** |
| LAN-004 | **Organização das etapas: Start e End, com possibilidade de vários Mid para ações complexas.** | `2B — Start e End, com possibilidade de vários Mid para ações complexas.` | **APROVADA — Rodada 1** |
| LAN-005 | **Todas as animações obrigatoriamente em 30 FPS.** | `3A — Todas as animações obrigatoriamente em 30 FPS.` | **APROVADA — Rodada 1** |
| LAN-006 | **Convenção de delimitadores: [ ] para direção visual; { } para dados mecânicos.** | `4A — Usar [ ] para direção visual e { } para dados mecânicos.` | **APROVADA — Rodada 1** |
| LAN-007 | **Combinar modificadores simultâneos quando compatíveis e sinalizar conflitos.** | `5A — Combinar modificadores compatíveis e sinalizar conflitos.` | **APROVADA — Rodada 1** |
| LAN-008 | **A deformação deve retornar suavemente ao estado normal dentro do próprio intervalo de atuação.** | `6A — A deformação deve voltar ao normal dentro do próprio intervalo.` | **APROVADA — Rodada 1** |
| LAN-009 | **Primeira utilização: prompts estruturados no Claude/Antigravity com Blender MCP, antes de desenvolver outras ferramentas.** | `7A — Primeiro usar prompts estruturados no Claude/Antigravity com Blender MCP.` | **APROVADA — Rodada 1** |
| LAN-010 | **Etapas com durações fixas nesta primeira versão; suporte a durações dinâmicas fica para planejamento posterior.** | `8C — Começar com durações fixas e planejar suporte a durações dinâmicas posteriormente.` | **APROVADA — Rodada 1** |
| LAN-011 | **Nomes anatômicos e nomes exatos de ossos são aceitos para designar partes-alvo; antes de executar, a IA deve inspecionar o rig e mapear os termos às estruturas reais.** | `9C — Aceitar nomes anatômicos ou ossos exatos, com inspeção e mapeamento do rig antes da execução.` | **APROVADA — Rodada 2** |
| LAN-012 | **Diante de modificador incompatível com a anatomia ou a técnica, a IA deve propor alternativa anatômica/técnica e solicitar aprovação antes de executá-la.** | `10C — Propor uma alternativa anatômica ou técnica e solicitar sua aprovação antes de executar.` | **APROVADA — Rodada 2** |
| LAN-013 | **Smear admite diferentes técnicas, selecionadas conforme rig e resultado pretendido; a exportação precisa ser verificada.** | `11D — Permitir diferentes técnicas, escolhidas conforme o rig e o resultado pretendido, verificando a exportação.` | **APROVADA — Rodada 2** |
| LAN-014 | **Parâmetros dos modificadores são opcionais; quando explicitamente fornecidos devem ser respeitados, e quando ausentes os valores propostos pela IA ficam identificados como provisórios.** | `12C — Parâmetros opcionais: valores explícitos são obrigatórios quando fornecidos; os ausentes são propostos pela IA e ficam identificados como provisórios.` | **APROVADA — Rodada 2** |
| LAN-015 | **Distinguir princípios globais de direção artística de modificadores temporais acionáveis.** | `13C — Separar princípios globais de direção artística e modificadores temporais acionáveis.` | **APROVADA — Rodada 2** |
| LAN-016 | **Permitir poses-chave e marcos opcionais; a IA deve criar o blocking, refinar curvas e apresentar transições à revisão.** | `14B — A linguagem permite poses-chave e marcos opcionais; a IA cria o blocking, refina as curvas e apresenta as transições para revisão.` | **APROVADA — Rodada 2** |
| LAN-017 | **Se uma deformação não sobreviver corretamente à exportação GLB, buscar bake ou substituição compatível, validar o resultado e solicitar aprovação caso haja perda visual.** | `15B — Procurar uma versão compatível por bake ou substituição, validar o resultado e solicitar aprovação se houver perda visual.` | **APROVADA — Rodada 2** |
| LAN-018 | **O comando {Hitbox} deve exibir um volume ofensivo vermelho na prévia e exportar metadados com o intervalo; não deve alterar automaticamente regras de dano.** | `16A — Desenhar uma hitbox vermelha na prévia e exportar metadados de seus intervalos, sem alterar automaticamente as regras de dano.` | **APROVADA — Rodada 3** |
| LAN-019 | **Hitboxes podem ter volumes gerados automaticamente ou especificados explicitamente, associados a ossos quando necessário, com múltiplos volumes; exigem validação antes de qualquer integração.** | `17C — Permitir volumes automáticos ou explícitos, vinculados a ossos quando necessário, com múltiplas hitboxes e validação antes da integração.` | **APROVADA — Rodada 3** |
| LAN-020 | **Sincronização: ajustar a velocidade temporal de reprodução do clipe à duração da ação, converter eventos consistentemente e apresentar relatório das diferenças.** | `18B — Ajustar o tempo de reprodução à duração da ação, converter os eventos de forma consistente e apresentar um relatório das diferenças.` | **APROVADA — Rodada 3** |
| LAN-021 | **Comandos mecânicos em { } para janelas e eventos, incluindo invulnerabilidade, cancelamentos, hitstop e stagger, devem inicialmente servir à inspeção, sem modificar automaticamente a mecânica.** | `19A — Permitir comandos { } que descrevam janelas e eventos, inicialmente como dados para inspeção, sem modificar a mecânica automaticamente.` | **APROVADA — Rodada 3** |
| LAN-022 | **Root motion horizontal in-place por padrão; outros movimentos visuais são admitidos apenas quando compatíveis com o controle autoritativo da física.** | `20B — In-place horizontal por padrão, permitindo outros movimentos visuais quando forem compatíveis com o controle da física.` | **APROVADA — Rodada 3** |
| LAN-023 | **A linguagem terá escopo geral de animação, com extensões específicas para as mecânicas do Arenamon.** | `21C — Linguagem geral de animação, com extensões específicas para as mecânicas do Arenamon.` | **APROVADA — Rodada 3** |
| LAN-024 | **Entrega obrigatória por animação: arquivo `.blend` editável, GLB exportado, prévia em vídeo, especificação original do prompt e relatório de validação.** | `22A — Arquivo .blend, GLB exportado, prévia em vídeo, especificação original do prompt e relatório de validação.` | **APROVADA — Rodada 4** |
| LAN-025 | **Qualidade avaliada pela combinação de testes automáticos, revisão visual de múltiplos ângulos e aprovação final do diretor.** | `23A — Combinar testes automáticos, avaliação visual em vários ângulos e aprovação final do diretor.` | **APROVADA — Rodada 4** |
| LAN-026 | **Fluxo de aprovação: diretor aprova primeiro o blocking; a IA pode então refinar e polir; o diretor faz a aprovação final antes da entrega definitiva.** | `24C — Aprovar primeiro o blocking, permitir refinamento e polimento depois e exigir aprovação final antes da entrega definitiva.` | **APROVADA — Rodada 4** |
| LAN-027 | **Cada versão recebe identificação própria, histórico de mudanças e referência à versão de origem; variantes anteriores devem permanecer preservadas.** | `25A — Cada versão recebe identificação própria, histórico de alterações e referência à versão original; variantes ficam preservadas.` | **APROVADA — Rodada 4** |
| LAN-028 | **Casos iniciais para validar a linguagem: idle de Vigoroth, tapa com deformação das mãos e animação de criatura com anatomia não humanoide. A criatura e a ação do terceiro teste permanecem indefinidas.** | `26B — Idle do Vigoroth, tapa com deformação das mãos e uma animação de criatura com anatomia não humanoide.` | **APROVADA — Rodada 4** |
| LAN-029 | **Aceitar tanto cabeçalhos com dois-pontos (`[Start: 12]`) como com espaço (`[Start 12]`) e normalizar automaticamente ambos.** | `27C — Aceitar ambos os formatos e normalizá-los automaticamente.` | **APROVADA — Rodada 5** |
| LAN-030 | **Permitir blocos Mid sem nome e nomes opcionais; atribuir identificação automática aos blocos.** | `28C — Aceitar blocos sem nome e permitir nomes opcionais, com identificação automática dos blocos.` | **APROVADA — Rodada 5** |
| LAN-031 | **Admitir campos nomeados opcionais e uma descrição textual livre abaixo de cada modificador.** | `29B — Permitir campos nomeados opcionais e uma descrição livre abaixo do modificador.` | **APROVADA — Rodada 5** |
| LAN-032 | **Interpretar um único número como evento pontual e dois números como intervalo inclusivo, como `[Impact: 8]` e `[Smear: 8-12]`.** | `30A — Um número indica evento pontual; dois números indicam intervalo, como [Impact: 8] e [Smear: 8-12].` | **APROVADA — Rodada 5** |
| LAN-033 | **A IA deve propor curvas apropriadas ao movimento, registrar parâmetros efetivos e respeitar integralmente curvas explicitamente fornecidas pelo diretor.** | `31C — A IA propõe curvas adequadas ao efeito, registra seus parâmetros e respeita curvas explicitamente declaradas.` | **APROVADA — Rodada 5** |
| LAN-034 | **Determinar compatibilidade por parte do corpo, propriedade/canal afetado e intervalo; combinar efeitos compatíveis e exigir resolução dos incompatíveis antes da execução.** | `32A — Analisar parte do corpo, propriedade e intervalo; combinar efeitos compatíveis e exigir resolução dos incompatíveis antes da execução.` | **APROVADA — Rodada 5** |
| LAN-035 | **Rejeitar janelas de deformação curtas demais para cumprir entrada e retorno suaves dentro da própria janela; solicitar correção.** | `33A — Rejeitar janelas de deformação que sejam curtas demais para entrada e retorno suaves, solicitando correção.` | **APROVADA — Rodada 5** |
| LAN-036 | **Exigir continuidade de poses e trajetórias entre etapas sem inserir frames extras; admitir mudanças bruscas intencionais quando declaradas.** | `34A — Exigir continuidade de pose e trajetória entre as etapas, sem criar frames extras; permitir mudanças bruscas intencionais quando especificadas.` | **APROVADA — Rodada 5** |
| LAN-037 | **Usar seção global de direção artística e catálogo inicial controlado de modificadores temporais, ampliado somente após validação.** | `35A — Usar uma seção global de direção artística e um catálogo inicial controlado de modificadores temporais, ampliado somente após validação.` | **APROVADA — Rodada 5** |
| LAN-038 | **Catálogo temporal inicial: Smear, Squash, Stretch, Scale, Anticipation, FollowThrough, Overlap e SecondaryAction; expansão apenas posteriormente.** | `36A — Smear, Squash, Stretch, Scale, Anticipation, FollowThrough, Overlap e SecondaryAction como primeiro conjunto, com expansão posterior.` | **APROVADA — Rodada 6** |
| LAN-039 | **Smear admite parâmetro opcional `method`; na ausência dele, a IA fundamenta a seleção do método e valida sua exportação.** | `37B — Permitir um parâmetro opcional method, com seleção fundamentada pela IA quando omitido e validação da exportação.` | **APROVADA — Rodada 6** |
| LAN-040 | **Squash, Stretch e Scale admitem escala/deformação por eixo e parâmetros opcionais de preservação de volume e limites anatômicos; a IA identifica como provisórios os valores que propuser.** | `38B — Escala/deformação por eixo, com parâmetros opcionais de volume e anatomia; a IA apresenta propostas provisórias quando necessário.` | **APROVADA — Rodada 6** |
| LAN-041 | **Disponibilizar curvas predefinidas Ease, Sharp, Elastic e Overshoot, parametrizáveis e personalizáveis, respeitando retorno suave e demais regras já aprovadas.** | `39B — Curvas predefinidas como Ease, Sharp, Elastic e Overshoot, com parâmetros e possibilidade de personalização, respeitando as regras de retorno.` | **APROVADA — Rodada 6** |
| LAN-042 | **Anticipation e FollowThrough operam como marcadores temporais de direção para a IA construir poses e curvas coerentes dentro da janela indicada.** | `40A — Funcionam como marcadores temporais que orientam a IA a construir poses e curvas coerentes na janela especificada.` | **APROVADA — Rodada 6** |
| LAN-043 | **Overlap e SecondaryAction admitem alvos e atrasos específicos, derivados da ação principal e condicionados por massa, articulações e anatomia.** | `41B — Permitir alvos e atrasos próprios, derivados do movimento principal, considerando massa, articulações e anatomia.` | **APROVADA — Rodada 6** |
| LAN-044 | **Uma seção global opcional define princípios, estilo e intensidade; a IA aplica os critérios durante a animação inteira e relata como os utilizou.** | `42A — Uma seção global opcional define princípios, estilo e intensidade; a IA aplica os critérios na animação inteira e relata como os utilizou.` | **APROVADA — Rodada 6** |
| LAN-045 | **Ampliação temporária de partes corporais pode usar Scale e outras deformações compatíveis com o rig, com técnica escolhida conforme resultado e controles de proporção, eixo e retorno.** | `43B — Permitir Scale e deformações compatíveis com o rig, escolhendo o método conforme o resultado, com proporções, eixos e retorno controláveis.` | **APROVADA — Rodada 6** |
| LAN-046 | **Validar efeitos pela comparação da animação com e sem modificadores e pela inspeção visual em vários ângulos, reprovando defeitos não intencionais.** | `44A — Comparar a animação com e sem efeitos, inspecionar deformações em múltiplos ângulos e reprovar defeitos não intencionais.` | **APROVADA — Rodada 6** |
| LAN-047 | **Poses-chave são marcadores opcionais em frames locais, com descrição da postura e alvos anatômicos, como `[Pose: 8 | crouch]`.** | `45A — Permitir marcadores opcionais de pose em frames locais, como [Pose: 8 | crouch], com descrição da postura e alvos anatômicos.` | **APROVADA — Rodada 7** |
| LAN-048 | **São permitidos marcos opcionais de timing para aceleração, hold e desaceleração, com intervalos locais, sem acrescentar frames à etapa.** | `46B — Permitir marcos opcionais de ritmo, como aceleração, hold e desaceleração, com intervalos locais e sem acrescentar frames.` | **APROVADA — Rodada 7** |
| LAN-049 | **São permitidos marcadores temporais de contato/travamento para pontos de apoio, com IK quando necessário, inspeção de deslizamento e respeito à física.** | `47A — Permitir marcadores temporais de contato e travamento, usando IK quando necessário, com inspeção de deslizamentos e respeito à física.` | **APROVADA — Rodada 7** |
| LAN-050 | **Animações cíclicas exigem continuidade de pose e movimento na passagem do último para o primeiro frame, com verificação do loop e sem frames extras.** | `48A — Exigir fechamento contínuo de pose e movimento, com verificação do loop sem acrescentar frames.` | **APROVADA — Rodada 7** |
| LAN-051 | **A linguagem admite impacto, pose e hold visual com duração declarada; hitstop mecânico permanece metadado separado e não é alterado automaticamente.** | `49B — Permitir impacto, pose e hold visual com duração declarada, mantendo o hitstop mecânico como metadado separado.` | **APROVADA — Rodada 7** |
| LAN-052 | **Cada Mid pode ter suas próprias poses, modificadores, timing e impactos, recebendo IDs automáticos e mantendo continuidade com as etapas adjacentes.** | `50A — Cada Mid pode ter poses, modificadores, timing e impactos próprios, com IDs automáticos e continuidade entre eles.` | **APROVADA — Rodada 7** |
| LAN-053 | **São permitidos metadados visuais de entrada, saída e blending entre clipes, sem modificar automaticamente cancelamentos nem outras regras de gameplay.** | `51B — Permitir metadados visuais de entrada, saída e blending, sem alterar automaticamente cancelamentos ou outras regras de gameplay.` | **APROVADA — Rodada 7** |
| LAN-054 | **Curvas avançadas podem ser utilizadas no Blender; realizar bake quando necessário e comparar a animação original com o GLB reimportado.** | `52B — Permitir curvas avançadas no Blender, aplicar bake quando necessário e comparar a animação original com o GLB reimportado.` | **APROVADA — Rodada 7** |
| LAN-055 | **A validação exige relatório automático de timing e integridade, prévias multivistas, comparação com/sem efeitos e teste de reimportação GLB antes da entrega final.** | `53A — Relatório automático de timing e integridade, prévias multivistas, comparação com/sem efeitos e teste de reimportação GLB antes da entrega final.` | **APROVADA — Rodada 7** |
| LAN-056 | **Antes de animar, analisar rig, hierarquia, malha e articulações e produzir mapa anatômico verificável.** | `54B — Inspecionar rig, hierarquia, malha e articulações; produzir um mapa anatômico verificável antes de animar.` | **APROVADA — Rodada 8 (aprovação global das recomendações)** |
| LAN-057 | **Em caso de rig incompleto/ambíguo, interromper apenas operações afetadas, diagnosticar e propor correções, exigindo aprovação antes de alterações estruturais.** | `55A — Interromper apenas as operações afetadas, apresentar diagnóstico e propostas de correção, exigindo aprovação antes de mudanças estruturais.` | **APROVADA — Rodada 8 (aprovação global das recomendações)** |
| LAN-058 | **Criar e editar somente cópia versionada, preservando rig, malha e pesos originais, com autorização prévia para quaisquer alterações estruturais.** | `56A — Trabalhar sempre sobre uma cópia versionada, preservando rig, malha e pesos originais; mudanças estruturais exigem autorização.` | **APROVADA — Rodada 8 (aprovação global das recomendações)** |
| LAN-059 | **Detectar orientação, escala, pivôs e eixos do rig e estabelecer referencial anatômico documentado, com conversões explícitas para os eixos de trabalho.** | `57B — Detectar orientação, escala, pivôs e eixos do rig e usar um referencial anatômico documentado, com conversões explícitas.` | **APROVADA — Rodada 8 (aprovação global das recomendações)** |
| LAN-060 | **Detectar possíveis interpenetrações; distinguir exageros intencionais explicitamente previstos e enviar casos ambíguos para revisão visual.** | `58B — Detectar possíveis problemas, distinguir exageros explicitamente previstos e submeter casos ambíguos à revisão visual.` | **APROVADA — Rodada 8 (aprovação global das recomendações)** |
| LAN-061 | **Combinar métricas de deslocamento, contato e continuidade com inspeção visual; limites quantitativos serão propostos e deverão ser aprovados, não presumidos.** | `59B — Combinar métricas de deslocamento, continuidade e contato com inspeção visual, propondo limites verificáveis para aprovação.` | **APROVADA — Rodada 8 (aprovação global das recomendações)** |
| LAN-062 | **Para efeitos auxiliares, testar exportação GLB direta e, se necessário, bake ou representação equivalente, comparando visualmente e documentando perdas.** | `60B — Testar exportação direta e, quando necessário, utilizar bake ou representação equivalente, com comparação visual e relatório de perdas.` | **APROVADA — Rodada 8 (aprovação global das recomendações)** |
| LAN-063 | **Validar Blender e GLB reimportado como estágios independentes; exigir teste no jogo quando houver integração disponível e relatar o que não foi testado.** | `61B — Validar Blender e GLB reimportado separadamente, exigir teste no jogo quando houver integração disponível e relatar claramente o que não foi testado.` | **APROVADA — Rodada 8 (aprovação global das recomendações)** |
| LAN-064 | **Terceiro teste inicial: criatura quadrúpede genérica e autoral executando salto no lugar, com apoios e FollowThrough. A identidade/modelo exatos seguem a aprovação do diretor.** | `62A — Criatura quadrúpede genérica e autoral, com animação de salto no lugar, apoios e follow-through.` | **APROVADA — Rodada 8 (aprovação global das recomendações)** |
| LAN-065 | **Tratar lacunas conforme criticidade: parâmetros técnicos opcionais podem receber propostas provisórias explicitamente identificadas; ambiguidades impeditivas exigem confirmação. A obrigação adicional de perguntas sobre lacunas da descrição da animação consta em LAN-074.** | `63C — Separar por criticidade: sugerir valores opcionais identificados como provisórios e exigir confirmação para ambiguidades que bloqueiem a execução.` | **APROVADA — Rodada 9 (recomendação aprovada)** |
| LAN-066 | **O texto estruturado da linguagem é a fonte de verdade; uma representação técnica derivada, verificável e gerada futuramente pode ser admitida, sem fontes independentes conflitantes.** | `64B — Texto estruturado como fonte de verdade, com possibilidade futura de gerar representação técnica derivada e verificável.` | **APROVADA — Rodada 9 (recomendação aprovada)** |
| LAN-067 | **O tipo de animação precisa de declaração explícita (por exemplo, Loop ou OneShot); não se deve inferir modo de execução somente pelo nome do clipe. A forma literal `[Mode: ...]` continua sujeita à gramática final.** | `65B — Exigir uma declaração explícita do tipo, como [Mode: Loop] ou [Mode: OneShot], sem presumir pela nomenclatura.` | **APROVADA — Rodada 9 (recomendação aprovada)** |
| LAN-068 | **Relatórios devem indicar frames locais e globais, tempo do clipe, duração ajustada à ação e, quando aplicável, passos internos, com regras de conversão explícitas.** | `66B — Exibir frames locais e globais, tempo do clipe, duração ajustada e, quando aplicável, passos internos com regras explícitas de conversão.` | **APROVADA — Rodada 9 (recomendação aprovada)** |
| LAN-069 | **Versionar a linguagem e o catálogo de comandos; reconhecer e rejeitar comandos desconhecidos em vez de executá-los silenciosamente.** | `67A — Versionar a linguagem e o catálogo; identificar comandos desconhecidos e impedir sua execução silenciosa.` | **APROVADA — Rodada 9 (recomendação aprovada)** |
| LAN-070 | **Manter rastreabilidade separada de valores explicitamente solicitados, propostas da IA, aprovações do diretor e alterações posteriores.** | `68B — Identificar separadamente valores explícitos, propostas da IA, aprovações e alterações posteriores, com histórico rastreável.` | **APROVADA — Rodada 9 (recomendação aprovada)** |
| LAN-071 | **Emitir diagnóstico por erro e bloquear operações comprometidas; incompatibilidades e violações essenciais devem ser resolvidas antes da execução afetada.** | `69A — Emitir diagnóstico por erro, bloquear operações comprometidas e exigir resolução prévia dos conflitos ou violações essenciais.` | **APROVADA — Rodada 9 (recomendação aprovada)** |
| LAN-072 | **Organizar testes de conformidade com casos de referência e resultados esperados, validação de timing, inspeção visual multivistas e comparação de exportação.** | `70A — Criar casos de referência com resultados esperados, verificações temporais, inspeção visual multivistas e comparação de exportação.` | **APROVADA — Rodada 9 (recomendação aprovada)** |
| LAN-073 | **A especificação só estará pronta para eventual prova de conceito quando consolidada, acompanhada de exemplos verificáveis e testes de aceitação definidos, sem pendências bloqueantes; qualquer prova de conceito ainda exige autorização explícita.** | `71C — Quando houver especificação consolidada, exemplos verificáveis, testes de aceitação definidos e nenhuma pendência bloqueante; a prova de conceito dependerá ainda de autorização explícita.` | **APROVADA — Rodada 9 (recomendação aprovada)** |
| LAN-074 | ****Antes de executar a criação ou alteração de uma animação, a IA deve revisar a descrição fornecida e perguntar obrigatoriamente ao diretor sobre informações descritivas ausentes ou ambíguas necessárias para entender o movimento pretendido.** Deve expor as lacunas identificadas em perguntas claras, sem inventar silenciosamente intenção, poses, trajetória, timing, alvo, estilo ou elementos anatômicos omitidos. A execução das partes dependentes dessas respostas deve aguardar o esclarecimento do diretor. Se a descrição já estiver suficientemente definida, não são necessárias perguntas artificiais. Parâmetros técnicos realmente opcionais continuam podendo ser propostos provisoriamente conforme LAN-014/LAN-065, mas tais sugestões **não dispensam** as perguntas obrigatórias sobre lacunas na descrição.** | `Complemento explícito do diretor — inclusive adicione a obrigatoriedade da IA perguntar sobre o que falta de informação na desc da animação` | **APROVADA — Rodada 9 (complemento explícito)** |
| LAN-075 | **Revisar o briefing com checklist contextual de intenção, movimento, anatomia, poses, timing, estilo e referências, perguntando pelos elementos relevantes ausentes; não exigir campos irrelevantes.** | `72B — Usar uma checklist contextual de intenção, movimento, anatomia, poses, timing, estilo e referências, perguntando sobre os elementos relevantes ausentes.` | **APROVADA — Rodada 10 (recomendação aprovada)** |
| LAN-076 | **Agrupar perguntas de esclarecimento por categoria em uma rodada e permitir novas perguntas quando as respostas revelarem novas lacunas relevantes.** | `73A — Agrupar as dúvidas em uma rodada de perguntas por categoria, permitindo novas perguntas somente quando as respostas revelarem outras lacunas.` | **APROVADA — Rodada 10 (recomendação aprovada)** |
| LAN-077 | **A IA pode decidir somente aspectos criativos explicitamente delegados pelo diretor; deve registrar decisões, valores e justificativas e preservar todos os requisitos fixados.** | `74A — A IA pode decidir somente os aspectos explicitamente delegados, registrando os valores e a justificativa, sem alterar requisitos já definidos.` | **APROVADA — Rodada 10 (recomendação aprovada)** |
| LAN-078 | **Diante de linguagem subjetiva como 'mais épico', 'mais peso' ou 'mais exagerado', apresentar interpretações concretas com efeitos previstos em movimento/timing e pedir escolha ao diretor.** | `75B — Apresentar interpretações concretas, explicando como cada uma afetaria movimento e timing, e solicitar sua escolha.` | **APROVADA — Rodada 10 (recomendação aprovada)** |
| LAN-079 | **Inspecionar referências fornecidas, identificar características potencialmente relevantes e perguntar ao diretor quais devem orientar a animação; não copiar indiscriminadamente outras características.** | `76B — Analisar as referências disponíveis, identificar quais características podem orientar o trabalho e perguntar quais devem ser seguidas.` | **APROVADA — Rodada 10 (recomendação aprovada)** |
| LAN-080 | **Manter histórico rastreável e vinculado à versão da animação, contendo perguntas, respostas, decisões delegadas e alterações de briefing.** | `77B — Manter registro rastreável de perguntas, respostas, decisões delegadas e revisões, associado à versão da animação.` | **APROVADA — Rodada 10 (recomendação aprovada)** |
| LAN-081 | **Detectar contradições entre descrição, referências e parâmetros explícitos, apontar instruções conflitantes e pedir resolução antes de executar a parte afetada.** | `78A — Apontar a contradição, mostrar as instruções envolvidas e pedir resolução antes de executar a parte afetada.` | **APROVADA — Rodada 10 (recomendação aprovada)** |
| LAN-082 | **Após esclarecimentos, apresentar resumo consolidado do briefing e solicitar confirmação do diretor antes de iniciar o blocking; essa aprovação é anterior e distinta da aprovação do blocking concluído.** | `79B — Apresentar um resumo consolidado do briefing e solicitar sua confirmação antes de começar o blocking.` | **APROVADA — Rodada 10 (recomendação aprovada)** |
| LAN-083 | **Preparar exemplo canônico completo com briefing, perguntas e respostas, etapas, modificadores, marcações de eventos, validações previstas e distinção entre decisões aprovadas e propostas; a obrigação de preparar o exemplo não aprova o conteúdo hipotético nem autoriza implementação.** | `80B — Preparar um exemplo canônico completo, com briefing, perguntas e respostas, etapas, modificadores, marcações de eventos, validações previstas e distinção entre decisões aprovadas e propostas.` | **APROVADA — Rodada 10 (recomendação aprovada)** |
| LAN-084 | **Exigir declaração explícita de modo (`Mode`), etapa Start e etapa End; blocos Mid são usados quando o movimento exigir; os demais campos seguem opcionais conforme suas normas.** | `81B — Exigir Mode, Start e End; incluir blocos Mid conforme a ação descrita, mantendo os outros campos opcionais.` | **APROVADA — Rodada 11 (recomendação aprovada)** |
| LAN-085 | **Atribuir IDs sequenciais estáveis aos múltiplos Mid, admitir nomes opcionais e rejeitar nomes duplicados ou referências ambíguas até o esclarecimento.** | `82A — Gerar IDs sequenciais estáveis, permitir nomes opcionais e rejeitar nomes ou referências ambíguas até serem esclarecidos.` | **APROVADA — Rodada 11 (recomendação aprovada)** |
| LAN-086 | **Cada frame autoral de 30 FPS corresponde a um intervalo de duração 1/30 s, com índice local começando em 1; o limite final da duração é calculado separadamente, sem introduzir frame autoral ou duração extra.** | `83A — Tratar cada frame como um intervalo de 1/30 s, com amostras indexadas a partir de 1 e limite final calculado separadamente, sem frame extra de duração.` | **APROVADA — Rodada 11 (recomendação aprovada)** |
| LAN-087 | **Para loops, permitir amostra técnica de fechamento no limite final da duração, externa à contagem de frames autorais; verificar continuidade de pose e velocidade, sem aumentar o tempo do loop.** | `84B — Permitir uma amostra técnica de fechamento no limite de duração, fora da contagem de frames de autoria, verificando pose e velocidade.` | **APROVADA — Rodada 11 (recomendação aprovada)** |
| LAN-088 | **A duração mínima de deformações deve ser avaliada conforme efeito, curva e magnitude; se insuficiente para entrada e retorno, explicar a incompatibilidade e solicitar correção sem ampliar a janela automaticamente.** | `85A — Avaliar o mínimo necessário segundo efeito, curva e deformação, informar o motivo e solicitar correção sem ampliar a janela por conta própria.` | **APROVADA — Rodada 11 (recomendação aprovada)** |
| LAN-089 | **Propor métricas e tolerâncias verificáveis de deslizamento, contato e continuidade de acordo com movimento e anatomia; registrar valores e pedir aprovação antes de validação definitiva.** | `86B — Propor tolerâncias verificáveis por tipo de movimento e anatomia, registrar os valores e submetê-los à aprovação antes da validação definitiva.` | **APROVADA — Rodada 11 (recomendação aprovada)** |
| LAN-090 | **Metadados de hitbox admitem formato, dimensões, offset, orientação, osso e janela ativa, com campos opcionais propostos pela IA e relatório; não alteram por si mesmos a lógica de dano.** | `87B — Admitir formato, dimensões, offset, orientação, osso associado e intervalo ativo, com campos opcionais propostos pela IA e relatório de validação.` | **APROVADA — Rodada 11 (recomendação aprovada)** |
| LAN-091 | **Rastrear por agente, versão e etapa evidências verificáveis, comandos efetivamente executados, resultados, falhas, ressalvas e testes não realizados; não declarar sucesso sem prova.** | `88A — Registrar por versão e etapa as evidências, comandos executados, resultados, falhas, ressalvas e testes não realizados, sem declarar sucesso sem prova.` | **APROVADA — Rodada 11 (recomendação aprovada)** |
| LAN-092 | **Antes de eventual prova de conceito, consolidar gramática, preparar exemplos completos, definir casos de conformidade e auditar pendências bloqueantes; solicitar autorização específica antes de qualquer implementação.** | `89A — Consolidar a gramática, preparar exemplos completos, definir casos de conformidade, auditar pendências bloqueantes e pedir autorização específica antes de implementar.` | **APROVADA — Rodada 11 (recomendação aprovada)** |
| LAN-093 | **Blocos Mid aceitam `[Mid: 12 | name=uppercut]` ou `[Mid 12 | name=uppercut]`, com nome opcional e identificação sequencial estável; os dois formatos devem ser normalizados.** | `90A — Adotar [Mid: 12 | name=uppercut] ou [Mid 12 | name=uppercut], aceitando nome opcional e atribuindo ID sequencial estável.` | **APROVADA — Rodada 12** |
| LAN-094 | **A gramática organiza seção global artística opcional e comandos visuais `[ ]` e mecânicos `{ }` dentro da respectiva etapa, usando frames locais.** | `91A — Usar seção artística global opcional e comandos visuais [ ] e mecânicos { } associados à respectiva etapa, respeitando frames locais.` | **APROVADA — Rodada 12** |
| LAN-095 | **Parâmetros numéricos devem ter unidades pertinentes a seu tipo, com validação de conversões; valores sugeridos pela IA permanecem identificados como provisórios. As unidades específicas por campo ainda requerem definição documental.** | `92B — Definir unidades próprias por tipo de parâmetro, validar as conversões e sinalizar valores sugeridos como provisórios.` | **APROVADA — Rodada 12** |
| LAN-096 | **Diagnósticos se dividem em três níveis: erro bloqueante para as operações afetadas; pendência que exige aprovação; aviso informativo, todos rastreáveis.** | `93A — Definir três níveis: erro bloqueante para operações afetadas, pendência que exige aprovação e aviso informativo, com diagnóstico rastreável.` | **APROVADA — Rodada 12** |
| LAN-097 | **O frame autoral i representa o intervalo temporal de (i−1)/30 a i/30 segundos (na etapa de 30 FPS), com limite final separado e conversões documentadas; não acrescentar duração ou frame fantasma.** | `94B — Definir que o frame i corresponde ao intervalo temporal de (i−1)/30 a i/30 segundos, com limite final separado e conversões documentadas.` | **APROVADA — Rodada 12** |
| LAN-098 | **A matriz de conformidade deve incluir casos positivos e negativos para contagem de frames, intervalos inclusivos, vários Mid, eventos pontuais, loops, conflitos e deformações curtas demais.** | `95A — Incluir testes positivos e negativos de frames, intervalos inclusivos, vários Mid, eventos pontuais, loops, conflitos e deformações curtas demais.` | **APROVADA — Rodada 12** |
| LAN-099 | **O aceite de exemplo completo exige briefing confirmado, blocking aprovado, evidências documentadas de conformidade e exportação, e aprovação final; testes não realizados jamais podem ser declarados concluídos.** | `96B — Exigir briefing confirmado, blocking aprovado, verificações documentadas de conformidade/exportação e aprovação final, sem alegar testes não executados.` | **APROVADA — Rodada 12** |
| LAN-100 | **Catálogo versionado por categoria deve definir nome, finalidade, parâmetros e exemplos válidos/inválidos dos comandos; comandos desconhecidos exigem esclarecimento, não execução silenciosa.** | `97A — Criar catálogo versionado por categoria, com nome, finalidade, parâmetros e exemplos válidos/inválidos; comandos desconhecidos exigem esclarecimento.` | **APROVADA — Rodada 12** |
| LAN-101 | **A revisão final deve apresentar matriz separando normas aprovadas, pendências bloqueantes, itens futuros e evidências de conformidade; exigir aprovação explícita do diretor para homologação.** | `98B — Entregar uma matriz separando normas aprovadas, pendências bloqueantes, itens futuros e evidências de conformidade, solicitando sua aprovação explícita.` | **APROVADA — Rodada 12** |

Consequências invariantes:
- Para o intervalo textual `a-b`, a quantidade é `b - a + 1` frames (se `b >= a`).
- Um intervalo local deve permanecer dentro da fase de que faz parte.
- Uma fase não muda automaticamente a duração de outra fase.
- Converter para o contrato do jogo não pode criar nem perder um frame de duração por erro de borda.
- Nenhuma dessas decisões autoriza modificar a lógica de dano, cancelamento, física ou invulnerabilidade.

**Aprovado na Rodada 1:** numeração local em 1, Start e End com possibilidade de múltiplos Mid, 30 FPS obrigatório, distinção `[ ]` visual e `{ }` mecânica, composição apenas dos modificadores compatíveis com alerta de conflitos, retorno suave da deformação dentro do intervalo, etapa inicial por prompts para Claude/Antigravity via Blender MCP e durações fixas na primeira versão.

**Rodada 2 aprovada:** reconhecimento e mapeamento prévio de termos anatômicos/nomes de ossos, alternativas sujeitas a aprovação para incompatibilidades, seleção de técnicas de Smear condicionada a rig/resultado/exportação, parâmetros opcionais com propostas provisórias identificadas, distinção entre princípios globais e operadores temporais, poses/marcos opcionais com revisão das transições e tentativa validada de bake/substituição para exportação incompatível com aprovação da perda visual.

**Rodada 3 aprovada:** prévia vermelha e exportação de metadados da hitbox sem alterar automaticamente o dano; volumes automáticos/explícitos, múltiplos e passíveis de associação óssea com validação; sincronização pela duração da ação e relatório das diferenças; comandos mecânicos para inspeção sem alteração automática; in-place horizontal padrão com movimentos visuais fisicamente compatíveis; linguagem geral extensível para o Arenamon.

**Rodada 4 aprovada:** entrega `.blend`, GLB, prévia em vídeo, prompt original e relatório de validação; testes automáticos + análise visual multivistas + aprovação do diretor; aprovação do blocking antes de refinamento/polimento, com aprovação final antes da entrega definitiva; versionamento identificado, rastreável e não destrutivo; três testes-alvo (idle Vigoroth, tapa deformante, criatura não humanoide a definir).

**Rodada 5 aprovada:** dois estilos de cabeçalho normalizados; Mid opcionalmente nomeado com IDs automáticos; parâmetros nomeados opcionais e texto livre por modificador; eventos de frame único diferenciados dos intervalos; curvas propostas, documentadas e subordinadas às declaradas; conflito detectado por alvo/propriedade/intervalo, resolvido antes de executar; deformações com duração insuficiente rejeitadas; continuidade entre etapas sem frames extras, exceto mudança brusca intencional declarada; seção global artística distinta de catálogo temporal controlado.

**Rodada 6 aprovada:** oito modificadores temporais no catálogo inicial (LAN-038); escolha de técnica Smear por `method` opcional e justificativa da IA (LAN-039); deformação por eixo com volume/anatomia opcionais (LAN-040); curvas Ease/Sharp/Elastic/Overshoot personalizáveis respeitando o retorno (LAN-041); Anticipation/FollowThrough como diretrizes temporais de poses e curvas (LAN-042); Overlap/SecondaryAction com atrasos e anatomia próprios (LAN-043); seção global opcional com relatório de aplicação (LAN-044); ampliação corporal temporária e controlável (LAN-045); e comparação com/sem efeitos e multivistas, rejeitando defeitos (LAN-046).

**Rodada 7 aprovada:** poses-chave opcionais por frame local e anatomia (LAN-047); marcos de timing internos sem frames extras (LAN-048); contatos/travamentos temporais com IK quando necessário e validação de deslizamentos (LAN-049); fechamento contínuo de loops sem frames adicionais (LAN-050); impacto, pose e hold visual separados do hitstop mecânico (LAN-051); Mid com IDs automáticos e conteúdo próprio (LAN-052); metadados de blending sem alterar gameplay (LAN-053); curvas avançadas com bake e comparação após reimportação GLB (LAN-054); e relatório de timing/integridade, multivistas, comparação com/sem efeitos e reimportação antes da entrega final (LAN-055).

**Rodada 8 aprovada:** inspeção e mapa anatômico verificável antes da execução; pausa seletiva diante de ambiguidades e autorização para alterações estruturais; cópia versionada com preservação de rig/malha/pesos; referenciais anatômicos e conversões explícitas; interpenetrações ambíguas sob revisão; métricas de contato e continuidade com limites propostos para aprovação; validação de efeitos auxiliares com exportação/bake e comparação; testes separados de Blender/GLB e eventual jogo, declarando lacunas; e terceiro caso inicial quadrúpede genérico autoral saltando no lugar com apoios e FollowThrough.

**Rodada 9 aprovada:** parâmetros técnicos opcionais propostos provisoriamente e ambiguidades impeditivas encaminhadas à confirmação; texto estruturado como fonte de verdade; modo de animação explicitamente declarado; relatórios de contagem local/global, tempo e passos; versões de linguagem e catálogo; rastreabilidade de origem e aprovação de parâmetros; diagnóstico e bloqueio seletivo de violações; testes por referência; e prontidão para eventual prova de conceito condicionada a ausência de pendências bloqueantes e autorização explícita.

**Complemento obrigatório do diretor (LAN-074) — conferência da descrição antes de animar:**
1. A IA deve ler a descrição da animação antes da execução e identificar todas as lacunas ou ambiguidades descritivas relevantes para o movimento pretendido.
2. Havendo lacunas na descrição, **é obrigatório formular perguntas ao diretor**, inclusive sobre intenção criativa, ação, poses, trajetória, timing, alvos e anatomia quando faltarem elementos relevantes. Não inventar respostas nem tratar sugestões próprias como decisões aprovadas.
3. A IA deve esperar o esclarecimento das informações descritivas das quais a execução depende. Quando a descrição estiver suficientemente clara, não precisa fazer perguntas apenas por formalidade.
4. Parâmetros técnicos genuinamente opcionais podem continuar como sugestões provisórias, identificadas e rastreadas segundo LAN-014/LAN-065. **Isso não substitui a obrigação de perguntar sobre lacunas na descrição da animação.**
5. O procedimento concreto de checklist, agrupamento de perguntas e tratamento de delegação de escolhas ainda será deliberado na Rodada 10; não presumir autorização para implementar nem para decidir opções pendentes.

**Rodada 10 aprovada:** checklist contextual com perguntas obrigatórias sobre lacunas relevantes; questões agrupadas por categoria; delegações criativas limitadas ao que foi autorizado; interpretação de adjetivos subjetivos apresentada em alternativas para decisão; leitura de referências com confirmação do que deve ser utilizado; histórico de perguntas/respostas/delegações/revisões; resolução explícita de contradições; **resumo consolidado para aprovação do diretor antes de iniciar o blocking**; e preparação de exemplo canônico integral, sem presumir que seus detalhes fictícios estejam aprovados (LAN-075 a LAN-083).

**Rodada 11 aprovada:** Mode, Start e End obrigatórios e Mid conforme a ação (LAN-084); IDs estáveis, nomes opcionais e rejeição de ambiguidades nos Mid (LAN-085); frames autorais 1-based com duração de 1/30 s por frame, sem duração fantasma (LAN-086); fechamento de loop por amostra técnica fora da contagem autoral e sem aumentar a duração (LAN-087); mínimo de deformação avaliado por efeito/curva/magnitude sem extensão automática (LAN-088); tolerâncias propostas por anatomia e aprovadas antes da validação definitiva (LAN-089); campos opcionais de hitbox com geometria, orientação, associação óssea e janela, sem ativar dano (LAN-090); evidências por agente, etapa e versão incluindo falhas/testes omitidos (LAN-091); preparação ordenada de gramática, exemplos, conformidade e auditoria antes de solicitar autorização de implementação (LAN-092).

**Rodada 12 aprovada:** sintaxe de Mid nomeado com `name` opcional e IDs sequenciais estáveis (LAN-093), organização de comandos globais/visuais/mecânicos por fase (LAN-094), unidades por tipo com conversão validada e sugestões provisórias (LAN-095), três níveis rastreáveis de diagnóstico (LAN-096), correspondência formal do frame i ao intervalo `(i−1)/30` até `i/30` s (LAN-097), casos positivos e negativos de conformidade (LAN-098), aceite condicionado a briefing/blocking/validações/aprovação final sem alegar testes não executados (LAN-099), catálogo versionado com comandos válidos/inválidos (LAN-100) e matriz final de normas, bloqueios, futuro e evidências sujeita à aprovação do diretor (LAN-101).

**Continuam pendentes:** escolhas numéricas de tolerância, unidades concretas para cada parâmetro, formas exatas e validações dos tipos de eventos e comentários, conteúdo detalhado de entradas do catálogo, exemplos completos com briefings e resultados esperados, matriz de casos de teste exaustiva e qualquer evidência de execução real em Blender/GLB. A especificação permanece **preliminar**, sem prova de conceito autorizada.

## 4. Modelo temporal ilustrativo — PROPOSTA, não norma aprovada

Exemplo hipotético com frames **numerados a partir de 1**, conforme **LAN-003 aprovada**. Os números do exemplo e sua sintaxe continuam ilustrativos:

    [Start: 12]    # frames globais 1..12
    [Mid: 16]      # frames globais 13..28
    [Smear: 4-6]   # frames globais 16..18, 3 frames
    [Impact: 10]   # frame global 22
    {Hitbox: 9-11} # frames globais 21..23, 3 frames
    [End: 18]      # frames globais 29..46

Para uma fase com início global `S` e intervalo local inclusivo `a-b` (**indexação em 1 aprovada**), o intervalo global inclusivo é `[S+a-1, S+b-1]`. A conversão do intervalo global de frames para segundos e passos da simulação dependerá do FPS de autoria, da duração efetiva do golpe e do contrato em vigor; **não** basta copiar números de frames de 30 FPS diretamente para passos de 120 Hz.

Quando a fase terminar, o próximo trecho não deverá receber um frame fantasma ou duplicado que aumente a duração final. A convenção de amostragem/poses nos limites ainda precisa de decisão.

## 5. Sintaxe candidata — PROPOSTA NÃO APROVADA

Uma forma legível, com parâmetros opcionais, poderia ser:

    [Animation: Uppercut]
    [FPS: 30]
    [Mode: OneShot]
    [RootMotion: InPlace]

    [Start: 12]
    O corpo abaixa, a perna acumula força, o braço dominante recua.
    [Anticipation: 1-12]
    [Squash: 8-12 | tronco e pernas]

    [Mid: 16]
    Extensão explosiva, punho em trajetória ascendente.
    [Stretch: 1-8 | corpo e braço]
    [Smear: 4-6 | braço dominante]
    [Impact: 10]
    {Hitbox: 9-11}
    {Hitbox Bone: punho dominante}

    [End: 18]
    O braço segue a trajetória e o corpo retorna ao equilíbrio.
    [FollowThrough: 1-9]

**Somente demonstração de expressividade e contagem**, não um uppercut oficialmente aprovado. A separação entre `[ ]` para direção visual e `{ }` para dados mecânicos está **aprovada em LAN-006**; sintaxe literal dos parâmetros, nomes dos efeitos, valores de duração e significado de `Impact` continuam **pendentes**. O cabeçalho `[FPS: 30]` é apenas ilustrativo: a taxa fixa de 30 FPS é aprovada independentemente de esse cabeçalho vir a ser exigido.

### Exemplo inspirado na intenção do tapa de Vigoroth (não especificação oficial)

O diretor descreveu uma preparação de 19 frames, palmas encontrando-se no frame global 24 e aumento/deformação das mãos por 5 frames antes de normalizar. Na hipótese de frames numerados de 1 e fases contíguas, `Start:19` implica impacto no **quinto frame local de Mid**. O efeito de 5 frames poderia ocupar `Mid:5-9`; a recuperação e a duração total **não foram definidas**.

Este é um caso de teste importante do futuro validador: identificar a correspondência entre requisitos globais narrativos (`impacto no frame 24`) e modificadores locais sem mudar as duas decisões aprovadas.

## 6. Compatibilidade com o Arenamon — achados verificados no GitHub

Fontes consultadas (base remota `main` em 16/10/2026):
- [Editor e formato de metadados do Studio](../prototypes/studio/README.md).
- [Timeline do Studio](../prototypes/studio/src/editor/timeline.js).
- [Contrato de janelas de combate](JANELAS_COMBATE_RESOLVE_HIT.md).
- [Validador de janelas de animação](../prototypes/combat-lab/src/sim/animation-combat-windows.js).
- [Máquina de animação do laboratório](../prototypes/combat-lab/src/view/characters.js).
- [Sistema de Moves](../prototypes/combat-lab/MOVIMENTOS.md).

**Fatos observados:**
1. O Studio suporta clipes, timeline, eventos de animação, marcações de `hitbox_on` / `hitbox_off` e exportação com metadados em GLB; isso não significa que ele implemente o interpretador proposto.
2. As janelas documentadas pelo `animationCombatWindows` são intervalos **semiabertos de passos da simulação** (padrão 120 Hz): `[startStep, endStep)`. Esse é o formato **interno existente**, não a forma que o diretor escreverá.
3. Atualmente, os eventos de janela de hitbox de GLB/Studio são diagnósticos/visuais; **não alteram automaticamente** o dano, a colisão ou a invulnerabilidade do motor. O contrato descreve uma **integração futura**, condicionada à autorização do diretor.
4. A posição horizontal no jogo é controlada pela física; o deslocamento horizontal do root motion do clipe é descartado. A forma de declarar `in-place` na nova linguagem ainda precisa ser escolhida.
5. O Studio preserva animações e metadados, mas alguns recursos avançados de deformação não são garantidos pelo GLB; `Smear` e outros efeitos deverão ter implementação e forma de exportação verificadas.

**Não confundir:** (a) intenção visual do golpe, (b) janela desenhada na prévia, (c) metadados exportados, (d) hitbox física real que provoca dano. São camadas diferentes e o novo sistema não pode equipará-las por suposição.

## 7. Princípios e modificadores a especificar — CATÁLOGO PROPOSTO

Sem assumir aprovação de nomes, parâmetros ou motores de execução:

| Família | Exemplos a avaliar | Questão central |
|---|---|---|
| Fases e poses | Start, Mid, End, pose-chave, Impact | Estados obrigatórios? Como combinar subações? |
| Tempo e movimento | Anticipation, SlowIn, SlowOut, Arcs, Timing | Definição textual versus curvas editáveis e verificáveis |
| Forma | Squash, Stretch, Smear, escala de mãos | Ossos, shape keys, deformação ou geometria de efeito? |
| Secundários | FollowThrough, Overlap, SecondaryAction | Quais partes do rig e como compor contribuições? |
| Composição | Staging, Appeal, Exaggeration, SolidDrawing | Diretrizes artísticas ou operadores temporais mensuráveis? |
| Mecânica/metadados | Hitbox, Impact, invulnerabilidade, cancelamento | Apenas prévia ou futura integração ao motor? |
| Estrutura | FPS, Loop/OneShot, RootMotion, Target/Bone, export | Valores obrigatórios, padrão ou inferidos? |

Os **12 princípios clássicos de animação** devem orientar a qualidade dos movimentos. Nem todo princípio precisa virar uma operação acionável por janela de frames; alguns podem funcionar melhor como critérios globais de direção e validação. Essa distinção ainda exige aprovação.

## 8. Validações candidatas — NÃO IMPLEMENTADAS

Requisitos propostos para uma futura fase de validador:
- Rejeitar durações não positivas, intervalos invertidos, frames fora da fase e elementos que não se encaixam na animação.
- Identificar intervalos simultâneos e possíveis conflitos entre operadores que atingem o mesmo osso/canal.
- Distinguir operações deformantes visuais, eventos pontuais e volumes ofensivos; não tratar qualquer evento visual como dano automaticamente.
- Exibir frames locais e globais, duração total, timeline e conversão explícita em segundos e passos internos, com a política de arredondamento documentada.
- Não inventar rig, nomes de ossos, poses ou transições na falta de informações essenciais; solicitar dados ou reportar impedimento.
- Preservar malha, rig, pesos, materiais e clipes preexistentes, salvo autorização contrária; prévia visual e verificação de exportação/importação.
- Em clipes cíclicos, detectar descontinuidade no retorno ao início. Em golpes, distinguir fim visual de fim mecânico.
- Registrar os parâmetros efetivos usados para geração e anexar evidências de execução, em vez de alegar qualidade sem testes.

**Esses são critérios para deliberação; não foram implementados nem homologados.**

## 9. Perguntas pendentes — roteiro de deliberação

### Rodada 1 — gramática e tempo (concluída em 16/10/2026; decisões LAN-003 a LAN-010)
- **LAN-Q01.** Frames locais começam em **1** ou **0**? Os exemplos usam 1, mas não há aprovação explícita da origem. **RESOLVIDA — LAN-003 (1A)**.
- **LAN-Q02.** Start/Mid/End são sempre três fases obrigatórias, ou fases opcionais e/ou repetíveis para movimentos complexos? **RESOLVIDA — LAN-004 (2B)**.
- **LAN-Q03.** O FPS deve ser informado em cada prompt, ter padrão global configurável ou ser obtido do arquivo/projeto? **RESOLVIDA — LAN-005 (3A)**.
- **LAN-Q04.** Colchetes para direção/efeitos e chaves para informações mecânicas devem ter semântica distinta obrigatória? **RESOLVIDA — LAN-006 (4A)**.
- **LAN-Q05.** Modificadores em simultâneo na mesma parte: composição aditiva, precedência definida, substituição, rejeição, ou dependente do tipo? **RESOLVIDA — LAN-007 (5A)**.
- **LAN-Q06.** No término do modificador, o efeito deve ser removido instantaneamente, com atenuação incluída em sua janela ou com um intervalo de saída declarado? **RESOLVIDA — LAN-008 (6A)**.
- **LAN-Q07.** O diretor deseja que o sistema seja inicialmente uma **linguagem de prompts para Claude/Antigravity**, um **interpretador estruturado com validação**, ou uma **ferramenta no próprio Studio**? (Nenhuma arquitetura escolhida.) **RESOLVIDA — LAN-009 (7A)**.
- **LAN-Q08.** As durações de Start/Mid/End são fixas por prompt, ou podem ser expressas também por marcos e tempos relativos/adaptáveis? **RESOLVIDA — LAN-010 (8C)**.

### Rodada 2 — semântica visual e rig (concluída; decisões LAN-011 a LAN-017)
- **LAN-Q09.** Como identificar a parte-alvo: nomes exatos de ossos, termos anatômicos com mapeamento por rig ou ambos? **RESOLVIDA — LAN-011 (9C)**.
- **LAN-Q10.** Se a anatomia não suportar o modificador, interromper com erro, pedir alternativa ou apresentar versões para aprovação? **RESOLVIDA — LAN-012 (10C)**.
- **LAN-Q11.** `Smear` significa escala/stretch esquelético, malha temporária de deformação, múltiplas cópias/blur visual, ou seleção explícita do método? **RESOLVIDA — LAN-013 (11D)**.
- **LAN-Q12.** Intensidades (amplitude, direção, curva) obrigatórias ou descrição natural com sugestões do agente? **RESOLVIDA — LAN-014 (12C)**.
- **LAN-Q13.** Todos os princípios podem receber janelas, ou apenas efeitos temporais; quais princípios são globais? **RESOLVIDA — LAN-015 (13C)**.
- **LAN-Q14.** Como devem funcionar poses-chave e transições Start→Mid→End quando há mudanças bruscas? **RESOLVIDA — LAN-016 (14B)**.
- **LAN-Q15.** Qual a política para deformações que não sobrevivem à exportação GLB? **RESOLVIDA — LAN-017 (15B)**.

### Rodada 3 — gameplay e integração (concluída; decisões LAN-018 a LAN-023)
- **LAN-Q16.** `{Hitbox}` inicialmente desenha volume vermelho, exporta eventos/metadados ou futuramente governa dano real? Cada opção exige autorização e validação distinta. **RESOLVIDA — LAN-018 (16A)**.
- **LAN-Q17.** Como identificar formato, tamanho, offset, orientação e osso de uma hitbox? Podem existir múltiplos volumes e golpes multihit? **RESOLVIDA — LAN-019 (17C)**.
- **LAN-Q18.** Como resolver divergência de FPS e duração entre o clipe animado e a duração efetiva do golpe no jogo? **RESOLVIDA — LAN-020 (18B)**.
- **LAN-Q19.** A linguagem pode mencionar invulnerabilidade, cancelamento, hitstop e stagger sem mudar a física, ou esses termos serão restritos? **RESOLVIDA — LAN-021 (19A)**.
- **LAN-Q20.** In-place sempre, por padrão com exceções ou configurável por ação? **RESOLVIDA — LAN-022 (20B)**.
- **LAN-Q21.** A evolução da linguagem deve valer apenas para o laboratório de combate ou também para outros usos e jogos? **RESOLVIDA — LAN-023 (21C)**.

### Rodada 4 — produção, segurança e aprovação (concluída; decisões LAN-024 a LAN-028)
- **LAN-Q22.** Arquivos de entrega: BLEND, GLB, vídeo, especificação textual e/ou relatório de validação — quais são obrigatórios? **RESOLVIDA — LAN-024 (22A)**.
- **LAN-Q23.** Verificação: apenas testes automáticos ou também revisão visual em vários ângulos, comparação e aprovação do diretor? **RESOLVIDA — LAN-025 (23A)**.
- **LAN-Q24.** Critérios de aprovação por fases (blocking, spline, polish) e autorização antes de substituir arquivos? **RESOLVIDA — LAN-026 (24C)**.
- **LAN-Q25.** Como versionar uma animação e registrar variantes sem sobrescrever originais? **RESOLVIDA — LAN-027 (25A)**.
- **LAN-Q26.** Quais três casos reais devemos usar para validar a linguagem (idle, uppercut, tapa, esquiva, quadrúpede...)? **RESOLVIDA — LAN-028 (26B)**.

### Rodada 5 — gramática detalhada e catálogo inicial de modificadores (concluída; decisões LAN-029 a LAN-037)

> **Rodada respondida:** apenas as nove alternativas explicitamente selecionadas (LAN-029 a LAN-037) estão aprovadas. A especificação exata de cada modificador segue pendente.

- **LAN-Q27.** Qual formato literal dos cabeçalhos e das durações: `[Start: 12]`, `[Start 12]` ou aceitar ambos e normalizar? **RESOLVIDA — LAN-029 (27C)**.
- **LAN-Q28.** Como identificar múltiplos `Mid`: repetição sequencial de `[Mid: X]`, identificação explícita `[Mid: Nome | X]` ou numeração automática? **RESOLVIDA — LAN-030 (28C)**.
- **LAN-Q29.** Qual sintaxe de parâmetros adicionais de um modificador (alvo, intensidade, curva), mantendo valores opcionais e estritamente respeitados quando fornecidos? **RESOLVIDA — LAN-031 (29B)**.
- **LAN-Q30.** Como expressar eventos pontuais versus intervalos inclusivos: `[Impact: 8]`, `[Impact: 8-8]` ou uma sintaxe separada? **RESOLVIDA — LAN-032 (30A)**.
- **LAN-Q31.** Como a IA escolhe e documenta curvas de entrada, sustentação e saída de modificadores dentro do intervalo aprovado? **RESOLVIDA — LAN-033 (31C)**.
- **LAN-Q32.** Como categorizar compatibilidade e conflitos entre modificadores simultâneos que atingem o mesmo osso, canal ou malha? **RESOLVIDA — LAN-034 (32A)**.
- **LAN-Q33.** Como lidar com modificadores de deformação com janela muito curta, inclusive um único frame, sem violar o retorno suave dentro do intervalo aprovado em LAN-008? **RESOLVIDA — LAN-035 (33A)**.
- **LAN-Q34.** Como garantir continuidade de poses e curvas entre Start, múltiplos Mid e End sem acrescentar ou duplicar frames? **RESOLVIDA — LAN-036 (34A)**.
- **LAN-Q35.** Como declarar princípios globais (Staging, Appeal etc.) e definir o primeiro catálogo de modificadores temporais, sem tratar todos os 12 princípios como operações temporais? **RESOLVIDA — LAN-037 (35A)**.

### Rodada 6 — catálogo semântico de efeitos e parâmetros (concluída; decisões LAN-038 a LAN-046)

> **Rodada concluída:** as seleções explícitas 36A, 37B, 38B, 39B, 40A, 41B, 42A, 43B e 44A estão registradas como LAN-038 a LAN-046. Demais detalhes de implementação seguem pendentes.

- **LAN-Q36.** Qual o conjunto inicial de modificadores temporais de deformação (Smear, Squash, Stretch, Scale e outros), e qual processo de ampliação do catálogo? **RESOLVIDA — LAN-038 (36A)**.
- **LAN-Q37.** Quando `Smear` significa deformação corporal, rastro visual, duplicação temporária ou outro método, qual a convenção para selecionar/descrever a técnica? **RESOLVIDA — LAN-039 (37B)**.
- **LAN-Q38.** Como especificar intensidade e escala de Squash/Stretch/Scale (eixos, preservação de volume, alvo anatômico) sem forçar anatomia inadequada? **RESOLVIDA — LAN-040 (38B)**.
- **LAN-Q39.** Quais curvas de entrada/pico/retorno devem estar disponíveis para deformações, e como registrar propostas provisórias feitas pela IA? **RESOLVIDA — LAN-041 (39B)**.
- **LAN-Q40.** Como distinguir `Anticipation` e `FollowThrough` como marcadores temporais de direção dos seus efeitos reais nas poses e curvas? **RESOLVIDA — LAN-042 (40A)**.
- **LAN-Q41.** Como especificar `Overlap` e `SecondaryAction`: alvo anatômico, atraso, duração e dependência da ação principal? **RESOLVIDA — LAN-043 (41B)**.
- **LAN-Q42.** Quais princípios devem ser globais por padrão e como expressar sua intensidade geral sem transformar todos em operadores de frames? **RESOLVIDA — LAN-044 (42A)**.
- **LAN-Q43.** Como definir a ampliação temporária de partes corporais (mãos, punhos, cabeça etc.) com volta ao normal, preservação anatômica e coerência de exportação? **RESOLVIDA — LAN-045 (43B)**.
- **LAN-Q44.** Como validar que uma mudança é efeito artístico intencional versus deformação acidental do rig, incluindo prévia sem efeitos e comparação? **RESOLVIDA — LAN-046 (44A)**.

### Rodada 7 — timing, poses, loops e eventos (concluída; decisões LAN-047 a LAN-055)

> **Rodada concluída:** aprovadas somente as respostas explícitas 45A, 46B, 47A, 48A, 49B, 50A, 51B, 52B e 53A. Mantidos os contratos de 30 FPS, frames locais 1-based, intervalos inclusivos, retorno suave dentro da janela e distinção entre direção visual e dados mecânicos.

- **LAN-Q45.** Como especificar poses-chave opcionais e seus marcos temporais, sem conflito com os intervalos de modificadores? **RESOLVIDA — LAN-047 (45A)**.
- **LAN-Q46.** Como definir timing de preparação, aceleração, pausa e recuperação, sem inserir frames além da duração fixa? **RESOLVIDA — LAN-048 (46B)**.
- **LAN-Q47.** Como indicar contatos com chão, apoio das mãos ou travamento de pés (IK/foot plant) sem alterar deslocamento físico do lutador? **RESOLVIDA — LAN-049 (47A)**.
- **LAN-Q48.** Como definir animações cíclicas (Idle etc.) e a continuidade entre o último frame e o primeiro sem mudar a contagem de frames? **RESOLVIDA — LAN-050 (48A)**.
- **LAN-Q49.** Como declarar impacto visual, pose de impacto e possível pausa/hold de animação, separando isso do hitstop mecânico? **RESOLVIDA — LAN-051 (49B)**.
- **LAN-Q50.** Como representar sequências de múltiplos golpes, múltiplos Mid e ritmos diferentes, mantendo tempos e marcos locais verificáveis? **RESOLVIDA — LAN-052 (50A)**.
- **LAN-Q51.** Como especificar blending de entrada e saída, interrupções e transições com outras animações sem transformar metadados em alterações mecânicas? **RESOLVIDA — LAN-053 (51B)**.
- **LAN-Q52.** Como modelar, revisar, amostrar e exportar curvas/poses do Blender para GLB, preservando timing e intenção visual? **RESOLVIDA — LAN-054 (52B)**.
- **LAN-Q53.** Quais evidências mínimas devem acompanhar a validação de continuidade, contatos, deformação, timing e exportação antes da aprovação do blocking e da entrega final? **RESOLVIDA — LAN-055 (53A)**.

### Rodada 8 — rigs não humanoides, integridade e validação de exportação (concluída; decisões LAN-056 a LAN-064)

> **Rodada concluída por aprovação global das recomendações:** o diretor respondeu `sigo todas recomendações`, ratificando as alternativas 54B, 55A, 56A, 57B, 58B, 59B, 60B, 61B e 62A como decisões LAN-056 a LAN-064. A aprovação não autoriza alterar malha, rig ou pesos nem implementar código.

- **LAN-Q54.** Como detectar e classificar anatomias não humanoides e seus segmentos a partir da inspeção do rig e da malha? **RESOLVIDA — LAN-056 (54B)**.
- **LAN-Q55.** O que fazer com mapeamentos ambíguos, ossos ausentes ou malhas sem rig e como registrar pedidos de aprovação? **RESOLVIDA — LAN-057 (55A)**.
- **LAN-Q56.** Como preservar estrutura óssea, skinning, materiais, malha e arquivos-fonte quando uma técnica de animação pede adaptação? **RESOLVIDA — LAN-058 (56A)**.
- **LAN-Q57.** Como definir espaço de coordenadas, direção frontal, unidade de escala, pivôs e eixos para que comandos anatômicos não invertam movimentos? **RESOLVIDA — LAN-059 (57B)**.
- **LAN-Q58.** Como lidar com colisões ou interpenetrações visuais intencionais versus erros de malha/rig nas deformações? **RESOLVIDA — LAN-060 (58B)**.
- **LAN-Q59.** Quais critérios mensuráveis ou diagnósticos devem validar pés/mãos apoiados, deslizamento, IK e fechamento de loops sem sacrificar animação estilizada? **RESOLVIDA — LAN-061 (59B)**.
- **LAN-Q60.** Como representar efeitos auxiliares (trails, cópias, geometria de Smear, shape keys) na exportação GLB sem perder a aparência, e o que reprovar? **RESOLVIDA — LAN-062 (60B)**.
- **LAN-Q61.** Como organizar diferenças entre prévia no Blender, prévia reimportada em GLB e reprodução futura no Arenamon sem afirmar integração não implementada? **RESOLVIDA — LAN-063 (61B)**.
- **LAN-Q62.** Qual criatura de anatomia não humanoide e qual ação específica deverão compor o terceiro teste inicial, e como aprovar o modelo de teste? **RESOLVIDA — LAN-064 (62A)**.

### Rodada 9 — normalização, contrato de conformidade e rastreabilidade (concluída; decisões LAN-065 a LAN-074)

> **Rodada concluída:** o diretor aprovou todas as recomendações (`sigo suas recomendações`), correspondentes às escolhas 63C, 64B, 65B, 66B, 67A, 68B, 69A, 70A e 71C. Acrescentou expressamente a obrigação de perguntar sobre informação ausente na descrição da animação (LAN-074). Nenhuma implementação autorizada.

- **LAN-Q63.** Como tratar instruções incompletas ou ambíguas no prompt: pedir confirmação, gerar proposta provisória identificada ou bloquear conforme a criticidade? **RESOLVIDA — LAN-065 (63C)**.
- **LAN-Q64.** Qual o formato canônico normalizado do documento/prompt: texto estruturado único, texto com representação intermediária proposta ou duas fontes equivalentes? **RESOLVIDA — LAN-066 (64B)**.
- **LAN-Q65.** Como declarar tipos de animação (Loop, OneShot, pose, reação), evitando que propriedades cíclicas sejam presumidas a partir do nome? **RESOLVIDA — LAN-067 (65B)**.
- **LAN-Q66.** Como representar e validar frames locais, globais, eventos pontuais e intervalos inclusivos em relatórios e exportações, preservando duração exata? **RESOLVIDA — LAN-068 (66B)**.
- **LAN-Q67.** Como identificar versão do catálogo, versão da linguagem e compatibilidade de comandos entre agentes, sem aceitar comandos desconhecidos silenciosamente? **RESOLVIDA — LAN-069 (67A)**.
- **LAN-Q68.** Como registrar valores explicitamente fornecidos, valores sugeridos e valores aprovados, distinguindo proveniência e revisão? **RESOLVIDA — LAN-070 (68B)**.
- **LAN-Q69.** Qual o tratamento de erros de conformidade: falhar seletivamente, bloquear execução completa ou permitir correções automatizadas condicionadas à aprovação? **RESOLVIDA — LAN-071 (69A)**.
- **LAN-Q70.** Quais critérios objetivos e evidências devem compor a matriz de testes de aceitação da gramática, da animação e da exportação? **RESOLVIDA — LAN-072 (70A)**.
- **LAN-Q71.** Quando considerar a versão inicial da linguagem pronta para uma prova de conceito controlada, sem autorizar a implementação automaticamente? **RESOLVIDA — LAN-073 (71C)**.

### Rodada 10 — briefing obrigatório e protocolo de esclarecimentos (concluída; decisões LAN-075 a LAN-083)

> **Rodada concluída:** o diretor declarou `sigo com suas recomendações`, aprovando 72B, 73A, 74A, 75B, 76B, 77B, 78A, 79B e 80B. A obrigação LAN-074 de perguntar sobre lacunas na descrição permanece em vigor; nenhuma implementação foi autorizada.

- **LAN-Q72.** Quais campos devem entrar na revisão inicial da descrição (tipo, intenção, ação, anatomia, duração, poses, impacto, referências) e quais são necessários conforme o tipo de animação? **RESOLVIDA — LAN-075 (72B)**.
- **LAN-Q73.** Como apresentar as perguntas de esclarecimento: todas agrupadas, uma por vez ou por categorias de criticidade? **RESOLVIDA — LAN-076 (73A)**.
- **LAN-Q74.** O que fazer quando o diretor autorizar explicitamente a IA a decidir algum aspecto criativo ainda indefinido? **RESOLVIDA — LAN-077 (74A)**.
- **LAN-Q75.** Como interpretar descrições subjetivas como `mais épico`, `mais peso` e `mais exagerado` sem presumir movimentos específicos? **RESOLVIDA — LAN-078 (75B)**.
- **LAN-Q76.** Como lidar com imagens, vídeos, animações e arquivos de referência fornecidos para orientar poses e timing? **RESOLVIDA — LAN-079 (76B)**.
- **LAN-Q77.** Como registrar cada pergunta, resposta, decisão delegada e revisão do briefing para manter rastreabilidade e impedir contradições? **RESOLVIDA — LAN-080 (77B)**.
- **LAN-Q78.** Como resolver instruções conflitantes entre descrição atual, arquivos de referência e parâmetros explícitos sem escolher silenciosamente? **RESOLVIDA — LAN-081 (78A)**.
- **LAN-Q79.** Como confirmar que a fase obrigatória de perguntas terminou e que o briefing está suficientemente completo antes do blocking? **RESOLVIDA — LAN-082 (79B)**.
- **LAN-Q80.** Como preparar uma especificação canônica de exemplo com briefing, perguntas, respostas, blocos, modificadores e relatório de validação, sem iniciar implementação? **RESOLVIDA — LAN-083 (80B)**.

### Rodada 11 — contrato temporal, conformidade e aceitação (concluída; decisões LAN-084 a LAN-092)

> **Rodada concluída:** o diretor respondeu `suas recomendações`, aprovando 81B, 82A, 83A, 84B, 85A, 86B, 87B, 88A e 89A. Nenhuma implementação autorizada.

- **LAN-Q81.** Quais campos mínimos e tipos devem compor um bloco de animação, distinguindo declarações obrigatórias das opcionais? **RESOLVIDA — LAN-084 (81B)**.
- **LAN-Q82.** Como normalizar nomes opcionais e IDs de múltiplos Mid, inclusive duplicações e referências entre etapas? **RESOLVIDA — LAN-085 (82A)**.
- **LAN-Q83.** Como definir a correspondência entre frames de autoria 1-based, amostras de poses, duração de 30 FPS e limites de etapas sem frame fantasma? **RESOLVIDA — LAN-086 (83A)**.
- **LAN-Q84.** Como representar o limite de loop para assegurar continuidade visual de pose e velocidade sem duplicar duração? **RESOLVIDA — LAN-087 (84B)**.
- **LAN-Q85.** Como avaliar e comunicar a duração mínima necessária para deformações com retorno suave, sem alterar janelas aprovadas? **RESOLVIDA — LAN-088 (85A)**.
- **LAN-Q86.** Como aprovar e aplicar métricas verificáveis de deslizamento, contato, continuidade e deformação conforme a anatomia e o estilo? **RESOLVIDA — LAN-089 (86B)**.
- **LAN-Q87.** Quais campos mínimos do volume de hitbox (shape, tamanho, deslocamento, rotação, alvo, janela) serão documentados e como separar prévia de dano real? **RESOLVIDA — LAN-090 (87B)**.
- **LAN-Q88.** Como estruturar evidências e rastreabilidade por agente/versão, diferenciando teste realizado, teste não executado, ressalva e reprovação? **RESOLVIDA — LAN-091 (88A)**.
- **LAN-Q89.** Em que ordem consolidar gramática, casos canônicos, testes e revisão de pendências antes de solicitar autorização específica para prova de conceito? **RESOLVIDA — LAN-092 (89A)**.

### Rodada 12 — fechamento do formato canônico e testes normativos (concluída; decisões LAN-093 a LAN-101)

> **Rodada concluída:** o diretor aprovou expressamente 90A, 91A, 92B, 93A, 94B, 95A, 96B, 97A e 98B. A consolidação da seção 12 deve distinguir regras aprovadas, propostas ainda não aprovadas e testes não executados.

- **LAN-Q90.** Qual a forma exata de escrever cabeçalhos com nomes opcionais e IDs, sem confundir duração, identificadores de Mid e termos descritivos? **RESOLVIDA — LAN-093 (90A)**.
- **LAN-Q91.** Como representar poses, intervalos de modificadores, eventos pontuais, holds visuais, dados mecânicos e seções globais num exemplo normativo sem ambiguidades? **RESOLVIDA — LAN-094 (91A)**.
- **LAN-Q92.** Como representar precisão/unidades de valores (escala, ângulos, offsets, intensidade) e tratamento de propostas provisórias? **RESOLVIDA — LAN-095 (92B)**.
- **LAN-Q93.** Como categorizar diagnósticos em bloqueante, pendência que exige aprovação e simples aviso, preservando a execução seletiva autorizada? **RESOLVIDA — LAN-096 (93A)**.
- **LAN-Q94.** Qual convenção documental para limites de tempo, último frame, amostra terminal e conversão de 30 FPS para 120 Hz quando aplicável? **RESOLVIDA — LAN-097 (94B)**.
- **LAN-Q95.** Como estabelecer casos de teste curtos para sequência de Mid, intervalo inclusivo, impacto pontual, loop e fechamento, conflito e duração insuficiente? **RESOLVIDA — LAN-098 (95A)**.
- **LAN-Q96.** Como definir critérios de aceite do exemplo completo, incluindo briefing esclarecido, blocking aprovado, exportação GLB e revisão final, sem presumir que os testes já foram executados? **RESOLVIDA — LAN-099 (96B)**.
- **LAN-Q97.** Como organizar um catálogo normativo de termos visuais e mecânicos, com exemplos de comandos aceitos e comandos não definidos? **RESOLVIDA — LAN-100 (97A)**.
- **LAN-Q98.** Como consolidar e apresentar ao diretor os itens já normativos, as pendências ainda bloqueantes e os itens reservados para uma versão futura? **RESOLVIDA — LAN-101 (98B)**.

## 10. Governança e escopo

- **Este documento é apenas planejamento.** Nenhuma implementação de parser, Studio, Blender ou jogo foi autorizada.
- O registro deve preservar decisões existentes e acrescentar novas respostas por identificador (`LAN-...`). Uma decisão substituída deve manter a redação original e apontar sua substituta.
- Propostas de exemplo não viram decisões por estarem escritas aqui.
- Deve ser revisado junto dos contratos técnicos existentes antes de qualquer implementação, sem alterar regras do combate automaticamente.
- As perguntas da próxima rodada serão apresentadas em chat; as respostas explícitas do diretor serão incorporadas por novos commits documentais.
- As limitações de acesso ao checkout Windows local devem ser relatadas; atualizações via GitHub não comprovam a sincronização ou a limpeza desse checkout.

## 11. Registro de alterações

| Data | Ação |
|---|---|
| 16/10/2026 | Primeira consolidação da ideia de Start/Mid/End, das duas decisões explicitamente aprovadas (LAN-001 e LAN-002), dos conflitos técnicos conhecidos e das perguntas pendentes. Novo documento isolado; nenhum código alterado. |
| 16/10/2026 | **Rodada 1:** registradas oito aprovações explícitas (LAN-003 a LAN-010; escolhas 1A, 2B, 3A, 4A, 5A, 6A, 7A e 8C). LAN-Q01 a LAN-Q08 marcadas como resolvidas sem apagá-las. Restantes pendências preservadas. Nenhuma implementação autorizada. |
| 16/10/2026 | **Rodada 2:** registradas sete aprovações explícitas (LAN-011 a LAN-017; escolhas 9C, 10C, 11D, 12C, 13C, 14B, 15B). LAN-Q09 a LAN-Q15 marcadas como resolvidas sem apagar o texto anterior. Restantes pendências preservadas. Nenhuma implementação autorizada. |
| 16/10/2026 | **Rodada 3:** registradas seis decisões explícitas (LAN-018 a LAN-023; escolhas 16A, 17C, 18B, 19A, 20B, 21C). LAN-Q16 a LAN-Q21 marcadas como resolvidas. Preservadas todas as decisões e pendências anteriores. Nenhuma implementação nem ativação de regras de combate autorizada. |
| 16/10/2026 | **Rodada 4:** registradas cinco decisões explícitas (LAN-024 a LAN-028; escolhas 22A, 23A, 24C, 25A, 26B). LAN-Q22 a LAN-Q26 marcadas como resolvidas sem suprimir o texto histórico. Incluídas perguntas LAN-Q27 a LAN-Q35 como pendências novas, sem aprová-las. Nenhuma implementação autorizada. |
| 16/10/2026 | **Rodada 5:** registradas nove decisões explícitas (LAN-029 a LAN-037; 27C, 28C, 29B, 30A, 31C, 32A, 33A, 34A, 35A). As perguntas LAN-Q27 a LAN-Q35 foram marcadas como resolvidas mantendo o enunciado histórico. LAN-Q36 a LAN-Q44 adicionadas somente como pendências. Nenhuma implementação autorizada. |
| 16/10/2026 | **Rodada 6:** registradas nove decisões explícitas LAN-038 a LAN-046 (36A, 37B, 38B, 39B, 40A, 41B, 42A, 43B, 44A). LAN-Q36 a LAN-Q44 marcadas como resolvidas sem supressão do histórico. LAN-Q45 a LAN-Q53 adicionadas como pendências, sem presumir aprovações. Nenhuma implementação autorizada. |
| 16/10/2026 | **Rodada 7:** registradas nove aprovações explícitas LAN-047 a LAN-055 (45A, 46B, 47A, 48A, 49B, 50A, 51B, 52B, 53A). LAN-Q45 a LAN-Q53 marcadas como resolvidas, sem remover perguntas nem decisões anteriores. LAN-Q54 a LAN-Q62 adicionadas apenas como pendências de planejamento. Nenhuma implementação autorizada. |
| 17/10/2026 | **Rodada 8:** o diretor aprovou todas as recomendações da rodada com `sigo todas recomendações`, correspondendo a 54B, 55A, 56A, 57B, 58B, 59B, 60B, 61B e 62A. Registradas LAN-056 a LAN-064 e resolvidas LAN-Q54 a LAN-Q62. Incluídas LAN-Q63 a LAN-Q71 como pendências para normalização/conformidade. Nenhuma implementação autorizada; histórico integral preservado. |
| 17/10/2026 | **Rodada 9:** o diretor aprovou todas as nove recomendações (63C, 64B, 65B, 66B, 67A, 68B, 69A, 70A, 71C), registradas em LAN-065 a LAN-073. Complemento explícito `inclusive adicione a obrigatoriedade da IA perguntar sobre o que falta de informação na desc da animação`, registrado separadamente em LAN-074. LAN-Q63 a LAN-Q71 resolvidas sem apagar histórico. LAN-Q72 a LAN-Q80 adicionadas como pendentes. Nenhuma implementação autorizada. |
| 17/10/2026 | **Rodada 10:** o diretor aprovou todas as recomendações com `sigo com suas recomendações`, correspondentes a 72B, 73A, 74A, 75B, 76B, 77B, 78A, 79B e 80B. Registradas LAN-075 a LAN-083, preservada a obrigatoriedade LAN-074, e marcadas resolvidas LAN-Q72 a LAN-Q80. Propostas LAN-Q81 a LAN-Q89 adicionadas sem aprovação. Nenhuma implementação autorizada. |
| 17/10/2026 | **Rodada 11:** o diretor aprovou as nove recomendações com `suas recomendações` (81B, 82A, 83A, 84B, 85A, 86B, 87B, 88A, 89A), registradas em LAN-084 a LAN-092. LAN-Q81 a LAN-Q89 resolvidas, preservando enunciados e decisões anteriores. Consolidação documental de regras já aprovadas na seção 12 e novas pendências LAN-Q90 a LAN-Q98, sem implementação. |
| 17/10/2026 | **Rodada 12:** o diretor aprovou explicitamente as nove recomendações (90A, 91A, 92B, 93A, 94B, 95A, 96B, 97A, 98B). Registradas LAN-093 a LAN-101 e resolvidas LAN-Q90 a LAN-Q98. Consolidação normativa e auditoria documental da seção 12 atualizadas, preservando o histórico integral. Nenhuma implementação, prova de conceito ou alteração em `main` autorizada. |
| 17/10/2026 | **Continuação documental após a Rodada 12:** preparados catálogo técnico comentado dos oito modificadores (seção 13), exemplo canônico candidato com briefing/respostas explicitamente hipotéticos e verificações não executadas (seção 14), e pendências LAN-Q99 a LAN-Q106 (seção 15). **Nenhuma nova aprovação atribuída ao diretor; LAN-001 a LAN-101 e histórico preservados. Nenhum código, rig ou runtime alterado.** |

## 12. Consolidação normativa preliminar — derivada exclusivamente das decisões aprovadas

> **Estado:** síntese normativa **parcial**, não homologação final de gramática ou autorização de implementação. Os requisitos abaixo possuem suporte nas decisões indicadas e não devem ser confundidos com uma especificação executável, um parser pronto ou animações validadas.
>
> **Convenção:** **REGRA APROVADA** = conteúdo obrigatório já deliberado; **EXEMPLO ILUSTRATIVO** = valores e nomes demonstrativos sem aprovação de uma animação real; **PENDENTE** = escolha que depende de deliberação.

### 12.1 Fluxo obrigatório de criação (REGRA APROVADA)

1. Receber descrição da animação e inspecionar referências e anatomia disponível; realizar checklist **contextual** de intenção, ação, anatomia, poses, duração/timing, estilo e referências (LAN-074 a LAN-076).
2. **Perguntar ao diretor** sobre lacunas relevantes ou ambiguidades da descrição, preferencialmente agrupadas por categoria. Pedir esclarecimento adicional se surgirem novas lacunas. Não presumir intenção criativa. Distinguir parâmetros técnicos opcionais propostos provisoriamente de decisões aprovadas (LAN-014, LAN-065, LAN-074 a LAN-081).
3. Exibir resumo consolidado do briefing, a procedência das informações e escolhas delegadas; **aguardar a confirmação do diretor antes de iniciar o blocking** (LAN-077 a LAN-082).
4. Inspecionar e mapear rig, hierarquia e anatomia, com cópia versionada e preservação dos dados originais. Incompatibilidades/alterações estruturais exigem esclarecimento ou aprovação; operações afetadas não avançam silenciosamente (LAN-011, LAN-012, LAN-056 a LAN-059).
5. Preparar blocking, obter sua aprovação e só depois prosseguir a refinamento/polimento. Exigir aprovação final antes da entrega definitiva; mudanças permanecem rastreadas por versão (LAN-016, LAN-026, LAN-027).
6. Preparar os cinco entregáveis exigidos: `.blend`, GLB, vídeo de prévia, prompt original e relatório de validação. Testar o que for possível e registrar explicitamente o não testado, evitando alegações sem evidências (LAN-024, LAN-025, LAN-054, LAN-055, LAN-062, LAN-063, LAN-091).

### 12.2 Semântica temporal e estrutura (REGRA APROVADA)

- A autoria usa **30 FPS obrigatórios**; a indexação do primeiro frame local de cada etapa começa em **1**. Intervalos textuais `a-b` são **inclusivos** e contêm `b-a+1` frames (LAN-001 a LAN-003, LAN-005).
- O modo (`Mode`) deve ser declarado. **Start e End são obrigatórios**; um ou mais **Mid podem existir conforme a ação**, incluindo nomes opcionais e IDs sequenciais estáveis (LAN-004, LAN-030, LAN-052, LAN-067, LAN-084, LAN-085).
- Os cabeçalhos aceitam tanto `[Start: 12]` quanto `[Start 12]`, com normalização. A forma de Mid nomeado `[Mid: 12 | name=uppercut]` ou `[Mid 12 | name=uppercut]` é **REGRA APROVADA**, com nome opcional e ID estável; os detalhes de caracteres permitidos em nomes e referências continuam pendentes (LAN-029, LAN-030, LAN-085, LAN-093).
- Cada frame autoral **i** corresponde ao intervalo temporal semiaberto `[(i−1)/30, i/30)` s em relação ao início da etapa de autoria, com índice i iniciado em 1. Uma etapa de `N` frames tem duração `N/30` s; seu limite final é calculado separadamente, sem adicionar duração fantasma. Para outro referencial, somar o deslocamento da etapa, mantendo a conversão documentada (LAN-086, LAN-097).
- Eventos pontuais usam um número; modificadores temporais usam dois extremos inclusivos. Modificadores dentro da etapa contam frames **locais**; a equivalência global deve ser relatada, sem introduzir frames extras nas transições (LAN-001, LAN-002, LAN-032, LAN-036, LAN-068).
- Loops devem preservar continuidade de pose/movimento e podem conter **amostra técnica terminal de fechamento** fora da contagem autoral, sem acrescentar duração ao ciclo (LAN-050, LAN-087).
- O tempo do clipe poderá ser ajustado à duração mecânica da ação conforme o contrato aprovado, com relatório de diferenças. A simulação do Arenamon utiliza passos próprios e intervalos internos semiabertos; comandos autorais não mudam a física diretamente (LAN-020, LAN-021, LAN-068).

### 12.3 Efeitos, princípios e metadados (REGRA APROVADA)

- `[ ]` indica direção/efeitos **visuais** e `{ }` indica dados **mecânicos**. A seção global artística é opcional e distinta do catálogo temporal controlado (LAN-006, LAN-015, LAN-037, LAN-044).
- Catálogo inicial aprovado: **Smear, Squash, Stretch, Scale, Anticipation, FollowThrough, Overlap, SecondaryAction**. `method` de Smear é opcional; técnicas escolhidas pela IA precisam de justificativa e verificação de exportação (LAN-038, LAN-039).
- Parâmetros nomeados são opcionais; texto livre é aceito. Valores expressamente fornecidos vinculam a IA; os propostos sem instrução explícita permanecem provisórios e rastreáveis (LAN-014, LAN-031, LAN-033, LAN-070).
- Compatibilidade de efeitos simultâneos depende de alvo anatômico, canal/propriedade e intervalo. Conflitos precisam de resolução prévia; deformações muito curtas para entrada e retorno suaves devem ser rejeitadas, sem alteração automática de duração (LAN-007, LAN-008, LAN-034, LAN-035, LAN-088).
- Curvas predefinidas aprovadas para disponibilização futura: Ease, Sharp, Elastic, Overshoot, respeitando as regras de retorno; aplicações específicas, parâmetros, intervalos e resultados devem ser verificáveis (LAN-041).
- Poses, timing, contatos, impactos e holds visuais podem ser declarados sem acrescentar frames; hitstop de gameplay, cancelamentos e invulnerabilidade permanecem dados de inspeção até autorização de integração (LAN-047 a LAN-053).
- `{Hitbox}` representa volume vermelho na prévia e metadados de janela, podendo incluir forma, dimensões, deslocamento, orientação e osso. **Não ativa dano automaticamente** (LAN-018, LAN-019, LAN-090).

### 12.4 Exemplo mínimo de contagem — EXEMPLO ILUSTRATIVO, NÃO ANIMAÇÃO APROVADA

```text
[Mode: OneShot]   # declaração explícita do modo (grafia literal ainda candidata)
[Start: 12]      # 12 intervalos de 1/30 s; frames globais 1..12
  Preparação descrita no briefing confirmado.
[Mid: 16]        # frames globais 13..28
  Movimento principal descrito no briefing confirmado.
  [Smear: 4-6]   # 3 frames locais; globais 16..18
  [Impact: 10]   # evento pontual local; frame global 22
  {Hitbox: 9-11} # 3 frames locais; globais 21..23; metadados/visualização
[End: 18]        # frames globais 29..46
  Retorno e conclusão descritos no briefing confirmado.
```

**Conta ilustrativa:** `12+16+18 = 46` frames = `46/30 s` de duração autoral total. Os textos de movimento, nomes, medidas, posições, anatomia, pose e eventual gameplay reais exigem briefing aprovado. Os valores desse exemplo não estão aprovados como especificação de uppercut, tapa ou idle. A sintaxe exata de anotações, comentários e todos os parâmetros ainda não foi homologada; o exemplo **não** autoriza execução.

### 12.5 Matriz de aceitação em planejamento — não executada

| Aspecto | Verificação exigida pelo princípio aprovado | Estado |
|---|---|---|
| Interpretação/briefing | Perguntas obrigatórias quando faltarem informações relevantes; resumo confirmado antes do blocking | **REGRA APROVADA**, caso de teste pendente |
| Contagem de frames | 30 FPS, índices locais em 1, intervalos inclusivos, duração sem frame fantasma | **REGRA APROVADA**, verificação automatizada pendente |
| Mid e transições | IDs estáveis, nomes opcionais e formato `[Mid: N | name=...]` / `[Mid N | name=...]`; referências não ambíguas; poses/velocidades coerentes | **REGRA APROVADA**, restrições de nomes e exemplos testáveis pendentes |
| Efeitos/deformações | Não sobrescrever parâmetros explícitos; conflito diagnosticado; retorno dentro da janela | **REGRA APROVADA**, tolerâncias dependem de aprovação |
| Loop/contato | Fechamento sem duração extra, sem deslizamento não intencional | **REGRA APROVADA**, métricas numéricas pendentes |
| Hitbox | Prévia vermelha, intervalos e volumes como metadados sem ativação de dano | **REGRA APROVADA**, esquema completo pendente |
| Exportação | Comparar Blender e GLB reimportado; evidenciar perdas, failures e não testados | **REGRA APROVADA**, execução não iniciada |
| Aprovação | Briefing confirmado, blocking aprovado, resultado final aprovado | **REGRA APROVADA**, nenhuma animação aprovada aqui |

### 12.6 Bloqueios ainda abertos — PENDENTE

- Detalhar caracteres permitidos, escapes e unicidade de nomes/IDs de Mid, bem como a sintaxe/semântica literal de todas as variantes de eventos e seus parâmetros.
- Definir unidades concretas e tolerâncias numéricas por tipo de parâmetro, ação e anatomia; valores não aprovados permanecem propostas provisórias, e limites numéricos exigem aprovação.
- Completar catálogo versionado com entradas individuais, comandos válidos/inválidos e tratamento de compatibilidade.
- Especificar casos positivos/negativos com resultados esperados para contagem, Mid, loops, conflitos, deformações, preservação de rig e GLB reimportado, **sem afirmar que já foram executados**.
- Completar exemplo **canônico** com briefing, esclarecimentos, confirmação, estrutura de animação, validações e evidências hipotéticas identificadas como não executadas.
- Realizar revisão final de matriz de normas, pendências bloqueantes, itens futuros e evidências de conformidade e solicitar aprovação explícita do diretor (LAN-101).
- Nenhum código, protótipo funcional, implementação no Blender/MCP, Studio ou runtime, ou prova de conceito foi autorizado neste registro.


### 12.7 Consolidação formal da Rodada 12 — REGRA APROVADA

| Domínio | Obrigação normativa aprovada | Decisões |
|---|---|---|
| Cabeçalhos de Mid | Aceitar `[Mid: 12 | name=uppercut]` e `[Mid 12 | name=uppercut]`, com `name` opcional e identificação sequencial estável | LAN-029, LAN-030, LAN-085, LAN-093 |
| Localização dos comandos | Seção global artística opcional; comandos visuais `[ ]` e mecânicos `{ }` associados à respectiva etapa, com intervalos locais | LAN-006, LAN-037, LAN-094 |
| Parâmetros e procedência | Unidade apropriada por tipo; conversão validada; sugestões provisórias visivelmente identificadas | LAN-014, LAN-070, LAN-095 |
| Diagnósticos | **Erro bloqueante** para a operação afetada, **pendência para aprovação**, **aviso informativo**; registrar causas e desfechos | LAN-071, LAN-096 |
| Tempo | Frame local `i` ocupa `[(i−1)/30, i/30)` s desde o início de sua fase; o limite terminal não acrescenta duração | LAN-001 a LAN-003, LAN-086, LAN-097 |
| Conformidade | Casos **positivos e negativos** de frames, intervalos inclusivos, múltiplos Mid, eventos pontuais, loops, conflitos e deformações insuficientes | LAN-072, LAN-098 |
| Aceitação | Briefing confirmado, blocking aprovado, evidências de conformidade/exportação e aprovação final; declarar testes não executados | LAN-026, LAN-055, LAN-091, LAN-099 |
| Catálogo | Versionado e categorizado, com nomes, fins, parâmetros e exemplos válidos/inválidos; comandos desconhecidos são impedimentos para esclarecimento | LAN-069, LAN-100 |
| Homologação | Matriz de normas aprovadas, bloqueios, itens futuros e evidências, seguida de aprovação explícita do diretor | LAN-073, LAN-092, LAN-101 |

**Nota de semântica:** a notação `[(i−1)/30, i/30)` é um intervalo semiaberto **temporal** dentro da etapa. Isso não altera os intervalos textuais **inclusivos** como `[Smear: 4-6]` nem autoriza mudar a simulação. Para uma etapa com deslocamento global de `K` frames, seu frame local `i` corresponde ao frame global `K+i`; o tempo autoral correspondente começa em `(K+i−1)/30` s. Se a ação usar outro tempo de reprodução, deve ser aplicado o mapeamento aprovado e documentadas as diferenças, sem assumir taxa da física igual à de autoria.

### 12.8 Casos de conformidade documentais — PROPOSTA DE TESTES, NÃO EXECUTADOS

| ID proposto | Cenário | Resultado esperado derivado de regra aprovada | Situação |
|---|---|---|---|
| TC-01 | Start com 12 frames, Mid com 16 e End com 18 | 46 frames autorais = 46/30 s; sem frame extra | **Planejado, não executado** |
| TC-02 | Mid de 16 frames com `[Smear: 4-6]` | 3 frames locais ativos; evento não se estende para outras fases | **Planejado, não executado** |
| TC-03 | Duas etapas Mid com `name` opcional | IDs sequenciais estáveis; duplicidade/referência ambígua diagnosticada | **Planejado, não executado** |
| TC-04 | `[Impact: 10]` e `[Smear: 4-6]` | Primeiro é evento pontual; segundo é intervalo inclusivo | **Planejado, não executado** |
| TC-05 | Loop de 30 frames com amostra terminal de fechamento | Duração de 30/30 s; amostra terminal não soma frame de autoria | **Planejado, não executado** |
| TC-06 | Dois modificadores incompatíveis no mesmo canal/intervalo | Bloqueio das operações conflitantes e solicitação de resolução | **Planejado, não executado** |
| TC-07 | Deformação de um frame incapaz de entrar e retornar suavemente | Diagnóstico e pedido de correção sem aumento automático do intervalo | **Planejado, não executado** |
| TC-08 | Comando desconhecido, rig ambíguo ou parâmetro técnico sugerido | Não executar silenciosamente; distinguir erro, aprovação pendente e provisório conforme o caso | **Planejado, não executado** |
| TC-09 | Comparação de `.blend` com GLB reimportado | Registrar diferenças, falhas, ressalvas e não testados; não confundir exportação com integração ao jogo | **Planejado, não executado** |

Estes casos são **propostas de exemplos e de verificações**, não alegações de teste executado, nem escolha automática de parâmetros concretos. Sua conversão em matriz oficial completa e critérios quantitativos ainda exige revisão.

### 12.9 Auditoria de pendências pós-Rodada 12 — PENDENTE, sujeita à revisão do diretor

| Grupo | Situação documental | Classificação para futura prova de conceito |
|---|---|---|
| Gramática lexical | Formato de Mid aprovado, mas faltam regras de escapes, texto livre, identificadores, repetição de campos, comentários e nomes válidos | **Candidato a bloqueante** |
| Catálogo técnico | Família e curvas aprovadas, mas faltam esquemas de campos, unidades concretas, defaults e exemplos válidos/inválidos por operador | **Candidato a bloqueante** |
| Tolerâncias e deformação | Método de aprovação de limites aprovado, mas não há limites numéricos homologados nem critério computável geral de suavidade | **Candidato a bloqueante**, conforme escopo de teste |
| Contrato de eventos/hitbox | Semântica visual/mecânica aprovada; schema de exportação, múltiplos volumes e integração somente leitura ainda requerem detalhamento | **Candidato a bloqueante** para testes de hitbox |
| Evidência de execução | Nenhum teste real de Blender/GLB foi executado por esta documentação; as exigências de verificação são aprovadas | **Ainda sem evidências**; não declarar conforme |
| Exemplo canônico completo | Obrigação aprovada; apenas exemplo mínimo ilustrativo está documentado | **Candidato a bloqueante** |
| Evolução futura | Durações dinâmicas continuam fora do primeiro escopo, embora previstas para estudo | **Futuro, não bloqueante** da versão inicial |
| Homologação | Aprovação explícita do diretor exigida após matriz revisada e ausência de bloqueios relevantes | **Pendente de aprovação** |

**Importante:** a classificação `candidato a bloqueante` acima é **análise documental para revisão, não nova decisão aprovada**. Cabe ao diretor aprovar a matriz de homologação conforme LAN-101. Também não se presume que a prova de conceito deva testar todos os efeitos simultaneamente: seu escopo exato precisará de aprovação separada.

## 13. Catálogo técnico comentado — PROPOSTA DOCUMENTAL, NÃO HOMOLOGADA

> **Escopo autorizado por "prossiga" em 17/10/2026:** preparar o detalhamento do catálogo e um exemplo canônico **para avaliação**, sem gerar código, modificar modelos, executar Blender ou aprovar novos comportamentos. O conjunto de oito nomes abaixo **já está aprovado** (LAN-038); as definições específicas de campos, eixos, algoritmos, valores, unidades, prioridades, limiares e exemplos de sintaxe são **CANDIDATOS**, não decisões do diretor.
>
> **Versão indicada apenas para discussão:** `catalog-draft-0`. Esse identificador é editorial e **não homologa uma versão da linguagem**.

### 13.1 Contrato comum a todos os oito modificadores

**Regras efetivamente aprovadas:** autorar em 30 FPS; intervalos textuais locais e inclusivos; comandos visuais entre colchetes; descrições livres e parâmetros nomeados opcionais; parâmetros explícitos obrigatórios e inferências claramente provisórias; mapear partes ao rig inspecionado; considerar anatomia, exportação, compatibilidade, curvas e retorno; bloquear conflitos ou ambiguidades antes de executar a operação afetada (LAN-001/002/003/005/006/007/008/011/012/014/031/034/035/041/056/065/071/095/096).

| Campo candidato | Significado a discutir | Situação |
|---|---|---|
| `target` | Parte anatômica (ex.: mão, antebraço) ou osso real, validado por mapeamento | **Nome de campo proposto**; identificação anatômica **aprovada** |
| `axis` / `space` | Direção da deformação e espaço anatômico/local | **Campos propostos**; referencial documentado **aprovado** |
| `intensity` / `factor` | Magnitude quantificada, com unidade conforme natureza do efeito | **Campos, unidade e escala pendentes** |
| `curve` / `attack` / `release` | Curva e composição de entrada/pico/retorno dentro da janela | **Campos e parametrização pendentes**; famílias Ease/Sharp/Elastic/Overshoot **aprovadas** |
| `method` | Técnica opcional de Smear; se omitida, proposta justificada da IA | **Opcionalidade aprovada**, vocabulário de métodos pendente |
| `preserve_volume` / `anatomy_limit` | Controle opcional de compensação entre eixos e limite anatômico | **Campos propostos**; suporte conceitual **aprovado** |
| `delay_frames` / `source` | Relação temporal de movimento secundário com principal | **Campos propostos**; atraso e dependência **aprovados** |
| `notes` | Descrição livre de intenção, poses, peso e silhueta | **Campo proposto**; texto descritivo livre **aprovado** |

**Regras transversais de avaliação (aprovadas):**
1. O nome de um alvo não autoriza pressupor que ele exista no rig real: inspecionar, mapear, diagnosticar e pedir esclarecimento em caso de dúvida.
2. Duas operações simultâneas sobre a **mesma propriedade/canal da mesma parte** precisam de uma análise de compatibilidade. A IA pode combinar apenas efeitos compatíveis; efeitos incompatíveis **não** são resolvidos por precedência arbitrária.
3. Nenhuma deformação deve permanecer alterada após a própria janela; se não couber entrada e retorno suaves no intervalo, solicitar correção **sem estender duração**.
4. O método efetivo, os parâmetros e a exportação/reimportação precisam ser auditáveis. Não confundir `exportou sem erro` com `preservou aparência`.
5. A semântica de alvos, tolerâncias numéricas e curvas concretas permanece **PENDENTE DE APROVAÇÃO**; os itens abaixo servem de especificação **candidata**.

### 13.2 Os oito verbetes propostos

| Modificador aprovado | Finalidade e interpretação candidata | Entradas candidatas opcionais | Risco a validar |
|---|---|---|---|
| **Smear** | Acentuar a trajetória de um segmento na ação rápida por deformação, rastro ou técnica equivalente, sem determinar previamente o método | `target`, `method`, `axis`, `intensity`, `curve` | Silhueta ilegível, geometria auxiliar ausente no GLB, técnica incompatível com rig |
| **Squash** | Comprimir o volume aparente sobre eixo(s) pretendido(s), podendo compensar proporções em outros eixos | `target`, `axis`, `factor`, `preserve_volume`, `curve` | Colapso de junta, penetração involuntária, compensação excessiva |
| **Stretch** | Alongar uma parte do corpo ou o gesto de modo controlado, com retorno à proporção normal | `target`, `axis`, `factor`, `anatomy_limit`, `curve` | Estiramento de articulação, troca inesperada de referencial |
| **Scale** | Aumentar/reduzir temporariamente uma parte; por eixo ou uniformemente se assim for proposto/definido | `target`, `axis`, `factor`, `curve` | Origem/pivô inadequado, propagação para filhos do rig |
| **Anticipation** | Marcador de direção temporal que orienta poses preparatórias, movimento em sentido contrário e timing antes da ação principal | `target`, `intent`, `pose_hint`, `curve` | Antecipação gerada fora da fase, movimento incompatível com apoio |
| **FollowThrough** | Marcador temporal para a continuidade/reação residual após ação dominante, respeitando massa, juntas e controle global | `target`, `source`, `delay_frames`, `curve` | Excesso de oscilação, invasão do tempo de recuperação |
| **Overlap** | Distribuir defasagens entre alvos relacionados sem tornar seus movimentos independentes da ação principal | `targets`, `source`, `delay_frames`, `curve` | Transições descoordenadas, efeitos somados no mesmo canal |
| **SecondaryAction** | Movimento complementar subordinado à ação primária, sem prejudicar leitura, impacto nem restrições físicas | `target`, `source`, `intent`, `delay_frames`, `curve` | Distrair do gesto principal, conflito de canal, anatomia inexistente |

**Observação:** `intent`, `pose_hint`, `targets` e todos os demais identificadores nesta tabela são **propostas de nomes de campos**; não constam como chaves obrigatórias ou homologadas nas decisões aprovadas. A presença de exemplos não dispensa o briefing obrigatório LAN-074.

### 13.3 Exemplos isolados — CANDIDATOS DE SINTAXE, NÃO EXECUTÁVEIS

```text
[Squash: 3-12 | target=torso | axis=anatomical_vertical]
  Comprimir o tronco no meio da preparação e retornar à forma normal antes do fim.
[Stretch: 2-11 | target=forearm_right | axis=local_forward]
  Alongar progressivamente, atingir o pico perto do gesto e recuperar o volume normal.
[Scale: 1-10 | target=right_hand]
  Ampliar a silhueta da mão antes do impacto e retornar dentro desta janela.
[Smear: 1-9 | target=forearm_right]
  O método de smear NÃO foi informado: solicitar proposta fundamentada e validar exportação.
[Anticipation: 2-10 | target=torso]
  A IA propõe poses preparatórias condizentes com a intenção já confirmada.
[FollowThrough: 1-9 | target=arms]
  Recuperação residual sem alterar automaticamente o deslocamento físico do personagem.
[Overlap: 2-9 | target=head | source=torso]
  Propor atraso conforme anatomia e massa percebida, sem presumir um número fixo.
[SecondaryAction: 2-9 | target=face]
  Ação secundária opcional subordinada ao golpe; alvo só existe se o rig inspecionado suportar.
```

As expressões `anatomical_vertical`, `local_forward`, `source=torso` etc. **não foram homologadas**. O exemplo pode ser rejeitado por rig inexistente, intensidade não declarada, impossibilidade de retorno ou conflito; essa rejeição seria **correta** até que o diretor ou a política aprovada resolva cada lacuna. Este catálogo **não** determina, por conta própria, mínimos universais de frames, intensidades, nomes de ossos ou algoritmo de curvas.

### 13.4 Matriz candidata para revisão de cada operador

| Evidência esperada por operador | Smear | Squash | Stretch | Scale | Anticipation | FollowThrough | Overlap | SecondaryAction |
|---|---|---|---|---|---|---|---|---|
| Anatomia e alvo mapeados | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Entrada/saída dentro da janela, quando deformante | Sim | Sim | Sim | Sim | Não é deformação obrigatória | Não é deformação obrigatória | Conforme transformação | Conforme transformação |
| Separação de propriedades com efeitos simultâneos | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Trajetória/timing e transições observados | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Comparação Blender → GLB quando houver resultado exportado | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |

**Estado da matriz:** planejamento de inspeção, **nenhum ensaio executado**. Requisitos numéricos concretos e parâmetros de catálogo precisam ser submetidos ao diretor antes de homologação.

## 14. Exemplo canônico candidato — tapa estilizado (100% HIPOTÉTICO)

> **ATENÇÃO:** cenário, criatura, intenções, decisões criativas, poses, duração, parâmetros, respostas e aprovação de briefing abaixo são **fictícios e escritos exclusivamente para demonstrar a linguagem**. **Não** são declarações feitas pelo diretor, **não** homologam animação, **não** representam rig inspecionado e **não** autorizam gerar qualquer arquivo Blender, vídeo ou GLB. As regras citadas como aprovadas já constam em LAN-001 a LAN-101; a aplicação concreta neste exemplo permanece **PROPOSTA**.

### 14.1 Descrição recebida — FICTÍCIA

> "Quero uma animação de tapa exagerado, com a mão crescendo perto do impacto, um smear veloz e recuperação visível."

**Lacunas detectadas segundo o procedimento aprovado:** quem executa o tapa; tipo de anatomia e disponibilidade de rig; mão usada; direção do gesto; alvo e contato; duração e fases; pose de preparação; estilo de exagero; se a ação é cíclica; tolerância a efeitos que não sobrevivam ao GLB; autorização para qualquer proposta de intensidade/curva. Não responder silenciosamente a essas questões.

### 14.2 Perguntas e respostas — SIMULAÇÃO DIDÁTICA, NUNCA ENVIADAS AO DIRETOR

| Pergunta que a IA deveria fazer | Resposta **inventada apenas para o exemplo** | Status |
|---|---|---|
| Qual personagem e qual material anatômico? | Criatura bípede genérica de demonstração, com braços e mãos; nenhum rig real fornecido | **HISTÓRIA HIPOTÉTICA**, rig não verificado |
| Qual mão e trajetória? | Tapa com a mão direita num arco lateral da direita para a esquerda | **HISTÓRIA HIPOTÉTICA** |
| Qual deve ser a intenção artística? | Estilo cartunesco, silhueta forte, preparação e aceleração bem legíveis | **HISTÓRIA HIPOTÉTICA** |
| O golpe deve fazer o personagem sair do lugar? | Não: movimento horizontal in-place e apoio dos pés | **HISTÓRIA HIPOTÉTICA** |
| Qual duração e forma da animação? | OneShot, Start 12 frames, Mid de aproximação 14, Mid do golpe 10, End 10; 30 FPS | **HISTÓRIA HIPOTÉTICA** |
| Como tratar efeitos visuais e impacto? | Smear no antebraço, ampliação temporária da mão direita; impacto no frame 6 do segundo Mid; hitbox apenas ilustrativa | **HISTÓRIA HIPOTÉTICA** |
| Você delega algum detalhe? | Somente a sugestão de curva/intensidade e método de Smear, que devem ser rastreados como provisórios | **HISTÓRIA HIPOTÉTICA** |
| Confirma o briefing consolidado? | "Confirmo, somente para este exemplo fictício" | **CONFIRMAÇÃO SIMULADA**; **não** substitui confirmação real exigida por LAN-082 |

**Porta de aprovação real:** em produção, depois de reunir respostas verdadeiras e inspecionar o rig, a IA precisará apresentar resumo para aprovação verdadeira do diretor **antes** do blocking. Na simulação, a etapa está apenas representada.

### 14.3 Prompt estruturado — EXEMPLO ILUSTRATIVO, NÃO EXECUTÁVEL

As linhas de descrição abaixo compõem texto livre; as linhas entre `[ ]` e `{ }` ilustram, respectivamente, comandos visuais e dados mecânicos, mas **nem todas as palavras-chave ilustrativas possuem grafia homologada**. As linhas com `#` são anotações editoriais de documento, **não** sintaxe oficialmente permitida. `ArtDirection`, `Contact`, `Hold` e atributos como `shape` e `target` continuam propostas de grafia. Os nomes anatômicos exigem mapeamento a rig verdadeiro antes de uso.

```text
# CENÁRIO HIPOTÉTICO — não enviar diretamente a um agente como comando aprovado
[Mode: OneShot]
[ArtDirection]
  Silhuetas claras, antecipação exagerada e recuperação com sensação de peso.
  Direção global opcional, sem comandar regras do combate.

[Start: 12]                         # globais 1..12
  Carregar peso na postura sem deslocar a raiz horizontal.
  [Pose: 9 | ready]
  [Anticipation: 3-10 | target=torso]
    Preparação no sentido oposto ao tapa; não alterar duração.
  [Contact: 1-12 | target=feet]
    Pés apoiados, sem deslizamento não intencional.

[Mid: 14 | name=approach]           # ID sequencial 1; globais 13..26
  Iniciar o arco do tapa, mantendo silhueta legível.
  [Pose: 11 | arm_extended]
  [Stretch: 3-12 | target=forearm_right]
    Alongamento contido, com retorno ao normal até o fim da janela.

[Mid 10 | name=slap]                # ID sequencial 2; globais 27..36
  Acelerar o arco lateral para o impacto do exemplo.
  [Smear: 1-8 | target=forearm_right]
    Seleção de method pela IA: PROVISÓRIA, justificar e validar GLB.
  [Scale: 1-9 | target=right_hand]
    Intensidade e curva PROVISÓRIAS: sugerir e identificar na revisão.
    A mão deve recuperar sua proporção até o término desta janela.
  [Impact: 6]                       # evento pontual: global 32
  {Hitbox: 5-7 | target=right_hand} # metadados/volume vermelho; globais 31..33
    Forma, dimensões e posição ainda exigem definição ou proposta provisória.

[End: 10]                          # globais 37..46
  Recuperar pose e estabilidade sem criar frames extras.
  [FollowThrough: 1-9 | target=arm_right]
  [Overlap: 2-9 | target=shoulders | source=torso]
  [SecondaryAction: 2-9 | target=face]
    Expressão facial só se houver controles reais no rig.
```

**Restrições de execução, se o exemplo viesse a ser usado no futuro:** (1) inspecionar rig e checar as partes `forearm_right`, `right_hand`, `feet` e `face`; (2) resolver eventuais conflitos por canal, inclusive os dois efeitos sobre região do braço; (3) aprovar escolhas de intensidade/curva e metas qualitativas do briefing quando não delegadas; (4) não presumir que um `Smear` em 8 frames ou `Scale` em 9 frames satisfaça retorno suave — a viabilidade dependerá de curva e magnitude; (5) não ativar dano ao ler `Hitbox`; (6) impedir execução até o briefing **real** e o blocking **real** serem aprovados.

### 14.4 Derivação temporal do exemplo — conferência aritmética documental

| Etapa | Frames da etapa | Frames globais inclusivos | Duração autoral |
|---|---:|---|---:|
| Start | 12 | 1..12 | 12/30 s |
| Mid #1 `approach` | 14 | 13..26 | 14/30 s |
| Mid #2 `slap` | 10 | 27..36 | 10/30 s |
| End | 10 | 37..46 | 10/30 s |
| **Total** | **46** | **1..46** | **46/30 s ≈ 1,533 s** |

- `[Impact: 6]` no Mid #2: deslocamento global anterior = 26; índice global = `26+6=32`. O intervalo temporal autoral desse frame global é `[31/30, 32/30)` segundos, sem duração adicional criada pelo evento.
- `{Hitbox: 5-7}` no Mid #2: índices globais = `31..33`, três frames autorais inclusivos e **apenas metadados de prévia**, não duração de dano real. Sua futura conversão para passos de simulação segue contrato a especificar/verificar.
- `[Scale: 1-9]` no Mid #2: frames globais `27..35`, nove frames inclusivos. O frame global 36 pertence ao Mid #2 mas já está fora desse modificador.
- `[Smear: 1-8]` no Mid #2: globais `27..34`, oito frames inclusivos.
- A existência de dois Mid e seus IDs estáveis não insere quadros entre as etapas; o fechamento total fica em `46/30` segundos. Nenhuma dessas contas representa teste de engine, renderização ou Blender.

### 14.5 Matriz de verificação desse exemplo — PLANO, NÃO EXECUTADO

| Marco | Evidência que seria necessária | Estado **real** |
|---|---|---|
| Briefing | Perguntas respondidas e resumo aprovado pelo diretor | **NÃO REALIZADO** (diálogo fictício) |
| Anatomia | Mapa de ossos, eixos, pivôs, cópia versionada | **NÃO REALIZADO** (rig fictício) |
| Blocking | Poses-chave e timing mostrados; aceite do diretor | **NÃO REALIZADO** |
| Conformidade temporal | Verificar em parser/validador autorizado local/global, inclusividade e duração | **NÃO REALIZADO** (há somente contas escritas) |
| Composição de efeitos | Verificar conflito, retorno, limites e intenção visual | **NÃO REALIZADO** |
| Hitbox de prévia | Geometria vermelha, associação e metadados, sem alterar dano | **NÃO REALIZADO** |
| Blender | Executar em rig real, comparar views e versões com/sem efeitos | **NÃO REALIZADO** |
| GLB | Exportar, reimportar, comparar aparência/timing; documentar perdas | **NÃO REALIZADO** |
| Jogo | Integrar apenas se autorizado, testar duração/janelas na simulação | **NÃO REALIZADO; FORA DO ESCOPO ATUAL** |
| Entrega | `.blend`, GLB, vídeo, prompt original, relatório e aprovação final | **NENHUM ARQUIVO DE ANIMAÇÃO CRIADO** |

### 14.6 Pendências que o exemplo torna visíveis — SEM APROVAÇÃO

1. Falta definir sintaxe formal de seção global, marcadores de contato e texto livre, assim como comentários, aspas, escapes e nomes/IDs permitidos.
2. Não estão definidos contratos exatos e unidades de `target`, `axis`, `factor`, `intensity`, `curve`, `delay_frames`, `method` e `shape`. A aprovação dos conceitos não define suas fórmulas.
3. Faltam esquemas concretos de geometria/volumes e metadados `{Hitbox}`, sem permitir inferir lógica de dano.
4. Sem mapa anatômico real não se pode verificar bone mapping, IK, deformação, retarget ou exportação.
5. Sem curvas/magnitudes e tolerâncias aprovadas não se pode atestar suavidade, retorno, deslizamento, interpenetração ou fechamento.
6. Não foram produzidos `.blend`, GLB, vídeo, evidências de execução, blocking aprovado ou aprovação final.

**Conclusão documental:** o exemplo é um artefato de planejamento **pronto para crítica**, não uma animação aprovada. Pela LAN-101, a auditoria de bloqueios e os resultados de conformidade precisariam ser submetidos ao diretor antes da homologação da linguagem. Esta etapa não autoriza implementação.

## 15. Próximas questões propostas — ainda NÃO APROVADAS

A próxima rodada visa resolver lacunas tornadas explícitas pelo catálogo e exemplo. Nenhuma alternativa deve ser escolhida automaticamente, mesmo quando aparecer como recomendação.

- **LAN-Q99.** Qual a gramática oficial da seção artística global, texto livre, comentários, caracteres especiais e escape de delimitadores?
- **LAN-Q100.** Quais unidades e convenções específicas devem ser usadas em ângulos, escalas, deslocamentos, durações de atraso e intensidade?
- **LAN-Q101.** Qual forma exata de identificar alvos anatômicos, múltiplos alvos, canais e referencial do eixo dentro dos comandos?
- **LAN-Q102.** Como tipar e validar campos específicos dos oito modificadores, mantendo parâmetros opcionais e proibindo inventar valores aprovados?
- **LAN-Q103.** Como registrar propostas de curvas/limites sem transformá-las em defaults normativos antes de aprovação?
- **LAN-Q104.** Qual especificação mínima de `{Hitbox}` para prévia vermelha e metadados sem integração automática com dano?
- **LAN-Q105.** Como exigir evidências de correspondência entre briefing, blocking, validação, Blender e GLB sem afirmar que testes documentais foram executados?
- **LAN-Q106.** Que prioridades usar para concluir o catálogo, exemplos e matriz de aceitação sem iniciar código antes de autorização explícita?
