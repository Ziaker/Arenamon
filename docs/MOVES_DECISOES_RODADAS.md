# Arenamon — Registro de decisões do sistema de Moves (Reflect, Psyshock, Power Level)

> **Documento oficial de planejamento. Não é autorização para implementar.**
>
> **Escopo:** Reflect, Psyshock, Power Level, Clash/Counter, categorias e tipos de Moves, controles, física, IA, interface e validação — Rodadas 1–29.
> **Fora do escopo:** o mapa da arena (arena circular, obstáculos, plataformas, salto, consumíveis) está em [MAPA_COMBAT_LAB_DECISOES_RODADAS.md](MAPA_COMBAT_LAB_DECISOES_RODADAS.md). Os dois registros são independentes e não devem ser misturados.
> **Repositório:** https://github.com/Ziaker/Arenamon · **Laboratório:** `prototypes/combat-lab/`
> **Base de código no momento da criação:** `origin/main` @ `cf6da6e` (2026-10-16).

## 0. Estados deste registro (mantidos separados)

| Dimensão | Estado |
|---|---|
| Design de Reflect e Psyshock | **Aprovado** pelo diretor (conteúdo das seções 3–7) |
| Implementação de Reflect, Psyshock e demais Moves | **NÃO autorizada** |
| Integridade documental — Rodadas 1–12 | **Não certificada** (reconstrução; aguarda confronto com a transcrição original) |
| Integridade documental — Rodadas 13–29 | **Declarada** pelo Registro-Mestre como respostas explícitas (H) ou aprovação global (I); **não verificada** contra a conversa original por quem publicou este arquivo |
| Registro completo e auditado | **NÃO declarado.** Nenhuma lacuna foi preenchida por suposição |

## 1. Procedência e regras de leitura

**Origem do conteúdo:** consolidação “ARENAMON — Registro-Mestre de Decisões, Ambiguidades e Pendências”, produzida no ChatGPT, de 16/10/2026, entregue pelo diretor ao Claude Code na mesma data. O texto foi transposto sem alterar o conteúdo das decisões; foram acrescentados apenas os identificadores `M<rodada>.<item>`, as notas de procedência e as seções marcadas como “Notas do arquivista”.

**Etiquetas de procedência** (conforme **declaradas pelo Registro-Mestre**, não verificadas de forma independente por quem publicou este arquivo):

| Etiqueta | Significado declarado |
|---|---|
| **H** — Histórico explícito | A resposta original do diretor está disponível no histórico usado na consolidação |
| **R** — Reconstrução | Decisão recuperada de uma síntese anterior; conteúdo conhecido, redação original possivelmente indisponível |
| **I** — Interpretação | Conclusão inferida de uma aprovação global, sem seleção individual inequívoca |

**Procedência declarada por período:** Rodadas 1–12 predominantemente **R**; 13–17 **H**; 18 original substituída (revisada **H**); 19–25 **H**; 26 original não aprovada (substituta **H**); 27–28 **H** (exceto a confirmação posterior da questão 28.1); 29 **I** (aprovação global sem respostas numeradas).

O link público da conversa foi fornecido, mas seu conteúdo integral não foi recuperado de forma verificável.

**Identificadores `M<rodada>.<item>`:** imutáveis. O número do item segue a **ordem das listas deste registro**. Nas Rodadas 1–12 isso corresponde à numeração da **consolidação**, **não** necessariamente à numeração das perguntas originais (que não está disponível). Nas Rodadas 13–29 as letras (A, B, C, D) são as alternativas escolhidas conforme o Registro-Mestre; a correspondência com a numeração das perguntas originais também não foi verificada. Rodadas substituídas mantêm seus IDs e estado; nunca reutilizar um ID.

**Regras de manutenção:**
1. Novas decisões entram em novas rodadas (M30.x…), sem apagar as anteriores.
2. Quando uma decisão substituir outra, marcar a anterior como substituída, apontar a nova e registrar o que mudou (ver seção 10).
3. Valores experimentais são **provisórios** e não podem ser apresentados como aprovados.
4. Nenhum agente deve: preencher ambiguidades silenciosamente; declarar valores provisórios como aprovados; modificar decisões já tomadas sem autorização; reintroduzir versões substituídas; recriar sistemas existentes sem auditar o repositório; considerar testes técnicos suficientes para substituir a aprovação de jogabilidade do diretor.

## 2. Objetivo do sistema

O Arenamon é um jogo de combate tridimensional com personagens capazes de executar quatro Moves equipados.

A implementação inicial terá dois Moves definidos:

| Slot | Move | Categoria | Tipo principal |
|---|---|---|---|
| A | Reflect | Charge | Field |
| S | Psyshock | Charge | Projectile |
| D | Reservado | Indefinido | Indefinido |
| Z | Reservado | Indefinido | Indefinido |

As teclas são configuráveis. Reflect produz uma barreira geométrica refletora com dimensões e duração dependentes da carga. Psyshock reúne pedras telecinéticas disparadas simultaneamente, com quantidade dependente da carga. Os Moves usam o sistema de stamina, cooldown, execução, interrupções e Power Level. A implementação inicial deve preservar os sistemas já existentes de combate, física, Tackle, Dodge, defesa, hit stun, guard stun e proteção contra combos.

### Contrato obrigatório da implementação (M28.4)

> Alterações de sliders valem apenas para **usos posteriores** dos Moves. **Entidades já existentes (barreiras, pedras, projéteis, áreas) mantêm os parâmetros capturados na criação**, respeitando as propriedades fixas aprovadas.

A futura implementação deve usar uma estratégia explícita de captura dos parâmetros aplicáveis a cada execução ou entidade. Isso vale independentemente de quando (ou se) o estado global de configuração do laboratório for refatorado. Ver “Notas do arquivista” (seção 15).

---

## 3. Histórico cronológico de decisões

### Rodada 1 — Funcionamento fundamental
**Procedência declarada: R**

- **M1.1** O personagem dispõe de quatro Moves equipáveis, com teclas padrão A, S, D e Z.
- **M1.2** Reflect aparece diante do personagem e permanece fixo no mundo depois de criado.
- **M1.3** A reflexão utiliza geometria especular: direção incidente e normal da superfície determinam a direção refletida.
- **M1.4** Psyshock é carregado mantendo o botão pressionado e disparado ao soltá-lo.
- **M1.5** Psyshock utiliza de três a oito pedras.
- **M1.6** O carregamento máximo é de quatro segundos.
- **M1.7** Todas as pedras de uma execução são disparadas simultaneamente.

Ambiguidades:
- *Resolvida posteriormente:* mapeamento de Reflect e Psyshock (M17.1); formação progressiva das pedras (M11.1–M11.2).
- *Parcialmente aberta:* referencial geométrico exato do lançamento (posição da mão, eixo de orientação) depende do modelo/rig e da implementação visual.
- *Parcialmente aberta:* não há contrato completo para animações interrompidas durante o disparo.
- *Procedência:* conferir a formulação original da primeira rodada para assegurar que não existiam qualificações adicionais.

### Rodada 2 — Recursos, controles e movimentação
**Procedência declarada: R**

- **M2.1** A defesa utiliza Shift, evitando conflito com a tecla D.
- **M2.2** Moves possuem custo de stamina e cooldown.
- **M2.3** É permitido gastar stamina para antecipar o fim de um cooldown.
- **M2.4** Reflect inicia seu cooldown quando a barreira é materializada.
- **M2.5** Psyshock inicia seu cooldown quando as pedras são disparadas.
- **M2.6** Ambos permitem movimentação com redução de 25% na velocidade durante a carga.
- **M2.7** Projéteis refletidos transferem sua propriedade ao personagem que realizou a reflexão.

Ambiguidades:
- *Resolvidas:* gasto para acelerar cooldown (M5.8–M5.9; refinado em M16.8); cooldown de interrupções (M7.3–M7.4); penalidade de movimento termina ao soltar o botão (M16.5).
- *Aberta:* conferir se as regras originais de movimentação pressupunham restrição adicional na transição do carregamento para a recuperação.
- *Aberta:* o momento exato em que o novo proprietário passa a valer em todas as rotinas de atribuição de dano, assistência e telemetria deve ser formalizado na implementação.

### Rodada 3 — Geometria e comportamento espacial
**Procedência declarada: R**

- **M3.1** Reflect começa maior do que o personagem e cresce durante o carregamento.
- **M3.2** O Reflect possui preview retangular diante do personagem.
- **M3.3** A face frontal reflete projéteis.
- **M3.4** A face traseira permite a passagem de projéteis.
- **M3.5** Reflect interage com projéteis físicos e lasers direcionais.
- **M3.6** Explosões não são refletidas.
- **M3.7** As pedras de Psyshock aparecem próximas ao personagem, com posições, tamanhos e alturas variadas.

Decisões posteriormente modificadas: trajetória reta do Psyshock → homing limitado (M10.2); bordas do Reflect passam a refletir por normais próprias (M13.3); geometria tridimensional fina aceita globalmente (M29.2).

Ambiguidades:
- *Importante:* a passagem pela face traseira deve valer para o percurso completo do projétil, inclusive se ele entra pelo verso e depois alcança a região frontal.
- *Importante:* impactos exatamente nas quinas entre frente e bordas precisam de prioridade geométrica determinística.
- *Aberta:* uso de dimensões visuais ou do colisor como referência de escala da barreira (ver P2).
- *Aberta:* relação entre tamanhos de pedras e propriedades físicas — os tamanhos variam visualmente, sem aprovação de massa ou dano variável por tamanho.

### Rodada 4 — Duração, destruição e impactos
**Procedência declarada: R**

- **M4.1** Reflect é materializado quando o jogador solta o botão.
- **M4.2** Sua duração inicial é de quatro segundos.
- **M4.3** Cada segundo carregado acrescenta um segundo de duração.
- **M4.4** Com quatro segundos de carga máxima, a duração varia de quatro a oito segundos.
- **M4.5** Explosões e ataques físicos diretos, como Tackle, podem destruir a barreira antecipadamente.
- **M4.6** Projéteis refletidos normalmente não a destroem.
- **M4.7** Cada pedra causa dano ao primeiro personagem atingido e se despedaça.
- **M4.8** Pedras também se despedaçam ao colidir com geometria sólida.
- **M4.9** Várias pedras podem atingir o mesmo alvo, mas o dano sucessivo é reduzido.
- **M4.10** Reflexões sucessivas não possuem limite fixo de quantidade.

Ambiguidades:
- *Resolvidas:* redução sucessiva quantificada (M6.3); Tackle e explosões detalhados (Rodada 14); ciclos degenerados (M17.2).
- *Aberta:* não há tolerância geométrica numérica aprovada para detectar contato repetido sem deslocamento significativo.
- *Aberta:* a duração da barreira no instante em que o temporizador chega a zero deve ser consistente com a ordem dos eventos do passo físico.

### Rodada 5 — Valores numéricos iniciais
**Procedência declarada: R**

- **M5.1** Reflect — carga máxima: 4 segundos.
- **M5.2** Reflect — largura mínima 1,5× e máxima 3× a largura do personagem.
- **M5.3** Reflect — altura mínima 1,5× e máxima 2,5× a altura do personagem.
- **M5.4** Reflect — duração: 4 a 8 segundos.
- **M5.5** Psyshock — velocidade individual das pedras: 10–14 m/s, com configuração própria.
- **M5.6** Custo por Move: 1 ponto de stamina.
- **M5.7** Cooldown inicial: 8 segundos por Move, configurável.
- **M5.8** Aceleração manual: inicialmente 0,5 ponto de stamina para reduzir 1 segundo de cooldown.
- **M5.9** A aceleração exige um novo pressionamento físico do botão.

Refinado na Rodada 16 (M16.8): o custo é proporcional quando o tempo restante é inferior à redução solicitada (ex.: 0,4 s restante custa 0,2 de stamina).

Ambiguidades:
- *Aberta:* curva de crescimento dimensional do Reflect em relação ao tempo de carga (interpolação linear plausível, **não aprovada**).
- *Aberta:* “10–14 m/s” pode ser distribuição uniforme ou apenas limites permitidos; distribuição estatística não aprovada.
- *Aberta:* arredondamento dos custos fracionários de stamina e precisão exibida pelo HUD.
- *Aberta:* se as dimensões vêm das bounding boxes do modelo, do colisor principal ou de dimensão lógica padronizada (ver P2).

### Rodada 6 — Interrupções, defesa e categorias preliminares
**Procedência declarada: R**

- **M6.1** Ataques que interrompem Reflect durante a carga impedem a criação da barreira.
- **M6.2** Ataques que interrompem Psyshock durante a carga eliminam as pedras em preparação.
- **M6.3** Dano de pedras sucessivas contra o mesmo alvo: multiplicador 0,8 por acerto (100%, 80%, 64%, 51,2%…).
- **M6.4** Cada pedra pode interagir individualmente com defesa comum, defesa perfeita e i-frames do Dodge.
- **M6.5** Os Moves foram inicialmente descritos como Charge Construct e Charge Projectile *(substituído pela Rodada 18 revisada)*.
- **M6.6** Não podem começar durante a execução ativa de Dodge ou Tackle.
- **M6.7** Podem começar no final do Dodge.

Ambiguidades:
- *Resolvidas:* janela no final do Dodge (Rodadas 15 e 16); estados de interrupção efetivos (Rodada 15).
- *Parcialmente aberta:* “mesmo alvo” deve ser associado ao identificador de execução do Psyshock e ao alvo atingido.
- *Aberta:* não foi determinado se um bloqueio bem-sucedido conta como acerto para avançar o multiplicador (a regra fala em impactos com dano).
- *Aberta:* impactos no mesmo passo físico com proteção temporária de combo devem respeitar o motor existente, sem regra nova por interpretação.

### Rodada 7 — Penalidades e barreiras simultâneas
**Procedência declarada: R**

- **M7.1** O custo de 1 stamina é cobrado ao iniciar o carregamento.
- **M7.2** Se o carregamento for interrompido, o custo não é devolvido.
- **M7.3** Interrupções aplicam metade do cooldown normal.
- **M7.4** Com cooldown inicial de 8 s, a penalidade é de 4 s.
- **M7.5** Ao atingir a carga máxima, o Move pode permanecer carregado indefinidamente até ser liberado ou interrompido.
- **M7.6** Múltiplos Reflect podem coexistir por personagem, respeitando custos e cooldowns.
- **M7.7** Colisões seguem a primeira superfície fisicamente atingida.
- **M7.8** Empates geométricos exatos favorecem a face frontal do Reflect.
- **M7.9** Aceleração de cooldown só ocorre por novo keydown físico, não por autorepeat nem por manutenção do botão.

Ambiguidades:
- *Resolvidas:* reembolso por falha de criação do Reflect (M13.7); cancelamento voluntário com a mesma penalidade (M16.1).
- *Aberta:* “indefinidamente” não define o comportamento diante de pausa, perda de foco do navegador ou desconexão de controle.
- *Aberta:* se o cooldown acabar com um segundo botão pressionado, não há aprovação de ativação automática (interpretação conservadora: exigir nova ação — **não formalmente escolhida**).
- *Aberta:* significado de empate geométrico dentro da tolerância numérica.

### Rodada 8 — Formação, efeitos visuais e posicionamento
**Procedência declarada: R**

- **M8.1** Pedras do mesmo Psyshock não colidem entre si.
- **M8.2** Pedras de adversários distintos podem colidir e destruir uma à outra.
- **M8.3** Com lock-on, as pedras miram regiões diferentes do corpo do alvo.
- **M8.4** Reflect utiliza ondas geométricas de energia ao ser destruído.
- **M8.5** Psyshock utiliza pulsos psíquicos e fragmentos flutuantes.
- **M8.6** O preview de Reflect detecta obstáculos.
- **M8.7** O crescimento da barreira respeita o espaço físico disponível.
- **M8.8** Reflect acompanha a orientação do personagem durante a carga e congela sua orientação ao materializar.

Ambiguidades:
- *Resolvidas:* dimensionamento máximo diante de obstáculos (M13.6); criação perto de outro personagem (M26s.3).
- *Parcialmente aberta:* regiões anatômicas no modelo ou colisor — sem estrutura oficial de pontos de mira (ver P5).
- *Aberta:* distribuição aleatória das posições das pedras deve ser reproduzível por seed nos testes; algoritmo não selecionado.
- *Aberta:* ondas geométricas são visuais (M14.8); duração e orçamento de partículas ficam para calibração visual.

### Rodada 9 — Knockback, Tackle e lasers
**Procedência declarada: R**

- **M9.1** Pedras causam pequeno knockback.
- **M9.2** O knockback acumulado possui limite configurável.
- **M9.3** Hit stun, guard stun e proteções de combo seguem o sistema existente.
- **M9.4** Reflect é obstáculo sólido para os dois personagens.
- **M9.5** Tackle destrói Reflect, mas o atacante sofre recuo ou stagger.
- **M9.6** Lasers contínuos refletem geometricamente, atualizando seus segmentos conforme a direção do feixe.

Decisões posteriores: Rodada 14 (recuo curto e 0,25 s de stagger ao destruir Reflect com Tackle); Rodada 26 substituta (0,3 m/s por pedra, limite acumulado de 0,9 m/s).

Ambiguidades:
- *Aberta, importante:* o limite de 0,9 m/s é por alvo e por execução, ou global por execução? (ver P4)
- *Aberta:* direção do impulso quando a pedra atinge de cima ou o alvo está junto a uma parede.
- *Aberta:* o recuo curto do Tackle não tem magnitude numérica inicial aprovada (slider previsto).
- *Aberta:* lasers em incidência tangencial precisam de estabilidade numérica para não gerar contatos repetidos artificiais.

### Rodada 10 — Dano e homing
**Procedência declarada: R**

- **M10.1** Dano-base de cada pedra: 20% do Ataque do lançador, antes de Defesa e multiplicadores por impactos sucessivos.
- **M10.2** Psyshock possui homing nos primeiros 0,3 segundo do voo.
- **M10.3** Após esse intervalo, mantém trajetória reta na direção alcançada.
- **M10.4** O carregamento utiliza efeitos predominantemente nas mãos, pedras e preview.
- **M10.5** A animação corporal deve ser contida para preservar a locomoção.
- **M10.6** Reflect torna-se sólido imediatamente ao ser criado, apesar da transição visual luminosa.
- **M10.7** Perto do término, o Reflect apresenta bordas instáveis, partículas e pulsos.

Ambiguidades:
- *Resolvidas:* homing só com lock-on ativo no disparo (regra citada pelo Registro como “Rodada 11”; ver M11.5–M11.6 e a nota da Rodada 11); taxa angular máxima (M12.1).
- *Aberta, importante:* o momento em que o Ataque é amostrado para o dano-base (ver P1). A Rodada 26 original perguntou isso, mas foi substituída sem aprovação.
- *Aberta:* o VFX de degradação não define o instante percentual de início.
- *Aberta:* relação entre o tamanho visual das pedras e seu dano — não especificada.

### Rodada 11 — Formação progressiva e controles direcionais
**Procedência declarada: R**

- **M11.1** Psyshock começa com três pedras.
- **M11.2** Surge mais uma pedra a cada 0,8 s de carga; com 4 s chega ao máximo de oito.
- **M11.3** As pedras acompanham o personagem com inércia telecinética suave.
- **M11.4** O disparo utiliza gesto de extensão de uma mão.
- **M11.5** Com lock-on, o conjunto ataca diferentes regiões do alvo.
- **M11.6** Sem lock-on, as pedras seguem a orientação frontal do personagem *(refinado por M26s.6: leque discreto)*.
- **M11.7** A velocidade angular do personagem também sofre redução de 25% durante a carga de ambos os Moves.

> Nota do arquivista: o Registro-Mestre cita nas Rodadas 10 e 12 que o homing só funciona com lock-on ativo no disparo “conforme Rodada 11”; essa regra aparece aqui como M11.5/M11.6 (lock-on vs. sem lock-on), sem item numerado próprio.

Decisão posterior: Rodada 26 substituta — sem lock-on, o disparo forma um leque discreto configurável.

Ambiguidades:
- *Aberta:* distinguir visualmente pedras materializadas das ainda em formação.
- *Aberta:* sem parâmetros numéricos aprovados para a inércia telecinética.
- *Aberta:* pedra temporariamente ocultada por outra geometria durante a carga.
- *Aberta:* se o gesto usa um braço específico ou um ponto de ancoragem dependente do personagem.

### Rodada 12 — Direção, vida útil e efeitos de impacto
**Procedência declarada: R**

- **M12.1** Homing limitado inicialmente a 180°/s, com slider.
- **M12.2** Desativar manualmente o lock-on durante os 0,3 s não remove o homing para o alvo originalmente selecionado.
- **M12.3** Pedras não possuem duração máxima fixa de voo.
- **M12.4** Desaparecem quando atingem algo ou ultrapassam os limites válidos da arena.
- **M12.5** VFX de impacto distintos: personagem — pulso psíquico; defesa — dispersão energética; ambiente — fragmentos minerais; pedra contra pedra — explosão psíquica apenas visual.
- **M12.6** A reflexão cancela imediatamente o homing de uma pedra.

Ambiguidades:
- *Resolvida:* perda definitiva do alvo interrompe o homing e conserva a direção (M27.5).
- *Aberta:* limite geométrico válido da arena sem medidas ou volumes.
- *Aberta:* a explosão visual entre pedras não tem dano em área aprovado.
- *Aberta:* contatos muito próximos do alvo durante o homing de 180°/s.
- *Aberta:* efeitos visuais não devem criar colisores ofensivos sem aprovação explícita.

---

### Rodada 13 — Posicionamento e geometria definitiva do Reflect
**Procedência declarada: H**

- **M13.1** *C* — distância proporcional ao tamanho do personagem.
- **M13.2** *A* — base toca o chão; a barreira cresce para cima.
- **M13.3** *C* — bordas refletem projéteis utilizando normais geométricas próprias.
- **M13.4** *A* — barreira sempre vertical, independentemente da inclinação do solo.
- **M13.5** *A* — projéteis interagem com várias barreiras na ordem física dos contatos, permitindo ricochetes sucessivos.
- **M13.6** *A* — o crescimento é limitado ao maior retângulo válido, preservando o tamanho mínimo.
- **M13.7** *A* — impossibilidade de criar a barreira devolve a stamina e não inicia cooldown.

Ambiguidades:
- *Resolvidas:* valor inicial da distância (M26s.4); altitude (M26s.2) e tolerância de desníveis (M27.2); espessura sugerida e aprovada globalmente (M29.2).
- *Aberta:* prioridade entre borda refletora, face frontal e passagem traseira próximo às quinas (ver P3).
- *Aberta:* algoritmo e tolerâncias da verificação do maior retângulo válido.

### Rodada 14 — Interações físicas e explosões
**Procedência declarada: H**

- **M14.1** *A* — o personagem é bloqueado pela barreira, mas pode deslizar pelas laterais.
- **M14.2** *A* — Dodge colide normalmente, podendo ultrapassar a barreira por cima se a trajetória permitir.
- **M14.3** *A* — Tackle que destrói Reflect provoca recuo curto e stagger de 0,25 s, com sliders independentes.
- **M14.4** *A* — Tackle pode destruir Reflect pela frente, verso ou bordas, inclusive barreiras próprias.
- **M14.5** *A* — explosões destroem a barreira quando seu volume a alcança validamente, respeitando bloqueios da geometria.
- **M14.6** *A* — Reflect protege personagens na região coberta contra a explosão que o destrói.
- **M14.7** *A* — uma explosão pode destruir várias barreiras validamente atingidas.
- **M14.8** *A* — ondas de destruição são exclusivamente visuais.

Ambiguidades:
- *Aberta:* definir geometricamente a região protegida, incluindo múltiplas barreiras e proteção parcial do corpo (ver P7).
- *Aberta:* a mesma explosão não deve causar dano atrás da barreira por atualização posterior do mesmo evento.
- *Aberta:* valor-base do recuo curto.
- *Resolvidas:* Power Level não remove a proteção contra explosões (M22.5); Tackle ignora PL do Reflect (M19.9).

### Rodada 15 — Integração com ações e IA
**Procedência declarada: H**

- **M15.1** *A* — pressionar defesa cancela Charge e inicia defesa, se disponível.
- **M15.2** *C* — Dodge pode cancelar Charge; Tackle fica indisponível até soltar o botão.
- **M15.3** *A* — somente ataques que causam hit stun, knockback ou lançamento interrompem Charge.
- **M15.4** *A* — iniciar Move exige controle livre, ressalvada a janela especial no final do Dodge.
- **M15.5** *A* — Move pode começar ao fim do deslocamento principal do Dodge, mesmo durante a recuperação final.
- **M15.6** *A* — impactos quase simultâneos das pedras seguem ordem determinística, redução de dano, limite de impulso e regras de combo existentes.
- **M15.7** *A* — a IA utiliza Reflect e Psyshock desde o primeiro protótipo.
- **M15.8** *A* — a IA reage contextualmente com defesa, esquiva, reflexão, navegação e destruição de barreiras.

Ambiguidades:
- *Resolvidas:* Dodge só cancela Charge após 0,2 s (M16.2); buffer no final do Dodge de 0,15 s (M16.3).
- *Aberta:* “controle livre” deve ser associado aos estados reais do controlador.
- *Aberta:* a IA não deve executar ação proibida ao jogador humano nas mesmas condições.
- *Aberta:* várias pedras no mesmo alvo dentro de um passo: auditar a proteção de combo preexistente.

### Rodada 16 — Cancelamentos, HUD e cooldown
**Procedência declarada: H**

- **M16.1** *A* — cancelamento voluntário mantém o custo de 1 stamina e aplica 4 s de cooldown.
- **M16.2** *B* — Dodge pode cancelar Charge após 0,2 s, com configuração.
- **M16.3** *A* — comando de Move pode ser armazenado nos últimos 0,15 s do deslocamento principal do Dodge.
- **M16.4** *A* — não se iniciam carregamentos simultâneos.
- **M16.5** *A* — penalidade de 25% na velocidade e rotação termina imediatamente ao soltar o botão.
- **M16.6** *D* — teclas configuráveis, A e S como padrão.
- **M16.7** *A* — slots exibem carga, cooldown, disponibilidade, stamina e indicação discreta próxima ao personagem.
- **M16.8** *B* — custo proporcional para a fração final da redução manual de cooldown.

Decisões posteriores: Rodada 17 confirmou A = Reflect e S = Psyshock; durante Charge, pressionar outro Move em cooldown pode acelerar sua recarga sem iniciar uma segunda habilidade; Rodada 26 substituta fixou recuperação de 0,25 s.

Ambiguidades:
- *Resolvida:* a proibição genérica de segundo Move tem exceção explícita para aceleração de cooldown (M17.8).
- *Aberta:* defesa nos primeiros 0,2 s de carga é diferente do Dodge; o controle deve distinguir as duas entradas.
- *Aberta:* botão ainda pressionado ao terminar o cooldown deve ser formalizado.
- *Aberta:* prioridade entre eventos no mesmo passo (soltar Move, defesa, Dodge) precisa ser determinística (ver P9).

### Rodada 17 — Motor de reflexão, dano e propriedade
**Procedência declarada: H**

- **M17.1** *A* — A = Reflect; S = Psyshock.
- **M17.2** *A* — detectar ciclos de reflexão degenerados e suspender seu processamento no passo atual, preservando o projétil.
- **M17.3** *B* — o dano de pedra refletida é recalculado com o Ataque do refletor.
- **M17.4** *A* — projétil normal não atinge o proprietário atual; após reflexão, pode atingir o lançador original.
- **M17.5** *A* — lasers podem formar vários segmentos refletidos, recalculados continuamente.
- **M17.6** *A* — o laser mantém seu perfil original de dano e a propriedade é atribuída conforme a última reflexão.
- **M17.7** *A* — ao desaparecer a barreira, o feixe recalcula sua trajetória sem ela.
- **M17.8** *B* — outro Move pode ter cooldown acelerado durante Charge.

Ambiguidades:
- *Aberta, importante:* instante de amostragem do Ataque do refletor (ver P1).
- *Aberta:* o algoritmo de ciclos degenerados deve evitar loops sem criar limite artificial de reflexões.
- *Aberta:* passagem de propriedade entre segmentos do laser e eventos de dano com identificação consistente.
- *Resolvida:* neutralização de segmento de laser não encerra a fonte (M20.6).

### Rodada 18 original — Classificação
**Estado: SUBSTITUÍDA.** A proposta original de categorias foi rejeitada como referência definitiva. **Não usar para inferir decisões vigentes.**

### Rodada 18 revisada — Categorias, tipos e Power Level
**Procedência declarada: H**

Categorias oficiais: **Normal** (tempos do GDD, com ajustes experimentais individuais); **Charge** (botão mantido para carregar e melhorar o efeito); **Burst** (ativação e efeito imediatos, sem carga).

Tipos oficiais: **Projectile** (inclui lasers); **Status** (buffs, debuffs, efeitos debilitantes); **Melee** (ataques semelhantes ao Tackle); **Field** (explosões, barreiras, objetos, armadilhas, zonas); **Trick** (saltos especiais, esquivas ampliadas, outras habilidades de movimento).

- **M18.1** *C* — categoria + tipo principal + tipo secundário opcional.
- **M18.2** *B* — Normal utiliza o GDD como base, com ajustes experimentais por Move.
- **M18.3** *D* — permissões de execução definidas por Move; Reflect e Psyshock aumentam PL com carga.
- **M18.4** *A* — PL pertence ao Move; efeitos ofensivos herdam o mesmo nível.
- **M18.5** *A* — níveis iguais geram Clash; níveis diferentes geram Counter, quando a interação é elegível.
- **M18.6** *C* — elegibilidade de Clash configurável por Move, com regras-base por tipo.
- **M18.7** *A* — Counter superior neutraliza ou supera o inferior, sem bônus automático de dano.
- **M18.8** *B* — Reflect reflete apenas ataques de PL igual ou inferior.
- **M18.9** *B* — progressão universal de PL para Charge.

Ambiguidades:
- *Resolvida:* marcos universais (M19.1).
- *Aberta, não bloqueante:* tempos exatos das categorias Normal, a extrair do GDD quando uma habilidade Normal for criada.
- *Aberta:* como documentar tipos secundários sem duplicar eventos de dano.
- *Importante:* o PL pertence à execução do Move, mas suas entidades podem resolver colisões separadamente.

### Rodada 19 — Progressão de PL e disputas
**Procedência declarada: H**

- **M19.1** *B* — PL1 abaixo de 50% de carga; PL2 de 50% até antes de 100%; PL3 na carga máxima.
- **M19.2** *C* — ataque superior destrói Reflect e é neutralizado no impacto.
- **M19.3** *A* — reflexão tem prioridade sobre Clash quando o projétil tem PL igual ou inferior.
- **M19.4** *A* — projéteis de PL igual se destroem; PL superior vence e continua.
- **M19.5** *C* — o conjunto de pedras do Psyshock compartilha um único Power Level.
- **M19.6** *A* — Reflect conserva seu PL desde a materialização.
- **M19.7** *A* — a pedra refletida conserva seu PL original.
- **M19.8** *A* — Counter por PL é independente de outros sistemas de contra-ataque.
- **M19.9** *A* — Tackle destrói Reflect independentemente do PL.

Valores derivados para Reflect e Psyshock:

| Tempo carregado | Power Level |
|---|---|
| 0 até antes de 2 s | PL1 |
| 2 até antes de 4 s | PL2 |
| 4 s (carga máxima) | PL3 |

Ambiguidades:
- *Resolvida:* pedras compartilham PL, mas não a destruição (M20.1).
- *Aberta:* tolerância numérica dos marcos de 2,0 e 4,0 s coerente com o passo fixo da simulação.
- *Aberta:* a neutralização de projétil ofensivo superior que destrói Reflect deve disparar só os efeitos autorizados para aquela colisão.

### Rodada 20 — Interações entre tipos de Move
**Procedência declarada: H**

- **M20.1** *B* — pedras compartilham PL e execução, mas só as envolvidas na colisão são destruídas.
- **M20.2** *A* — Projectile × Melee normalmente é elegível a Clash/Counter quando há colisão ofensiva real.
- **M20.3** *A* — Projectile × Field segue propriedades e elegibilidade de cada Field.
- **M20.4** *B* — Melee × Field depende das propriedades envolvidas; Reflect mantém exceção para Tackle.
- **M20.5** *A* — Fields podem coexistir; sobreposição não basta para gerar Clash.
- **M20.6** *B* — neutralizar laser contínuo elimina apenas o segmento incidente naquele instante; a fonte pode emitir novamente no passo seguinte.
- **M20.7** *A* — Status e Trick não disputam PL por padrão, salvo efeitos ofensivos explicitamente elegíveis.
- **M20.8** *B* — Counter provoca stagger específico no personagem derrotado quando aplicável.
- **M20.9** *A* — HUD e telemetria mostram PL, Clash, Counter e resultados.

Ambiguidades:
- *Resolvida:* stagger só ocorre quando o ataque vencedor atinge fisicamente o corpo (M21.4).
- *Aberta:* delimitar em dados quais regiões ofensivas são elegíveis e quais são só visuais.
- *Aberta:* a neutralização de segmento de laser precisa de identificação própria para não repetir Counter artificialmente.

### Rodada 21 — Disputas simultâneas e Counter Stagger
**Procedência declarada: H**

- **M21.1** *A* — Tackle possui PL1 fixo.
- **M21.2** *A* — colisões múltiplas seguem ordem física determinística, sem favorecer jogador ou IA.
- **M21.3** *A* — cada pedra atingida por Melee resolve a disputa individualmente.
- **M21.4** *B* — stagger só acontece quando o ataque vencedor atinge o corpo do personagem.
- **M21.5** *A* — Counter Stagger dura 0,2 s inicialmente, com slider.
- **M21.6** *A* — Counters sucessivos não acumulam nem reiniciam o stagger ativo.
- **M21.7** *A* — Counter Stagger pode interromper Charge, aplicando a penalidade existente.
- **M21.8** *A* — defesas herdadas de Moves recebem PL e configuram seus próprios comportamentos.
- **M21.9** *A* — contatos contínuos só geram nova disputa após separação, nova emissão ou novo evento ofensivo.

Ambiguidades:
- *Aberta:* critérios exatos para reconhecer eventos simultâneos dentro do mesmo passo físico.
- *Aberta:* duas interações vencendo o mesmo ataque no mesmo instante: a neutralização deve ocorrer uma vez, preservando o determinismo.
- *Aberta:* a duração do stagger pode ser ajustada, mas sua interação com animações já interrompidas deve obedecer ao controlador existente.

### Rodada 22 — Explosões e Fields persistentes
**Procedência declarada: H**

- **M22.1** *A* — Fields fixam PL na criação.
- **M22.2** *A* — Clash entre áreas exige interseção de regiões ofensivas ativas.
- **M22.3** *C* — cada Move decide neutralização local ou integral.
- **M22.4** *A* — Projectile × explosão de PL igual neutraliza o projétil e a região conflitante; PL superior vence a parte envolvida.
- **M22.5** *A* — Reflect continua protegendo contra explosões independentemente do PL.
- **M22.6** *C* — objeto físico e efeito ativado de armadilhas podem ter interações distintas.
- **M22.7** *B* — projétil explosivo e explosão constituem uma única entidade ofensiva; a colisão ativa seus efeitos.
- **M22.8** *A* — Fields definem a cadência de dano; contato contínuo não reinicia Clash/Counter.
- **M22.9** *B* — cada Move define alvos válidos (inimigos, aliados, proprietário, objetos).

Ambiguidades:
- *Aberta, importante:* como projétil e explosão compartilham identidade de evento sem dupla contabilização de dano.
- *Aberta:* quando a colisão é neutralizada por Clash, o componente explosivo também é neutralizado ou ativa efeitos compatíveis?
- *Aberta:* formatos de área, propagação e oclusão são propriedades dos Moves futuros, não regras aprovadas para todos.
- *Não bloqueante:* novos tipos de explosão serão detalhados quando suas habilidades forem criadas.

### Rodada 23 — Status e Trick
**Procedência declarada: H**

- **M23.1** *B* — Status pode ser aplicado diretamente ou por contato, Projectile e Field.
- **M23.2** *C* — cada efeito configura acúmulo, renovação, substituição ou instâncias independentes.
- **M23.3** *B* — modificadores de atributos combinam multiplicativamente.
- **M23.4** *B* — duração fixa, condicional ou persistente até remoção.
- **M23.5** *A* — efeitos entregues por ataques respeitam suas defesas; aplicações diretas exigem regras explícitas.
- **M23.6** *A* — resistência, imunidade e remoção seletiva por identificadores.
- **M23.7** *A* — Trick respeita colisões da arena; atravessamento exige propriedade explícita.
- **M23.8** *B* — i-frames configurados individualmente por Trick.
- **M23.9** *C* — Status e Trick só recebem PL quando possuírem tipo secundário ofensivo.

Notas: detalhes dos futuros Status continuam indefinidos; o diretor determinou depois que o aprofundamento de Status fosse suspenso até criar uma habilidade desse tipo. **A suspensão não revoga as decisões já aprovadas.** A obrigatoriedade de tipo secundário ofensivo para receber PL prevalece sobre regras genéricas anteriores.

### Rodada 24 — Atributos e física de Trick
**Procedência declarada: H**

- **M24.1** *B* — Status pode modificar atributos, máximos e regeneração de recursos, mobilidade, resistência e propriedades de ações.
- **M24.2** *A* — multiplicadores combinados antes da aplicação dos limites finais.
- **M24.3** *B* — recursos possuem operações instantâneas, máximos, regeneração e drenagem separados.
- **M24.4** *B* — cada efeito define quais ações restringe.
- **M24.5** *C* — Status decide se bloqueia novas ações, interrompe existentes ou ambos.
- **M24.6** *C* — Trick pode adicionar, substituir ou combinar impulso existente.
- **M24.7** *C* — direção, autoridade, correção e travamento configuráveis.
- **M24.8** *B* — colisões impedem penetração e preservam deslocamento tangencial válido.
- **M24.9** *B* — impulso remanescente preservado; queda e aterrissagem seguem o sistema existente.

Notas: cálculos de recursos sob efeitos temporários foram propostos na Rodada 26 original, mas **não aprovados**; Tricks futuros necessitarão de decisões próprias; o sistema de física existente prevalece onde não houver comportamento específico aprovado.

### Rodada 25 — Restrições, imunidades e IA
**Procedência declarada: H**

- **M25.1** *A* — a ação permanece bloqueada enquanto qualquer Status válido a proibir.
- **M25.2** *B* — resistência reduz duração e intensidade separadamente; imunidade impede aplicação.
- **M25.3** *A* — interrupção de Charge por Status usa a penalidade já aprovada.
- **M25.4** *A* — interrupções simultâneas aplicam a penalidade uma única vez.
- **M25.5** *A* — Trick configura suas próprias janelas de cancelamento.
- **M25.6** *C* — Trick configura resistência a interrupções.
- **M25.7** *C* — Trick pode compartilhar ou separar recursos e restrições de ações convencionais.
- **M25.8** *A* — a IA avalia intensidade, duração, recursos, resistências e efeitos ativos para Status.
- **M25.9** *A* — a IA avalia ambiente, distância, velocidade, ameaças e aterrissagem ao usar Trick.
- **M25.10** *A* — HUD sinaliza Status e ações bloqueadas; Trick usa VFX próprios e depuração de trajetória.

Notas: regras detalhadas de efeitos Status estão deliberadamente adiadas; prioridades entre múltiplos bloqueios e efeitos removidos serão documentadas quando implementadas; nenhum Status ou Trick específico foi aprovado para esta primeira implementação.

### Rodada 26 original — Não aprovada
**Estado: SUBSTITUÍDA.** A proposta original abordava amostragem de atributos, buffs, cooldowns modificados e parâmetros de projéteis ou Fields alterados por Status. O diretor decidiu que esse aprofundamento **não seria necessário antes da criação de um Move Status**. **Nenhuma das alternativas apresentadas deve ser tratada como aprovada**, inclusive a pergunta sobre o instante de amostragem do Ataque para o dano-base do Psyshock (ver P1).

### Rodada 26 substituta — Regras práticas de Reflect e Psyshock
**Procedência declarada: H.** IDs com sufixo `s` (`M26s.n`) para distinguir da Rodada 26 original.

- **M26s.1** *C* — ambos só podem ser iniciados quando o personagem está apoiado em uma superfície.
- **M26s.2** *B* — Reflect utiliza a altitude da superfície de apoio do personagem.
- **M26s.3** *A* — personagens contam como obstáculos no posicionamento; a falha devolve stamina.
- **M26s.4** *B* — distância livre inicial equivalente a 50% da profundidade do personagem, com slider.
- **M26s.5** *A* — Psyshock procura posições alternativas válidas para preservar a quantidade de pedras.
- **M26s.6** *B* — sem lock-on, as pedras são disparadas em leque discreto, com dispersão configurável.
- **M26s.7** *A* — knockback de 0,3 m/s por pedra, limitado a 0,9 m/s por Psyshock.
- **M26s.8** *C* — recuperação de 0,25 s para ambos; o movimento normal retorna imediatamente.

Ambiguidades:
- *Resolvidas:* perda de contato com o chão durante a carga interrompe a habilidade (M27.1); falta absoluta de espaço (M29.3).
- *Aberta:* cálculo da profundidade do personagem em diferentes colisores e modelos.
- *Aberta:* o limite acumulado de knockback deve ser associado explicitamente ao alvo e à execução (ver P4).
- *Aberta:* a recuperação não deve ser estendida involuntariamente pela duração visual do disparo.

### Rodada 27 — Posicionamento final e IA
**Procedência declarada: H**

- **M27.1** *B* — sair da superfície de apoio durante Charge interrompe imediatamente o Move.
- **M27.2** *C* — desníveis aceitos dentro de tolerância configurável; altura de origem preservada.
- **M27.3** *B* — Psyshock procura regiões livres alternativas à frente, dentro de alcance configurável.
- **M27.4** *A* — durante a recuperação de 0,25 s, movimento, defesa e Dodge são permitidos; novos Moves e Tackle ficam bloqueados.
- **M27.5** *A* — perda definitiva do alvo encerra o homing e preserva direção/velocidade das pedras.
- **M27.6** *A* — a IA seleciona contextual e estrategicamente PL1, PL2 ou PL3.
- **M27.7** *A* — VFX distintos por intensidade de Power Level, sem alterar a identidade visual.
- **M27.8** *A* — laboratório jogável offline com IA ativável, ajustes, cenários de colisão e PL.

Ambiguidades:
- *Aberta:* tolerância inicial de altitude sem valor numérico.
- *Aberta:* alcance máximo da procura de espaço para as pedras sem valor-base.
- *Aberta:* comportamento se a superfície de apoio deixar de existir durante a carga por destruição ambiental (aplica-se a regra geral de perda de contato, salvo exceção futura).
- *Resolvida:* falha absoluta de formação do Psyshock (M29.3).

### Rodada 28 — Arquitetura e validação
**Procedência declarada: H, com confirmação posterior por aprovação global**

- **M28.1** Inicialmente personalizada para solicitar recomendação técnica.
- **M28.2** *B* — alternar o controle manual entre os dois personagens, podendo ativar IA no não controlado.
- **M28.3** *B* — cenários de Reflect/Psyshock/Tackle e emissores técnicos de laser e explosão.
- **M28.4** *A* — **alterações de sliders afetam usos posteriores; entidades existentes mantêm parâmetros** (contrato obrigatório, seção 2).
- **M28.5** *A* — HUD apresenta carga, PL, cooldown, recuperação e ações bloqueadas.
- **M28.6** *A* — preview comunica falhas discretamente e informa reembolso; Psyshock comunica reposicionamento.
- **M28.7** *A* — overlays técnicos opcionais, desativados por padrão.
- **M28.8** *A* — cenários reproduzíveis por seed, com pausa e avanço passo a passo.
- **M28.9** *A* — testes automatizados, testes manuais e aprovação visual/jogável separada.

Recomendação técnica posterior (abrangida pela aprovação global): código modular, testes separados e build automatizado que produz um HTML único autocontido, aberto offline diretamente pelo usuário. A direção de linguagem foi registrada pelo Registro-Mestre como “TypeScript”; ver a nota de reconciliação na seção 15.

Ambiguidades:
- *Confirmação global, não numerada:* a aprovação da arquitetura foi inferida da aceitação geral posterior.
- *Importante:* o laboratório existente já é modular e tem scripts de build, mas **não** está em TypeScript; modularizar não implica reescrever indiscriminadamente.
- *Aberta:* quais dependências e recursos serão embutidos no HTML final.
- *Aberta:* não há autorização para integrar os Moves ao jogo principal antes da aprovação do laboratório.

### Rodada 29 — Últimas recomendações aceitas globalmente
**Procedência declarada: I** — o diretor afirmou seguir todas as recomendações apresentadas; não houve resposta individual numerada às três questões.

- **M29.1** *A — Arquitetura:* código modular, testes separados e geração de HTML offline autocontido (ver nota de reconciliação, seção 15).
- **M29.2** *A — Geometria:* Reflect como painel tridimensional fino, com espessura inicial sugerida de 0,10 m, ajustável.
- **M29.3** *A — Falha absoluta do Psyshock:* se não houver espaço válido para formar todas as pedras após esgotada a busca permitida, o disparo falha, as pedras são dissipadas, a stamina é devolvida e nenhum cooldown é aplicado.

Ambiguidades:
- *Importante:* a interpretação é forte, mas não equivale a três respostas numeradas.
- *Aberta:* compatibilizar a espessura de 0,10 m com as regras de reflexão da frente, das bordas e passagem pelo verso.
- *Aberta:* critério de esgotamento da busca de posições do Psyshock (depende do alcance configurável).
- *Aberta:* regra clara para impedir edições manuais do HTML gerado.

---

## 4. Especificação vigente — Reflect

*Síntese das decisões acima, após as substituições conhecidas. Em caso de divergência, valem os itens `M…` e suas notas.*

### 4.1 Identificação
Move Reflect · Charge · Field · tecla padrão A · custo 1 stamina cobrada no início da carga · cooldown 8 s (configurável) · carga máxima 4 s · pode permanecer em carga máxima até liberação ou interrupção · só começa e continua carregando com o personagem apoiado em superfície válida.

### 4.2 Power Level
PL1 com carga < 2 s; PL2 de 2 s até antes de 4 s; PL3 em 4 s. PL fixado na criação. Reflete ataques elegíveis de PL igual ou inferior. Ataques superiores destroem a barreira e são neutralizados no contato. Explosões não são refletíveis e seguem regras defensivas próprias. Tackle destrói Reflect independentemente do PL.

### 4.3 Geometria
Retangular, painel vertical; espessura inicial recomendada e globalmente aprovada 0,10 m (ajustável); largura 1,5×–3× e altura 1,5×–2,5× as do personagem; distância livre inicial 50% da profundidade do personagem; base na altitude da superfície de apoio, com tolerância configurável para desníveis; orientação acompanha o personagem durante a carga e congela na criação; preview se adapta ao espaço sem violar dimensões mínimas; personagens são obstáculos ao posicionamento.

### 4.4 Colisões
Face frontal: reflexão especular. Bordas: reflexão especular com normais próprias. Face traseira: passagem livre para projéteis que chegam pelo verso. Personagens: obstáculo sólido com deslizamento lateral. Dodge: colisão física, ultrapassagem por cima se a trajetória permitir. Reflexões entre barreiras sucessivas e ilimitadas em contagem lógica; ciclos numéricos degenerados não podem prender a simulação.

### 4.5 Duração e destruição
Duração = 4 s + tempo carregado (4–8 s). Múltiplas barreiras coexistem. Tackle destrói pela frente, verso ou bordas, inclusive barreiras próprias, com recuo curto e stagger de 0,25 s. Explosões podem destruir várias barreiras; Reflect absorve a explosão na região protegida. Ondas de destruição são somente visuais.

### 4.6 Falhas
Sem espaço mínimo válido: não cria barreira, devolve a stamina, não inicia cooldown e mostra feedback discreto do motivo.

## 5. Especificação vigente — Psyshock

### 5.1 Identificação
Move Psyshock · Charge · Projectile · tecla padrão S · custo 1 stamina · cooldown 8 s (configurável) · carga máxima 4 s · só com apoio em superfície válida.

### 5.2 Formação
Três pedras iniciais; +1 a cada 0,8 s; oito ao atingir a carga máxima. Posições, tamanhos e alturas visualmente variados. Seguem o personagem por inércia telecinética suave. Pedras do mesmo Move não colidem entre si. Posições alternativas são procuradas para evitar penetração em obstáculos.

### 5.3 Disparo
Todas as pedras simultâneas; gesto de extensão de uma mão; velocidade individual configurável no intervalo inicial de 10–14 m/s. Com lock-on: regiões diferentes do alvo; homing limitado a 0,3 s e 180°/s. Sem lock-on: leque discreto frontal com dispersão ajustável. Perda definitiva do alvo termina o homing preservando o movimento. Reflexão cancela o homing. Sem tempo fixo máximo de voo; os limites válidos da arena encerram o projétil.

### 5.4 Dano
Dano-base nominal por pedra: 20% do Ataque. Hits sucessivos no mesmo alvo: 1; 0,8; 0,64; 0,512… Cada pedra pode ser defendida, bloqueada perfeitamente ou evitada pelos i-frames. Knockback inicial 0,3 m/s por pedra; limite acumulado 0,9 m/s por execução (**escopo por alvo ainda não formalizado — P4**). Hit stun, guard stun e proteção de combo existentes permanecem válidos.

### 5.5 Power Level
PL1 antes de 2 s; PL2 de 2 s até antes de 4 s; PL3 em 4 s. Todas as pedras compartilham o PL da execução e resolvem colisões individualmente; só as efetivamente destruídas deixam de existir. Refletidas, conservam o PL original.

### 5.6 Reflexão
Pedra refletida muda de proprietário, recebe nova direção por reflexão geométrica, cancela o homing, recalcula o dano-base com o Ataque do refletor, pode atingir o lançador original e conserva o PL. **Pendente: momento da amostragem do Ataque (P1).**

### 5.7 Falha de espaço
Busca posições alternativas próximas e à frente. Esgotada a busca dentro do alcance configurado sem formar todas as pedras: o disparo falha, as pedras desaparecem, a stamina é devolvida e nenhum cooldown é aplicado.

## 6. Regras compartilhadas de execução

**6.1 Movimentação e carregamento.** Reflect e Psyshock: redução de 25% na velocidade linear e angular durante a carga, normal imediatamente ao soltar; não começam no ar; interrompem se perderem o apoio; sem carregamentos simultâneos.

**6.2 Defesa, Dodge e Tackle.** Defesa cancela Charge quando disponível. Dodge pode cancelar Charge após 0,2 s. Tackle não pode ser ativado durante Charge. Um Move pode ser armazenado nos últimos 0,15 s do deslocamento principal do Dodge e começar quando esse deslocamento terminar, mesmo durante a recuperação final permitida.

**6.3 Interrupções.** Hit stun, knockback e lançamento podem interromper Charge. A interrupção mantém a stamina gasta e inicia metade do cooldown normal. Cancelamento voluntário segue a mesma penalidade. Nenhuma interrupção única aplica penalidade múltipla.

**6.4 Recuperação após materialização/disparo.** 0,25 s; movimento e rotação normais; defesa e Dodge permitidos; novos Moves e Tackle indisponíveis até terminar.

**6.5 Aceleração de cooldown.** Novo pressionamento físico do botão; custo-base 0,5 stamina por 1 s reduzido; custo proporcional na fração final; autorepeat não gera gastos adicionais; permitida em outro Move durante um Charge em andamento; não inicia automaticamente um segundo carregamento.

## 7. Power Level, Clash e Counter

**7.1 Escala.** PL de 1 a 3; Moves Charge capazes de elevar PL usam marcos universais de 50% e 100% da carga; o PL pertence à execução do Move.

**7.2 Clash.** Ataques elegíveis de PL igual interagem fisicamente; a resolução depende do tipo e das propriedades aprovadas.

**7.3 Counter.** Ataques elegíveis de PL diferentes: o nível superior vence. Sem bônus universal automático de dano por Counter de PL. Quando o ataque vencedor atinge o corpo do personagem, pode aplicar Counter Stagger.

**7.4 Counter Stagger.** 0,2 s (configurável); não acumula; novos Counters não reiniciam o stagger ativo; pode interromper carregamento quando aplicado validamente; perder uma disputa distante entre projéteis não causa stagger automático.

**7.5 Exceções.** Reflect prioriza reflexão válida sobre Clash; Tackle destrói Reflect independentemente de PL; explosões podem destruir Reflect, mas a barreira mantém a proteção da região coberta; Status e Trick puros não possuem PL (M23.9).

## 8. Inteligência artificial

A IA usa Reflect e Psyshock desde a primeira implementação jogável. Deve avaliar quando criar Reflect, quando interromper a própria carga e disparar, escolher contextualmente PL1/PL2/PL3, considerar riscos e oportunidades, defender e esquivar, reconhecer projéteis refletidos, desviar de barreiras, usar Tackle para destruir barreiras quando vantajoso, e respeitar as mesmas restrições do jogador humano. As decisões da IA devem ser acessíveis em telemetria opcional. **Não foi aprovado um modelo específico de IA** (máquina de estados, utility AI, árvore de comportamento); a integração deve considerar a arquitetura existente.

## 9. Laboratório de validação

**9.1 Arquitetura (aceita globalmente).** Código-fonte modular; testes separados; build automatizado; um HTML final autocontido; execução offline direta no navegador; sem CMD para o usuário jogar; sem integração definitiva ao jogo principal antes da aprovação. Ver nota de reconciliação sobre TypeScript (seção 15).

**9.2 Recursos obrigatórios.** Alternar o controle dos dois personagens; IA ativável/desativável; sliders; cenários repetíveis; emissores técnicos de laser e explosão; testes PL1/PL2/PL3; Tackle contra Reflect; reflexão pelas faces e bordas; colisões entre pedras; testes de falta de espaço; HUD de carga, cooldown, PL, recuperação e bloqueios; overlays opcionais de física; pausa e avanço passo a passo; seed controlada; testes automatizados; aprovação manual de jogabilidade e visuais.

**9.3 Sliders.** Alterações durante o jogo aplicam-se aos próximos usos dos Moves; entidades existentes preservam os valores com que foram criadas, respeitando as propriedades fixas aprovadas (M28.4).

## 10. Matriz de decisões substituídas

| Tema | Regra anterior | Regra vigente |
|---|---|---|
| Trajetória inicial do Psyshock | Reta sem homing | Homing de 0,3 s com lock-on; leque frontal sem lock-on |
| Bordas do Reflect | Não explicitamente refletoras | Refletem usando normais geométricas próprias |
| Categorias de Moves | Charge Construct / Charge Projectile (M6.5) | Categoria Charge e tipo Field / Projectile |
| Classificação geral | Proposta original da Rodada 18 | Rodada 18 revisada |
| Segundo Move durante Charge | Comando inteiramente ignorado | Pode acelerar o cooldown, mas não iniciar outra carga |
| Custo de aceleração | Custo fixo por acionamento | Proporcional quando resta fração inferior a 1 s |
| PL do Psyshock | Conjunto tratado como força única | PL compartilhado; colisões e destruição individuais |
| Neutralização de laser | Interpretação possivelmente integral | Somente o segmento incidente naquele instante |
| Rodada 26 (Status) | Perguntas sobre modificadores | Não aprovada; substituída por regras de Reflect/Psyshock |
| Origem e altitude do Reflect | Base no chão | Altitude da superfície de apoio do criador, com tolerância para desníveis |
| Recuperação após disparo | Não definida | 0,25 s, com movimento, defesa e Dodge permitidos |
| Formato do laboratório | HTML único ou modular separado | Fontes modulares e HTML final autocontido (aprovação global) |

## 11. Pendências e ambiguidades não resolvidas

Nenhuma delas foi resolvida por quem publicou este arquivo. Valores experimentais podem começar como provisórios, configuráveis e identificados como não aprovados.

- **P1 — Momento de cálculo do dano das pedras (Alta).** O dano depende do Ataque e é recalculado na reflexão, mas não foi determinado se o atributo é amostrado no início da carga, no disparo, na reflexão ou no impacto. A Rodada 26 original levantou a questão e foi substituída. **Não há aprovação para adotar qualquer alternativa.**
- **P2 — Referência dimensional do Reflect (Média).** Colisor de combate, bounding box visual ou dimensões lógicas do personagem; afeta largura, altura, profundidade de referência e distância. Acessórios visuais não devem alterar a física.
- **P3 — Geometria da reflexão em quinas (Média).** Frente e bordas refletem, o verso é atravessável; falta regra para contatos próximos às extremidades e incidência pelo verso, evitando reflexões contraditórias.
- **P4 — Knockback acumulado do Psyshock (Média).** 0,3 m/s por pedra e limite de 0,9 m/s por execução; falta formalizar se o limite vale por alvo.
- **P5 — Homing e pontos anatômicos (Média).** Falta contrato técnico dos pontos de mira nos modelos e comportamento para anatomias diferentes; deve ser compatível com os colisores atuais do laboratório.
- **P6 — Reflexão × Power Level (Média).** Prioridades de eventos entre reflexão válida, ataque superior contra Reflect, explosão e Tackle, sem resultados incompatíveis simultâneos (requisito de consistência, não nova decisão de gameplay).
- **P7 — Explosões e região protegida (Média).** Definição geométrica de quais personagens são protegidos, preservando a proteção durante o mesmo evento.
- **P8 — Parâmetros numéricos de calibração (Baixa).** Sem valores aprovados: tolerância de desnível; alcance da busca de posições das pedras; dispersão do leque; inércia telecinética; magnitude do recuo de Tackle após destruir Reflect; tolerâncias de colisão e de ciclos degenerados; instante de início do VFX de expiração.
- **P9 — Estados de entrada e ordenação de comandos (Média).** Soltar Move, pressionar defesa e ativar Dodge no mesmo passo exigem ordem determinística e testável; a regra existente do jogo não deve ser substituída sem auditoria.
- **P10 — Arquitetura do repositório (Alta antes da implementação).** Auditar o que já existe, quais partes estão em JavaScript, como os Moves são registrados, os estados do controlador, as entidades físicas, a execução de testes e a produção do HTML offline. Não há autorização para reconstruir do zero. *(Auditoria parcial feita em 16/10/2026 pelo Claude Code; resultados em documentação separada, quando publicada.)*
- **P11 — Integridade documental das Rodadas 1–12 (Alta antes de declarar completude).** Conteúdo recuperado por síntese; requer conferência com a fonte original.
- **P12 — Aprovações globais da Rodada 29 (Baixa).** Interpretação razoável, mas deve constar como aprovação global, não como respostas individuais.

## 12. Não bloqueiam os dois primeiros Moves

Moves específicos do tipo Status; buffs e debuffs; fórmulas de regeneração alterada por Status; resistências especializadas; Moves Trick; novos ataques Melee além do Tackle; novas habilidades Field além de Reflect; outros Projectile não necessários aos testes técnicos; os dois slots restantes; balanceamento definitivo; multiplayer em rede. Permanecem documentados como decisões de arquitetura ou possibilidades futuras.

## 13. Critérios para considerar o sistema pronto para implementação

1. Todas as decisões das Rodadas 1–29 presentes ou com lacunas explicitamente identificadas.
2. Regras substituídas não usadas como vigentes.
3. Parâmetros numéricos aprovados preservados.
4. Exceções de reflexão, Tackle, explosões e Power Level documentadas.
5. Relação entre Physic, Controller, Moves, World e IA existentes auditada.
6. Ambiguidades que modificam dano, colisão ou custos resolvidas antes da codificação.
7. Valores experimentais identificados como provisórios.
8. Testes automatizados refletem as decisões e suas exceções.
9. A entrega produz HTML offline autocontido, sem comandos do usuário final.
10. O diretor aprova a especificação antes de qualquer modificação técnica.

## 14. Documentos adicionais propostos (não criados)

`MOVES_SPEC_REFLECT_PSYSHOCK.md` (especificação vigente isolada), `MOVES_AMBIGUIDADES.md`, `MOVES_TEST_MATRIX.md` e `MOVES_IMPLEMENTATION_PROMPT.md` são propostas de organização do Registro-Mestre, **não arquivos existentes**. O histórico das seções 3 e 10 deve permanecer imutável; a especificação vigente pode receber versões conforme novas aprovações.

## 15. Notas do arquivista (acréscimos de quem publicou este arquivo — não são decisões do diretor)

1. **Reconciliação sobre TypeScript.** O Registro-Mestre (M28, M29.1, §9.1) registra “TypeScript” como direção aprovada para o laboratório. Em 16/10/2026 o diretor aprovou, para o plano de arquitetura, começar por `checkJs` + JSDoc no `combat-lab`, sem converter arquivos para `.ts`; a migração para `.ts` permanece possibilidade futura, justificada por benefício concreto e sem alterar a física ou os comportamentos existentes. Os dois registros não se contradizem: um é a direção de longo prazo, o outro o primeiro passo.
2. **Contrato M28.4 × estado do código.** Em `prototypes/combat-lab/src/sim/`, a configuração viva `C` (`config.js`) é um objeto global mutável lido diretamente pelos módulos da simulação, e o registro de Moves (`moves.js`, `REGISTRY`) é global. Hoje isso permitiria que o ajuste de um slider alterasse entidades já criadas, o que **contraria o M28.4**. A futura implementação dos Moves deve capturar, na criação da execução ou da entidade, os parâmetros aplicáveis. A refatoração do estado global **não está autorizada**; será tratada em proposta separada. O ciclo de importação `entity → moves → world → entity` também está documentado como risco, sem alteração.
3. **Interação com o mapa da arena.** O registro do mapa permite que movimentos especiais concedam saltos adicionais; este registro exige apoio em superfície para iniciar e manter Reflect e Psyshock (M26s.1, M27.1). Não há contradição hoje; observar quando salto e plataformas forem implementados (apoio em plataformas, perda de contato ao saltar).
4. **Contexto técnico vigente (16/10/2026, `main` @ `cf6da6e`).** O `combat-lab` já oferece, apenas como infraestrutura sem conteúdo, o registro de movimentos (`src/sim/moves.js`), entidades de mundo (`world.js`), status (`status.js`) e o formato descrito em `prototypes/combat-lab/MOVIMENTOS.md`. O registro está vazio. Nada deste documento foi implementado.

## 16. Auditoria de confiabilidade (estado em 16/10/2026)

| Área | Situação |
|---|---|
| Decisões explícitas das Rodadas 13–28 | Transcritas do Registro-Mestre; procedência H declarada por ele, não verificada de forma independente |
| Rodadas 1–12 | Recuperadas por síntese (R); aguardam confronto integral com a transcrição |
| Rodada 18 revisada | Prevalece sobre a original |
| Rodada 26 original | Não aprovada |
| Rodada 26 substituta | Incorporada (`M26s.n`) |
| Rodada 29 | Aceitação global (I) |
| Reflect / Psyshock | Design aprovado; especificação operacional substancialmente definida; implementação **não autorizada** |
| Power Level / Clash / Counter | Regras principais definidas, com necessidades técnicas de resolução (P6, P9) |
| IA | Diretrizes aprovadas; implementação não auditada |
| Laboratório | Requisitos de entrega e validação definidos |
| Revisão do código existente | Parcial; não concluída para esta especificação |
| Verificação contra a exportação da conversa original | **Pendente** |
| Publicação no GitHub | Branch `docs/moves-decisoes-rodadas`; ver o histórico do Git para o estado de integração |
| Autorização para implementação | **Não concedida** |

**Declaração final de integridade.** Este documento preserva as decisões conhecidas e identifica ambiguidades relevantes, mas **não certifica que nenhum detalhe da conversa original foi omitido**. Para rastreabilidade integral é necessário comparar esta consolidação com o histórico original completo, especialmente as Rodadas 1–12.

**Estado recomendado:** preservar este registro, confrontá-lo com a conversa original, resolver as ambiguidades efetivamente bloqueantes e somente depois produzir o prompt definitivo de implementação.

## Changelog do registro

- **2026-10-16 — Criação inicial:** transposição do Registro-Mestre (Rodadas 1–29), IDs `M<rodada>.<item>`, notas do arquivista e estados separados de design, implementação e integridade. Nenhum código alterado.
