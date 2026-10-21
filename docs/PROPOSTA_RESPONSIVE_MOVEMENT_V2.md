# Arenamon — Proposta de Game Feel: Responsive Movement V2

> **STATUS: PROPOSTA TÉCNICA PARA AVALIAÇÃO — NÃO APROVADA; NÃO IMPLEMENTADA.**
>
> **Escopo desta entrega:** registrar uma proposta de calibração da locomoção e da apresentação visual do **Combat Lab** oficial, sem alterar código, presets existentes, decisões de design ou o comportamento jogável. O responsável deverá testar e aprovar uma variante antes de qualquer aplicação ao padrão do jogo.
>
> **Data do registro:** 21/10/2026 · **Base consultada:** `main` no commit `68eda6c6c938aa21167cafa761f04be57d4224cc`.
>
> **Motivação recebida do responsável:** “as coisas ainda parecem meio duras e pesadas”. O objetivo é atacar *responsividade e fluidez perceptiva*, não necessariamente a velocidade máxima.

## 1. Diagnóstico fundamentado

O Arenamon **já possui** um controlador de locomoção contínua com aceleração progressiva, reversão, frenagem, aderência lateral e giro com aceleração angular; não se deve apresentar essas tecnologias como se estivessem faltando. Há também presets experimentais, ajuste de parâmetros em UI, telemetria e A/B.

### Fontes auditadas

- `prototypes/combat-lab/src/sim/locomotion.js`: `locomotionStep`, velocidade paralela e perpendicular, `turnGrip`, atrito e limite de aceleração por passo.
- `prototypes/combat-lab/src/sim/controller.js`: locomoção, sprint, transições de X/C, estados impeditivos, orientação e parâmetros efetivos.
- `prototypes/combat-lab/src/sim/config.js`: valores atuais e pontos de configuração.
- `prototypes/combat-lab/src/view/characters.js`: escolha de clipes, frenagem, `smoothLocomotion`, `fade`, `actionFade` e `locomotionHold`.
- `prototypes/combat-lab/src/view/rig.js`: câmera com amortecimento, rotação e seguimento.
- `prototypes/combat-lab/CALIBRACAO.md`: tabela de presets e medições determinísticas.
- `prototypes/combat-lab/OVERHAUL.md`: histórico da revisão de locomoção e suas garantias.
- `docs/INDICE_MODULOS.md`: contratos, testes e responsabilidade dos módulos.

### Referência de tempos já documentada

Os resultados seguintes pertencem aos testes anteriormente registrados em `CALIBRACAO.md`; **não são resultados executados nesta tarefa**.

| Cenário | Preset padrão documentado | Preset Storm-like já existente |
| --- | ---: | ---: |
| Caminhada até 95% da velocidade | 225 ms | 150 ms |
| Inversão até velocidade zero | 125 ms | 75 ms |
| Inversão até 95% no novo sentido | 350 ms | 233 ms |
| Frenagem da caminhada no cenário medido | 175 ms | 117 ms |
| Distância de frenagem no cenário medido | 0,25 m | 0,17 m |

**Interpretação:** há espaço para experimentar tempos menores mantendo velocidade máxima de caminhada e física contínua. Como o preset Storm-like também altera o multiplicador de sprint e outros parâmetros, **não atribuir seus resultados numéricos à V2 sem rodar medições específicas**. O relato de rigidez pode envolver também animação, câmera e transição entre estados; ainda depende de avaliação humana no navegador.

## 2. Resultado de experiência desejado

O lutador deve começar a se mover prontamente, mudar de direção sem parecer deslizar como um bloco, parar sem atraso excessivo e *parecer* responder ao input no próprio quadro visual. Movimentos devem manter massa, equilíbrio e continuidade física. Direção e deslocamento permanecem consistentes com câmera e lock-on.

**Não objetiva** tornar todos os personagens igualmente rápidos, alterar a física de lançamentos, acelerar golpes, remover recuperação após ações ou introduzir cancelamentos que não foram aprovados.

## 3. Pacote experimental V2 — hipótese de parâmetros

**Tudo nesta tabela é um valor de ensaio, NÃO um padrão aprovado.** Aplique inicialmente como preset experimental separado, sem substituir o preset padrão nem o Storm-like.

| Parâmetro do sistema | Padrão consultado | V2 experimental | Interpretação |
| --- | ---: | ---: | --- |
| `locomotion.acceleration` | 26 m/s² | **40 m/s²** | Ganhar velocidade mais cedo |
| `locomotion.braking` | 22 m/s² | **34 m/s²** | Parar com menos deslizamento |
| `locomotion.reversal` | 38 m/s² | **62 m/s²** | Responder à inversão do direcional |
| `locomotion.turnGrip` | 34 | **52** | Dissipar mais rápido a velocidade lateral incompatível com o comando |
| `actions.sprint.acceleration` | 16 m/s² | **26 m/s²** | Tornar entrada em sprint mais pronta |
| `actions.sprint.turnGrip` | 20 | **30** | Melhorar controle em curvas rápidas durante sprint |
| `display.animation.fade` | 0,18 s | **0,14 s** | Reduzir latência visual entre animações de locomoção |

**Preservar na primeira rodada** `locomotion.model=1`, velocidades máximas por perfil, `actions.sprint.speedMultiplier=1.55`, `actions.sprint.braking=12`, `locomotion.accelCurve=0.45`, `locomotion.brakeCurve=0.35`, `locomotion.friction=0.8`, `locomotion.residualSpeed=0.25`, giro máximo, `display.animation.actionFade=0.07`, `display.animation.locomotionHold=0.1` e valores de câmeras existentes. Isso isola o efeito dos sete parâmetros acima.

- **Atenção:** o preset Storm-like existente usa aceleração/frenagem/reversão/aderência próximas às quatro primeiras hipóteses, **mas também muda outros valores** (inclusive sprint ×1,8). A V2 deve preservar a velocidade máxima original para medir *sensação de resposta*, não vantagem de deslocamento.
- **Não inferir números de desempenho da V2 a partir de outra coluna de preset.** Medir de novo com a configuração final.
- **Não mudar a identidade dos atributos de Velocidade dos lutadores.** Se diferentes personagens apresentarem sensações distintas, documentar e comparar antes de propor regras particulares.

## 4. Ajuste conceitual adicional: resposta adaptativa nas viradas

**Proposta de investigação, fora da tabela numérica acima, pendente de aprovação.**

O controlador atual já decompõe o movimento em componentes paralela e perpendicular, com limite de aceleração. Testar uma *aderência direcional transitória* em mudanças grandes de entrada (ex.: curva de 90° ou reversão), ativada apenas quando o lutador está em locomoção livre, em vez de aumentar globalmente a velocidade ou zerar o vetor de movimento.

Invariantes obrigatórias, se isso vier a ser autorizado:

1. A velocidade evolui continuamente por passos fixos de 120 Hz, sem snap de direção, teletransporte ou alterações retroativas.
2. Aplicar limite verificável de |Δv| por passo; atualizar o cálculo de limite caso a nova aceleração temporária seja introduzida.
3. Não sobrepor o controlador de X, C, tackle, charge, defesa, recuo, knockback ou situações em que o movimento esteja legalmente bloqueado.
4. Definir intensidade, janela, decaimento, condição de ativação e regra para entradas sucessivas **somente após teste e aprovação**. Nenhum novo valor numérico foi decidido.
5. Em lock-on, distinguir explicitamente direção de movimento, direção do corpo e orientação da câmera; não trocar involuntariamente o referencial de input.

**Separar resultados:** primeiro comparar exclusivamente a tabela da seção 3, depois testar um modelo adaptativo, caso o primeiro ainda pareça duro. Isso permite saber qual mudança realmente ajudou.

## 5. Camada de apresentação — não atrasar o comando com animação

O jogo já possui transições e clipes `walk_stop`, `sprint_stop`, `walk_left/right` e `walk_back`, com fallback para modelos que não tenham todas as animações. Não duplicar sistemas já presentes.

Experimentos visuais posteriores, condicionados à qualidade dos GLBs disponíveis:

- **Inclinação de intenção (*anticipation lean*):** deslocamento/rotação visual sutil da parte superior do corpo na direção da aceleração ou curva. Escala e amortecimento ajustáveis; não modificar posição de colisão/hitboxes/hurtboxes nem mover o root físico.
- **Freio responsivo:** interromper rapidamente a representação visual de frenagem se um novo comando de locomoção for válido. Preservar a desaceleração física real; não antecipar a posição do personagem.
- **Animações direcionais:** conferir se o clipe de strafe ou recuo corresponde à velocidade, direção relativa ao oponente e estado de lock-on, sem reprodução invertida ou deslizamento de pés exagerado.
- **Locomoção *speed-matched*:** avaliar taxa de reprodução dos passos baseada na velocidade e no ciclo de contato dos pés; preservar metadados de janelas dos Moves e não alterar timings de combate.
- **Qualidade do crossfade:** comparar `display.animation.fade` 0,18 vs 0,14 s com modelos reais; reduzir somente fades de locomotion se o estado exigir e não prejudicar transitions de ações especiais.
- **Câmera:** testar primeiro o comportamento existente (`view/rig.js`) antes de ajustar amortecimento, zona morta ou rotação. Alterar simultaneamente câmera e física impossibilita atribuir a melhora à causa correta.

Em todos os itens visuais, **apresentação acompanha a simulação, não é dona da simulação**. O personagem não pode ser visualmente deslocado através de paredes para “parecer responsivo”.

## 6. Comparação A/B/C proposta para homologação

| Variante | O que muda | Objetivo |
| --- | --- | --- |
| **A — Atual** | Nada | Controle de regressão e referência subjetiva |
| **B — Storm-like existente** | Preset já disponível, sem edições | Referência de agilidade, com diferenças de velocidade claramente identificadas |
| **C — Responsive Movement V2** | Apenas os 7 parâmetros da seção 3, preservando velocidades máximas | Isolar a melhoria de resposta e fluidez visual |

O laboratório já possui ferramentas de preset, telemetria e comparação em `CALIBRACAO.md` e `movement.js`. Reutilizar isso; **não criar uma máquina paralela de locomoção só para a comparação**.

Procedimento:

1. Registrar versão do checkout, commit e parâmetros efetivos de cada variante.
2. Usar mesmo lutador, posição inicial, cenário, estado de stamina, semente e sequência de comandos nas três versões.
3. Repetir o roteiro determinístico: iniciar caminhada, manter deslocamento, soltar, inverter 180°, virar 90°, deslocar na diagonal, lock-on com movimento lateral, iniciar sprint, curvar durante sprint, sair do sprint, C → sprint, X, defesa, retorno à locomoção.
4. Analisar velocidade, aceleração, desaceleração, inversão, overspeed, deslocamento, estados transientes e estabilidade da câmera.
5. Rodar avaliações visuais *jogáveis* nos modelos GLB reais, com efeitos ligados e desligados, FPS representativos e sem zoom/câmera extras alterados inadvertidamente.
6. Fazer avaliação humana cega quando possível: nota de resposta ao input, clareza da intenção, rigidez aparente, sensação de peso, derrapagem e coerência entre animação e velocidade; guardar observações e capturas.

## 7. Invariantes e não regressões

- Simulação mantém 120 Hz, determinismo, repetibilidade por semente e compatibilidade com replay/save-load.
- Velocidades máximas, bônus de Velocidade, custo de sprint, stamina, proteção e cobertura da defesa continuam inalterados.
- X (tackle), C (esquiva), suas janelas, cancelamentos e retornos às ações seguem exatamente os contratos existentes.
- `landing`, `knockRecovery`, guard stun, hit stun, Wall-Splat, Wall-Bounce, Tech Recovery e Meteor Slam não recebem bypass ou novas permissões.
- Colisões, empurrão, deslocamento em paredes/objetos e apoio em plataformas não podem ser contornados pela alteração da locomoção.
- Input de câmera/lock-on, diagonal normalizada e modos de referencial de movimento preservados.
- Locomoção impedida por status (`stunned`, `rooted`), charge, stamina e outros estados conserva as restrições.
- IA não deve sofrer vantagem oculta por receber outra física ou parâmetros diferentes do jogador.
- Modelos que não contenham certos clipes GLB mantêm fallback estável; VFX e animações de combate não são redefinidos.
- Nenhuma diferença de comportamento ocorre quando o preset experimental estiver desligado.

## 8. Testes de aceitação previstos (NÃO EXECUTADOS)

**Automatizados:**
- `npm run test:combat-lab:unit`, com foco especial em `locomotion.test.mjs`, `calibration.test.mjs`, `core` e `rules`.
- `npm run test:combat-lab:browser`, com foco em movimentos de teclado, lock-on, animation states e desempenho.
- `npm run verify` na preparação final para implementação autorizada.
- Simulação de mesma sequência a 30/60/120/144 FPS de renderização com passo físico fixo, para garantir independência de frame rate.
- Verificar limites de aceleração e trajetórias (sem salto instantâneo de vetor), situações de overspeed e colisões.

**Critérios de aceitação humanos, a combinar antes da implementação:**
- O usuário deve perceber resposta mais rápida nas quatro direções e em movimentos diagonais **sem perda de precisão perto do adversário ou plataforma**.
- A inversão não deve parecer deslizamento nem snap antinatural.
- A sensação de peso dos diferentes lutadores deve continuar distinguível por seus perfis.
- A movimentação deve se manter legível em combate sob ataques, defesa, câmera com lock-on, sprint e falhas de input por estado.
- Avaliação nos próprios personagens/modelos é obrigatória; melhoria só em um bloco genérico não é suficiente.
- Nenhum número de FPS, teste aprovado, ganho de latência ou melhoria percentual será declarado antes de medições efetivas.

## 9. Arquivos-alvo para uma eventual implementação (NÃO MEXER AGORA)

- `prototypes/combat-lab/src/sim/config.js` — preset e/ou parâmetros experimentalmente isolados.
- `prototypes/combat-lab/src/sim/locomotion.js` — somente se a aderência adaptativa for posteriormente aprovada.
- `prototypes/combat-lab/src/sim/controller.js` — integração mínima, somente após confirmar necessidade.
- `prototypes/combat-lab/src/view/characters.js` — avaliação de crossfade, foot sliding e inclinações visuais.
- `prototypes/combat-lab/src/view/rig.js` — avaliar câmera, sem editar por padrão.
- `prototypes/combat-lab/test/` — cobertura de regressão.
- `prototypes/combat-lab/CALIBRACAO.md` — registro dos resultados de ensaio, caso sejam executados.
- `ABRIR_ARENAMON.html` — link para a proposta na Central de Documentação, conforme `AGENTS.md`.

Não modificar `prototypes/game/` (legado descontinuado), Animation Studio, regras de Moves ou o GDD em razão desta proposta.

## 10. Decisão pendente e condição de avanço

Esta documentação é aprovada **apenas quanto ao ato de registrá-la no GitHub** pelo pedido do responsável; **a mudança jogável não está aprovada**.

Antes de qualquer implementação:
1. Confirmar que o responsável deseja testar a V2, sem substituir o preset atual.
2. Criar branch de protótipo própria e oferecer comparação jogável A/B/C em HTML acessível pelo portal.
3. Avaliar o resultado e documentar escolha explícita, correções solicitadas ou rejeição.
4. Apenas após decisão, discutir promoção de parâmetros para o jogo principal.

**Estado da tarefa atual:** documentação para revisão, sem código de gameplay alterado, sem execução de testes locais e sem homologação de sensação de movimento.
