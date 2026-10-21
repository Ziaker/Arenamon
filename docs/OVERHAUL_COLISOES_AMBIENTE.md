# Arenamon — Overhaul da Física de Colisões e Interações com o Ambiente

> **STATUS: AUDITORIA E PLANO DE MIGRAÇÃO + PRIMEIRA CORREÇÃO EXPERIMENTAL. OVERHAUL COMPLETO NÃO IMPLEMENTADO.**
>
> **Origem:** o responsável relatou colisões com objetos e interações no cenário frequentemente bugadas, causando sensação de rigidez/inconsistência.
>
> **Data:** 21/10/2026. **Código auditado:** `main` @ `68eda6c6c938aa21167cafa761f04be57d4224cc`. **Branch desta entrega:** `fix/collision-overhaul-stage1`.
>
> **Não confundir:** o documento `docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md` já contém **152 decisões aprovadas** sobre a futura arena, que são normas de projeto; isso **não comprova implementação** das plataformas, itens e obstáculos persistentes na `main`. O que está nesta branch é apenas a correção **COL-P0** para contatos XZ com sólidos já existentes.

## 1. Diagnóstico auditável

### 1.1. Inventário da implementação atual

| Módulo | O que faz hoje | Lacuna/restrição |
| --- | --- | --- |
| `src/sim/physics.js` | 120 Hz; movimentos, rebote na arena, subpassos para corpos, separação AABB XZ entre lutadores | Usa um limiar de altura `vaultCollisionHeight` para ignorar contatos; não resolve colisão de dois volumes corporais 3D completos nem apoio em cima de objetos/plataformas |
| `src/sim/world.js` | Projéteis, barreiras, paredes de Moves, áreas/feixes, resposta de colisão e `applyHit` | Contatos de lutadores com volumes sólidos projetados no plano XZ; cada objeto é processado sequencialmente, sem manifold global; em penetração interna, correção anterior podia ser insuficiente |
| `src/sim/geometry.js` | Rotação de caixas, SAT entre retângulos, `sweepBox`/segmento contra barreira | O sweep existente é específico de feixes/Reflect e não cobre todo movimento de personagens/projéteis |
| `src/sim/game.js` | Ordem: `updateFighter` → `stepPhysics` → `stepWorld`; hitstop, eventos, saves e replay | Sistemas têm noções de contato em momentos diferentes; projétil é avançado após a física completa do lutador no tick |
| `src/sim/ai.js` e `spatial.js` | Evitar encurralamento e orientar aproximação no limite quadrado da arena | Não significa navegação com volumes persistentes/plataformas integrados |
| `src/view/world-view.js` | Representações 3D de objetos do `world`, VFX, barreiras, projéteis | Renderização não é autoridade física; modelo gráfico não pode criar colisor “implícito” sem componente de simulação |
| `src/sim/scenarios.js` e `test/` | Cenários e testes de impactos, Moves, projéteis e determinismo | Não cobrem matriz extensiva de contatos complexos de cenário 3D planejado |

### 1.2. Falhas/risco com evidência de código

**COL-A — Correção de penetração interna inadequada (falha geométrica concreta):** antes da branch atual, `world.collideFighter` usa `closestOnShape` e, quando `inside`, posiciona `f.position = c.point + normal * r`. Para caixa com centro dentro, `c.point` pode ser a **própria posição do lutador**, e deslocar apenas `r` não garante saída. Em círculo, a normal calculada a partir do ponto de contorno pode apontar **para o centro** quando o lutador está dentro da forma. Isso admite correções repetidas, deslocamentos surpreendentes ou penetração persistente. **Correção experimental COL-P0 já codificada nesta branch**, com suíte nova ainda não executada.

**COL-B — Contatos dependentes da ordem de objetos:** o laço percorre uma entidade por vez. Um objeto pode deslocar o lutador para dentro de outro, sem uma resolução conjunta de todos os contatos do passo. O comportamento em quinas, corredores estreitos e sobreposições simultâneas precisa de uma solução de múltiplas restrições com ordem estável e diagnóstico de geometria impossível.

**COL-C — Contactos entre lutadores com checagem de altura aproximada:** a física de dois lutadores usa quadrados XZ e ignora a colisão se a altura vertical de um deles ultrapassa um limiar global. Volumes 3D parcialmente sobrepostos não ficam representados corretamente por esse atalho. A regra aprovada da **R7.11** exige volumes reais tridimensionais.

**COL-D — Projéteis com subamostragem:** `stepProjectile` avança usando distância máxima por subpasso e checa vários obstáculos por sobreposição na posição amostrada. Isso reduz, mas não elimina de maneira formal, *tunneling* em geometria fina, alta velocidade e alvos em movimento. Também é necessário decidir contatos por **tempo de impacto mais cedo**, não somente por ordem da lista de objetos. O `sweepBox` existente deve ser reaproveitado quando apropriado, não descartado.

**COL-E — Dois estágios temporais:** o jogo atual resolve a física integral dos lutadores antes de avançar o mundo dos projéteis. Colisões entre objetos em movimento não são simultâneas por padrão. Isso é uma fonte de inconsistência potencial que exige provas de cenário/replay antes de ser reordenado.

**COL-F — Altura e suporte:** o código usa `flight.y`/`vaultHeight` como referência vertical e pouso em `y <= 0` na física atual. Não existe contrato central geral de suporte/contato no topo, laterais e fundo das futuras plataformas sólidas. É necessário criar o componente de suporte antes de adicionar Ground Snap, Step Assist ou Ledge Grab.

**COL-G — Mundo de Moves ≠ cenário persistente aprovado:** `world` conhece entidades de Moves; não é uma implementação completa das 4 destructíveis + 4 indestrutíveis, 2 plataformas, arena circular, itens/respawn previstos no mapa. A falta dessa camada impede estabelecer interação física consistente com esses objetos. Não considerar o documento do mapa como teste de funcionalidade.

**COL-H — Destruição durante o mesmo passo:** entidades marcadas `dead` podem ainda existir na coleção até `stepWorld` limpá-las. `world.collideFighter` não ignorava explicitamente esse estado, gerando risco de contato com objeto já destruído. **Corrigido experimentalmente nesta branch** para o contato de lutadores; investigar outros sistemas afetados.

**Limite da auditoria:** os itens acima são fundamentados no código; não foram reproduzidos em sessão visual no PC do responsável nem classificados por frequência no jogo real. Outros bugs podem existir e devem ser identificados por cenários reproduzíveis.

## 2. Contrato técnico desejado da nova camada de colisões

### 2.1. Uma fonte de verdade para geometria física

Todo elemento colidível deve declarar explicitamente:

- `colliderId` estável e identidade da entidade; tipo `fighter`, `staticSolid`, `dynamicSolid`, `projectile`, `hurtbox`, `hitbox`, `trigger` ou `support` conforme uso;
- forma física + transform com unidades e coordenadas do mundo, incluindo limites verticais: caixa orientada, cilindro, esfera, cápsula ou composição quando necessários; **forma visual não gera colisor implicitamente**;
- modo sólido/trigger, dono, equipes/permissões, camadas de bloqueio, se está ativo, e material/resposta física quando a regra permitir;
- flags ou perfil de interação de Moves conforme contrato já aprovado: bloquear, refletir, atravessar, quebrar, empurrar, explodir, dar dano, ou apenas coletar; **não inferir propriedades por aparência**;
- estado serializável para save/load/replay, sem referências gráficas ou `Three.js` dentro da simulação.

Os tipos concretos e extensões numéricas são proposta de arquitetura, não parâmetros homologados. Introduzir apenas quando o módulo correspondente for implementado.

### 2.2. Etapas da simulação por tick

1. Ler comandos e mudanças de estado permitidas, preservando bloqueios e prioridades.
2. Atualizar velocidades/forças e movimentação cinemática prevista para a janela física.
3. Construir **pares candidatos** (broadphase determinístico; evitar todos contra todos em mapas maiores).
4. Calcular **contato contínuo**, quando necessário, ao longo do deslocamento (`time of impact`), ou manifold de contato para objetos sobrepostos; usar formas tridimensionais.
5. Resolver contatos sólidos: não penetração; velocidade normal/tangencial; recuperação de apoio; rebote ou parada conforme perfil e estado.
6. Resolver eventos de gameplay: impacto ambiental, hit, choque, defesa, destruição, colisão de projétil, drops e coleta; registrar autoria, alvo e prioridade.
7. Atualizar suporte e estados (`grounded`, `airborne`, pouso, knockback, recuperação), spawn/despawn, cooldown e timers.
8. Emitir um fluxo único de eventos e telemetria para animação, IA, HUD e VFX, sem que a apresentação altere física.

**Importante:** esta sequência é o contrato-alvo conceitual; não reordenar `Game.step` antes de testes de paridade e migração dos subsistemas. O jogo usa 120 Hz fixos e uma regra de pausa/hitstop: manter.

### 2.3. Contato deve identificar causa e consequência

Uma estrutura `Contact` candidata:

`{aId, bId, point3, normal3, penetrationDepth, relativeVelocity, contactTime, surfaceType, phase, flags}`

- Uma **normal de contato** deve ser geometricamente significativa e estável.
- Uma correção de penetração serve para **retirar sobreposição**, não para adicionar locomoção lateral não solicitada.
- Em uma quina, usar resolução conjunta das superfícies — não alternar correções gigantescas entre dois obstáculos.
- Em contato múltiplo impossível (geometrias geradas sobrepostas, personagem preso num volume sem espaço livre), **reportar erro e aplicar política de recuperação explicitamente aprovada**; não inventar teleporte silencioso.
- Distinguir contato de apoio (`support`), contato lateral (`blocking`), impacto ofensivo, gatilho de coleta, dano ambiental e colisão de projétil.

## 3. Matriz mínima de interações

| A × B | Resultado principal | Preservar |
| --- | --- | --- |
| Lutador × parede/obstáculo estático | Parar componente penetrante; conservar tangente válida | Sem movimento espontâneo; colisão na forma real |
| Lutador × outro lutador | Separação física 3D e eventos de golpe independentes | PL, tackle, i-frames, defesa, stagger, knockback |
| Lutador × plataforma (topo) | Aterrissar e manter apoio quando a trajetória permite | R7.14; física de suporte e gravidade |
| Lutador × plataforma (lateral/fundo) | Bloquear volume; não “subir” automaticamente | Plataforma totalmente sólida (R7.6) |
| Lutador arremessado × destrutível | Dano ao objeto proporcional à velocidade relativa horizontal | R3.7/R7.15 e resistência aprovada |
| Lutador arremessado × indestrutível | Rebote de acordo com ângulo/intensidade | R3.12; Wall-Splat/Tech só conforme regras |
| Tackle/Move × obstáculo/Reflect | Atingir/quebrar/refletir segundo contrato específico | M20–M30 e `world.applyHit` |
| Projétil × sólido | Primeiro impacto real; bloquear/ricochetear/quebrar | Reflect e perfis dos Moves |
| Projétil × borda circular | Ricochetear por padrão | R11.7; não aplicar na arena quadrada legado sem migração |
| Explosão/área/feixe × cobertura | Interseção/oclusão geométrica 3D | Nunca atingir através de cobertura indevida |
| Consumível × lutador | Coleta automática por distância esférica 3D | R11.5; autorização por qualquer estado conforme regra |
| Drop × plataforma/solo | Cair fisicamente até superfície válida | R11.6; colisão de suporte |
| Objeto destruído × cenário | Remove colisor no passo válido; gera efeitos e drops | Sem colisões “fantasma” |
| Respawn × lutadores/objetos | Prévia translúcida e validação da posição | R3.13, R6.6 e R11.9 |
| IA × objetos/plataformas | Navegação física com obstáculos e alturas válidas | Mesmas regras para IA e jogador |

**Regra transversal:** o sistema de colisão não define dano de Moves nem altera o GDD; fornece eventos e geometria para as regras existentes.

## 4. Entrega COL-P0 — Correção geométrica inicial nesta branch

**Arquivos alterados/criados:**
- `src/sim/solid-contact.js` (novo): núcleo puro `solidContact`, contato entre um disco no XZ e caixa rotacionada/círculo, devolvendo normal, profundidade mínima e informação de interior. Não usa valores de game state.
- `src/sim/world.js`: `collideFighter` usa este contato para separar corretamente o corpo das paredes/barreiras, preserva eliminação da velocidade normal e ignora sólidos já marcados como `dead`.
- `test/collision-solid.test.mjs`: testes propostos para centro dentro de caixas/círculos, caixa girada, quina, tangência, deslizamento tangencial, barreira de proprietário e objeto morto.
- `package.json`: inclui a suíte nas execuções de testes do Combat Lab e no teste geral.

**Esta etapa NÃO faz:**
- CCD/swept AABB ou TOI de personagens, projéteis e obstáculos móveis;
- resoluções de múltiplos sólidos com manifold;
- sistema de apoio em plataformas, arena circular, obstáculos persistentes, destruição/respawn e coleta de consumíveis;
- atualização do motor de IA para navegação em obstáculos 3D;
- migração de todas as decisões de mapa para código.

**Validação neste ambiente:** patch remoto publicado, testes **adicionados mas não executados**, build offline **não executada**, browser **não testado**; nenhum merge na `main`. O checkout Windows oficial não foi acessado.

## 5. Plano de migração incremental, sem regressões silenciosas

### COL-P1 — Verificação e contratos de suporte do legado (obrigatório antes do merge da P0)

- Executar `node prototypes/combat-lab/test/collision-solid.test.mjs`.
- Rodar `npm run test:combat-lab:unit`, `npm run build:combat-lab`, `npm run test:combat-lab:browser` e pelo menos os cenários de Reflect/Psyshock com barreiras sólidas.
- Registrar casos: parede reta, parede girada, centro interno, duas barreiras adjacentes, quina côncava, objeto destruído no subpasso, knockback junto ao obstáculo.
- Confirmar que a correção geométrica não altera comportamento de dano/PL/recovery aprovado nem deixa o personagem preso em superfícies.
- Se falhar, ajustar a P0 na própria branch; **não fazer merge** com CI quebrado.

### COL-P2 — Manifold estável para contatos simultâneos

- Introduzir coleção de contatos por subpasso e resolução iterativa por restrições, com limite e tolerância verificáveis.
- Não corrigir uma penetração criando outra sem detectá-la; lidar com duas paredes e personagem no canto.
- Separar `normal velocity` de `tangential velocity` e de impulso recebido, respeitando colisões e estados.
- Remover comportamentos dependentes da ordem de inserção de sólidos (salvo desempate ID documentado).
- Adicionar cenários de corredor estreito, canto, interseção e formação impossível, instrumentados na UI.

### COL-P3 — CCD / Time of Impact para alvos rápidos

- Varredura real de corpos contra sólidos durante cada passo e primeiro contato por `TOI`.
- Integrar testes de alta velocidade, ângulo rasante, obstáculos finos, movimento oblíquo, múltiplos contatos no mesmo passo.
- Migrar projéteis mantendo contratos de Reflect, Laser/Beam, Psyshock e ordem de prioridades específica dos Moves.
- Desacoplar colisão física, dano e efeitos; não criar acertos duplicados após resolver uma superfície.

### COL-P4 — Colisão tridimensional e suporte

- Definir volume 3D do corpo/hitbox e altura real dos objetos. Unificar posição física e altura sem confundir `vaultHeight`/`flight.y` com apoio.
- Implementar classificação piso, parede, teto, topo e fundo de plataforma, normal de contato e superfície de apoio corrente.
- Permitir pouso sobre plataforma e contato sob plataforma **somente segundo trajetória 3D legítima**.
- Introduzir testes de escadas/rampas, quinas, degraus, salto sobre objetos e inimigo, queda ao sair de borda e destruição do suporte.
- Ground Snap/Step Assist propostos em [PR #99](https://github.com/Ziaker/Arenamon/pull/99) **ainda precisam de aprovação**; não ativá-los automaticamente.
- Ledge Grab, Directional Influence e Wall Tech (issues #95–#97) também não são parte autorizada deste overhaul.

### COL-P5 — Objetos persistentes do mapa e regras já aprovadas

- Construir tipos configuráveis e serializáveis para **4 obstáculos destrutíveis e 4 indestrutíveis iniciais**, com quantidades configuráveis, materiais/resistências e geometria aprovada (blocos, cilindros, pilares).
- Integrar 2 plataformas sólidas, geração de posições válida com margem de spawn/rotas, arena circular de raio 50 m e limites físicos.
- Aplicar HP inicial 30 por objeto destrutível, dano ambiental por impulso horizontal relativo, destruição/efeitos, drop e respawn em outra posição válida após 15–30 s.
- Posições de respawn não podem criar sobreposição válida por “teleporte”; mostrar prévia translúcida antes da ativação do colisor (R11.9).
- Itens de drop acima do solo caem até uma superfície válida (R11.6); coleta por distância esférica real 3D (R11.5).
- Projéteis ricocheteiam ao atingir a borda circular (R11.7).
- Propriedades/escudos/status já aprovados preservados; atribuição de derrota ambiental à última fonte de dano *recente* (R11.2), mas a janela exata ainda está pendente, portanto **não inventar duração**.

### COL-P6 — Ferramentas de depuração e testes de aceitação

- Overlay **real**, não decorativo, de caixas/cápsulas/cilindros, normales, pares de contato, linha de varredura, TOI, suporte, altura, velocidade e último evento.
- Registro de `objectId`, `colliderId`, normal, profundidade, número de subpassos, impulso residual e razão de bloqueio.
- Cenários de um clique no portal: corredor estreito, dois objetos sobrepostos, ataque contra barreira, projétil entre dois obstáculos, quina e plataforma, drop e respawn, aterrissagem aérea, salto sobre rival.
- Estado seed/config/replay salvo para reproduzir cada falha, inclusive em 30/60/120/144 FPS de renderização, mantendo sim a 120 Hz.
- Critérios automáticos de aceitação a definir: **nenhum NaN**, limites de penetração, ausência de velocidade lateral espontânea, conservação tangencial, eventos únicos, não atravessar objetos sólidos e replay bitwise-determinístico quando aplicável.
- Testes browser em HTML do jogo oficial aberto por `JOGAR_ARENAMON.html`, sem CMD exigido do responsável; benchmark antes/depois de CPU/frametime e alertas quando número de contatos crescer.
- **Não marcar a fase como aprovada** sem execução dos testes e avaliação jogável em modelos reais.

## 6. Ordem de correção e prioridades

| Prioridade | Defeito a eliminar | Como verificar |
| --- | --- | --- |
| **P0** | Expulsão errada de sólido; contato com objeto destruído | Testes unitários específicos + testes de Reflect |
| **P0** | Personagem atravessa caixa fina/quina em alta velocidade | CCD e cenários com velocidade acima do normal |
| **P0** | Penetração/jitter com dois objetos simultâneos | Manifold/solver e repetição determinística |
| **P1** | Piso/plataforma não segura o personagem; queda/pouso inválidos | Contato 3D com suporte e gravidade |
| **P1** | Hits/projéteis/áreas não respeitam altura/cobertura | Matriz 3D e testes de Moves |
| **P1** | Objetos destrutíveis/drops/respawn/consumíveis inconsistentes | Ciclo de vida e eventos únicos |
| **P1** | IA não navega corretamente entre obstáculos | Cenários com jogador e IA |
| **P2** | Microtravadas visuais, foot sliding e feedback da colisão | Teste humano e instrumentação de estados |

Prioridade aqui descreve severidade de engenharia proposta, **não uma confirmação de ocorrência na versão local do responsável**.

## 7. Invariantes de segurança funcional

1. Contatos só podem responder a volumes físicos existentes e ativos, nunca a VFX, partículas ou meshes decorativas.
2. **Sem deslocamento forçado ao lado contrário** por uma correção que não derive de penetração real; sem snap de posição através de obstáculos.
3. Ataques/cancelamentos/PL, hitstop, stamina, knockback, Wall-Splat e Tech Recovery preservam seu contrato; use `applyHit` para danos de entidades.
4. Movimentos bloqueados por recovery, stun, KO, raiz/imobilização e ação não ficam magicamente liberados por colisão/apoio.
5. Hitbox/hurtbox real respeita altura, tamanho, orientação e trajetória; contato de dois corpos só existe quando volumes 3D se sobrepõem.
6. A ordem de contatos/efeitos é determinística, inclusive com respawn de novos objetos e remoção do objeto morto no tick.
7. Sem editar `prototypes/game/` legado nem o Animation Studio.
8. Controle visível via laboratório para cada nova tolerância, categoria de sólido e ativação experimental; sempre opção de voltar ao baseline.
9. Respeitar `AGENTS.md` e `docs/GUIA_COLABORACAO_AGENTES.md`, usar branches, não editar `main` diretamente, não sobrescrever checkout do outro agente.

## 8. Resultado e limite desta entrega

**Disponibilizado nesta branch de revisão:** correção COL-P0 para contato disco×sólido XZ, testes de regressão ainda não executados, e este documento de auditoria/roteiro de implementação.

**Não concluído:** overhaul completo do sistema de colisões, migração do mapa persistente, nova física 3D, testes no navegador, build e sincronização do checkout oficial.

**Regra de avanço:** antes de integrar na `main`, validar COL-P0 efetivamente. As etapas P2–P6 exigem implementação própria e testes; nenhuma é considerada pronta pelo simples fato de estar documentada.
