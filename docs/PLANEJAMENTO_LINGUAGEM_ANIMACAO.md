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

Consequências invariantes:
- Para o intervalo textual `a-b`, a quantidade é `b - a + 1` frames (se `b >= a`).
- Um intervalo local deve permanecer dentro da fase de que faz parte.
- Uma fase não muda automaticamente a duração de outra fase.
- Converter para o contrato do jogo não pode criar nem perder um frame de duração por erro de borda.
- Nenhuma dessas decisões autoriza modificar a lógica de dano, cancelamento, física ou invulnerabilidade.

**Ainda não está definido:** indexação inicial dos frames (1 ou 0); se as fases são obrigatórias; se as durações aceitam parâmetros automáticos; sobreposições; significado preciso dos modificadores; representação e efeito real das hitboxes.

## 4. Modelo temporal ilustrativo — PROPOSTA, não norma aprovada

Exemplo hipotético com frames **numerados a partir de 1**, apenas para expor as contas:

    [Start: 12]    # frames globais 1..12
    [Mid: 16]      # frames globais 13..28
    [Smear: 4-6]   # frames globais 16..18, 3 frames
    [Impact: 10]   # frame global 22
    {Hitbox: 9-11} # frames globais 21..23, 3 frames
    [End: 18]      # frames globais 29..46

Para uma fase com início global `S` e intervalo local inclusivo `a-b` (se a indexação de 1 for escolhida), o intervalo global inclusivo é `[S+a-1, S+b-1]`. A conversão do intervalo global de frames para segundos e passos da simulação dependerá do FPS de autoria, da duração efetiva do golpe e do contrato em vigor; **não** basta copiar números de frames de 30 FPS diretamente para passos de 120 Hz.

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

**Somente demonstração de expressividade e contagem**, não um uppercut oficialmente aprovado. Prefixos, nomes dos efeitos, duração, significado de `Impact` e distinção entre `[ ]` / `{ }` estão **pendentes**.

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

### Rodada 1 — gramática e tempo (iniciar por aqui)
- **LAN-Q01.** Frames locais começam em **1** ou **0**? Os exemplos usam 1, mas não há aprovação explícita da origem.
- **LAN-Q02.** Start/Mid/End são sempre três fases obrigatórias, ou fases opcionais e/ou repetíveis para movimentos complexos?
- **LAN-Q03.** O FPS deve ser informado em cada prompt, ter padrão global configurável ou ser obtido do arquivo/projeto?
- **LAN-Q04.** Colchetes para direção/efeitos e chaves para informações mecânicas devem ter semântica distinta obrigatória?
- **LAN-Q05.** Modificadores em simultâneo na mesma parte: composição aditiva, precedência definida, substituição, rejeição, ou dependente do tipo?
- **LAN-Q06.** No término do modificador, o efeito deve ser removido instantaneamente, com atenuação incluída em sua janela ou com um intervalo de saída declarado?
- **LAN-Q07.** O diretor deseja que o sistema seja inicialmente uma **linguagem de prompts para Claude/Antigravity**, um **interpretador estruturado com validação**, ou uma **ferramenta no próprio Studio**? (Nenhuma arquitetura escolhida.)
- **LAN-Q08.** As durações de Start/Mid/End são fixas por prompt, ou podem ser expressas também por marcos e tempos relativos/adaptáveis?

### Rodada 2 — semântica visual e rig
- **LAN-Q09.** Como identificar a parte-alvo: nomes exatos de ossos, termos anatômicos com mapeamento por rig ou ambos?
- **LAN-Q10.** Se a anatomia não suportar o modificador, interromper com erro, pedir alternativa ou apresentar versões para aprovação?
- **LAN-Q11.** `Smear` significa escala/stretch esquelético, malha temporária de deformação, múltiplas cópias/blur visual, ou seleção explícita do método?
- **LAN-Q12.** Intensidades (amplitude, direção, curva) obrigatórias ou descrição natural com sugestões do agente?
- **LAN-Q13.** Todos os princípios podem receber janelas, ou apenas efeitos temporais; quais princípios são globais?
- **LAN-Q14.** Como devem funcionar poses-chave e transições Start→Mid→End quando há mudanças bruscas?
- **LAN-Q15.** Qual a política para deformações que não sobrevivem à exportação GLB?

### Rodada 3 — gameplay e integração
- **LAN-Q16.** `{Hitbox}` inicialmente desenha volume vermelho, exporta eventos/metadados ou futuramente governa dano real? Cada opção exige autorização e validação distinta.
- **LAN-Q17.** Como identificar formato, tamanho, offset, orientação e osso de uma hitbox? Podem existir múltiplos volumes e golpes multihit?
- **LAN-Q18.** Como resolver divergência de FPS e duração entre o clipe animado e a duração efetiva do golpe no jogo?
- **LAN-Q19.** A linguagem pode mencionar invulnerabilidade, cancelamento, hitstop e stagger sem mudar a física, ou esses termos serão restritos?
- **LAN-Q20.** In-place sempre, por padrão com exceções ou configurável por ação?
- **LAN-Q21.** A evolução da linguagem deve valer apenas para o laboratório de combate ou também para outros usos e jogos?

### Rodada 4 — produção, segurança e aprovação
- **LAN-Q22.** Arquivos de entrega: BLEND, GLB, vídeo, especificação textual e/ou relatório de validação — quais são obrigatórios?
- **LAN-Q23.** Verificação: apenas testes automáticos ou também revisão visual em vários ângulos, comparação e aprovação do diretor?
- **LAN-Q24.** Critérios de aprovação por fases (blocking, spline, polish) e autorização antes de substituir arquivos?
- **LAN-Q25.** Como versionar uma animação e registrar variantes sem sobrescrever originais?
- **LAN-Q26.** Quais três casos reais devemos usar para validar a linguagem (idle, uppercut, tapa, esquiva, quadrúpede...)?

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
