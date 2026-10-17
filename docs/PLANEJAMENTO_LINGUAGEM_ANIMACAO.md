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

**Continuam pendentes:** normalização formal de sintaxe e eventos, política para valores inferidos pela IA, critérios quantitativos efetivos para continuidade/loop/contatos, estrutura do mapa anatômico, equações/presets de curvas, duração mínima/compatibilidade de efeitos, geometria e exportação de hitboxes, rastreabilidade das validações, detalhes de versionamento e critérios finais de homologação. A escolha do terceiro teste não aprova um modelo específico nem autoriza implementação.

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

### Rodada 9 — normalização, contrato de conformidade e rastreabilidade (pendente; roteiro proposto)

> **Todas as alternativas desta rodada continuam pendentes.** A gramática poderá ser especificada e validada documentalmente sem implementar parser, plugin, Blender ou runtime até autorização explícita.

- **LAN-Q63.** Como tratar instruções incompletas ou ambíguas no prompt: pedir confirmação, gerar proposta provisória identificada ou bloquear conforme a criticidade?
- **LAN-Q64.** Qual o formato canônico normalizado do documento/prompt: texto estruturado único, texto com representação intermediária proposta ou duas fontes equivalentes?
- **LAN-Q65.** Como declarar tipos de animação (Loop, OneShot, pose, reação), evitando que propriedades cíclicas sejam presumidas a partir do nome?
- **LAN-Q66.** Como representar e validar frames locais, globais, eventos pontuais e intervalos inclusivos em relatórios e exportações, preservando duração exata?
- **LAN-Q67.** Como identificar versão do catálogo, versão da linguagem e compatibilidade de comandos entre agentes, sem aceitar comandos desconhecidos silenciosamente?
- **LAN-Q68.** Como registrar valores explicitamente fornecidos, valores sugeridos e valores aprovados, distinguindo proveniência e revisão?
- **LAN-Q69.** Qual o tratamento de erros de conformidade: falhar seletivamente, bloquear execução completa ou permitir correções automatizadas condicionadas à aprovação?
- **LAN-Q70.** Quais critérios objetivos e evidências devem compor a matriz de testes de aceitação da gramática, da animação e da exportação?
- **LAN-Q71.** Quando considerar a versão inicial da linguagem pronta para uma prova de conceito controlada, sem autorizar a implementação automaticamente?

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
