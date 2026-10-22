# Arenamon — Catálogo de 5 Moves Genéricos

> **Atualização de 22/10/2026 (auditoria `docs/AUDITORIA_DOCUMENTACAO_2026-10-22.md`):** **Quick Attack, Swift, Harden, Spikes e Bounce estão implementados** (v1.14.0, branch `feat/moves-novos`, integrada à `main`), junto de Lunge, Guard Break, Feint, Riposte e Second Wind (ver `docs/moves-nao-iniciados/5_MOVES_GENERICOS_PROMPT.md`). Os números do catálogo continuam **propostas** até a homologação do responsável; os valores em uso estão em `C.world.<move>` e na base de calibração (`sim/calibration-base.js`). O estado «não implementado por este registro» refere-se só à criação do documento.

**Repositório:** `Ziaker/Arenamon`  
**Documento:** `docs/MOVES_GENERICOS_CATALOGO.md`  
**Data:** 20/10/2026  
**Estado:** catálogo aprovado para registro pelo diretor; valores numéricos e regras adicionais identificados como propostas iniciais de balanceamento, sujeitos à homologação individual. **Não implementado por este registro.**

## 1. Objetivo e enquadramento

Os cinco Moves abaixo são **genéricos**, isto é, candidatos a uso por **Croagunk, Drowzee, Mush/Mushroom e Vigoroth**, independentemente das restrições de aprendizado dos jogos Pokémon. Servirão como moldes reutilizáveis para cinco famílias oficiais de Moves do Arenamon: **Melee, Projectile, Status, Field e Trick**.

As categorias oficiais de execução são **Normal, Charge e Burst**. **Burst** significa ativação sem período de carga; os deslocamentos e efeitos resultantes ainda podem possuir duração física. O **Power Level (PL)** pertence à execução do Move; efeitos ofensivos elegíveis participam de Clash/Counter segundo as regras já estabelecidas. **Status e Trick puros não recebem PL** por padrão; Bounce possui componente ofensivo Melee e, portanto, utiliza PL.

### Visão geral

| Move | Categoria | Tipo principal / secundário | Power Level | Knockback |
|---|---|---|---|---|
| **Quick Attack** | **Burst** | **Melee** | **PL1** | **4 m/s horizontal; 0 vertical** |
| **Swift** | **Burst** | **Projectile** | **PL1** | **0,3 m/s horizontal por projétil; máximo 0,9 m/s por execução/alvo; 0 vertical** |
| **Harden** | **Normal** | **Status** | **Sem PL** | **Nega integralmente o knockback ofensivo recebido enquanto ativo** |
| **Spikes** | **Normal** | **Field** | **PL1 ofensivo** | **Nenhum: 0 horizontal e 0 vertical** |
| **Bounce** | **Charge** | **Trick + Melee** | **PL1 / PL2 / PL3** | **3 m/s horizontal e 6 m/s vertical** |

**Regra transversal de cobrança já aprovada:** para Moves **não-Charge** (Normal ou Burst), gasto de recursos e início de cooldown ocorrem **no cast, após a confirmação do alvo ou local e a soltura do botão**; para Moves **Charge**, a cobrança ocorre **quando a carga é ativada**, e não na soltura. Não voltar a discutir ou alterar esta regra por Move. Fonte: `docs/MUSHROOM_MOVES_DECISOES.md`, diretriz geral de 20/10/2026.

**Regra de parâmetros:** sliders afetam **usos posteriores**; entidades e execuções já existentes preservam os valores capturados quando foram criadas, conforme M28.4 de `docs/MOVES_DECISOES_RODADAS.md`.

---

## 2. Quick Attack — Ataque Rápido

**Categoria:** Burst  
**Tipo:** Melee  
**Power Level:** PL1

### Descrição e identidade

O personagem identifica automaticamente o **adversário elegível mais próximo a até 7 metros**, avança em altíssima velocidade para aplicar um **Tackle de curta distância** e **retorna imediatamente ao ponto de onde iniciou o golpe**, como na apresentação visual clássica de Quick Attack nos jogos de Pokémon. Não é uma investida convencional de 2,5 m: seu alcance de aquisição é **7 metros**.

### Parâmetros iniciais propostos

| Parâmetro | Valor |
|---|---:|
| Alcance de aquisição | **7 m** |
| Stamina | 0,75 |
| Cooldown | 6 s |
| Início do avanço | Imediato após confirmação/soltura |
| Tempo máximo de aproximação | 0,16 s |
| Tempo máximo de retorno | 0,14 s |
| Recuperação | 0,12 s |
| Dano nominal | 8 HP |
| Knockback horizontal | 4 m/s |
| Knockback vertical | 0 m/s |
| Power Level | PL1 |

### Sequência mecânica

1. Verificar o **adversário elegível mais próximo** dentro de 7 m.
2. Registrar a **posição inicial real** do usuário, incluindo seu apoio/altura pertinente.
3. Após a confirmação da seleção e soltura, executar o avanço extremamente rápido, sem tempo de Charge.
4. Resolver o contato ofensivo como Tackle: colisão real, defesa, defesa perfeita, i-frames, impactos e disputas ofensivas quando elegíveis.
5. Após o ataque, **tenha acertado ou errado**, iniciar imediatamente o retorno à origem registrada.
6. Encerrar no ponto de partida válido e aplicar a recuperação antes de restaurar o controle correspondente.

**Restrições:** aproximação e retorno usam verificação contínua de colisão; não atravessam paredes, obstáculos ou geometria sólida. O **trajeto de retorno não é um segundo ataque** e não pode atingir o alvo outra vez na mesma execução. Se o ponto de origem se tornar inacessível ou se o Move for interrompido, a resolução deve priorizar posição física segura; o comportamento exato nesses casos **ainda exige homologação**, não deve ser presumido.

### VFX e SFX

- **Avanço:** uma pós-imagem branca translúcida permanece brevemente na origem; **três a cinco rastros alongados** acompanham a trajetória; o corpo recebe contorno luminoso leve, sem se transformar em bola de energia.
- **Contato:** pequena explosão de linhas radiais e sparkles brancos exatamente no ponto da colisão, junto com o VFX normal de impacto do combate.
- **Retorno:** segunda passagem luminosa mais fina percorre o caminho inverso; a pós-imagem original se dissolve quando o personagem retorna.
- **Som:** dois whooshes rápidos e secos (aproximação e retorno), com impacto físico breve entre eles **somente se houver acerto**.

**Molde reutilizável:** aproximação veloz, seleção automática de alvo, contato Melee, retorno à origem, execução em fases e rastros de pós-imagem.

---

## 3. Swift — Estrelas Velozes

**Categoria:** Burst  
**Tipo:** Projectile  
**Power Level:** PL1

### Descrição e identidade

O personagem dispara **três estrelas luminosas** em direção ao adversário. Os projéteis seguem trajetórias ligeiramente diferentes e recebem uma correção limitada de direção durante curta janela de homing, **sem garantia de acerto**. Em comparação com Psyshock, é um disparo rápido sem Charge.

### Parâmetros iniciais propostos

| Parâmetro | Valor |
|---|---:|
| Stamina | 0,8 |
| Cooldown | 7 s |
| Quantidade | 3 projéteis |
| Velocidade | 15 m/s |
| Dano nominal | 3 HP por estrela |
| Homing | 0,25 s |
| Correção angular | 90°/s |
| Alcance máximo | 12 m |
| Knockback horizontal | 0,3 m/s por acerto |
| Knockback máximo | 0,9 m/s por execução e por alvo |
| Knockback vertical | 0 m/s |
| Power Level | PL1 |

### Funcionamento e interações

As estrelas são criadas no disparo e possuem **colisores e resoluções de acerto individuais**. Com lock-on, procuram a posição válida do alvo durante 0,25 s; sem lock-on, seguem pequeno **leque frontal**. Cada projétil pode ser defendido, evitado por i-frames, refletido ou neutralizado conforme elegibilidade, PL, Clash/Counter e propriedades da defesa/Field existentes. O limite de knockback é cumulativo **por alvo e por execução**; os três pequenos impactos não provocam lançamento desproporcional. Não duplicar dano nem propriedade ao refletir.

### VFX e SFX

- **Disparo:** três estrelas tridimensionais branco-douradas com núcleo luminoso e bordas geométricas definidas.
- **Voo:** pequena rotação individual e rastros luminosos curtos, separados por projétil.
- **Contato:** cada estrela se fragmenta em pequenos estilhaços brilhantes que desaparecem rapidamente.
- **Som:** três notas cristalinas rápidas no disparo, seguidas de impactos leves e agudos quando houver colisões.

**Molde reutilizável:** múltiplos projéteis, homing parcial, colisão por entidade, propriedade, reflexão, neutralização e acumulação controlada de knockback.

---

## 4. Harden — Endurecimento

**Categoria:** Normal  
**Tipo:** Status  
**Power Level:** **sem PL**

### Descrição e identidade

O personagem endurece temporariamente o corpo, aumentando sua **Defesa em 30%** e **negando integralmente o knockback de combate** enquanto o efeito durar. A proposta substitui explicitamente o bônus anterior de 15% e a antiga ideia de não proteger contra knockback.

### Parâmetros iniciais propostos

| Parâmetro | Valor |
|---|---:|
| Stamina | 0,8 |
| Cooldown | 10 s |
| Cast | 0,35 s |
| Duração | 5 s |
| Bônus de Defesa | **+30%** |
| Knockback ofensivo recebido | **0%** |
| Dano causado | Nenhum |
| Power Level | Sem PL |

### Funcionamento e interações

Durante os 5 s, o personagem possui o bônus de Defesa e **nega o empurrão/lançamento ofensivo horizontal e vertical** originado por ataques, projéteis e efeitos ofensivos. Um Tackle PL3 ainda pode causar dano, mas **não arremessa** o usuário de Harden. Isso **não** concede invulnerabilidade, não elimina hit stun ou guard stun, e não reduz automaticamente dano por regra nova.

A **gravidade e a física normal continuam**: o personagem pode caminhar, correr, pular, cair e colidir com sólidos. A proteção contra knockback **não impede quedas**, nem mantém o personagem no ar, nem autoriza penetrar objetos. A classificação de **empurrões contínuos de Fields** como knockback coberto ou não ainda requer definição específica antes de homologação.

### VFX e SFX

- **Ativação:** painéis geométricos semitransparentes aparecem sobre o corpo como uma fina camada de cristal branco solidificando-se.
- **Efeito persistente:** contorno angular discreto e brilho branco-prateado na superfície sem esconder o personagem.
- **Ao receber impacto:** ondulação geométrica breve comunica que o golpe foi absorvido sem deslocamento.
- **Expiração:** os elementos cristalinos se desfazem em pequenos fragmentos luminosos.
- **Som:** endurecimento cristalino curto, com ressonância grave moderada; golpes recebidos soam sólidos, sem som de lançamento.

**Molde reutilizável:** buffs temporários, modificadores de atributos, imunidades específicas a consequências físicas, VFX persistentes e distinção entre dano e knockback.

---

## 5. Spikes — Armadilha de Espinhos

**Categoria:** Normal  
**Tipo:** Field  
**Power Level:** PL1 **na componente ofensiva**

### Descrição e identidade

O usuário materializa uma **armadilha de espinhos em um local válido da arena**. Quando o adversário entra fisicamente na região ofensiva, sofre dano e consome a armadilha. É uma adaptação de uma armadilha de entrada de Pokémon para um objeto posicionado no campo tridimensional de Arenamon.

### Parâmetros iniciais propostos

| Parâmetro | Valor |
|---|---:|
| Stamina | 1 |
| Cooldown | 10 s |
| Cast | 0,40 s |
| Alcance de colocação | 5 m |
| Raio do campo | 1,2 m |
| Duração máxima | 8 s |
| Dano nominal | 6 HP |
| Ativações | 1 por armadilha |
| Knockback horizontal | **0 m/s** |
| Knockback vertical | **0 m/s** |
| Power Level ofensivo | PL1 |

### Funcionamento e interações

O jogador escolhe a superfície de apoio, confirma a colocação e **solta o botão para iniciar o cast**. Após o cast, o Field passa a existir sobre o apoio selecionado, inclusive em rampas e plataformas quando válidas. Não aparece dentro de paredes, personagens ou outros obstáculos que impossibilitem a colocação. A colisão é espacial e acompanha a inclinação do suporte. Se uma plataforma sustentadora for destruída, a armadilha não deve ficar flutuando; o destino preciso da entidade após perda de suporte precisa respeitar o contrato de objetos do mapa ou receber decisão específica.

**Proposta:** Spikes causa **dano sem knockback**, atinge somente adversários e desaparece após o primeiro acionamento ofensivo bem-sucedido. Defesa, invulnerabilidade, Fields e PL/Clash/Counter obedecem às regras de elegibilidade vigentes. Se o golpe produzir reação de acerto, essa reação não pode introduzir knockback inexistente. A classificação do dano da armadilha quanto a proteções como Sturdy ainda necessita homologação específica.

### VFX e SFX

- **Materialização:** pequenas rachaduras luminosas no solo; **cinco a sete espinhos geométricos** emergem em sequência rápida.
- **Armadilha ativa:** espinhos físicos visíveis com brilho sutil nas pontas.
- **Acionamento:** os espinhos pulsam e se fragmentam em pequenos estilhaços.
- **Som:** materialização mineral/cristalina; no contato, estalo cortante e fragmentação curta.

**Molde reutilizável:** entidades persistentes, armadilhas, eventos por contato, colocação em superfícies, duração, desaparecimento, colisão e física do mapa.

---

## 6. Bounce — Salto Ofensivo (substitui Teleport)

**Categoria:** Charge  
**Tipo principal:** Trick  
**Tipo secundário ofensivo:** Melee  
**Power Level:** **PL1, PL2 ou PL3 conforme a carga**

### Descrição e identidade

O personagem concentra força nas pernas, executa um **salto extraordinariamente alto**, avança em arco na direção do destino selecionado e atinge o adversário durante a descida, finalizando com impacto de aterrissagem. É uma tradução de Bounce para combate 3D em tempo real, **sem teletransporte** e **sem invulnerabilidade automática**. Este Move ocupa a quinta posição do catálogo no lugar de Teleport.

### Parâmetros iniciais propostos

| Parâmetro | Valor |
|---|---:|
| Stamina | 1,2 |
| Cooldown | 12 s |
| Carga máxima | 1,20 s |
| Distância horizontal máxima | 6 m |
| Dano nominal | 12 HP |
| Knockback horizontal | 3 m/s |
| Knockback vertical | 6 m/s |
| Recuperação após aterrissagem | 0,25 s |

### Progressão de Power Level (marcos aprovados para Charge)

| Carga acumulada | PL | Altura máxima inicial proposta |
|---|---|---:|
| **0 a 0,59 s** (abaixo de 50%) | **PL1** | **1,5 m** |
| **0,60 a 1,19 s** (de 50% até antes de 100%) | **PL2** | **2,5 m** |
| **1,20 s** (carga máxima) | **PL3** | **3,5 m** |

As alturas são **parâmetros experimentais**, não decisões universais. O PL do componente ofensivo é determinado pela carga da execução, seguindo os marcos aprovados. Como Charge, a stamina e a recarga são cobradas **ao iniciar a carga**, nos termos da regra geral vigente.

### Funcionamento e interações

O jogador mantém o botão para carregar; a soltura inicia o salto físico em arco rumo ao destino escolhido. A carga define altura e PL. A trajetória considera **gravidade, tetos, superfícies elevadas, plataformas, obstáculos, colisores e apoio real**. O ataque é ofensivo durante a janela válida de contato na descida, antes ou durante a aterrissagem conforme a geometria; o alvo pode escapar e o golpe pode errar. O usuário aterrissa sobre a **superfície efetivamente alcançada**, não sobre uma altura imaginária, respeitando a recuperação após pouso.

Bounce não atravessa plataformas, não flutua sem apoio físico e não força reposicionamento arbitrário para o chão original. As permissões específicas de uso **em estados aéreos especiais** ainda dependem de decisão, sem revogar regras existentes de salto, lançamento ou estados de combate.

### VFX e SFX

- **Carga:** anel luminoso horizontal que se comprime sob os pés, com linhas de energia ascendente.
- **Salto:** pequena onda circular na superfície inicial, seguida de rastro branco-azulado ao longo da curva real.
- **Descida:** o rastro alonga e intensifica à aproximação do impacto.
- **Acerto/aterrissagem:** círculo de choque se expande pelo chão, acompanhado de partículas e pequenos fragmentos; o efeito deve distinguir impacto ofensivo de pouso sem acerto.
- **Som:** tensão ascendente na carga, whoosh forte no salto, ar cortado durante descida e impacto grave no pouso.

**Molde reutilizável:** Tricks ofensivos, salto especial, trajetória balística, PL por carga, colisão vertical, impacto de aterrissagem e transição entre estados.

---

## 7. Regras compartilhadas e requisitos de integração

1. **Todas as descrições são propostas de Move e moldes técnicos; este documento por si só não implementa código.** Os números e novos comportamentos permanecem ajustáveis e devem ser verificados em laboratório antes de homologação final.
2. **Categorizações obrigatórias:** Quick Attack = Burst/Melee/PL1; Swift = Burst/Projectile/PL1; Harden = Normal/Status/sem PL; Spikes = Normal/Field/PL1 ofensivo; Bounce = Charge/Trick + Melee/PL variável.
3. **Cobrança transversal:** Normal/Burst após confirmação e soltura, no cast; Charge no início da carga, conforme documento de Mushroom. Não inventar exceções silenciosas.
4. **Resolução de combate:** respeitar defesa parcial/perfeita, i-frames, hit stun, guard stun, interrupções, knockback, colisões, Clash/Counter, Power Level e hitstop **somente onde o tipo e a interação forem elegíveis**.
5. **Parâmetros capturados:** alterações em sliders afetam os **próximos usos**, e não projéteis, armadilhas ou execuções já criadas.
6. **Geometria real:** deslocamentos e entidades respeitam obstáculos, superfícies e altura tridimensional. VFX não define colisão.
7. **VFX/SFX:** executar por eventos reais, com rastreabilidade de origem e alvo; evitar dupla emissão e efeitos de contato fantasma.
8. **Paridade:** nenhum Move altera o comportamento do jogo enquanto não estiver equipado/executado. IA e jogador obedecem às mesmas condições de elegibilidade.
9. **Sliders mínimos por Move:** stamina, cooldown, tempos, dano, knockback, alcance/geometria, duração, parâmetros próprios e intensidade/quantidade do VFX quando pertinentes.
10. **Pendências materiais para homologação:** (a) retorno impossível/interrupção de Quick Attack; (b) escopo da imunidade de Harden diante de empurrões contínuos de Fields; (c) elegibilidade aérea especial de Bounce; (d) perda de apoio e classificação de dano/defesa de Spikes. Não substituir essas escolhas por suposições.

## 8. Fundamentação e precedência

- `docs/MOVES_DECISOES_RODADAS.md` — categorias, tipos, PL, Clash/Counter, regras compartilhadas e parâmetros capturados.
- `docs/MUSHROOM_MOVES_DECISOES.md` — diretriz **posterior** e universal de cobrança de recursos dos Moves; escopo dos Moves particulares de Mushroom não é alterado por este catálogo.
- `docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md` — regras aprovadas de colisão, salto, plataformas, objetos e mundo 3D.
- `docs/PASSIVAS_DECISOES.md` — regras de passivas, necessárias para interações como Sturdy e modificadores de atributos; este catálogo **não modifica** essas decisões.

**Registro:** esta entrega cataloga os cinco Moves e seus elementos mecânicos/audiovisuais para implementação e homologação futuras. Não altera documentos históricos nem cria uma aprovação automática de detalhes pendentes.