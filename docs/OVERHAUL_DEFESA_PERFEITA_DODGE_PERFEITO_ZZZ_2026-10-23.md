# Arenamon — Overhaul de defesa perfeita e Perfect Dodge (ZZZ)

**Status:** plano e prompt, não autorização para editar código. **Data:** 23/10/2026.

**DOCX:** [`OVERHAUL_DEFESA_PERFEITA_DODGE_PERFEITO_ZZZ_2026-10-23.docx`](./OVERHAUL_DEFESA_PERFEITA_DODGE_PERFEITO_ZZZ_2026-10-23.docx)

**Evolução:** para a versão ambiciosa (contra-golpe PL3, afterimage, stagger para trás), ver [`DEFESA_OVERHAUL_EPICO_BRAINSTORM.md`](./DEFESA_OVERHAUL_EPICO_BRAINSTORM.md) (29/10/2026). Este documento continua válido como auditoria e contrato-base.

**Escopo:** auditoria read-only, especificação, câmera, VFX, testes e prompt operacional Claude com descoberta e uso verificado de Superpowers, Superskills e skills locais.

ESPECIFICAÇÃO + PROMPT DE IMPLEMENTAÇÃO

OVERHAUL DE

DEFESA PERFEITA

E PERFECT DODGE

Inspirado em Zenless Zone Zero e no parry individual de Banyue

Arenamon · Combat Lab · TypeScript/JavaScript + Three.js · 23 de outubro de 2026

ESCOPO: proposta de engenharia, apresentação cinematográfica, UX, testes e prompt operacional para o Claude. NÃO é autorização para alterar os arquivos do jogo.

Controle

Estado da decisão

D = defesa / defesa perfeita

PRESERVAR o comando existente.

C = esquiva

PRESERVAR; não substituir sem aprovação.

X = tackle / contra-ataque contextual

PRESERVAR as regras de cancelamento existentes.

C sem direção durante ataque, estilo Banyue

ALTERNATIVA opcional, requer decisão do diretor.

Durações, custos e recompensas novos

HIPÓTESES de tuning; NÃO aprovados.

Câmera cinematográfica

Integrar à camada visual existente, sem alterar a direção funcional.

Base consultada: Ziaker/Arenamon, branch main, commit 6d4ad5031f55c2f4ce86243531f461c61c27eb62 (auditoria remota somente leitura). O checkout oficial do Windows, os plugins locais e a execução dos testes não foram acessíveis nesta etapa.


## 1. Resumo executivo

O Arenamon já implementa defesa parcial, defesa perfeita individual (D), esquiva (C), invulnerabilidade e uma câmera cinematográfica inspirada em ZZZ. O objetivo não é recomeçar do zero: é consolidar o comportamento de combate, separar claramente sucesso mecânico e precisão da execução, corrigir inconsistências entre tipos de acerto e elevar o feedback audiovisual dos eventos defensivos.

Parry/Defesa Perfeita: preservar D e oferecer resultados mecanicamente explícitos; avaliar um estado de parry distinto da guarda parcial somente se aprovado.

Perfect Dodge: diferenciar janela curta de precisão da invulnerabilidade normal da esquiva, com evento de recompensa confiável em qualquer fonte de dano elegível.

Câmera: ampliar efeitos já existentes; um perfil para Perfect Dodge e outro para Parry; animação, hitstop, feedback visual e HUD sincronizados a eventos.

Segurança: sem efeitos colaterais nos comandos, física, movimentos, arena, recursos, saves, replay, IA e câmera funcional; regressões automatizadas.


## 2. Pesquisa: a referência ZZZ não é uma mecânica única

Sistema em ZZZ

Funcionamento observado

Tradução para Arenamon

Defensive Assist

Defesa com troca e consumo de recurso de equipe.

Referência audiovisual, NÃO pressupor sistema de equipes.

Banyue: Immovable Mountain

Durante um ataque, Dodge sem movimento ativa postura; impacto ativa parry; exatidão na entrada produz Perfect Block.

Parry individual SEM troca: referência principal para cancelar ofensiva em defesa.

Perfect Dodge / Dodge Counter

Esquiva oportuna em relação ao ataque, com oportunidade de contra-ataque.

Separar precisão, invulnerabilidade e recompensa de contra-ataque.

Evasive Assist / Vital View

Outra categoria de reação defensiva com assistência.

Não tratar como sinônimo de Perfect Dodge individual.

Cuidado metodológico: as fontes documentam as regras gerais do Banyue, mas não autorizam copiar números internos, duração exata de janela, valores de câmera ou frames específicos. Proponha tuning próprio e rotule todas as suposições. Direitos de propriedade intelectual: inspirar-se em técnicas e no feeling, não importar assets, sons ou animações proprietários.

Fontes de referência verificadas em 23/10/2026: https://zenlessdb.com/character/banyue/skills ; https://www.prydwen.gg/zenless/characters/banyue ; https://www.icy-veins.com/zenless-zone-zero/banyue-profile-skills-mindscapes .


## 3. Auditoria confirmada da implementação atual

Área / arquivo

Achado técnico e consequência

sim/config.js + calibration-base.js

factory rules.perfect = 0,20 s, porém a calibração-base atual define 0,34 s; factory perfectCooldown = 2 s. A janela de contra-ataque da defesa perfeita calibrada é 1,98 s (fábrica 0,70 s).

sim/controller.js

cmd.guardPressed abre perfectLeft; segurar D mantém guarda. Cooldown dispara se janela termina sem sucesso. Regras de cancelamento de tackle, esquiva e carga são contextuais.

sim/combat.js

Quando a esquiva tem invulnerabilidade ativa e enableCounterBonus, acerto corpo a corpo vira perfectDodge e concede contra-ataque; não existe uma janela independente, estrita de precisão.

sim/world.js

Projétil/área/beam contra personagem invulnerável retorna invulnerable, sem mesma recompensa/evento perfectDodge do corpo a corpo. Risco de inconsistência.

sim/game.js

Passo fixo = 1/120 s. Hitstop e fila de eventos já existem. Não confundir relógio de simulação e tempo visual.

view/cinematic-camera.js

Câmera inicia desligada. Perfect Parry já aciona snap/impact/letterbox/slowmo; Perfect Dodge apenas callout. snapParry usa arenaHalf quadrado; arena jogável usa raio circular.

view/vfx/effects/defense.js

Já há variantes de FX de defesa comum e perfeita; preferir estender, não duplicar.

sim/defense.js + prediction.js

IA já considera defesa e chegada de ataques; nova janela precisa integrar a percepção/reação sem leitura privilegiada.

ui/cinematic-camera-panel.js

Há painel de câmera; estender sliders existentes e opções de prévia.

Os números acima distinguem parâmetros de fábrica e os efetivamente sobrescritos pela calibração-base. Outros ajustes podem surgir no runtime por configurações do usuário; antes de codificar, inspecionar a configuração resolvida e os saves.


## 4. Contrato de estados defensivos proposto

Resultado lógico

Condição-base

Resultado / feedback

partialGuard

Guarda frontal mantida, ataque bloqueável, fora de janela perfeita.

Dano reduzido conforme regras, guard stun/recuo elegível, VFX discreto.

parry (opcional)

Postura ativa de desvio/interceptação, caso aprovada.

Deflexão com janela própria; NÃO pressupor recompensa perfeita.

perfectGuard

Acerto frontal elegível na janela perfectLeft do comando D.

Sem dano sob regras vigentes, recoil aplicável, janela de resposta, perfil de câmera de alto impacto.

dodgeInvulnerable

Acerto intercepta i-frames válidos, mas fora da janela perfeita.

Sem dano, evento invulnerable/normalDodge, sem benefício de perfectDodge.

perfectDodge

Acerto elegível durante janela de precisão da esquiva e i-frames; não consumido antes.

Sem dano, recompensa prevista, evento de câmera próprio, habilitação de Dodge Counter conforme regra.

hit / guardBreak / unblockable

Acerto não coberto por uma defesa elegível.

Preserva regras especiais, status, escudo, empurrão e exceções de cada Move.

Invariante central: um acerto produz UMA classificação defensiva, coerente em corpo a corpo, projéteis, áreas e beams. Não pode conceder múltiplas recompensas pelo mesmo hit ID / source + window.

Prioridades e exceções devem ser formalizadas em função compartilhada (ex.: resolveDefenseOutcome), sem fazer com que guardBreak seja inadvertidamente anulado, nem que ignoreInvulnerability deixe de funcionar. A ordem exata relativa a Riposte, escudos, status e efeitos especiais deve reproduzir os contratos vigentes e ter testes próprios.


## 5. Perfect Dodge: especificação funcional

Reconhecer a esquiva iniciada pelo comando C, com identificação determinística do instante de ativação, fase atual e direção.

Preservar a duração e os i-frames de esquiva normal atuais. Acrescentar um intervalo independente perfectDodgeWindow, medido em ticks do passo fixo; inicialmente manter o recurso sob feature flag OFF até aprovação de tuning.

Somente declarar perfectDodge se um ataque efetivo interceptaria o volume/hitbox do personagem num tick elegível E o golpe fosse evitado pela esquiva. Proximidade visual isolada não é suficiente.

Projetéis, áreas, beams, tackles e múltiplos hits devem passar pelo mesmo classificador. Para ataques contínuos, registrar fontes/janelas e impedir farm de recurso repetido.

Tratar Dodge Counter como janela explícita de resposta (não como ataque gratuito/automático). Preservar prioridade atual X/C, stamina, cancelamentos, cooldowns e a ação original quando o contra-ataque não for permitido.

Definir comportamento em ar, plataformas, obstáculos, desníveis, bordas, knockback, parede, wall-splat, states de charge/aim, stun e direção do personagem. Não teleportar nem atravessar colisores por causa do FX.

Emitir evento estável com IDs, tick, atacante, defensor, fonte, contato/normal e classificação. Observar replay, save/load e variação de FPS.

Janelas de 0,10–0,18 s e bônus de stamina/contra-ataque são APENAS valores de exploração, não os valores aprovados. O código existente possui dodge.counterWindow e dodge.perfectEvadeStamina próprios: verificar também a calibração do usuário.


## 6. Parry / defesa perfeita individual, inspirado em Banyue

Manter D como entrada de defesa universal e permitir interrupção do ataque somente nas condições atuais de cancelamento; comportamento não pode ser expandido silenciosamente.

Guardar separadamente guardPressed, estado de guarda, abertura/consumo da janela perfeita, cooldown e resultado do impacto. Não confundir “defesa acionada” com “acerto realmente defendido”.

Em impactos normais, preservar partial, guard stun, recoil e mitigação existente. Em perfectGuard, preservar imunidade a dano elegível e status especiais conforme a regra de cada golpe.

Inspirar-se no Banyue para a qualidade da transição ataque → postura defensiva → acerto → reação → contra-ataque, com animações/poses legíveis e efeito de interrupção potente.

Tratar “C sem direção durante ataque para parry” como experiência OPCIONAL configurável e dependente de aprovação; não sobrepor C existente, finta, esquiva sem direção, prioridade de X, ou cancelar tackles sem autorização.

Se aprovada a distinção parry normal / perfectParry, especificar precisamente entradas, posição do escudo, efeito do contato, custo, dano mitigado, regras de ruptura e câmera; não inferir de ZZZ qualquer valor.


## 7. Direção de câmera cinematográfica

A câmera deve consumir os resultados dos eventos simulados e nunca inferir “perfect” apenas pelo estado da animação. O rig funcional, a orientação dos inputs, a câmera orbital e o lock-on devem permanecer intactos.

Fase

Parry / Perfect Guard

Perfect Dodge

Leitura

Enquadramento do contato e antecipação curta; não anunciar sucesso antes do hit.

Manter leitura do vetor de ataque e da direção de esquiva.

Instante do sucesso

Snap lateral contextual/offset, flash opcional, hitstop e camada de brilho/escudo.

Time accent visual, leve desvio angular, rastro e foco na passagem próxima do ataque.

Retenção

Letterbox curta e slowmo VISUAL, sem congelamento da simulação fora do hitstop já contratado.

Breve realce da janela de Dodge Counter, com centro da ação visível.

Retorno

Spring para a câmera funcional; sem saltar para posições impossíveis.

Transição suave sem quebrar a leitura do próximo ataque.

Corrigir a validação do snap contra a arena circular real e objetos oclusores. Testar perto de bordas, plataformas, paredes, teto de obstáculos e dois alvos em alturas diferentes.

Criar perfis independentes de parry comum, perfectGuard e perfectDodge; privilegiar coerência de identidade visual sem sobreposição caótica de efeitos.

Atribuir prioridade: KO / intro / clash / parry / perfect dodge / dash conforme regra explícita, com cooldown audiovisual. Nunca disparar 3 snaps consecutivos pelo mesmo ataque.

Sliders: ativação, duração, distância, arco/ângulo, roll, FOV, velocidade de retorno, intensidade de flash, exposição, chroma, speedlines, barras, slowmo visual, força de shake e limite de spam; ranges e unidades claros.

Acessibilidade: reduceMotion, noFlash, câmera normal instantânea, teto de tremor, tremor/efeitos desligáveis individualmente, preservação de FPS e integridade do camera yaw.


## 8. Animação, VFX, som e integração

Blender/Animation Studio: planejar clipes de entrada de guarda, parry normal (se aprovado), perfectGuard, flinch/hold breve, início e recuperação de esquiva, perfectDodge, dodge counter; sincronizar com eventos de gameplay, respeitando rigs e tempos existentes. Nenhum clipe pode ser introduzido como obrigatório sem fallback procedural.

Animar antecipação mínima, linha de ação forte, pose de impacto legível e recuperação; squash/stretch e smear são visuais, não ampliam hitbox automaticamente.

Combinar os FX existentes com três variantes configuráveis para Perfect Guard e três para Perfect Dodge, reaproveitando o sistema de partículas do projeto; não reimplementar FX que já existem.

Layer de SFX com ataque/contato/perfect e aviso de Dodge Counter; evitar tocar áudio a cada frame ou repetir pelo mesmo hit ID.

Indicar sucesso no HUD com feedback localizado, sem textos que cubram o personagem/inimigo, e opção para ocultar rótulos.


## 9. Instrumentação e testes de aceitação

Classe

Cenários mínimos exigidos

Classificação

parcial, guard perfeita, dodge normal, dodge perfeita, invulnerabilidade herdada, riposte, guardBreak, unblockable, ignoreInvulnerability.

Fontes

tackle PL distintos, charges, projétil rápido, projétil ricocheteado, beam, AOE, multi-hit, status, explosão e source sem owner.

Geometria

frente, costas, lateral, alturas, plataforma, parede, obstáculo, contato contra chão, edge/out of bounds e colisão contínua.

Tempo

primeiro/último tick dentro, tick anterior/posterior fora, latência, FPS 30/60/120, substep, hitstop, pause/replay/snapshot.

Recursos

custo só no momento correto, sem reembolso indevido, janela de contra-ataque, cooldown, buffs, escudo, stamina máxima.

IA

percepção não onisciente, input justo, dificuldade, reação, concorrência de ações, comportamento em plataformas.

Câmera

parry/perfectDodge separados, desligada, previews, retorno, prioridade, arena circular, oclusão, reduceMotion, noFlash.

Regressão

estado da configuração salva, portais, controles X/C/D, tackle cancels, combos, cinematic tests, VFX existentes, build e verify.

Critérios de aceite: (1) resultados idênticos em todos os tipos de origem para o mesmo hit elegível; (2) cada ataque recompensa uma vez por janela/entidade; (3) não haver nova mudança de dano, stamina, cooldown e janelas sem decisão; (4) reproduções determinísticas em simulação; (5) câmera não altera rig funcional nem input; (6) todos os novos parâmetros acessíveis por sliders/interruptores, persistentes e testáveis por cenários; (7) compatibilidade com a arena circular e altitudes; (8) documentação e links no portal após integração.


## 10. Plano de implementação em etapas

Fase

Entregáveis

Gate de aprovação

0 — inspeção

git status, fetch, AGENTS, calibração efetiva, regras de defesa e classificação, snapshot dos testes.

Nenhuma edição sobre checkout sujo.

1 — motor

Função única de classificação; testes RED em tackle vs projectile; chaves de compatibilidade.

GREEN mecânico com toggle OFF.

2 — dodge

Janela separada, IDs, consumo single-hit, resposta contextual, testes cruzados.

Vídeos/trace comparativo sem mudança dos antigos.

3 — parry

Eventos refinados, transições e interrupções, tratamentos especiais, preservação D.

Teste manual contra guardBreak/charge/recoil.

4 — câmera/VFX

Perfis independentes, sliders, previews e redução de movimento; snap circular corrigido.

Inspeção visual 30/60/120 FPS e borda.

5 — polimento

Animação (fallback), SFX, HUD, IA, documentação, cenários rápidos, teste final.

Portal funcional, builds e commit revisado.

Não confundir plano com autorização. A implementação começa apenas quando a tarefa for explicitamente repassada ao Claude/Codex. Contratos numéricos novos e mapeamento alternativo de tecla devem ser aprovados antes de alterar o comportamento padrão.


## 11. Decisões pendentes do diretor

ID

Decisão necessária

Recomendação provisória

P1

D universal vs. ativação alternativa C neutro durante ataque.

Manter D; experimentar C somente em branch e com toggle OFF.

P2

Existirá parry normal separado da guarda parcial?

Prototipar apenas se alterar o feeling de modo demonstrável.

P3

Janela estrita de Perfect Dodge, stamina, cooldown, recompensa e contra-ataque.

Não fixar até testes com cenas reais.

P4

Perfect Guard: janela atual 0,34 s, 2 s cooldown e 1,98 s resposta calibrada.

Não alterar neste overhaul sem autorização específica.

P5

Qualquer slowdown que afete SIMULAÇÃO em vez de somente VISUAL.

Evitar até existir design + determinismo aprovados.

P6

Nível de exagero dos perfis de câmera e animação.

Três presets para comparação, sob controles acessíveis.


## 12. PROMPT COMPLETO PARA CLAUDE (copiar e executar quando autorizado)

O trecho a seguir é um prompt operacional independente. Ele exige a descoberta e o uso das ferramentas reais do Claude, sem inventar instalações ou atalhos. Pode ser enviado diretamente ao Claude na pasta oficial do Arenamon quando houver autorização para implementar.


### PAPEL E MISSÃO

Você é o engenheiro principal de combate/câmera do Arenamon. Implementará o overhaul de DEFESA PERFEITA e PERFECT DODGE inspirado em Zenless Zone Zero (incluindo o parry SOLO de Banyue, sem troca). Preserve as regras e decisões existentes. Trabalhe exclusivamente no checkout oficial do Arenamon, não em clones paralelos. Informe o plano, execute em fases verificáveis e nunca afirme testes/inspeções que não executou.


### TRAVA DE AUTORIZAÇÃO

Este DOCX documenta um plano. Não interprete a existência do documento como autorização para editar código. Quando o diretor encaminhar este prompt com ordem expressa para IMPLEMENTAR, prossiga; em simples leitura, AUDITE e proponha. Qualquer parâmetro de gameplay não aprovado, nova tecla ou comportamento controverso permanece como proposta/toggle OFF.

SUPERPOWERS E SUPERSKILLS — USO OBRIGATÓRIO E COMPROVÁVEL

ANTES de alterar qualquer arquivo: descubra os plugins/skills instalados e leia o ponto de entrada de Superpowers, Superskills e skills locais relevantes. Use realmente as skills disponíveis e registre por etapa: nome exato, caminho/comando efetivamente invocado, objetivo, resultado. Para Superpowers, sempre que disponível, usar processos equivalentes a brainstorming/design, writing-plans, test-driven-development (RED/GREEN/REFACTOR), systematic-debugging, executing-plans, requesting-code-review e verification-before-completion; use os nomes reais instalados em vez de inventar comandos. Para Superskills, faça inventário, escolha os módulos aplicáveis e invoque-os de verdade. Se Superskills não estiver instalado, DECLARE a ausência; não escreva que o utilizou. Não substitua trabalho por referências nominais decorativas.


### SKILLS ESPECÍFICAS DO REPOSITÓRIO

Ler obrigatoriamente AGENTS.md e .claude/skills/arenamon-routing/SKILL.md. Abrir também, quando pertinentes: camera-systems, game-feel, physics-tuning, threejs-gltf-loading, shader-programming, performance-optimization e router; registrar o uso em docs/GAMEDEV_SKILLS.md quando houver integração. Skills orientam técnica, mas não sobrepõem regras do Arenamon.


### VERIFICAÇÃO DO CONTEXTO

Execute git status --short --branch, git remote -v, git fetch origin e npm run verify:workspace ANTES de editar, na pasta oficial C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon. Se workspace estiver sujo por outro agente, PARE sobre arquivos conflitantes e reporte. Inspecione a main atual (não use SHA desatualizado). Leia controller.js, combat.js, world.js, config.js, calibration-base.js, entity.js, game.js, prediction.js, defense.js, cinematic-camera.js, ui/input.js, ui/cinematic-camera-panel.js, view/vfx/effects/defense.js, testes e documentos relacionados.


### ESTADO REAL A RECONFIRMAR

No commit 6d4ad5031f55c2f4ce86243531f461c61c27eb62 havia defesa perfeita D, esquiva C, tackle X, sim 120 Hz; calibração-base elevava rules.perfect 0,20→0,34s e perfectGuardCounterWindow 0,70→1,98s; melee emitia perfectDodge durante invulnerabilidade da esquiva quando enableCounterBonus; world.applyHit de projetil/área devolvia invulnerable; câmera já dramatizava perfect, porém perfectDodge só emitia callout; triggerSnap usava bounds quadrados arenaHalf. Confirme tudo no checkout atual antes de agir, pois pode ter evoluído.


### DESIGN FUNCIONAL

Implemente um classificador defensivo compartilhado e determinístico para melee, projétil, beam, área e entidades. Preserve guard comum, perfectGuard, guardBreak, Riposte, ignoreInvulnerability, shield, status, knockback, Move exceptions e costs. Separe i-frames da esquiva normal de uma janela própria de Perfect Dodge; hit evitado durante i-frames fora dessa janela não ganha bônus perfeito. Um único resultado por ataque/janela/defensor; IDs estáveis para eventos e replays. Adicione o novo comportamento sob feature flag desligada por padrão, até aprovação.


### BANYUE / PARRY INDIVIDUAL

Use a referência correta: Banyue pode realizar Immovable Mountain como parry pessoal sem troca de personagem, durante ataque com Dodge neutro; acerto no início gera Perfect Block. No Arenamon MANTENHA D por padrão. Não implemente C neutro durante ataque como comando padrão sem decisão P1; faça apenas design/testes isolados se explicitamente autorizado.


### TUNING / CONTRATOS

Não altere silenciosamente valores numéricos. Separe valores fábrica, calibração-base, saved profile e runtime. Se propuser duração para Perfect Dodge ou ajustes de cooldown, são hipóteses até aprovação; apresente sliders com unidades, min/max e presets A/B/C. Testes devem cobrir limites em ticks e não float ad hoc. Respeite política de consumo de recursos ao confirmar alvos/locais e regras globais de Moves existentes.


### CÂMERA / ÁUDIO / VFX

A câmera cinematográfica deve consumir eventos concretos, não inferências. Crie perfil distinto de Perfect Dodge e refine Perfect Guard sem apagar o sistema C01-C12. Snap contextual respeita arena circular, obstacles, câmera colisão, altura e occlusion. Slowmo VISUAL não pode afetar simulação/inputs, a menos que o diretor aprove mudança específica. Habilite reduceMotion/noFlash e sliders/previews. Use VFX preexistentes, Quarks.js quando houver integração já suportada, e áudio em camadas sem spam. Nenhum asset proprietário de ZZZ deve ser incorporado.


### ANIMAÇÃO / TIMING

Integre eventos dos clipes sem exigir Blender Studio nesta fase se não for necessário; preserve fallback procedural. Poses de parry/perfect dodge devem sincronizar com janelas REAIS e não ser usadas como autoridade para o contato. Não modifique Animation Studio fora do escopo.


### VALIDAÇÃO TDD

Primeiro capture a baseline e escreva testes que falhem demonstrando o bug real: melee vs projectile perfectDodge, limites de janela, multi-hit, impacto durante animação, casos de guardBreak e replay. Faça RED comprovado, implementação mínima, GREEN, refactor e code review independente. Teste 30/60/120 Hz, sim 120 Hz, bordas, altura, plataformas, obstáculos, troca de estados, colisoes, stats e IA. Gere cenários rápidos no painel para cada classe de defesa; sliders para TODO parâmetro ajustável. Não dê “verde” com teste que já passava antes do código.


### ENTREGA / CRITÉRIOS

Documente matriz de rastreabilidade requisito→arquivo→teste→evidência; diff auditado; commit por fase se adequado. Gere build:combat-lab e execute verify/testes afetados, informe falhas preexistentes separadas. Atualize docs e ABRIR_ARENAMON.html / TESTES_ARENAMON.html conforme AGENTS.md, verificando acesso em no máximo dois cliques. Não altere repositórios ou worktrees paralelos. Informe commits, branch, caminhos, como abrir, o que viu manualmente e o que não pôde verificar. Faça review independente antes de afirmar concluído.


### CHECKPOINTS OBRIGATÓRIOS

A) inventário de skills reais + estado Git; B) diagrama de transições e prioridades; C) testes RED; D) GREEN mecânico; E) câmera e feedback; F) cenários+QA; G) revisão, build, documentação e commit. Se uma pendência de aprovação bloquear comportamento padrão, implemente estrutura/testes sob toggle OFF e liste as decisões P1–P6 sem inventar respostas.


## 13. Referências e pontos de partida

Repositório: https://github.com/Ziaker/Arenamon

Controlador: https://github.com/Ziaker/Arenamon/blob/main/prototypes/combat-lab/src/sim/controller.js

Acerto direto: https://github.com/Ziaker/Arenamon/blob/main/prototypes/combat-lab/src/sim/combat.js

Acerto de entidade: https://github.com/Ziaker/Arenamon/blob/main/prototypes/combat-lab/src/sim/world.js

Calibração-base: https://github.com/Ziaker/Arenamon/blob/main/prototypes/combat-lab/src/sim/calibration-base.js

Câmera: https://github.com/Ziaker/Arenamon/blob/main/prototypes/combat-lab/src/view/cinematic-camera.js

Documento de câmera: https://github.com/Ziaker/Arenamon/blob/main/docs/CAMERA_CINEMATICA_ZZZ.md

Superpowers oficial: https://claude.com/plugins/superpowers

Referência Banyue: https://zenlessdb.com/character/banyue/skills

