# ARENAMON — Regras de criação, especificação e homologação de Moves

**Documento transversal de referência para TODO novo Move do Arenamon.**
**Atualizado em:** 20/10/2026. **Repositório:** `Ziaker/Arenamon`. **Jogo principal:** `prototypes/combat-lab/`.

> **Escopo:** consolidar normas já aprovadas, um roteiro obrigatório de especificação, dependências do combate 3D, apresentação audiovisual, parâmetros e critérios de teste. **Não aprova novos golpes, números ou exceções; não é autorização de implementação.** Os registros de decisões continuam sendo a fonte normativa primária. Antes de usar, conferir o estado atual do GitHub e eventuais decisões posteriores.

## 1. Hierarquia de fontes e proibição de suposições

Fontes que devem ser lidas quando pertinentes:

- [`MOVES_DECISOES_RODADAS.md`](MOVES_DECISOES_RODADAS.md): decisões M1–M30, tipos/categorias, PL, Clash, Counter, controles, Estados, Status, Trick, IA e VFX; inclui decisões anteriores substituídas e pendências.
- [`MUSHROOM_MOVES_DECISOES.md`](MUSHROOM_MOVES_DECISOES.md): **diretriz universal posterior** de cobrança de recursos, Bullet Punch, Sand Wave, Emerging Stone e decisão final ES-D103; **não** recuperar pendência B/C de Emerging Stone como se continuasse aberta.
- [`MOVES_GENERICOS_CATALOGO.md`](MOVES_GENERICOS_CATALOGO.md): os cinco modelos genéricos Quick Attack, Swift, Harden, Spikes e Bounce, com descrições integrais e valores **experimentais**.
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
