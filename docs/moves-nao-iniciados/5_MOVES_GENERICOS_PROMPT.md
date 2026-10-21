# Arenamon — 5 Moves Genéricos Adicionais

> **Documento de decisões de design — fonte para implementação futura.**  
> **Data:** 21/10/2026. **Status:** proposta de design; valores numéricos e regras adicionais sujeitos à homologação individual. **Não implementado por este registro.**  
> **Repositório:** `Ziaker/Arenamon`  
> **Base estrutural:** `docs/moves-nao-iniciados/EMERGING_STONE_PROMPT_IMPLEMENTACAO.md`, `docs/MOVES_GENERICOS_CATALOGO.md`, `docs/tackle/VER_TACKLE.html` (41f @ 30fps, v26), `docs/JANELAS_COMBATE_RESOLVE_HIT.md`.

---

## 1. Objetivo e enquadramento

Os cinco Moves abaixo são propostas **genéricas adicionais** ao catálogo aprovado (`Quick Attack`, `Swift`, `Harden`, `Spikes`, `Bounce`), candidatos a uso por **Croagunk, Drowzee, Mush/Mushroom e Vigoroth** — e potencialmente a todos os personagens futuros — independentemente das restrições de aprendizado dos jogos Pokémon. Cada um ocupa uma família oficial do Arenamon: **Melee, Trick, Status** ou combinações, sem duplicar a identidade mecânica dos cinco já homologados.

As categorias oficiais de execução são **Normal, Charge e Burst**. **Burst** significa ativação sem período de carga; os deslocamentos e efeitos resultantes ainda possuem duração física. O **Power Level (PL)** pertence à execução do Move; efeitos ofensivos elegíveis participam de Clash/Counter segundo as regras já estabelecidas. **Status e Trick puros não recebem PL** por padrão; quando um Status possui componente ofensivo (como Riposte), o componente ofensivo utiliza PL.

**Regra transversal de cobrança já aprovada:** para Moves **não-Charge** (Normal ou Burst), gasto de recursos e início de cooldown ocorrem **no cast, após a confirmação do alvo ou local, ao soltar o botão**; para Moves **Charge**, a cobrança ocorre **quando a carga é ativada**. Não voltar a discutir ou alterar esta regra por Move. Fonte: `docs/MUSHROOM_MOVES_DECISOES.md`, diretriz geral de 20/10/2026.

**Regra de parâmetros:** sliders afetam **usos posteriores**; entidades e execuções já existentes preservam os valores capturados quando foram criadas, conforme M28.4 de `docs/MOVES_DECISOES_RODADAS.md`.

**Regra de animação:** todos os Moves ofensivos (Lunge, Guard Break, Riposte) utilizam o **esqueleto de animação do Tackle aprovado** — 41 frames a 30 FPS (1,36 s), em 8 fases — como molde temporal. A duração pode ser comprimida ou estendida proporcionalmente, mas a **ordem das fases e suas propriedades (smear, stretch, follow-through, recovery, pulinho, convergência)** são preservadas salvo decisão em contrário.

---

## 2. Visão geral

| Move | Execução | Tipo principal / secundário | PL | Stamina | Cooldown | Duração total |
|---|---|---|---:|---:|---:|---:|
| **Lunge** | **Burst** | **Melee** | **PL1** | **0,75** | **6 s** | **0,60 s** |
| **Guard Break** | **Charge** | **Melee** | **PL1 / PL2 / PL3** | **1,0** | **10 s** | **0,70 s** (pós-soltura) |
| **Feint** | **Burst** | **Trick** | **Sem PL** | **0,30** | **3 s** | **0,22 s** |
| **Riposte** | **Normal** | **Status + Melee** | **PL1** (riposte) | **0,80** | **8 s** | **0,65 s** |
| **Second Wind** | **Normal** | **Status** | **Sem PL** | **0,80** | **12 s** | **0,50 s** |

**Knockback e impacto:**

| Move | Knockback horizontal | Knockback vertical | Dano nominal |
|---|---|---:|---:|
| Lunge | 4 m/s | 0 m/s | 8 HP |
| Guard Break | 2 m/s (guard stun 0,50 s) | 0 m/s | 6 HP |
| Feint | — | — | — |
| Riposte | 3 m/s | 0 m/s | 6 HP (condicional) |
| Second Wind | — | — | — |

---

## 3. Lunge — Investida Rápida

**Categoria:** Burst  
**Tipo:** Melee  
**Power Level:** PL1

### 3.1 Descrição e identidade

O personagem avança em linha reta em alta velocidade, aplicando um **Tackle de curta distância** e permanecendo no ponto final. Diferente de **Quick Attack**, não há retorno automático à origem; diferente do **Tackle padrão de botão**, este é um Move de slot com propriedades de PL1 elegíveis a Clash/Counter e knockback consistente.

### 3.2 Parâmetros propostos

| Parâmetro | Valor |
|---|---:|
| Alcance máximo | **3,5 m** |
| Stamina | **0,75** |
| Cooldown | **6 s** |
| Duração total | **0,60 s** |
| Velocidade de avanço | Pico de **0,47 m/frame** (≈ 14,1 m/s a 30fps) |
| Dano nominal | **8 HP** |
| Knockback horizontal | **4 m/s** |
| Knockback vertical | **0 m/s** |
| Power Level | **PL1** |
| Cancelável após | **0,45 s** |

### 3.3 Mapeamento no esqueleto do Tackle (g0–40, 41 frames @ 30fps)

| Fase | Frames | Conteúdo |
|---|---|---|
| Antecipação | g0–3 | Perna de apoio travada, tronco inclinado 15°, braço mirando o alvo |
| Smear/Disparo | g4–8 | Smear 5f, escala +15%, **braço líder antes do tronco** (regra do tackle) |
| Stretch & Contato | g9–12 | Stretch 4f; **hitbox ativa** `[g9, g13)`; pico de velocidade 0,47 m/frame |
| Continuação | g13 | Follow-through, pé de apoio travado |
| Recuperação 1 | g14–17 | Absorção de impacto |
| Recuperação 2 | g18–26 | Balanço residual (sem congelamento) |
| Pulinho | g27–30 | Reposicionamento 5,5 cm |
| Retorno | g31–40 | Convergência exata ao idle em g40 |

**Duração real:** 0,60 s ≈ 18 frames comprimidos do molde de 41f. A proporção entre fases é mantida: antecipação 18%, smear 14%, stretch 11%, continuação 3%, recuperação 38%, pulinho 11%, retorno 25%.

### 3.4 Janelas de combate (semiabertas, steps a 120 Hz)

Convertendo 0,60 s @ 30fps (18 frames) para 120 Hz (72 steps):

| Janela | Steps | Observação |
|---|---|---|
| Hitbox ativa | `[[36, 52))` | g9–g13 em 30fps |
| Invulnerável | `[[0, 16))` | g0–g3 em 30fps (antecipação defensiva) |
| Cancelável | `[[48, 72))` | Após contato, permite encadear esquiva ou outro move |

### 3.5 Funcionamento e interações

1. **Confirmação e disparo:** após a confirmação da direção (input direcional + botão de ação), o Burst inicia imediatamente. **Cobrança de stamina e cooldown ocorre na confirmação/soltura**, antes do avanço físico.
2. **Aproximação:** deslocamento em linha reta na direção confirmada, com verificação contínua de colisão. Não atravessa paredes, obstáculos ou geometria sólida.
3. **Contato:** resolve como Tackle — defesa parcial/perfeita, i-frames, Clash/Counter com PL1 elegível, hitstop.
4. **Follow-through:** o personagem permanece no ponto final do avanço (não retorna à origem).
5. **Recuperação:** balanço residual permite cancelamento por esquiva ou outro move após 0,45 s, mas o controle pleno só retorna em 0,60 s.

**Interações específicas:**
- **Clash:** Lunge PL1 empata com Tackle PL1; perde para Bullet Punch PL2 (regra transversal de PL).
- **Defesa perfeita:** anula dano e knockback; o atacante sofre hitstop normal.
- **i-frames:** alvo em i-frames não recebe dano nem knockback.
- **Cancelamento:** pode ser cancelado por Feint durante a antecipação (g0–g3), mas não após o smear.

### 3.6 VFX e SFX

- **Avanço:** pós-imagem branca translúcida breve na origem; rastro de poeira nas pegadas (família `vfx-solido`).
- **Contato:** pequena explosão de linhas radiais e sparkles brancos no ponto de colisão, junto com o VFX normal de impacto.
- **Som:** whoosh seco no avanço, impacto físico breve no contato (somente se houver acerto).

### 3.7 Testes obrigatórios

1. Disparo único por confirmação; sem duplo cast.
2. Stamina 0,75 e cooldown 6 s cobrados somente após confirmação/soltura.
3. Interrupção antes do contato: cancela sem reembolso se recursos já cobrados.
4. Contato com defesa parcial: dano reduzido, knockback reduzido.
5. Contato com defesa perfeita: dano 0, knockback 0, hitstop aplicado.
6. Clash com Tackle PL1: empate; com PL2: derrota.
7. i-frames do alvo: sem dano, sem knockback.
8. Cancelamento por Feint durante g0–g3: sucesso; durante g4+: falha.
9. Colisão com parede: para no contato, aplica recuperação.
10. Determinismo: mesma seed, mesmo resultado.

### 3.8 Pendências

- **GM-P01:** valor exato de redução de dano/knockback sob defesa parcial (proposta: 50% de redução, a confirmar).
- **GM-P02:** interação com campos de força (Reflect, Spikes) — Lunge é afetado normalmente por Reflect?
- **GM-P03:** comportamento exato em rampas/declives (alinhar ao solo ou manter direção do input?).

---

## 4. Guard Break — Quebra de Guarda

**Categoria:** Charge  
**Tipo:** Melee  
**Power Level:** PL1 / PL2 / PL3 (conforme carga)

### 4.1 Descrição e identidade

O personagem concentra força em um golpe carregado e lento. Se conectar em um oponente defendendo, **derruba a guarda** e causa stagger breve. O valor real é a quebra defensiva, não o dano nominal. Como Charge, a cobrança ocorre **no início da carga**.

### 4.2 Parâmetros propostos

| Parâmetro | Valor |
|---|---:|
| Carga máxima | **1,0 s** |
| Stamina | **1,0** |
| Cooldown | **10 s** |
| Duração (pós-soltura) | **0,70 s** |
| Dano nominal | **6 HP** |
| Knockback horizontal | **2 m/s** |
| Knockback vertical | **0 m/s** |
| Guard stun | **0,50 s** (proposta) |
| Power Level | **PL1 / PL2 / PL3** |

### 4.3 Progressão de Power Level (marcos consistentes com Bounce)

| Carga acumulada | PL | Postura visual |
|---|---|---|
| **0 a 0,49 s** (abaixo de 50%) | **PL1** | Antecipação baixa, g0–g6 alongada |
| **0,50 a 0,99 s** (de 50% até antes de 100%) | **PL2** | Postura média, smear mais intenso |
| **1,00 s** (carga máxima) | **PL3** | Punho visual "ref hulk curl" (f22 do tackle), impacto esmagador |

### 4.4 Mapeamento no esqueleto do Tackle (g0–40, comprimido/estendido)

| Fase | Frames | Conteúdo |
|---|---|---|
| Antecipação | g0–6 (PL1) / g0–10 (PL3) | Postura proporcional à carga; punho recuado |
| Smear/Disparo | g+4–8 | Smear 5f, escala +15% |
| Stretch & Contato | g+9–15 | Stretch 4f; **hitbox ativa** `[g10, g16)`; braço inteiro como massa |
| Continuação | g+16 | Follow-through pesado |
| Recuperação 1+2 | g+17–35 | Recuperação longa (preço da leitura) |
| Pulinho | g+36–38 | Reposicionamento mínimo |
| Retorno | g+39–40 | Convergência ao idle |

**Nota:** a antecipação é **proporcional à carga**. No release imediato (0 s de carga), antecipação g0–g3 comprimida; na carga máxima, antecipação estendida g0–g10.

### 4.5 Janelas de combate (semiabertas, steps a 120 Hz)

| Janela | Steps | Observação |
|---|---|---|
| Hitbox ativa | `[[40, 64))` | g10–g16 em 30fps |
| Cancelável | `[[56, 84))` | Após contato, permite esquiva |
| Vulnerável | `[[0, 40))` | Todo o startup é punível |

### 4.6 Funcionamento e interações

1. **Ativação da carga:** ao pressionar o botão, inicia a carga. **Stamina e cooldown são cobrados imediatamente** (regra Charge).
2. **Carga:** o personagem pode soltar a qualquer momento. A carga define o PL e a postura visual.
3. **Soltura:** inicia o golpe físico. O destino é a posição à frente do personagem (direção do input), sem mira livre.
4. **Contato:** se o oponente estiver em **defesa ativa** (guard), aplica **guard stun de 0,50 s** (proposta) e derruba a guarda. Se não estiver defendendo, aplica dano nominal e knockback normal.
5. **Não causa knockback padrão em defensor:** o valor é o guard stun, não o lançamento. O dano nominal continua aplicável.

**Interações específicas:**
- **Defesa perfeita:** anula dano, mas **não anula o guard stun** (a menos que homologado em contrário). Proposta: defesa perfeita anula ambos.
- **i-frames:** anula dano e guard stun.
- **Clash:** Guard Break PL3 vence Tackle PL1; empata com Guard Break PL3.
- **Harden:** se o oponente estiver sob Harden, knockback é anulado, mas guard stun **ainda se aplica** (proposta — força a troca de defesa para esquiva).

### 4.7 VFX e SFX

- **Carga:** anel de tensão ao redor do punho, crescendo com a carga; partículas de energia condensada.
- **Smear:** rastro pesado, sem a leveza do Lunge.
- **Contato (guard):** onda de choque frontal, fragmentos de "escudo quebrado" (VFX simbólico), som de vidro quebrando/grave.
- **Contato (normal):** impacto pesado de corpo a corpo, som de impacto seco.

### 4.8 Testes obrigatórios

1. Carga PL1/PL2/PL3: postura e hitbox consistentes.
2. Cobrança no início da carga; interrupção durante carga mantém custo.
3. Soltura antes de 50%: PL1; entre 50–99%: PL2; 100%: PL3.
4. Contato com defesa ativa: guard stun de 0,50 s aplicado.
5. Contato com defesa perfeita: dano 0, knockback 0, guard stun 0 (proposta).
6. Contato com Harden: knockback 0, guard stun aplicado (proposta).
7. i-frames: sem efeitos.
8. Clash: PL3 vence PL1; empate PL3 vs PL3.
9. Recuperação longa: janela de punição verificável.
10. Determinismo: mesma carga, mesmo resultado.

### 4.9 Pendências

- **GM-P04:** duração exata do guard stun (proposta: 0,50 s; requer homologação).
- **GM-P05:** interação com defesa perfeita — anula guard stun ou não?
- **GM-P06:** interação com Harden — guard stun aplica sobre knockback negado?
- **GM-P07:** comportamento se o oponente não estiver defendendo (dano + knockback leve, ou só dano?).

---

## 5. Feint — Finta Ofensiva

**Categoria:** Burst  
**Tipo:** Trick  
**Power Level:** Sem PL

### 5.1 Descrição e identidade

Cancela a animação de qualquer ataque carregado ou em execução em um flash curto, permitindo reposicionar ou encadear outra ação imediatamente. Não causa dano nem interage com Clash/Counter — é ferramenta de mente, não de força. Já existe propriedade `feint` no Tackle (`tackle-feint.test.mjs`); este Move formaliza a Feint como ação de slot independente.

### 5.2 Parâmetros propostos

| Parâmetro | Valor |
|---|---:|
| Stamina | **0,30** |
| Cooldown | **3 s** |
| Duração total | **0,22 s** |
| Cancelável de | `[tackle, quebra-de-guarda, lunge]` (ações carregáveis/ofensivas) |
| Dano | — |
| Knockback | — |
| Power Level | **Sem PL** |

### 5.3 Mapeamento no esqueleto do Tackle (comprimido)

| Fase | Frames | Conteúdo |
|---|---|---|
| Antecipação | g0–g3 (comprimido em 4f) | Inclinação mínima, **sem smear, sem stretch** |
| Pulinho | g5–g8 | Recuo que compra distância (5,5 cm a 40 cm conforme direção do input) |
| Retorno | g9–g12 | Convergência ao idle |

**Duração real:** 0,22 s ≈ 7 frames a 30fps. Sem fases de smear, stretch ou continuação — movimento defensivo/Trick não recebe linguagem ofensiva.

### 5.4 Janelas de combate (semiabertas, steps a 120 Hz)

| Janela | Steps | Observação |
|---|---|---|
| Cancel window | `[[4, 14))` | Permite encadear esquiva ou outro move |
| Invulnerável | `[[2, 10))` | Micro-janela de i-frames durante o recuo |

### 5.5 Funcionamento e interações

1. **Disparo:** Burst imediato ao pressionar o botão. **Cobrança na confirmação/soltura**.
2. **Cancelamento:** se usado durante a antecipação (g0–g3) de Lunge, Guard Break (pré-soltura) ou Tackle, interrompe a ação anterior e inicia o recuo.
3. **Recuo:** pequeno deslocamento para trás ou lateral (conforme input direcional), com duas pós-imagens translúcidas.
4. **Encadeamento:** ao final do recuo (0,22 s), o personagem pode iniciar imediatamente qualquer ação — ataque, esquiva, defesa ou outro move.

**Interações específicas:**
- **Não interage com Clash/Counter:** Trick puro, sem PL.
- **Punível:** se usado fora de janela de cancelamento (ex: durante o stretch de Lunge), o personagem executa a animação de Feint normalmente, mas a ação anterior continua — resultando em punição.
- **Stamina baixa:** custo 0,30 permite uso frequente, mas cooldown de 3 s evita spam.

### 5.6 VFX e SFX

- **Cancelamento:** duas pós-imagens translúcidas do personagem — uma na posição original, outra na posição de recuo.
- **Recuo:** pequeno rastro de poeira, sem impacto.
- **Som:** whoosh curto e seco, como um "corte" no ar.

### 5.7 Testes obrigatórios

1. Cancelamento de Lunge durante g0–g3: sucesso.
2. Cancelamento de Lunge durante g4+: falha (Feint executa, Lunge continua).
3. Cancelamento de Guard Break durante carga: sucesso, sem reembolso de stamina/cooldown do Guard Break.
4. Stamina 0,30 e cooldown 3 s cobrados na confirmação.
5. Sem interação com Clash/Counter.
6. i-frames durante recuo: sem dano/knockback.
7. Encadeamento imediato após 0,22 s.
8. Determinismo: mesmo input, mesmo resultado.

### 5.8 Pendências

- **GM-P08:** lista exata de ações canceláveis além de Lunge, Guard Break e Tackle.
- **GM-P09:** punição por uso fora de janela — animação de Feint completa ou interrupção parcial?

---

## 6. Riposte — Contra-ataque

**Categoria:** Normal  
**Tipo:** Status + Melee (riposte)  
**Power Level:** PL1 (apenas no riposte)

### 6.1 Descrição e identidade

Janela defensiva-ofensiva com timing. O personagem adota uma postura baixa por um breve instante; se for atingido durante a janela de riposte, anula o dano, cancela o knockback e responde automaticamente com um golpe rápido de dano moderado. Distinto da **defesa perfeita** (mecânica de botão de defesa) e de **Reflect** (barreira persistente) — é uma aposta de timing.

### 6.2 Parâmetros propostos

| Parâmetro | Valor |
|---|---:|
| Stamina | **0,80** |
| Cooldown | **8 s** |
| Duração total | **0,65 s** |
| Janela de riposte | **0,13 s a 0,30 s** (janela ativa de 0,17 s) |
| Dano do riposte | **6 HP** |
| Knockback horizontal (riposte) | **3 m/s** |
| Knockback vertical | **0 m/s** |
| Power Level | **PL1** (somente no riposte) |

### 6.3 Mapeamento no esqueleto do Tackle (adaptado)

| Fase | Frames | Conteúdo |
|---|---|---|
| Antecipação | g0–g3 | Postura baixa, arma/membro recuado |
| Riposte window | g4–g8 | **Janela ativa** `[g4, g9)`; se sofrer hit elegível aqui, dispara riposte |
| Riposte (gatilhado) | g9–g12 | Stretch 3f + smear 3f (metade do tackle, pois é reação) |
| Recuperação (sucesso) | g13–g30 | Follow-through curto, pulinho g20–g23, retorno g24–30 |
| Recuperação (falha) | g9–g30 | Sem pulinho de reposicionamento — punição visual da falha |
| Retorno | g31–g40 | Convergência ao idle em g40 |

**Duração real:** 0,65 s ≈ 20 frames a 30fps.

### 6.4 Janelas de combate (semiabertas, steps a 120 Hz)

| Janela | Steps | Observação |
|---|---|---|
| Riposte window | `[[16, 36))` | g4–g9 em 30fps |
| Riposte ativo | `[[36, 48))` | g9–g12 em 30fps, PL1 elegível |
| Invulnerável (se gatilhada) | `[[16, 36))` | Durante a janela de riposte |
| Invulnerável (falha) | `[]` | Sem invulnerabilidade se não gatilhada |

### 6.5 Funcionamento e interações

1. **Cast:** ao pressionar e confirmar, inicia o cast de 0,65 s. **Cobrança na confirmação/soltura**.
2. **Janela de riposte:** entre 0,13 s e 0,30 s (0,17 s de janela). Se o usuário sofrer hit elegível neste intervalo:
   - Dano do atacante é **anulado**.
   - Knockback do atacante é **cancelado**.
   - Riposte dispara automaticamente: hitbox ativa PL1, dano 6 HP, knockback 3 m/s.
3. **Se não houver gatilho:** a janela expira e o personagem entra em recuperação exposta (g9–g30 sem pulinho).
4. **Elegibilidade:** não anula grabs nem Guard Break (mantém o triângulo tático intacto).

**Interações específicas:**
- **Grab:** atravessa a janela de riposte — o usuário é agarrado normalmente.
- **Guard Break:** se o Guard Break conectar durante a janela, o usuário sofre guard stun (proposta: Riposte não anula guard stun de Guard Break).
- **i-frames do atacante:** se o atacante estiver em i-frames, o riposte não conecta (sem dano, sem knockback).
- **Clash:** riposte PL1 empata com Tackle PL1.

### 6.6 VFX e SFX

- **Antecipação:** brilho sutil no membro/arma, postura baixa.
- **Gatilho:** flash branco no ponto de contato, parada de tempo micro (hitstop de 0,05 s), contra-ataque instantâneo.
- **Riposte:** rastro curto e rápido, impacto seco.
- **Falha:** personagem balança levemente, som de "esforço vazio".

### 6.7 Testes obrigatórios

1. Gatilho durante janela: dano anulado, riposte dispara.
2. Gatilho fora da janela: dano normal, sem riposte.
3. Grab durante janela: agarra normalmente (não anulado).
4. Guard Break durante janela: guard stun aplica (proposta).
5. i-frames do atacante: riposte não conecta.
6. Clash: riposte PL1 empata com Tackle PL1.
7. Stamina 0,80 e cooldown 8 s cobrados na confirmação.
8. Interrupção durante cast: cancela, sem reembolso se cobrado.
9. Determinismo: mesmo timing, mesmo resultado.

### 6.8 Pendências

- **GM-P10:** Riposte anula guard stun de Guard Break ou não?
- **GM-P11:** comportamento contra multi-hit (uma janela anula um hit ou a sequência inteira?).
- **GM-P12:** duração exata da janela (proposta: 0,17 s; a confirmar).

---

## 7. Second Wind — Segundo Fôlego

**Categoria:** Normal  
**Tipo:** Status  
**Power Level:** Sem PL

### 7.1 Descrição e identidade

Por um período curto, o personagem regenera stamina em taxa aumentada e reduz o custo de esquiva e sprint. Não recupera HP. Move de gerenciamento de recurso puro — vira o momento de um round sem ser um "botão de cura".

### 7.2 Parâmetros propostos

| Parâmetro | Valor |
|---|---:|
| Stamina | **0,80** |
| Cooldown | **12 s** |
| Cast | **0,35 s** |
| Duração do efeito | **5 s** |
| Regeneração de stamina | **+40% / s** |
| Redução de custo de esquiva/sprint | **25%** |
| Dano | — |
| Knockback | — |
| Power Level | **Sem PL** |

### 7.3 Mapeamento no esqueleto do Tackle (adaptado — sem linguagem ofensiva)

| Fase | Frames | Conteúdo |
|---|---|---|
| Inspiração | g0–g15 | Loop de "balanço de respiração" (das fases Recuperação 2 do tackle) |
| Pulinho | g16–g19 | Reposicionamento leve |
| Retorno | g20–g28 | Convergência ao idle |

**Duração real:** 0,50 s ≈ 15 frames a 30fps. **Sem smear, sem stretch** — movimento de buff não recebe linguagem ofensiva.

### 7.4 Janelas de combate (semiabertas, steps a 120 Hz)

| Janela | Steps | Observação |
|---|---|---|
| Cast | `[[0, 42))` | 0,35 s de cast; vulnerável |
| Efeito ativo | Disparo em `step 42` | Inicia após cast concluído |

### 7.5 Funcionamento e interações

1. **Cast:** ao pressionar e confirmar, inicia cast de 0,35 s. **Cobrança na confirmação/soltura**.
2. **Ativação:** após o cast, o buff é aplicado. Duração: 5 s.
3. **Efeitos:**
   - Regeneração de stamina: +40% da stamina máxima por segundo.
   - Redução de custo: esquivas e sprints custam 25% a menos de stamina.
4. **Restrições:** não recupera HP; não afeta cooldown de moves; não concede invulnerabilidade.
5. **Cancelamento:** pode ser interrompido durante o cast; se interrompido, **stamina e cooldown são consumidos sem aplicar o buff**.

**Interações específicas:**
- **Harden:** pode coexistir com Harden (um buffa defesa, o outro regenera stamina).
- **Stagger:** se o personagem sofrer stagger durante o buff, o efeito continua (não é cancelado por stagger).
- **KO:** buff persiste até o fim da duração ou até o personagem ser derrotado.

### 7.6 VFX e SFX

- **Ativação:** partículas ascendentes suaves ao redor do personagem, brilho dourado sutil.
- **Efeito persistente:** aura leve e pulsante, sem obscurecer o personagem.
- **Som:** inspiração profunda, ressonância grave moderada; whoosh suave no início.

### 7.7 Testes obrigatórios

1. Cast 0,35 s: vulnerável a interrupção.
2. Interrupção durante cast: stamina 0,80 e cooldown 12 s consumidos, sem buff.
3. Buff aplicado: stamina regenera +40%/s por 5 s.
4. Esquiva durante buff: custo reduzido em 25%.
5. Sprint durante buff: custo reduzido em 25%.
6. Sem recuperação de HP.
7. Stagger não cancela buff.
8. Buff expira após 5 s.
9. Determinismo: mesma seed, mesma regeneração.

### 7.8 Pendências

- **GM-P13:** uso em estados aéreos (mesma classe de pendência do Bounce).
- **GM-P14:** interação com passivas de stamina (stacka ou substitui?).
- **GM-P15:** visibilidade do buff para o oponente (apenas VFX ou também indicador de UI?).

---

## 8. Regras compartilhadas (transversais aos 5 Moves)

### 8.1 Cobrança de recursos

| Categoria | Momento da cobrança |
|---|---|
| **Normal, Burst** | Após confirmação/soltura, antes do disparo físico |
| **Charge** | No início da carga |

### 8.2 Power Level e Clash/Counter

| Situação | Resultado |
|---|---|
| PL1 vs PL1 | Empate |
| PL2 vs PL1 | PL2 vence |
| PL3 vs PL1 | PL3 vence |
| PL3 vs PL3 | Empate |
| Status/Trick sem PL | Não elegível a Clash/Counter |

### 8.3 Defesas

| Tipo de defesa | Efeito em Lunge/Guard Break/Riposte |
|---|---|
| **Parcial** | Dano reduzido (50% proposto), knockback reduzido |
| **Perfeita** | Dano 0, knockback 0, hitstop aplicado ao atacante |
| **i-frames** | Sem dano, sem knockback |

### 8.4 Sliders

Alterações em sliders afetam apenas **usos futuros**. Execuções já existentes preservam valores capturados no momento da criação.

---

## 9. Matriz de regressão

| Move | Teste de disparo único | Cobrança correta | Defesa parcial | Defesa perfeita | i-frames | Clash/Counter | Cancelamento | Determinismo | Total |
|---|---|---|---|---|---|---|---|---|---|
| Lunge | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 8/8 |
| Guard Break | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | 7/7 |
| Feint | ✅ | ✅ | — | — | ✅ | — | ✅ | ✅ | 5/5 |
| Riposte | ✅ | ✅ | — | — | ✅ | ✅ | — | ✅ | 6/6 |
| Second Wind | ✅ | ✅ | — | — | — | — | ✅ | ✅ | 5/5 |

**Legenda:** ✅ = teste obrigatório definido; — = não aplicável.

---

## 10. Inventário de pendências materiais

| ID | Pendência | Move(s) afetado(s) | Severidade |
|---|---|---|---|
| GM-P01 | Redução exata sob defesa parcial | Lunge, Guard Break, Riposte | Média |
| GM-P02 | Interação com campos de força (Reflect) | Lunge | Média |
| GM-P03 | Comportamento em rampas/declives | Lunge | Baixa |
| GM-P04 | Duração exata do guard stun | Guard Break | **Alta** |
| GM-P05 | Defesa perfeita anula guard stun? | Guard Break | **Alta** |
| GM-P06 | Harden + guard stun | Guard Break | Média |
| GM-P07 | Comportamento sem defesa ativa | Guard Break | Média |
| GM-P08 | Lista completa de ações canceláveis | Feint | Média |
| GM-P09 | Punção por uso fora de janela | Feint | Baixa |
| GM-P10 | Riposte anula guard stun? | Riposte | **Alta** |
| GM-P11 | Multi-hit na janela | Riposte | Média |
| GM-P12 | Duração exata da janela | Riposte | Média |
| GM-P13 | Uso em estados aéreos | Second Wind | Baixa |
| GM-P14 | Stack com passivas de stamina | Second Wind | Média |
| GM-P15 | Visibilidade para oponente | Second Wind | Baixa |

---

## 11. Referências cruzadas

- `docs/moves-nao-iniciados/EMERGING_STONE_PROMPT_IMPLEMENTACAO.md` — estrutura de especificação, cronologia C, janelas semiabertas, cobrança transversal.
- `docs/MOVES_GENERICOS_CATALOGO.md` — catálogo aprovado de 5 moves genéricos (Quick Attack, Swift, Harden, Spikes, Bounce).
- `docs/tackle/VER_TACKLE.html` — esqueleto de animação canônico (41 frames @ 30fps, 8 fases, v26).
- `docs/JANELAS_COMBATE_RESOLVE_HIT.md` — janelas em intervalos semiabertos `[startStep, endStep)` a 120 Hz.
- `docs/MUSHROOM_MOVES_DECISOES.md` — regra de cobrança transversal e diretrizes de 20/10/2026.
- `docs/MOVES_DECISOES_RODADAS.md` — M28.4 (sliders afetam usos posteriores).
- `docs/MOVES_TEST_MATRIX.md` — estrutura de matriz de testes para moves.

---

*Documento gerado em 21/10/2026. Próximo passo sugerido: homologação das pendências GM-P04, GM-P05 e GM-P10 antes de iniciar implementação no Codex.*
