# Arenamon — Cinco propostas de Game Feel para o gameplay

> **STATUS GERAL: REGISTRO DE PROPOSTAS — NENHUMA DAS CINCO FOI APROVADA OU IMPLEMENTADA.**
>
> **Autorização recebida:** publicar estas cinco ideias no GitHub, **não** programá-las, alterar o balanceamento ou incorporar novas regras oficiais ao GDD.
>
> **Registrado em:** 21/10/2026 · **Repositório:** `Ziaker/Arenamon` · **Base de leitura:** `main` @ `68eda6c6c938aa21167cafa761f04be57d4224cc`.
>
> **Jogo oficial:** `prototypes/combat-lab/`. `prototypes/game/` é legado, fora do escopo.
>
> **Distinção de status:** valores indicados como “ensaio” são apenas hipóteses para comparação. Nenhuma conclusão sobre qualidade percebida ou performance foi validada em sessão jogável nesta entrega. As regras aprovadas sempre prevalecem.

## 0. Motivação e relação com as propostas anteriores

Problema informado: a movimentação do Arenamon ainda parece **dura e pesada**. A proposta [Responsive Movement V2, PR #98](https://github.com/Ziaker/Arenamon/pull/98) trata de aceleração, inversão, aderência, sprint e transições visuais. As ideias aqui registradas tratam de **outras cinco dimensões do game feel**, isoláveis em experimentos distintos:

| ID | Proposta | Prioridade sugerida | Dependência principal | Status |
| --- | --- | --- | --- | --- |
| GF-01 | Momentum Bridge — continuidade entre ações | 1 | Máquina de estados, X/C, recovery | Pendente |
| GF-02 | Collision Flow — deslocamento tangencial coerente | 2 | Colisores de cenário e corpos | Pendente |
| GF-03 | Coyote Time + Jump Buffer | 3 | Salto normal independente (planejado) | Pendente |
| GF-04 | Ground Snap + Step Assist | 4 | Suporte e plataformas 3D reais (planejados) | Pendente |
| GF-05 | Adaptive Hitstop | 5 | Eventos de impacto e hitstop existentes | Pendente |

**Observação de nomenclatura:** a ordem acima é recomendação de priorização para teste, não cronograma nem aprovação implícita. Cada proposta deve ter decisão própria e poder ser rejeitada independentemente.

### Funcionalidades já existentes: não duplicar

- `src/sim/locomotion.js`: aceleração, frenagem, reversão e dissipação lateral.
- `src/sim/controller.js`: `inputBuffer` para certas ações, transições X/C, `sprintCarry` e integração da locomoção; `advanceAction` encerra certas ações zerando `f.velocity`, com recovery distinto conforme o caso.
- `src/sim/physics.js`: `landingSlide`, resolução entre lutadores e barreiras e componentes de movimento/impulso.
- `src/sim/world.js`: `collideFighter` já remove componentes de velocidade contra determinadas geometrias sólidas.
- `src/sim/game.js`: hitstop já existe e processa buffering de X/C durante o congelamento; `src/sim/config.js` diferencia duração padrão entre impacto (0,035 s) e clash (0,085 s).
- `docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md`: salto normal via Espaço, altura inicial 2 m, sem correção horizontal no ar, somente um salto antes de tocar no chão, intervalo de 0,25 s após aterrissagem, plataformas sólidas e pouso tridimensional — **planejamento aprovado, não prova de implementação**.
- As ideias [#95 Ledge Grab](https://github.com/Ziaker/Arenamon/issues/95), [#96 Directional Influence](https://github.com/Ziaker/Arenamon/issues/96) e [#97 Wall Tech](https://github.com/Ziaker/Arenamon/issues/97) são propostas separadas, ainda não aprovadas. Não assumir que suas regras existem.

---

## GF-01 — Momentum Bridge: continuidade física nas transições de ação

### 1. Objetivo observável

Quando uma ação de movimento termina, o lutador deve retomar a locomoção de modo *contínuo*, evitando o efeito “freou artificialmente e precisou arrancar do zero”, **apenas quando o controlador já concede permissão para locomoção**.

Exemplo conceitual: após finalizar uma esquiva, se o jogador continua segurando a mesma direção e o estado permite caminhar, parte do momentum residual pode ser transferida suavemente. Isso **não** pode estender a distância nominal da esquiva nem tornar a ação cancelável antes do tempo.

### 2. Ponto concreto observado

`src/sim/controller.js`:
- Durante X/C, `f.velocity` segue uma curva própria e há `blend` de entrada de velocidade.
- Ao finalizar determinadas ações, `advanceAction` limpa `f.action`, define `f.velocity = vec()` e calcula recovery, inclusive para exaustão e Meteor Slam falhado.
- Existem `f.locomotionVelocity`, `f.blend` e `sprintCarry`; qualquer experimento deve mapear esses mecanismos **antes** de propor adicionar outro canal de velocidade.

**Isso indica um ponto específico a investigar; não prova que o usuário vivenciou este problema em todas as ações**. Testar o traçado no jogo com um GLB real.

### 3. Comportamento candidato

- Na conclusão de uma ação permitida, avaliar velocidade final válida, comando de movimento presente e estado liberado.
- Reintroduzir uma fração *limitada* de velocidade tangencial no controlador de locomoção, decaindo por aceleração/frenagem existentes.
- Se o comando for contrário, resolver pela reversão física existente, não por teletransporte ou inversão instantânea.
- Sem direção pressionada, aplicar frenagem existente; não permitir que o personagem escorregue indefinidamente.
- Em colisão, remover componente penetrante; não preservar momentum através de paredes.

### 4. Limites NÃO NEGOCIÁVEIS

Não transferir impulso nem antecipar movimento durante: hit stun, guard stun impeditivo, `knockRecovery` ainda vigente, charge/Move imóvel, Wall-Splat, KO, landing recovery não finalizado, controles bloqueados, nem durante frames de ação em que regras não autorizam movimentar-se. Preservar cancelamentos, `actionProgress`, durações, distâncias de C/X, i-frames, stamina e cooldowns. Atribuição/consumo de impulso só pode ocorrer na **transição de estado legal** e no passo correto do loop.

### 5. Decisões pendentes

- Quais transições são elegíveis (C→locomoção, sprint→andar, X→locomoção, salto→solo)?
- Intensidade/cap máximo de impulso, duração, perda por colisão, ângulo admissível e tratamento de velocidade residual.
- Deve haver diferença entre locomoção livre e lock-on?
- Como coexistir com a futura Responsive Movement V2 do PR #98?
- Qual é a métrica de melhora percebida sem aumentar a distância total da ação?

### 6. Testes propostos (GF01-T)

- **T01:** nenhuma alteração antes do fim da ação/cancelamento autorizado; recovery não é encurtado.
- **T02:** comando na mesma direção na primeira janela legal: deslocamento e aceleração contínuos, sem velocidade/posição impulsiva.
- **T03:** comando oposto e sem comando: reversão e frenagem coerentes.
- **T04:** colisão com parede/objeto: sem atravessamento nem deslizamento residual automático.
- **T05:** mesma semente e inputs produzem o mesmo replay a 120 Hz; verificar save/load em transição.
- **T06:** testes dos contratos de esquiva, tackle, defesa, stamina, Move e situações de exaustão.

---

## GF-02 — Collision Flow: movimento tangencial previsível junto aos obstáculos

### 1. Objetivo observável

Quando o comando do jogador possui componente **paralela a uma superfície sólida**, preservar o deslocamento tangencial permitido, em vez de o lutador parecer travado em todo contato. O jogo deve impedir penetração física e manter coerência na direção desejada.

### 2. Situação do código atual

`src/sim/world.js` já possui `collideFighter` e projeta/remova a velocidade que entra em determinadas paredes/barreiras. `src/sim/physics.js` faz resolução repetida entre corpos, parede da arena e entidades do mundo com subpassos. **Portanto isto é refinamento e auditoria de casos-limite, não introdução do conceito do zero.**

### 3. Comportamento candidato

- Separar componente normal penetrante de componente tangencial ao contato; anular apenas a primeira segundo o contrato físico aplicável.
- Manter múltiplos contatos coerentes em quinas, pilares e paredes adjacentes; movimento não pode “ganhar força” por projeções sucessivas.
- Com input explicitamente contra a parede, aceitar obstrução: **não gerar deslocamento involuntário para os lados**.
- Com input diagonal parcialmente tangencial, deslizar na direção tangencial permitida.
- Se o objeto destruível desaparecer, liberar suporte/contato em ordem determinística; se reaparecer, evitar criar sobreposição inválida.
- Colisão com outros lutadores deve respeitar políticas próprias de empurrão, tackle, bloqueio e prioridade de ação; não usar o mesmo ajuste global cegamente.

### 4. Decisões pendentes

- Tolerância numérica, comportamento em quinas côncavas/convexas, velocidade mínima de deslizamento e ângulo de aproximação.
- Ativar apenas na locomoção livre ou também em sprint? Não interferir em dash de esquiva nem tackle sem aprovação.
- Materiais com atrito diferenciado? **Não** presumir que existam.
- Relação com paredes, obstáculos, plataformas, escadas/rampas e arena dinâmica; seção de plataformas depende de física 3D ainda planejada.

### 5. Testes propostos (GF02-T)

- **T01:** input paralelo em parede longa conserva deslocamento tangencial, sem atravessar.
- **T02:** input somente perpendicular não movimenta lateralmente.
- **T03:** entrada diagonal em 30°, 45°, 90° e múltiplos cantos não trava nem impulsiona.
- **T04:** dois corpos disputam corredor estreito sem jitter, empilhamento ou teleporte.
- **T05:** mudança de direção, parar e voltar junto à superfície não acumula vetor fantasma.
- **T06:** testar entidades `wall/barrier`, limites da arena, obstáculos destrutíveis e regressão dos golpes.

---

## GF-03 — Coyote Time + Jump Buffer: tolerância temporal do salto

### 1. Pré-requisito decisivo

O **salto normal independente pelo Espaço** está registrado e aprovado como regra do **planejamento do mapa**, mas não se deve presumir que já esteja implementado no Combat Lab da `main`. Existe um *vault* físico associado à esquiva (C): **não é a mesma ação**.

A proposta de coyote e buffer deve ser avaliada **quando o salto normal real estiver disponível**, e não aplicada de forma inesperada ao vault ou à esquiva.

### 2. Ideia

- **Coyote Time:** por um breve intervalo após sair de uma borda e entrar em queda voluntária, o comando de salto normal pode ser aceito *se o personagem ainda teria direito àquele salto*.
- **Jump Buffer:** se o jogador aperta Espaço um pouco antes de um pouso elegível, o pedido pode ser preservado e executado **no primeiro passo fisicamente e legalmente permitido**, nunca antes disso.

**Valores iniciais apenas para ensaio:** coyote 0,08–0,10 s e buffer 0,10–0,15 s. Nenhum deles foi aprovado.

### 3. Regras que precisam permanecer verdadeiras

- **Um** salto normal entre contatos válidos; coyote usa essa única oportunidade, nunca concede salto duplo.
- Altura inicial aprovada de **2 m** permanece, salvo escolha posterior explícita.
- Impulso horizontal inicial do salto **é preservado, sem correção aérea**.
- Sem invulnerabilidade, ataque ou defesa durante o salto normal por concessão desta feature.
- Intervalo aprovado de **0,25 s após aterrissar** continua obrigatório. Um comando buffered durante cooldown deve aguardar apenas se ainda válido — ou expirar; essa precedência é uma decisão a tomar, **não** inferir autorização para pular antes.
- Estados impeditivos (hit stun, recovery, KO etc.) não são ignorados.
- Não reutilizar indiscriminadamente o `inputBuffer` de X/C como fila global de ações; verificar ordem de consumo, expiração e prioridades.

### 4. Casos de borda a decidir

- Saída por caminhada vs. lançamento por golpe, dash/esquiva ou queda causada por destruição da plataforma.
- Aterrissagem parcial na quina, teto baixo, apoio móvel/destruível e plataformas em alturas diferentes.
- Precedência entre input de salto e ação C (vault), knockback, Move de salto adicional e Ledge Grab da proposta #95.
- A IA deve ter ou não janela idêntica de tolerância? Princípio recomendado: mesmas regras físicas.

### 5. Testes propostos (GF03-T)

- **T01:** Espaço 1 passo após a borda, dentro da janela, realiza **somente o salto normal ainda disponível**.
- **T02:** fora da janela, não realiza salto extra e mantém queda.
- **T03:** botão antes do contato válida executa somente quando o piso está realmente apto e o cooldown foi cumprido.
- **T04:** buffers expirados, interrupções por dano e KO não disparam comandos tardios.
- **T05:** evitar salto duplo acidental por repetição ou autorrrepetição de tecla; contagem de saltos correta.
- **T06:** movimento horizontal no ar permanece invariável ao input, salvo outras ações especiais explicitamente aprovadas.

---

## GF-04 — Ground Snap + Step Assist: apoio confiável e pequenos degraus

### 1. Pré-requisito decisivo

O mapa com plataformas completamente sólidas (lados/topo/base), gravidade, alturas e colisão tridimensional reais está descrito em `docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md`. A existência do documento **não certifica que o motor já resolva todos esses contatos na `main`**.

Esta proposta depende primeiro de suporte robusto: detecção de piso, normal do solo, estado `grounded`, transferência de suporte e resolução de volume 3D sem atravessar geometrias.

### 2. Ideia: dois mecanismos diferentes

**Ground Snap:**
- Quando o lutador está *legalmente apoiado* em superfície acessível e existe apenas uma separação vertical muito pequena (por exemplo, descendo uma irregularidade suave), manter o contato e a estabilidade de locomoção em vez de alternar falsamente `grounded → airborne → grounded`.
- O snap **não opera** ao saltar, ao ser lançado, durante voo ofensivo ou quando o personagem deliberadamente sai de uma borda sem superfície alcançável. Não é gravidade mágica para “grudar” em plataformas.
- Exige teste geométrico de superfície, normal admissível e ausência de bloqueio/penetração do colisor.

**Step Assist:**
- Quando um obstáculo tem *degrau de baixa altura permitido* e há espaço livre para o corpo inteiro, tentar transpor o degrau por deslocamento de locomoção contínuo — sujeito a altura máxima e verificação por sweep, não por teleport.
- Degraus altos, paredes completas, teto baixo, escadas inclinadas ou plataformas separadas por vazio **não** devem ser transpostos artificialmente.
- Plataformas aprovadas de 1 m / 1,5 m não devem virar “subida automática” sem deliberação; saltos e Ledge Grab preservam funções próprias.

### 3. Decisões pendentes

- Altura mínima/máxima de step, tolerância de snap, ângulo máximo do plano, velocidade de subida/descida e aplicação por tipo de suporte.
- Comportamento com rampas íngremes, degraus consecutivos, obstáculos dinâmicos/destrutíveis, superfícies móveis e colisão com outro lutador.
- Como separar altura visual da malha, centro físico do colisor e posição do suporte sem oscilar ou inventar deslocamento.
- Colisões contra borda lateral de plataforma: respeitar as faces completamente sólidas e o espaço físico necessário.
- Gravidade, salto, pouso, knockback, teto e suspensão em parede devem prevalecer segundo estados autorizados.

### 4. Testes propostos (GF04-T)

- **T01:** caminhar sobre pequena irregularidade sem vibrar ou alternar estados artificialmente.
- **T02:** ao ultrapassar borda real, cair preservando impulso horizontal aprovado.
- **T03:** degrau elegível + teto livre permite transposição; degrau alto ou teto baixo bloqueia corretamente.
- **T04:** rampas, quinas, escadas inclinadas e superfícies convexas/côncavas não atravessam o terreno.
- **T05:** a quebra de suporte causa perda legítima de apoio, nunca “snap” para superfície distante.
- **T06:** sem transpor lateral de plataforma de 1 m/1,5 m sem comando de salto/ação autorizada; teste com lutadores e objetos no topo.

---

## GF-05 — Adaptive Hitstop: contraste proporcional entre impactos

### 1. O que já existe

`src/sim/game.js` implementa hitstop e coleta X/C durante o congelamento para buffer. `src/sim/config.js` traz valores padrão distintos para contato normal (**0,035 s**) e clash (**0,085 s**), além de VFX que reagem aos impactos. **Logo já há contraste básico de hitstop**; a proposta é ampliar de modo criterioso a expressividade por *tipo/intensidade*, não criar hitstop do zero.

### 2. Comportamento candidato

Testar múltiplos **perfis configuráveis** de hitstop conforme evento e força expressiva de contato, por exemplo:
- Contato leve: congelamento muito curto e leitura rápida;
- Contato forte: congelamento um pouco maior, preservando fluidez;
- Clash, defesa perfeita, quebra de obstáculo e slam: assinatura temporal própria *somente se* a regra do evento e o resultado justificarem.

Não confundir intensidade visual, dano real, Power Level e duração do hitstop: o mapeamento entre eles **precisa de aprovação**. Não atribuir automaticamente hitstop maior a todo evento com dano alto, em especial DoT ou múltiplos projéteis por passo.

### 3. Cuidados obrigatórios

- Pausa da simulação durante hitstop, comandos X/C buffers e janela de prioridade precisam continuar com a mesma política ou com mudança expressamente autorizada.
- Não permitir encadear hitstop indefinidamente por projéteis múltiplos, contato persistente ou eventos duplicados.
- Se dois eventos ocorrem no mesmo passo, a agregação precisa ser determinística e seguir uma regra explícita (por exemplo maior duração; *ainda não aprovado*).
- Combos, reação do defensor, início de cooldown, janelas de defesa, timers e lógica de KO **não podem avançar inadvertidamente** enquanto o jogo está congelado.
- Diferenciar duração real de congelamento de duração de VFX e *camera shake*: essas curvas são sistemas separados.
- A opção de acessibilidade/efeitos reduzidos não deve alterar hitboxes, dano ou regras de combate sem escolha do usuário.

### 4. Decisões pendentes

- Categorias de impacto e limites mínimos/máximos; se Power Level influencia ou não.
- Prioridade entre clash, perfect defense, impactos comuns e ataques simultâneos.
- Se todos os personagens congelam igualmente ou só participantes do contato; a atual implementação congela a simulação globalmente — mudança de modelo requer análise cuidadosa.
- Tratamento de multi-hit, feixes, efeitos persistentes, wall impact e golpes de área.
- Sliders visíveis, opção de comparar desligado/baseline/adaptativo sem misturar parâmetros de dano.

### 5. Testes propostos (GF05-T)

- **T01:** toggle desligado reproduz baseline determinístico.
- **T02:** eventos de contato mapeados a duração previsível, com máximo configurável e sem acumulação abusiva.
- **T03:** buffer de X/C durante congelamento é processado corretamente após retomar.
- **T04:** nenhum cooldown, status temporário, contador de stamina ou janela de combate avança em passo congelado indevido.
- **T05:** resultado de dano, defesa, PL, knockback e KO é idêntico entre presets de hitstop quando as regras não solicitam mudança.
- **T06:** testes com simultaneidade, múltiplos projéteis, Perfect Guard, Clash e hits no mesmo frame.

---

## 6. Plano de ensaio e comparação

### Ordem de experimentação sugerida (não compromisso de implementação)

1. **GF-01 isolado:** comparar jogo atual vs. Momentum Bridge, mantendo valores do Responsive Movement V2 **desligados**. Depois, se desejado, testar combinação.
2. **GF-02 isolado:** cenários reprodutíveis de parede, canto, dois lutadores, objetos dinâmicos.
3. **GF-03:** somente após o salto normal independente estar integrado e validado.
4. **GF-04:** somente após colisão/apoio 3D de plataformas ter contratos e regressões adequados.
5. **GF-05 isolado:** com conjunto de impactos de intensidade diferente, sem alterar força ou dano.

### Exigências de prototipagem futura

- Cada feature com toggle individual e sliders de valor e unidade no painel do jogo, sem valores importantes escondidos.
- Usar `prototypes/combat-lab/` como fonte, não reintroduzir lógica no protótipo legado.
- Comparação A/B com mesmas entradas, semente, lutadores, posição, FPS de apresentação, lock-on e parâmetros de combate.
- Telemetria do passo fixo de **120 Hz**, gráficos de velocidade/deslocamento/estados, contagem de colisões, timing real de inputs e replay reproduzível.
- Cenários de teste na interface para permitir ao responsável avaliar rapidamente sem comandos de terminal.
- Preservar caminho de retorno ao baseline e não alterar parâmetros oficiais sem aprovação.
- Animações GLB reais, câmera e efeitos ligados/desligados devem ser avaliados porque podem mudar a percepção sem modificar física.

### Gate de aceitação

Aprovação depende de (1) diferença perceptível jogando, (2) ganho sem quebrar precisão ou regras de combate e (3) testes objetivos e regressões. **Não medir só FPS ou tempo de aceleração:** observar sensação de intenção, consistência de estados e ausência de comportamento automático indesejado.

## 7. Arquivos prováveis numa implementação *futura* (não editar agora)

| ID | Módulos a investigar | Observação |
| --- | --- | --- |
| GF-01 | `src/sim/controller.js`, `locomotion.js`, `movement.js` | Respeitar ordens de `Game.step`, ações e recovery |
| GF-02 | `src/sim/world.js`, `physics.js`, `geometry.js` | Projeções físicas, normais e resolução de múltiplos contatos |
| GF-03 | Novo salto normal a integrar, `controller.js`, `entity.js`, `physics.js` | A implementação do salto independente é pré-requisito |
| GF-04 | `physics.js`, `world.js`, `geometry.js` e sistema de mapa futuro | Requer contato/apoio de volumes 3D |
| GF-05 | `game.js`, `combat.js`, `config.js`, UI de VFX | Preservar buffer, congelamento e ordem dos eventos |

As alterações do **PR #98** (Responsive Movement V2) e os documentos das **issues #95–#97** são propostas separadas; nenhuma é automaticamente incorporada a estas cinco.

## 8. Matriz de risco transversal

- **Troca de estados:** nunca permitir ação que deveria estar bloqueada por hitstun, guardstun, recuperação, knockback, imobilização, exaustão ou KO.
- **Velocidade/teleporte:** sem injeção ilimitada de vetor ou correção de posição através de volumes sólidos.
- **Ordem de simulação:** colisão, lançamento, mundo, cooldowns e timers seguem contratos do motor; nenhuma feature pode agir em fase arbitrária.
- **Determinismo:** replay/save-load conservam estado de buffers, janelas, transições, superfície de apoio, RNG e toggles necessários.
- **IA:** sujeita às mesmas restrições de personagem, sem ajuda física oculta.
- **Câmera e animação:** não inferir estado jurídico do lutador com base na pose visual; visual deve refletir simulação.
- **Teto e altura:** interações 3D respeitam piso, lateral, fundo das plataformas, teto e inclinação real.
- **Efeito da implementação:** cada feature deve ter teste de não regressão e comparador "desligado" antes de integrar à experiência principal.
- **Aprovação:** o pedido de registrar no GitHub não concede autorização para escrever código jogável.

## 9. Resultado desta entrega

Documento de propostas, organizado para decisões futuras por identificadores **GF-01 … GF-05**. Não há código de gameplay, protótipo HTML, execução de testes ou validação humana nesta entrega. Para implementar qualquer item, pedir autorização explícita e seguir `AGENTS.md` / `docs/GUIA_COLABORACAO_AGENTES.md`, em branch isolada e sem editar diretamente `main`.
