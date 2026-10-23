# ARENAMON — Regras de criação, especificação e homologação de Moves

**Documento transversal de referência para TODO novo Move do Arenamon.**
**Atualizado em:** 20/10/2026 (ampliação metodológica com referência externa 5_MOVES_GENERICOS_PROMPT.md). **Repositório:** `Ziaker/Arenamon`. **Jogo principal:** `prototypes/combat-lab/`.

> **Escopo:** consolidar normas já aprovadas, um roteiro obrigatório de especificação, dependências do combate 3D, apresentação audiovisual, parâmetros e critérios de teste. **Não aprova novos golpes, números ou exceções; não é autorização de implementação.** Os registros de decisões continuam sendo a fonte normativa primária. Antes de usar, conferir o estado atual do GitHub e eventuais decisões posteriores.

## 1. Hierarquia de fontes e proibição de suposições

Fontes que devem ser lidas quando pertinentes:

- [`MOVES_DECISOES_RODADAS.md`](MOVES_DECISOES_RODADAS.md): decisões M1–M30, tipos/categorias, PL, Clash, Counter, controles, Estados, Status, Trick, IA e VFX; inclui decisões anteriores substituídas e pendências.
- [`MUSHROOM_MOVES_DECISOES.md`](MUSHROOM_MOVES_DECISOES.md): **diretriz universal posterior** de cobrança de recursos, Bullet Punch, Sand Wave, Emerging Stone e decisão final ES-D103; **não** recuperar pendência B/C de Emerging Stone como se continuasse aberta.
- [`MOVES_GENERICOS_CATALOGO.md`](MOVES_GENERICOS_CATALOGO.md): os cinco modelos genéricos Quick Attack, Swift, Harden, Spikes e Bounce, com descrições integrais e valores **experimentais**.
- **Referência adicional externa:** 5_MOVES_GENERICOS_PROMPT.md (cinco candidatos novos, metodologia de fases e testes; **não** fonte de aprovação automática); ver §§22–32.
- [`MAPA_COMBAT_LAB_DECISOES_RODADAS.md`](MAPA_COMBAT_LAB_DECISOES_RODADAS.md): decisões de arena, salto, rampas, plataformas, objetos, escudos, consumíveis, colisão 3D e física.
- [`PASSIVAS_DECISOES.md`](PASSIVAS_DECISOES.md): interações com modificadores, Sturdy, status, passivas, duração/cooldowns e hitstop.
- [`JANELAS_COMBATE_RESOLVE_HIT.md`](JANELAS_COMBATE_RESOLVE_HIT.md): janelas de impacto associadas à animação.
- [`INDICE_MODULOS.md`](INDICE_MODULOS.md), [`GUIA_COLABORACAO_AGENTES.md`](GUIA_COLABORACAO_AGENTES.md), [`VFX_SOLIDOS.md`](VFX_SOLIDOS.md) e [`MOVES_TEST_MATRIX.md`](MOVES_TEST_MATRIX.md).
- [`../prototypes/combat-lab/MOVIMENTOS.md`](../prototypes/combat-lab/MOVIMENTOS.md): contratos técnicos de registro, timeline, Charge, Status e entidades existentes.

**Ordem de precedência:** (1) decisão **expressa e posterior** do diretor sobre o mesmo tema; (2) regra aprovada **específica do Move** sem contradizer norma geral posterior; (3) regras aprovadas gerais; (4) contratos técnicos existentes; (5) propostas experimentais. **Código existente não é prova de aprovação**. Guardar histórico e marcar substituições, sem apagar as versões antigas.

**Quatro status independentes:** design proposto, design aprovado, implementado/testado e homologado pelo diretor. Registrar um catálogo não significa implementar nem homologar números. Se duas normas aprovadas colidirem, **identificar a incompatibilidade e seu impacto real**; não decidir silenciosamente por uma regra.

**Economia de perguntas:** herdar decisões já existentes; consultar o diretor só quando houver decisão material real. Jamais voltar a perguntar sobre o instante de cobrança de recursos a cada novo Move.

## 2. Ficha obrigatória: nenhum campo ausente

**TODO Move**, inclusive buffs sem dano, deve declarar:

| Grupo | Informação |
|---|---|
| Identidade | ID estável, nome, descrição jogável, propósito tático, personagens elegíveis, genérico/exclusivo, referências das decisões e status de aprovação. |
| Categoria | **Normal / Burst / Charge** sem ambiguidades. |
| Tipo | **Melee / Projectile / Status / Field / Trick**: um principal e secundário opcional. Tema elemental separado. |
| **Power Level** | PL1/PL2/PL3 fixo ou variável, **ou SEM PL**, elegibilidade ofensiva para Clash/Counter. |
| Entrada | Tecla/slot, pressionar, segurar, soltar, mira, confirmação, direção, lock-on, alvo válido. |
| Execução | Preparação, cast, carga, emissão, janela ativa, deslocamento, persistência, recuperação e fim por evento e tempo. |
| Recursos | Stamina, início de cobrança, cooldown, início de contagem, falha, reembolso, interrupção, aceleração se aplicável. |
| Dano | Valor, unidade, fórmula, fonte, atributo, instante de amostragem, número/cadência de hits, escudo/defesa. |
| **Knockback** | **Horizontal e vertical** com unidade, vetor, aplicação, limites e casos sem knockback explícitos. |
| Estado | Permissões e cancelamentos em chão/ar/guarda/Dodge/Tackle/Charge/stun/recovery/KO/hitstop. |
| Geometria | Raio de busca distinto do alcance físico, hitbox/hurtbox 3D, altura, colisor, paredes, tetos, plataformas, apoio e arena. |
| Entidades | Quantidade, proprietário, HP, duração, alvo, trajetória, reflexão, colisões, suporte, destruição e limpeza. |
| Apresentação | **VFX por fase/resultado, SFX por evento, animação, HUD, indicador de PL**, acessibilidade. |
| Integração | IA, sliders, parâmetros capturados, save/load/replay, seed, cenários, testes e homologação. |
| Governança | Aprovado/proposto/pendente **por detalhe**, referências M/R/ES-D/SW-D e conflitos materiais ainda em aberto. |

Declarar “**SEM PL**”, “**dano 0**”, “**knockback horizontal 0 m/s e vertical 0 m/s**” ou “**N/A**” quando realmente aplicável, em vez de esquecer campos. Diferenciar pontos de HP, porcentagem, segundos, metros, velocidade/impulso em m/s e aceleração em m/s². **PL não é multiplicador automático de dano.**

## 3. Categorias: Normal, Burst, Charge

Categorias oficiais aprovadas em M18.1–M18.3:

- **Normal:** cast/preparação segundo GDD e contrato **individual** do golpe. Pode ter marcador ajustável antes da soltura ou cast iniciado na pressão. **Segurar para mirar não significa Charge**; não atribuir PL progressivo por esse motivo.
- **Burst:** sem carga progressiva, início do efeito rápido/imediato após a confirmação. A trajetória, a hitbox, a duração de uma entidade e a recuperação podem **não** ser instantâneas; Burst **não** permite atravessar sólidos, acertar sem contato ou ignorar recuperação.
- **Charge:** acumula carga segurando, solta para executar; exige máximo/mínimo, progressão, efeito visual, custo, PL, mobilidade, interrupções, apoio, liberação e limite de espera no máximo. **4 s de carga são específicos de Reflect/Psyshock**; não são o máximo universal de todos os Charges.

**Categoria não é tipo técnico.** O antigo campo `category` de código com valores `physical/special/status` não equivale automaticamente às três categorias oficiais. Também não confundir o **elemento Pokémon** com tipo Melee/Projectile/Status/Field/Trick.

## 4. Tipos oficiais: cinco arquétipos

| Tipo | Requisitos |
|---|---|
| **Melee** | Acerto por contato físico com hitbox 3D e janela real, direção, dano, knockback, stun, defesa, invulnerabilidade e Tackle. |
| **Projectile** | Criação, dono, raio/forma/altura, trajetória, velocidade, homing, alcance, colisão com sólidos/corpos, reflexão, neutralização, expiração e eventos. **Lasers entram em Projectile**. |
| **Status** | Buff/debuff/HP/DOT: alvo, fonte, duração, renovação, stacks, atributos, imunidades, resistência, interrupção e término. **Status puro não tem PL**. |
| **Field** | Explosão, barreira, armadilha, objeto, zona: volume 3D, suporte, cadência, HP/duração, proprietário, destruição, interações físicas/PL e desaparecimento. |
| **Trick** | Dash/salto/esquiva especial: impulso, posição, altura, orientação, gravidade, colisão, controle, cancelamento, aterrissagem e recuperação. **Trick puro não tem PL**. |

Cada Move tem **tipo principal + tipo secundário opcional**. `Trick + Melee` (Bounce) ou `Status + ofensivo` pode possuir **PL quando a componente ofensiva for elegível** (M23.9). Não atribuir PL a um círculo luminoso de VFX. Não causar dano duplicado por ter dois tipos.

## 5. PL, Clash, Counter e exceções

1. **PL pertence à execução do Move**; regiões ofensivas/entidades herdam o nível quando aplicável (M18.4).
2. Charge que evolui PL segue: **PL1 abaixo de 50% de carga; PL2 entre 50% e menos de 100%; PL3 no máximo** (M19.1). Para Reflect/Psyshock de 4 s, os marcos são 2 s e 4 s, por contagem de passos; outros máximos usam a **mesma proporção**, não o mesmo tempo absoluto.
3. Move ofensivo sem progressão declara PL **fixo**; Status/Trick **puros** ficam **sem PL** (M20.7/M23.9).
4. Colisões ofensivas **elegíveis** de PL igual geram Clash. PL superior vence/neutraliza inferior em Counter, **sem bônus universal de dano** (M18.5–M18.7).
5. Tackle normal é **PL1 fixo** (M21.1). **Exceção:** Tackle destrói Reflect sem depender do PL da barreira (M19.9).
6. Projectile × Melee é normalmente elegível com contato real; Projectile × Field e Melee × Field dependem do Field. Fields podem coexistir e sua sobreposição **não inicia Clash por si** (M20).
7. Clash de áreas exige interseção de **regiões ofensivas ativas** (M22.2). Neutralização local/integral deve ser definida **por Move** (M22.3).
8. Counter Stagger **só** quando o ataque vencedor atinge o corpo do derrotado e é elegível; valor inicial 0,20 s configurável, não acumula/reinicia enquanto ativo (M20.8/M21).
9. Contato contínuo não causa disputas infinitas: novo Clash/Counter exige separação, emissão ou novo evento ofensivo (M21.9).
10. Resolução determinística de contatos: **ordem física de contato; empate pela criação da entidade**, sem prioridade arbitrária ao jogador ou IA (M21.2/M30.6).
11. Reflexão, proteção por barreira, neutralização de segmento, destruição e danos são contratos específicos. Reflect reflete PL igual/inferior, ataque superior o destrói e é neutralizado; Tackle destrói em qualquer PL; explosão pode destruí-lo mas o alvo coberto continua protegido pelas regras M30.6/M30.7. **Não extrapolar automaticamente para outros Fields.**

Fichas precisam especificar: área elegível para disputas, colisão com Tackle/Projectile/Field, igualdade/superioridade/inferioridade de PL, reflexão, propriedade após reflexão, resultado de Clash/Counter e stagger. Sem colisão ofensiva **não há Clash**, mesmo quando PLs são iguais.

## 6. Entrada, mira, alvo e confirmação

Distinguir **pressionar, segurar, ajustar marcador, confirmar, soltar, iniciar cast, disparar, contato e término**. São eventos diferentes que **podem ocorrer em instantes diferentes**.

- Aquisição do alvo: adversário mais próximo, alvo travado, direção livre, objeto, posição no solo? Identificar referência, distância (3D ou horizontal) e desempate determinístico.
- Separar **alcance de busca**, **distância máxima do Move**, **alcance físico real**, **raio da hitbox** e **raio de Field**. Um adversário estar dentro do raio de busca **não garante acerto**.
- Alvo perdido, troca de alvo, lock-on desativado, alvo no ar, linha de visão/parede, destino ocupado e falta de apoio requerem resultado explícito.
- Marcador deve refletir local válido e mostrar invalidez sem criar colisão fantasma ou ignorar oclusão.
- Bullet Punch **segura botão para posicionar o marcador, mas NÃO é Charge**.
- Emerging Stone ES-D103: **cast de 0,55 s inicia na pressão**, mira ajustável enquanto mantém, projétil só dispara quando **cast completo e botão solto**, **sem segundo cast**. A cobrança segue a norma universal abaixo.

## 7. Norma UNIVERSAL de cobrança e cooldown — posterior às regras antigas

**Decisão direta do diretor de 20/10/2026**, registrada em `MUSHROOM_MOVES_DECISOES.md` e preservada após ES-D103. **É obrigatória para TODOS os novos Moves. Não reapresentar como questão para o diretor.**

| Categoria | Quando cobrar stamina e iniciar cooldown |
|---|---|
| **Normal ou Burst, não Charge** | **Na etapa de cast/preparação, após confirmação do alvo/local e soltura do botão, antes do disparo/efeito.** Não cobrar antes de confirmação; não esperar pelo impacto. |
| **Charge** | **No instante em que a carga é ativada**, não esperar a soltura. |

**Não confundir começo do cast com o débito:** Emerging Stone pode estar em cast desde que o botão foi pressionado e **não cobra na pressão**, porque não é Charge; cobra após confirmação/soltura antes do disparo. A cronologia C foi aprovada expressamente em **ES-D103**, substituindo o antigo estado “B/C pendente”.

Regras adicionais:

- Valores são por Move. **1 stamina / 8 s** caracterizam Reflect/Psyshock; não são defaults universais.
- **Falha, interrupção, cancelamento, reembolso** são decisões individuais: não impor “sempre devolve” ou “nunca devolve”. Reflect/Psyshock possuem falhas reembolsáveis por falta de espaço; Bullet Punch/Sand Wave têm contratos próprios de custos conservados em certas interrupções.
- Histórico de Reflect/Psyshock pode descrever cooldown a partir da soltura/materialização (M2/M7/M16); essa redação é **anterior** à regra universal. **Auditar divergência no código**, preservar o registro histórico, seguir norma posterior onde aplicável sem inventar efeitos colaterais.
- **Charge Reflect/Psyshock:** em interrupção/cancelamento aprovado, stamina paga se mantém e a penalidade de recarga é inicialmente metade do cooldown (M7/M16); não aplicar nova multa em duplicidade.
- Aceleração de cooldown de Moves, quando permitida, exige **novo pressionamento físico**, não autorepeat, com custo proporcional no restante fracionário (M2/M5/M16).
- Progressão por consumível reduz **duração das recargas futuras de Moves**, não cooldown já iniciado (mapa R5.8/R6.13). Cooldown de **passivas** segue regras próprias.
- Testar segurar/soltar antes e após cast, falha antes/depois da cobrança, interrupção, stun, falta de stamina e duplo débito.

## 8. Cronologia, estados, cancelamentos e recovery

Cada Move define:

1. **Entrada:** permissão, stamina, cooldown, estado atual, apoio.
2. **Mira/seleção:** se existir; velocidade/rotação permitidas, marcador e cancelamento.
3. **Cast/startup/Charge:** cronologia, animação e vulnerabilidade.
4. **Ativação e disparo:** cobrança, captura de parâmetros, eventos/entidades.
5. **Active:** início e fim de cada janela ofensiva, pulsos, contato, efeitos; **VFX não prolonga hitbox**.
6. **Persistência:** projéteis/Fields/status podem permanecer sem prender o usuário em recuperação.
7. **Recovery:** movimento, defesa, Dodge, Tackle, Moves, giro e transição para neutro.
8. **Interrupção/KO/falha:** saldo de stamina/cooldown, instância cancelada e estado final válido.

Estados a auditar: idle, caminhada, corrida, sprint, defesa, guard stun, hit stun, Dodge, Tackle, Charge, recovery, salto, voo, pouso, lançamento, parede, hitstop, KO e fim da partida. **Não inventar i-frames, permissões aéreas ou imunidade a interrupção quando não há aprovação.**

**Referência específica Reflect/Psyshock:** carregam com redução 25% de movimento e giro; só iniciam com apoio válido, interrompem ao perdê-lo; defesa cancela; Dodge pode cancelar após 0,20 s; Tackle não começa durante Charge; há buffer de Move nos últimos 0,15 s do deslocamento de Dodge; recuperação 0,25 s permite movimento, defesa/Dodge, bloqueando novos Moves e Tackle (M15–M17/M26s/M27). **Não copiar essas durações para todo Move**. Prioridade no mesmo passo de Charge já definido: **defesa → X/C → soltar Move** (M30.9).

## 9. Dano, defesa, escudos e efeitos secundários

Declarar em cada Move:

- dano **fixo em HP** ou fórmula escalada, base, unidades e atributo usado;
- momento da leitura de Ataque (cast, disparo, acerto, reflexão) e se usa base/efetivo com Status;
- por contato/projétil/pulso/alvo/execução/tick; intervalo e quantidade máxima;
- defesa parcial/perfeita, i-frames, escudo, HP real, hit stun/guard stun, proteção contra combo, dano a objetos;
- dano **direto, periódico, refletido, ambiental**, fonte e responsável;
- interrupção e aplicação de Status, prevenindo múltiplos disparos do mesmo evento.

**Não aplicar Ataque em dobro.** Psyshock (M30.1) grava 0,2 × Ataque no disparo e recalcula se refletido; `world.applyHit` não deve multiplicá-lo de novo. A pendência P13 sobre Ataque **base versus efetivo com Status** permanece no documento original; não suprimir. **Sand Wave tem dano fixo** aprovado; não convertê-lo em dano escalado pelo Ataque do emissor.

**Escudo do mapa, se implementado:** intercepta **dano bruto antes da Defesa**, inclusive DOT/ambiental; excedente vai à mitigação; **não cancela knockback** (mapa R9–R11). A verificação deve ocorrer no código atual, pois design aprovado não implica integração concluída.

**Ataque por contato:** só causa dano se houver colisão ofensiva real, alvo elegível, janela ativa, defesa e i-frames válidos. Não causar dano pela mera aquisição do alvo, aparência de impacto, lock-on ou proximidade fora do colisor. Defesa perfeita não é simples dano parcialmente reduzido.

## 10. Knockback: horizontal e vertical obrigatórios

Toda ficha registra **H e V** com unidades explícitas, **inclusive zeros**, mais:

- vetor/direção: contato, frente, centro radial, normal de superfície ou direção capturada;
- grandeza: **velocidade/impulso (m/s)** vs distância (m) vs aceleração (m/s²);
- momento e forma da aplicação, distribuição e teto acumulado por alvo/execução;
- Defesa, Clash/Counter, bloqueio, invulnerabilidade, imunidades, dano a escudo;
- colisões com parede, plataforma, chão, teto, queda, aterrissagem, wall-splat/ground bounce;
- distinguir **knockback ofensivo** de **deslocamento de correção de penetração** ou gravidade.

Exemplo **sem knockback:** escrever `horizontal 0 m/s; vertical 0 m/s` e NÃO conceder invulnerabilidade. Exemplo **Harden** (catálogo): +30% Defesa e imunidade ao **knockback ofensivo** por 5 s, sem impedir dano, hit/guard stun, gravidade nem colisão sólida. **Empurrões contínuos de Fields** ainda dependem de decisão específica. Exemplo **Swift:** teto por execução/alvo, não por todos os alvos da partida.

## 11. Física 3D, salto, terreno, objetos e altura

Todo Move físico deve funcionar em **X/Z/Y**: distância horizontal sozinha não basta. Checklist:

- alvo em nível diferente; contato com teto, borda, rampa, plataforma e piso;
- apoio integral para objeto quando o contrato requer; perda/alteração de suporte;
- trajetória rápida com **colisão contínua** e sem atravessar paredes/volumes por “tunneling”;
- hitbox real, normal da superfície, reflexões, circulação ao redor de obstáculos;
- impulso horizontal no salto, queda por gravidade, pouso em plataforma, perda de apoio e recuperação;
- colisões de entidades com corpos, paredes, Fields e arena; spawn válido e busca de alternativa quando autorizada;
- destrutíveis, indestrutíveis, obstrução/linha de visão, suporte destruído, posição inicial ocupada;
- retorno à origem quando previsto, **sem segundo hitbox ofensivo**, sem teleporte através de sólido.

Regras do mapa aprovadas incluem **salto normal no Espaço, um salto normal até pousar, sem stamina, sem i-frames e sem ações ofensivas/defensivas no salto normal; impulso horizontal da decolagem preservado sem correção aérea**. Tricks podem ter exceções **específicas aprovadas**, não mudar o salto normal globalmente.

**Uso no ar (norma de 22/10/2026, v1.18.0):** todo Move novo precisa declarar `air` na definição — `cast` (o corpo segue em voo), `descend` (desce e age, como o C → X do vault) ou `none` — e tratar o salto, a queda de borda e o arco do vault. Lançado por golpe e preso na parede continuam sem comando. Cada Move deve ter teste no ar (`test/moves-air.test.mjs`) e entrar na varredura de travamentos (`test/moves-softlock.test.mjs`: ausência, ação, voo, invulnerabilidade, mira, carga e recuperação presos). Estados que escondem o lutador (ex.: Bullet Punch) precisam de **rede de segurança** que os encerre se a ação sumir.

**Bullet Punch não estabelece regra universal de desaparecimento físico:** nele há fase individual em que corpo/hitbox/hurtbox deixam de existir. **Invisibilidade visual, invulnerabilidade e ausência física são estados distintos**.

**Emerging Stone:** apoio integral e rochas empilhadas têm regras específicas, inclusive consequência da destruição de suporte (ES-D87, ES-D93–ES-D103). Não transferir essas decisões para Spikes sem análise/decisão própria. Algumas mecânicas do mapa ainda podem estar só documentadas; **verificar implementação real antes de alegar funcionamento**.

## 12. Projectile, Beam, Field, Status e Trick: cuidados especiais

**Projectile/Beam:** trajetória, velocidade, correção angular, homing finito, perda de alvo, quantidade, dono, execução, dano/PL capturado, colisão com parede/corpo/projétil/Reflect, troca de proprietário na reflexão, neutralização, duração e expiração. **Neutralizar um segmento de laser não encerra automaticamente sua fonte** (M20.6); homing cancelado por reflexão não pode voltar arbitrariamente. Psyshock possui redução sucessiva de dano e knockback limitado próprios, não universais.

**Field:** separar **objeto sólido**, **área ofensiva** e **VFX**. Volume e base 3D, apoio, duração/HP, cadência dos pulsos, neutralização local/integral, destruição, empilhamento, proprietário e remoção. Fields coexistentes não fazem Clash só por sobreposição.

**Status:** definir aplicação direta ou por contato, buff/debuff, tags, fonte, duração fixa/condicional/persistente, empilhamento/renovação/substituição, imunidade/resistência, DOT, remoção, flags e efeitos de bloqueio/interrupção. Defesa contra ataque que entrega status respeita defesa daquele ataque (M23.5); aplicação direta requer regras próprias. Status puro **sem PL**.

**Trick:** trajetória, velocidade, correção, direção, i-frames somente se aprovados, altura, salto/queda, obstáculos, impulso residual, colisão tangencial, recovery e permissão em estados especiais. Não resolver colisão movimentando corpo diretamente através de paredes sem aprovação.

## 13. Conflito entre cálculo multiplicativo e aditivo — preservar

**Incompatibilidade documental material:** M23.3 de `MOVES_DECISOES_RODADAS.md` registra **multiplicadores combinados multiplicativamente** para Status. As Rodadas 7–9 de `PASSIVAS_DECISOES.md` registram **acúmulo aditivo** de modificadores compatíveis entre passivas, Moves e consumíveis, com fórmula:

`valorFinal = base + base × somaPercentuais + somaAbsolutos`

O `src/sim/status.js` auditado historicamente multiplica os fatores. **Não declarar uma das fórmulas automaticamente revogada nem esconder diferença**. Quando um novo Move de Status interagir com passivas, levantar o caso numérico, identificar qual trecho tem aprovação posterior aplicável, solicitar reconciliação apenas se realmente necessária e criar teste do resultado antes de homologar. Não reescrever a história dos documentos.

Além disso: não aplicar cooldown de passivas como cooldown de Move; não transformar Poison Touch, Sturdy ou Magic Guard em efeitos novos simplesmente porque o golpe tem tema veneno ou escudo.

## 14. Audiovisual obrigatório: VFX, SFX, animações e HUD

Toda ficha inclui apresentação **completa** e ligada a eventos mecânicos reais:

| Fase/resultado | O que especificar |
|---|---|
| Pressionar/preparar/carga | Pose, antecipação, geometria/partículas, cor, brilho, duração e variação por PL. |
| Soltar/cast/disparo | Efeito de confirmação, som, posição do emissor, rastro inicial e HUD de ação. |
| Deslocamento/voo | Pós-imagens, trails, linhas, fragmentos, sincronização com trajetórias **reais**. |
| Acerto | VFX no ponto físico, hitstop previsto, impacto e som; nunca acerto visual em erro. |
| Defesa parcial/perfeita/i-frame | VFX/SFX próprios e legíveis; sem dano visual fantasma. |
| Clash/Counter/reflexão | Diferenciar neutralização, vencedor, PL e direção; não duplicar impactos. |
| Persistência | Contorno/objeto enquanto ativo; status/Fields legíveis sem poluir cena. |
| Falha/interrupção/expiração | Dissipação, recusa do marcador, cleanup e som específico, conforme necessidade. |

**Animações:** corpo, anticipação, cast, active, follow-through, recuperação, transição; o rig não substitui hitbox lógica. **Janelas ofensivas** devem corresponder à simulação, não ao FPS gráfico; verificar `JANELAS_COMBATE_RESOLVE_HIT.md` e intervalo `[startStep, endStep)` onde aplicável. Diferenciar markers apenas diagnósticos de eventos consumidos pelo motor.

**HUD:** ícone/nome, custo, cooldown, disponibilidade, carga/PL, recovery, bloqueios, marcador e feedback de falha. **SFX:** origem espacial, timbre, momento, duração, volume, sons diferentes para sucesso/erro/impacto; não copiar assets proprietários de Pokémon sem licença. **VFX de passiva** (toast e aros brancos) é sistema distinto; não reutilizar para todos os Moves por suposição.

**Acessibilidade:** noFlash, reduceMotion, contraste, legibilidade a 720p/1080p, sem esconder o personagem nem bloquear os controles. VFX não altera dano/física. Câmera e hitstop adicionais somente se previstos/autorizados.

## 15. Sliders, parâmetros capturados e determinismo

**Contrato M28.4:** modificar slider afeta **usos posteriores**; cada execução/objeto/projétil/Field preserva seus parâmetros capturados ao nascer/iniciar. Não fazer entity já criada ler configuração global modificável e mudar durante seu voo/vida útil.

Sliders pertinentes: stamina, cooldown, tempo, Charge, recuperação, dano, PL, knockback **H e V separados**, teto, alcance de busca, distância física, hitbox, altura, quantidade, homing, HP/duração, suporte, intensidade Status, intervalos DOT, partículas, rastros, emissividade, som. Cada slider precisa de **valor padrão, mínimo, máximo, passo, unidade, descrição e consequência real**; não criar controle decorativo.

**Simulação determinística** em passos (referência 120 Hz), seeds reproduzíveis, estado serializável com `structuredClone`, save/load/replay, sem aleatoriedade não controlada ou DOM dentro da sim. IA e jogador obedecem às mesmas regras; o botão de preview audiovisual não pode executar dano real.

## 16. IA e interface de uso

IA utiliza apenas Moves equipados, o mesmo controlador e custos do jogador. Avalia distância, ameaça, chance de contato, PL, defesa rival, energia, cobertura/oclusão, altura, apoio, obstáculos, risco da trajetória, cancelamento e destino. Em Charge, decide segurar e soltar; em Field/Trick considera localização, colisão e perda de suporte.

Interface do laboratório apresenta quatro slots remapeáveis e estado dos comandos. Diagnósticos precisam indicar razão de recusa (stamina, cooldown, stun, apoio, espaço, recuperação). Não inventar controle novo que conflite com defesa, Dodge ou salto; consultar binds atuais. IA não deve disparar efeitos diretamente ignorando `movePermission`.

## 17. Arquitetura e integração no Combat Lab

**Jogo principal:** `prototypes/combat-lab/`. `prototypes/game/` é legado.

| Responsabilidade | Fontes para auditar na versão atual |
|---|---|
| Registrar/validar/4 slots | `src/sim/moves.js` |
| Permissões, stamina, Charge, cancelamento | `src/sim/controller.js`, `src/sim/charge.js`, `src/sim/move-state.js` |
| Timeline e handlers | `src/sim/game.js`, `src/sim/move-effects.js` |
| Dano, mundo, física, beam, colisões | `src/sim/combat.js`, `src/sim/world.js`, `src/sim/physics.js`, `src/sim/geometry.js`, `src/sim/beam.js` |
| Status | `src/sim/status.js` |
| Definições de Moves existentes | `src/sim/moves/reflect.js`, `psyshock.js`, `standard.js` |
| IA | `src/sim/ai-moves.js` e demais módulos de IA |
| HUD e controles de parâmetros | `src/ui/moves-panel.js`, `moves-hud.js`, `tuning.js` |
| Visual, partículas e áudio | `src/view/world-view.js`, `src/view/vfx/`, `src/view/audio.js` |
| Cenários, replay, registro | `src/sim/scenarios-moves.js`, `game.js`, `recording.js`, `replay.js` |

**Atenção:** o schema histórico `moves.js` usa `category: physical/special/status`, não as três categorias e cinco tipos técnicos normativos; `timeline` suporta `spawn/status/hit/effect`, e o registry começa vazio até bootstrap explícito. **Verifique antes de evoluir schema**. Registrar um Move não significa equipá-lo; build verde não significa gameplay aprovado. Não criar vias de dano que contornam `world.applyHit` ou repetem multiplicação de Ataque. Não alterar a ordem de `Game.step` sem teste de regressão.

## 18. Cinco modelos genéricos — exemplos concretos, não defaults universais

**A fonte integral de descrição e VFX/SFX continua [MOVES_GENERICOS_CATALOGO.md](MOVES_GENERICOS_CATALOGO.md).** Não alterar seus números só por este guia.

| Move | Categoria | Tipo | PL | Knockback | Identidade |
|---|---|---|---|---|---|
| **Quick Attack** | **Burst** | Melee | **PL1** | **4 m/s H / 0 V** | Adversário mais próximo em **até 7 m**, investida física rápida e **retorno à origem**, sem acerto de volta. |
| **Swift** | **Burst** | Projectile | **PL1** | **0,3 m/s H por projétil**, teto **0,9 m/s por alvo/execução**, 0 V | **3 estrelas** com homing parcial e colisões individuais. |
| **Harden** | **Normal** | Status | **Sem PL** | **Nega knockback ofensivo recebido** | **+30% Defesa** por 5 s, sem cancelar dano, stun ou gravidade. |
| **Spikes** | **Normal** | Field | **PL1 na parte ofensiva** | **0 H / 0 V** | Armadilha física persistente, acionada por contato válido, sem empurrão. |
| **Bounce** | **Charge** | Trick + Melee | **PL1–PL3** | **3 m/s H + 6 m/s V** | Salto balístico com carga, ataque de descida, pouso físico. |

**VFX/SFX:** Quick Attack: pós-imagem, rastros de avanço/retorno, whooshes; Swift: estrelas branco-douradas, notas cristalinas; Harden: cristal branco persistente, som mineral; Spikes: rachaduras, espinhos e fragmentação; Bounce: anel de carga, rastro aéreo, onda no pouso e whoosh ascendente/descendente.

**Pendências reais dos cinco:** Quick Attack — retorno inacessível ou interrompido; Harden — empurrões contínuos de Fields; Spikes — perda de suporte e classificação frente a Sturdy; Bounce — permissão em estados aéreos especiais. Não transformar propostas numéricas em valores aprovados sem homologação.

**Movimentos de Mushroom são exemplos particulares, não normas universais:** Emerging Stone com ES-D103 e rochas/apoio; Bullet Punch com marcador **não Charge**, ausência física e investida PL2; Sand Wave com dano **fixo**, janela ativa e cegueira; Body Slam ainda exige especificação própria.

## 19. Verificações mínimas e cenários por novo Move

1. Registro, categoria/tipo/PL, slot e loadout; nenhuma alteração quando Move não equipado.
2. Pressionar/segurar/soltar, confirmação, mira, estado, cancelamento e recuperação.
3. Cobrança de recursos **no marco universal**, falha antes/depois, sem duplicidade, cooldown.
4. Charge: 50%/100%, duração máxima, PL, interrupção e custos; Normal/Burst sem PL progressivo indevido.
5. Alvo fora do raio, sem lock-on, posição ocupada, parede e tetos.
6. Acerto/erro, defesa parcial, perfeita, i-frames e proteção de combo.
7. Clash/Counter elegíveis, empate, prioridade física, Counter Stagger, neutralização.
8. Knockback H/V, zero quando especificado, paredes, plataformas, ar, limites.
9. Projectiles/Fields: dono, spawn, reflexão, destruição, hit único/pulsos e expiração.
10. Rampas, plataformas em alturas diferentes, bordas, perda de apoio, salto, gravidade, tunneling.
11. Status, DOT, imunidades, interação com passivas e escudo, conflito aditivo/multiplicativo explicitado.
12. Hitstop, pausa, KO, fim da partida, efeito que persiste e cleanup.
13. Slider alterado após spawn **não muda instância existente** (M28.4).
14. IA usando mesmas permissões e previsões que jogador; replay/seed/save/load.
15. VFX/SFX corretos para acerto/erro, legibilidade e performance.
16. **Regressão:** nenhuma mudança de física/combat quando Move não está equipado.

Executar quando aplicável: `npm run build:combat-lab`, `npm run test:combat-lab:unit`, `npm run test:combat-lab:browser`, `npm run typecheck` e `npm run verify`. Não marcar teste não executado como aprovado. Teste em navegador e homologação do diretor **não** são substituídos por compilação.

## 20. Modelo copiável obrigatório para novo Move

**Completar este modelo conciso com o suplemento obrigatório da seção 31, que acrescenta timeline, coreografia, janelas, estados, storyboard e oráculos verificáveis.**

```markdown
# MOVE [nome] — [id-estavel]
Status: [proposto / aprovado / implementado / testado / homologado]
Personagens e slots: [...]
Fontes/IDs aprovados: [...]
Descrição jogável e propósito tático: [...]

## Identidade e classificação
Categoria: [Normal | Burst | Charge]
Tipo principal / secundário: [...]
Power Level: [Sem PL | PL1 | PL2 | PL3 | progressivo]
Elegibilidade Clash/Counter e exceções: [...]

## Entrada e execução
Pressionar, segurar, confirmar, soltar: [...]
Origem e alvo, lock-on, busca e alcance físico: [...]
Estados permitidos/proibidos: [...]
Fases, tempos, condições e timeline de efeitos: [...]
Recovery, cancelamentos, interrupções e retorno ao controle: [...]

## Recursos
Stamina: [...] pontos
Cooldown: [...] segundos
Cobrança: [regra universal conforme categoria]
Falha/reembolso/penalidade: [...]
Parâmetros capturados por uso: [...]

## Dano e propriedades
Dano nominal: [...] HP [por acerto / execução / pulso / segundo]
Fórmula e instante do atributo: [...]
Defesa parcial/perfeita, escudos, i-frames, stun: [...]
Limite/cadência de hits e PL Clash/Counter: [...]
Knockback horizontal: [...] m/s
Knockback vertical: [...] m/s
Vetor/mitigação/limite/impacto em parede/plataforma: [...]

## Geometria e cenário
Colisor, hitbox, altura, trajetória, apoio, limites: [...]
Rampas/plataformas/obstáculos/tetos/objetos: [...]
Perda de suporte, alvo e destino inválido: [...]
Entidades persistentes, HP/duração/limpeza: [...]

## Visual, áudio e interface
Animações de startup, active, recovery: [...]
VFX preparação, deslocamento, acerto, bloqueio, erro, expiração: [...]
SFX de cada evento: [...]
HUD, marcador, indicadores PL, acessibilidade: [...]

## Implementação e homologação
IA, sliders (padrão/min/max/passo/unidade): [...]
Seeds, replay e cenários/testes: [...]
Detalhes aprovados / experimentais / pendentes: [...]
Critérios de conclusão: [...]
```

## 21. Governança e critério de conclusão

- **Documentado:** ficha integral com categoria, tipo, PL, H/V de knockback, stamina/cooldown, dano, cronologia, física, VFX/SFX, IA, testes e estados de aprovação.
- **Implementado:** funcional pelo comando normal no Combat Lab com motor, estados, colisores e recursos reais, não apenas menu/VFX.
- **Testado:** passou testes unitários, navegador, cenários e paridade do jogo sem Move; reportar falhas e bloqueios.
- **Homologado:** aprovação visual e de gameplay **expressa pelo diretor**. Não inventar aprovação de números ou exceções.
- **Regra de qualidade:** não criar questionários abstratos intermináveis antes de existir habilidade concreta; **herdar tudo que já está aprovado e perguntar apenas sobre conflitos materiais**.
- **Regra de manutenção:** este arquivo é **guia transversal**; o histórico de decisões de cada Move continua nos catálogos próprios. Alteração universal nova deve apontar fonte e data, preservando o histórico.

> A criação de Moves deve produzir ações **coerentes, previsíveis e fisicamente corretas** em combate tridimensional. O diretor não precisa solicitar individualmente cada interação que decorre das regras já aprovadas; a equipe tampouco pode atribuir a ele novas exceções não decididas.


---

## 22. Como utilizar a referência adicional de cinco Moves (sem homologá-los)

**Origem:** arquivo externo fornecido pelo diretor, **5_MOVES_GENERICOS_PROMPT.md**, identificado internamente como proposta de 21/10/2026. A data impressa e o nível de detalhamento **não equivalem a aprovação**, implementação ou publicação no repositório.

Essa referência apresenta cinco **candidatos adicionais**: Lunge (Burst/Melee/PL1), Guard Break (Charge/Melee/PL1–3), Feint (Burst/Trick/sem PL), Riposte (Normal/Status + Melee/PL1 no componente ofensivo) e Second Wind (Normal/Status/sem PL). **Não substituem** os cinco Moves já catalogados (Quick Attack, Swift, Harden, Spikes e Bounce), nem devem ser adicionados automaticamente a um roster.

**Adotar como metodologia**, e não como valores universais:
1. Coreografia por fases com referência verificável de quadros, poses, smear, stretch, follow-through, recuperação e transição ao idle.
2. Timeline explícita de entrada, confirmação, cast, charge, ativação, janela ativa, persistência e recovery.
3. Janelas de hitbox, invulnerabilidade e cancelamento expressas por **intervalos semiabertos em passos inteiros da simulação**.
4. Separação entre efeito físico, animação, VFX, SFX, HUD e estado de combate.
5. Matriz de interações e testes específicos por Move, incluindo ações bem-sucedidas e falhas.
6. Inventário identificável de pendências materiais, com rastreabilidade por regra aprovada.
7. Comparação rigorosa entre **resultado esperado, observado e realmente testado**.

**Não transformar em regra global:** todas as ações ofensivas terem 41 quadros; toda antecipação possuir i-frames; todo ataque ter smear de 5 quadros, stretch de 4 quadros ou pulinho; todos os novos Moves serem canceláveis por Feint; os números de guard stun e riposte; custos, dano, cooldown, alcance e knockback exemplificados; ou os bônus experimentais de Second Wind.

### 22.1 Auditoria preventiva de inconsistências na referência recebida

| Exemplo da referência | Inconsistência, risco ou lacuna | Exigência deste manual |
|---|---|---|
| Lunge comprimido de 41 quadros para 0,60 s, mas janela g9–g13 convertida em steps 36–52 | Intervalo 36–52 equivale a 0,300–0,433 s da ação de 72 passos; **não** à transformação proporcional de g9–g13 | Usar matemática de remapeamento entre timelines, não quadros antigos multiplicados por 4 |
| Percentuais de fases de Lunge | 18+14+11+3+38+11+25 = **120%**, não 100% | Validar soma e sobreposição antes de aprovar a tabela |
| Invulnerabilidade automática em antecipação de Lunge | Uma pose não concede invulnerabilidade | Exigir decisão específica, com estado e janela; não criar i-frames por inferência |
| Guard Break contra defesa perfeita | A proposta apresenta alternativas ainda abertas | Não resolver contradição escolhendo a alternativa preferida da IA |
| Feint usada fora de janela | Sugere sua animação simultânea a outra ação corporal que continua ativa | Não permitir estados incompatíveis paralelos; definir rejeição, buffer ou cancelamento validado |
| Riposte com invulnerabilidade condicional | Não é possível conceder invulnerabilidade retroativa após verificar um evento já concluído | Definir prioridade e transição no próprio evento de contato |
| Move com duração 0,22 s a 120 Hz | 0,22 × 120 = 26,4 passos, não inteiro | Declarar quantização e duração simulada resultante |
| “✅” na tabela de regressão | Legenda da referência significa **teste previsto**, não teste executado | Nunca apresentar plano como aprovação real |
| “+40%/s” em Second Wind | Pode significar taxa base ×1,4 ou +40% da capacidade máxima por segundo | Escrever fórmula explícita, base, unidades e acúmulos |

A referência histórica deve permanecer intacta. Estes apontamentos são **auditoria técnica sobre como usá-la**; não registram novas decisões de gameplay.

## 23. Método v2: nove entregáveis obrigatórios por novo Move

| Etapa | Entregável | Condição de aceite |
|---|---|---|
| A. Rastreabilidade | Tabela regra → fonte → ID → status (aprovado, herdado, técnico, proposto, pendente) | Nenhuma decisão histórica substituída aparece como vigente |
| B. Identidade | Função tática, diferença de Moves existentes, personagens, categoria, tipo, PL | O novo Move não é uma simples renomeação |
| C. Entrada e estados | Máquina de estados, alvo, confirmação, custos, cooldown, cancelamento e falhas | Todo caminho termina em um estado controlável e correto |
| D. Coreografia | Referência de animação e tabela por fases/poses, timelines e transições | A animação não é confundida com a mecânica |
| E. Contrato físico | Dano, knockback H/V, volume 3D, status, Clash/Counter e resultado de cada contato | Não há interação relevante descrita apenas como “óbvia” |
| F. Cenário e IA | Solo/ar, rampas, paredes, plataformas, teto, suporte, destino, controle da IA | Nenhuma trajetória atravessa sólidos sem regra |
| G. Apresentação | Storyboard VFX, SFX, HUD e animação por evento real | Acerto, defesa, falha e expiração são distinguíveis |
| H. Validação | Casos de teste com estado inicial, entrada, oráculo e evidência | Testes previstos não são relatados como executados |
| I. Governança | Versão da ficha, valores experimentais, pendências e aprovação do diretor | Nenhum valor experimental se torna oficial por estar escrito |

O fluxo é **reutilizar o que foi aprovado → especificar o novo Move concreto → auditar → solicitar só decisões novas indispensáveis → implementar apenas com autorização → testar → homologar separadamente**. Não gerar dezenas de questionários abstratos sobre a engine.

## 24. Coreografia vinculada a uma máquina de estados verificável

Toda ficha deve conter **dois mapas separados**:

**A. Linha temporal de controle e simulação**, contendo:
- solicitar comando e validar slot/estado/cooldown/stamina;
- aquisição e confirmação de alvo/local/direção;
- início do cast e início do débito segundo a **regra universal** (Normal/Burst pós-confirmar/soltar; Charge no início da carga);
- carga, se houver, com PL corrente e máximo;
- startup, janela ofensiva ou aplicação de status, follow-through;
- recovery, retorno ao controle, cooldown independente, encerramento da instância;
- perda de alvo, falta de apoio, interrupção, KO, hitstop, falha, refund e limpeza;
- estado anterior, evento, condições, estado seguinte e identidade única da execução.

**B. Storyboard audiovisual**, contendo:
- pose de início, antecipação, compressão/energia, smear/stretch quando apropriado, gesto de contato, impacto, seguimento, recuperação, transição ao idle;
- quadros/segundos de origem e de destino;
- movimento real do colisor e movimento somente visual;
- som, partículas e HUD vinculados a eventos físicos, não a uma função gráfica que roda todo frame;
- diferenças de êxito, bloqueio, erro, interrupção, expiração e disparo de Counter.

**Tabela de estados obrigatória:**

| Fase | Evento disparador | Pré-condições | Estado antes → depois | Custo/cooldown | Físico | Resultado se interrompido |
|---|---|---|---|---|---|---|
| Solicitação | input | personagem válido | estado atual → preparação/negação | **sem cobrança antecipada** para Normal/Burst | sem hitbox | informar motivo |
| Confirmação | release/confirm | alvo/local válido | preparação → cast | Normal/Burst cobra agora, no cast | ainda sem contato até janela | política individual |
| Charge | pressionar e segurar | Charge permitido | neutro → carregando | cobra quando Charge é ativado | efeito de carga não é dano | penalidade aprovada |
| Startup | marco temporal | ativo | cast → startup | sem segundo débito | hitbox inativa salvo especificação | cancelar conforme contrato |
| Contato/efeito | marco + colisão/condição | elegibilidade validada | startup → active | — | dano, status, entidade ou Trick | hit/miss/bloqueio |
| Recovery | fim ativo | ação remanescente | active → recovery | cooldown continua | sem nova hitbox salvo multi-hit | estados de cancelamento definidos |
| Encerramento | fase concluída/KO | limpezas | recovery → neutral/KO | — | limpar referências; manter apenas entidades de vida válida | não deixar estado órfão |

**Essa tabela orienta**, mas não impõe uma máquina idêntica a todos os Moves. Distinguir relógios: duração da animação, duração da ação, Charge, duração de Projectile/Field, status ativo, recarga e hitstop. **Nenhum fim de animação deve encerrar automaticamente uma entidade que ainda possui lifetime válido.**

## 25. Cálculo obrigatório de frames → segundos → passos

Três medidas **não são equivalentes**:
1. **Frame de autoria:** um quadro/pose da fonte (por exemplo, g0–g40).
2. **Tempo da apresentação:** duração real do clipe/GLB ou de sua execução reescalada.
3. **Passo do motor:** contador inteiro de simulação (referência 120 Hz; conferir configuração atual).

Antes da conversão, a ficha declara a **convenção de duração**: se g0–g40 são 41 células de quadro com limite exclusivo g41, duração 41/30 ≈ 1,3667 s; se são 41 amostras com 40 intervalos, a duração entre g0 e g40 é 40/30 ≈ 1,3333 s. **Escolher conforme metadados da fonte, não conforme conveniência.**

Adotar janelas **[startStep, endStep)** (fonte: JANELAS_COMBATE_RESOLVE_HIT.md): limite inicial incluído, limite final excluído; 0 ≤ start < end ≤ totalSteps. Não escrever notações equivocadas como dois colchetes de abertura com dois fechamentos incompatíveis.

### 25.1 Exemplo de conversão que deve aparecer em futuras fichas

Fonte: **41 células** g0 a g40, com **g41 exclusivo**. Ação de destino: **0,60 s = 72 passos de 1/120 s**.

Hitbox proposta nos quadros de origem **[g9, g13)**:

- Início = round(9 / 41 × 72) = **16**.
- Fim exclusivo = round(13 / 41 × 72) = **23**.
- Janela efetiva proporcional = **[16, 23)**.
- Tempo efetivo ≈ 0,1333 a 0,1917 s.

**Não usar [36,52)**, pois essa faixa inicia em 0,30 s; ela pertence a outra interpretação temporal.

Se for usada convenção de **40 intervalos**, resultados podem ser diferentes e devem ser recalculados explicitamente. Não mesclar os dois critérios.

### 25.2 Invariantes verificáveis

- Total de steps da ação deve ser inteiro, com política de arredondamento exposta; por exemplo 0,22 s ×120 = 26,4 steps, então a duração real simulada dependerá da quantização escolhida.
- Fases **exclusivas e sequenciais** devem cobrir a timeline prevista sem sobreposições/hiatos não intencionais. Se percentuais expressam uma partição, devem somar **100%**.
- Fases audiovisuais e mecânicas podem se sobrepor **em trilhas distintas**, declaradamente; isso não justifica soma 120% numa partição supostamente exclusiva.
- Marcos instantâneos (impact hint) são **eventos pontuais**, não janelas de colisão com duração.
- Hitbox, invulnerabilidade, cancelamento, recovery e movimento físico são **trilhas mecânicas diferentes**.
- Alterar slider de duração muda **usos futuros**, não deforma uma execução já ativa (M28.4).
- Testes obrigatórios de borda: passo imediatamente anterior ao início, primeiro passo ativo, último passo ativo e primeiro passo excluído.
- A referência de smear 5f/stretch 4f não preserva automaticamente essas durações **em segundos** quando a animação total é comprimida; decidir se preserva ordem, proporção ou tempo absoluto.

## 26. Esqueleto de animação: Tackle v26 é referência específica, não padrão imposto a todo Move

A referência verificável **docs/tackle/VER_TACKLE.html** descreve o **Tackle aprovado do Vigoroth v26**, com **41 frames a 30 FPS, 5 quadros de smear e 4 de stretch**. Servirá como molde **opcional e técnico** para novos ataques físicos, com adaptação à anatomia e ao tipo de ação:

| Fase de referência | Quadros fonte | Leitura visual | Decisão mecânica que o novo Move deve explicitar |
|---|---|---|---|
| Antecipação | g0–g3 | peso, intenção e leitura | vulnerável? cancelável? |
| Smear/impulso | g4–g8 | aceleração exagerada | início do deslocamento físico? |
| Stretch/contato | g9–g12 | extensão e impacto | hitbox ativa em quais **steps**? |
| Continuação | g13 | follow-through | pode haver segundo hit? |
| Recuperação 1 | g14–g17 | absorção de peso/impulso | quando começa recovery mecânico? |
| Recuperação 2 | g18–g26 | movimento residual contínuo | janela de comandos? |
| Pulinho de reposicionamento | g27–g30 | equilíbrio **específico do Tackle** | não inventar deslocamento ou imunidade |
| Convergência | g31–g40 | blend final ao idle | retomada do estado correto |

**Não copiar automaticamente** o pulinho, a garra do Vigoroth, braço líder, pico de 0,47 m/frame, números de smear/stretch nem propriedades mecânicas entre personagens. Um Move de Status pode usar respiração, postura e aura sem smear; um Trick sem ataque não recebe automaticamente hitbox; um contra-ataque possui **ramos distintos de sucesso e falha**.

Para qualquer animação remapeada, registrar **quadro origem, tempo original, tempo efetivo do novo Move, intervalo em passos e posição/velocidade real do corpo**. Testar pés e suporte no chão, arcos, deformação, timing, mudança de estado e retorno ao idle sem pop visual.

**Regra essencial:** não inferir i-frames, superarmadura ou cancelabilidade de uma pose, de um “smear” ou de uma instrução estética.

## 27. Trilhas independentes: hitbox, defesa, cancelamento e física

Fichas técnicas devem conter tabela separada de:

| Trilha | Intervalo em steps / condição | Consequência |
|---|---|---|
| Hitbox ofensiva | [start,end) e volume 3D | permite verificar contato, mas **não garante hit** |
| Invulnerabilidade | [start,end) **se aprovada**; senão NENHUMA | filtra impacto elegível sem criar imunidade não pedida |
| Resistência a interrupção | estado/condição explícita | não é o mesmo que invulnerabilidade ou redução de dano |
| Guarda/contra-ataque | janela + gatilho válido | resultado defensivo decidido no **evento atual**, sem retroatividade |
| Cancelamento | janela + ação destino elegível | transição atômica do estado anterior ao novo |
| Recovery | início e fim mecânicos | quais comandos ficam bloqueados ou aceitos |
| Deslocamento | curva física/impulso + colisão | corpo real anda/salta/empurra, não apenas o rig |
| Persistência externa | lifetime e owner próprios | Field/projétil/buff não desaparece ao terminar recovery do lançador |

Se uma Feint é solicitada fora da janela, não é aceitável executar uma segunda ação incompatível em paralelo deixando a anterior rodando. O novo Move deve **definir** recusa, buffer ou penalidade quando aplicável, usando regras existentes antes de inventar solução.

Se Riposte protege contra um golpe, a resolução da proteção deve ocorrer no **evento ofensivo elegível** e na janela correspondente. Não adicionar frames passados de invulnerabilidade depois do acerto.

Se Guard Break encontra defesa perfeita, defender sem guarda, i-frames ou Harden, a ficha apresenta resultados por caso. **GM-P04–GM-P07 são pendências da referência, não decisões aprovadas.**

## 28. Matriz de interações concretas em vez de exceções implícitas

Cada Move deve definir uma linha para **cada caso materialmente diferente**:

| Contexto de teste | Entrada/contato | Resultado que deve estar documentado |
|---|---|---|
| Alvo neutro | contato válido | dano/knockback e stun efetivos |
| Guarda comum | hit sobre ângulo coberto | mitigação, guard stun e empurrão conforme regra |
| Defesa perfeita | hit na janela perfeita | zero dano ou exceção **aprovada**, efeito de guarda e hitstop |
| i-frames | contato durante invulnerabilidade | sem hit aplicado, evento de falha correto |
| Ataque concorrente | hitbox × hitbox com PL elegível | Clash/Counter, normalização, stagger e neutralização |
| Obstáculo | trajeto cruza parede/sólido | bloqueio ou correção tangencial física, nunca atravessamento implícito |
| Desnível/ar | separação real em Y | contato somente se volumes verticais se cruzarem |
| Knockback imune | Hardening/outro efeito válido | cancelar somente as consequências especificamente protegidas |
| Cancelamento/interrupt | evento no passo de troca | custo e cooldown **uma única vez**, estado final lícito |
| Multi-hit | múltiplos contatos do mesmo Move | hit cap, contador por alvo/janela, resposta ao bloqueio |
| Status/escudo/passiva | efeito derivado de dano | distinguir dano direto, DOT, shield, proteção e modificadores |
| KO/hitstop | ação interrompida ou efeitos persistentes | tempos congelados e limpeza conforme contratos oficiais |

Não assumir que “PL1 versus PL1 = empate” quando não houver **regiões ofensivas elegíveis em contato real**. Counter não acrescenta bônus universal de dano. A existência de um nome “Grab” no material de referência não prova que um sistema de agarrão esteja implementado.

**Avaliar combos e cancels em ambas as direções**, inclusive comando simultâneo, release do Charge, ataque que recebe stun e tentativa de Feint; nunca permitir que um mesmo contato gere duas aplicações indevidas.

## 29. Storyboard obrigatório de VFX, SFX, animação e HUD por evento

Não basta escrever “partículas e som”. O Move deve incluir uma tabela audiovisual completa:

| Evento mecânico | VFX com geometria e posição | SFX e timing | HUD/telemetria | Fim da apresentação |
|---|---|---|---|---|
| Seleção/mira | marcador, alcance, válido/inválido, profundidade 3D | feedback discreto opcional | alvo/local elegível | limpar ao cancelar |
| Cast/Charge | pose, antecipação, emissividade, progressão visual de PL | tensão/carga | progresso, stamina, PL | interromper sem impacto falso |
| Disparo/ação | trilhas na trajetória física, emissor correto, pós-imagem quando adequada | whoosh/disparo | custo, cooldown, ação | sem emissão duplicada |
| Contato real | impacto no ponto físico, sparkles e fragmentos | hit real | dano, stagger e fonte | vida útil curta |
| Defesa/i-frames | feedback distinto de acerto | bloqueio/perfect/miss | evitar “dano fantasma” | limpar corretamente |
| Clash/Counter/reflexão | efeitos distintos para neutralização e direção | SFX de Clash/Counter | vencedor/PL/owner | não duplicar impacto |
| Status/Field ativo | aura leve, objeto sólido real, duração/expiração | loop somente se apropriado | efeitos ativos | destruir quando expirar |
| Cancelamento/falha | dissipação/abortamento, sem flash de hit | som de erro/recusa | razão explícita | remover partículas/objetos órfãos |

Incluir por Move: cor, espessura, material, opacidade, brilho, duração, partículas máximas, escala por personagem, rastro, posição e visibilidade frente/atrás do modelo; timbre, frequência/pitch, volume e duração do som; sincronização com simulação e hitstop; câmera sem cortes involuntários; opções de acessibilidade e qualidade.

**VFX não é hitbox.** A partícula não pode causar dano, prolongar a janela ativa nem se tornar fonte de verdade do acerto. A assinatura audiovisual **das passivas** é separada dos Moves.

## 30. Prova quantitativa, testes e matriz de rastreabilidade

Um teste deve possuir: **ID, fonte normativa, setup, input/tick, resultado esperado mensurável, observado, evidência e estado**.

| Teste de exemplo | Preparação | Oráculo esperado | Estado da planilha |
|---|---|---|---|
| T-COST-01 | Move Burst custando 0,75 stamina | nenhum débito antes da confirmação/soltura; exatamente 0,75 debitado no cast, uma vez | **PLANEJADO** |
| T-WINDOW-01 | 41 células fonte, 0,60 s, 120 Hz, origem [g9,g13) | [16,23) na convenção declarada; sem hit fora dos limites | **PLANEJADO** |
| T-GUARD-01 | atacante golpeia alvo invulnerável | nenhum dano nem knockback; evento correto | **PLANEJADO** |
| T-SNAPSHOT-01 | alterar slider depois de criar projétil | instância existente mantém valores capturados; próxima usa valores novos | **PLANEJADO** |
| T-REPLAY-01 | mesma seed, estado e comandos | resultados e IDs determinísticos | **PLANEJADO** |

**Estados permitidos:** especificado/planejado; implementado sem teste; executado passou; executado falhou; bloqueado por decisão; N/A fundamentado; homologado pelo diretor. **Nenhum ✅ pode significar simultaneamente “previsto” e “executado”.**

Revisar obrigatoriamente:
- totais de fases e janelas, arredondamento/quantização e velocidades × deslocamento;
- stamina/cooldown Normal/Burst versus Charge, inclusive interrupção e falta de recurso;
- defesa parcial/perfeita, i-frames, hitstop, PL e Clash/Counter elegíveis;
- knockback H/V, caps, contatos em parede, degraus, rampas, tetos, plataformas e queda;
- animação e VFX sob hit/miss/blocked/cancelled/KO, som sem duplicar;
- IA, save/load, parâmetros capturados M28.4, replay/seed;
- execução com Move não equipado para preservar paridade;
- cenário de browser real, não somente teste de definição de arquivo.

**Homologação visual e de gameplay pelo diretor é diferente de testes automatizados.**

## 31. Suplemento obrigatório ao modelo de ficha da seção 20

A ficha resumida da seção 20 **permanece válida**, mas deve ser completada com os campos abaixo:

~~~markdown
## A. Proveniência
Fonte/IDs de decisões | regra | aprovada / herdada / proposta / pendente
Referência de vídeo/animação | link/versão | parâmetros confirmados
Autorização de implementação | SIM/NÃO

## B. Timeline, frames e passos
Origem | número de quadros | FPS | duração real | convenção N/N-1
Duração do Move | simulação Hz | total de steps | política de quantização
Fase | frame origem [início,fim) | segundo efetivo | steps [início,fim) | pose | deslocamento físico
Antecipação / smear / stretch / contato / follow-through / recovery / idle
Partição de fases = 100%? sobreposições deliberadas entre trilhas?

## C. Trilhas de gameplay
Hitbox ativa [startStep,endStep): ...
Invulnerabilidade autorizada [startStep,endStep) OU NENHUMA: ...
Superarmadura/interrupção: ...
Cancelamento [steps], condição e destinos permitidos: ...
Deslocamento real (steps, distância, velocidade, colisões): ...
Guard stun/hit stun/knockback H e V: ...

## D. Transições e eventos
Estado anterior → evento → estado seguinte → consumo/cooldown → consequências
Eventos de sucesso/falha/defesa/perfect/i-frames/Clash/Counter/KO
Entrada inválida, buffer, refund, cancelamento, release e cleanup

## E. VFX/SFX por evento
Marco | efeito 3D | posição | duração | som | HUD | desligamento
Cast/Charge | Movimento | Contato | Bloqueio | Erro | Expiração

## F. Testes e evidências
ID | fonte | estado inicial/entrada | resultado esperado | observado | status | evidência
Testes de conversão de frames, soma de fases e limites: ...
Regressão e determinismo, sliders e save/load: ...

## G. Pendências materiais
ID | caso concreto | regra consultada | opções sem escolha | impacto
~~~

Cada campo numérico deve informar **unidade, base, valor, intervalo de slider, status da aprovação e instante em que o motor o captura**. O template não determina números; organiza decisões verificáveis.

## 32. Checklist final adicional para autores, revisores e IAs

- [ ] O arquivo de referência foi lido como **proposta** e não como aprovação de suas cinco habilidades.
- [ ] Conferi registros de decisões mais recentes e as substituições, especialmente ES-D103.
- [ ] Categoria, tipo principal/secundário, PL/sem PL, dano e knockback H/V estão expressos.
- [ ] A linha temporal física tem fases com início/fim e estado válidos.
- [ ] FPS de animação, duração original e steps de simulação não foram confundidos.
- [ ] Todas as janelas usam [início,fim) coerente e o cálculo foi demonstrado.
- [ ] Fases exclusivas somam 100% da duração; sobreposições são trilhas declaradas.
- [ ] I-frames, resistências e cancelamentos não foram criados a partir de aparência da animação.
- [ ] Nenhum personagem executa duas ações incompatíveis ao mesmo tempo.
- [ ] A cobrança universal foi preservada e não repeti perguntas sobre seu momento.
- [ ] Dano e Status têm fórmula sem ambiguidade de porcentagem e sem aplicar Ataque duas vezes.
- [ ] PL/Clash/Counter dependem de regiões ofensivas elegíveis e contato real.
- [ ] Rampas, plataformas, parede, altura, teto, queda e colisores foram previstos.
- [ ] VFX/SFX/HUD têm storyboard por evento, incluindo miss e interrupção.
- [ ] Sliders alteram usos futuros, preservando instâncias em andamento.
- [ ] IA, replay, seed, save/load, diagnóstico e cleanup estão especificados.
- [ ] Testes planejados estão separados de testes executados e aprovados.
- [ ] Apenas pendências materiais não decididas foram apresentadas ao diretor.
- [ ] Nenhum registro de proposta foi promovido a homologação sem autorização.

**Critério de qualidade:** o resultado deve fazer a coreografia observada, a física tridimensional, as janelas da simulação, os estados, os custos e os efeitos audiovisuais descreverem **exatamente o mesmo Move**. Mais páginas sem essa correspondência não representam melhor especificação.
