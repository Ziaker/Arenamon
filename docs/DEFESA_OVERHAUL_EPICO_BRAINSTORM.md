# Arenamon — Overhaul épico do sistema de defesa (brainstorm)

**Status:** brainstorming de design e engenharia. **Não é autorização para alterar código.**
**Data:** 29/10/2026.
**Base:** [`OVERHAUL_DEFESA_PERFEITA_DODGE_PERFEITO_ZZZ_2026-10-23.md`](./OVERHAUL_DEFESA_PERFEITA_DODGE_PERFEITO_ZZZ_2026-10-23.md) (plano ZZZ/Banyue), [`CAMERA_CINEMATICA_ZZZ.md`](./CAMERA_CINEMATICA_ZZZ.md), [`ANIMACAO_ESTILO_ZZZ_PLANO.md`](./ANIMACAO_ESTILO_ZZZ_PLANO.md).
**Escopo:** rebalanceamento + nova gramática defensiva. Defesa Perfeita e Esquiva Perfeita deixam de ser "um acerto que não doeu" e passam a ser **os dois momentos mais caros do jogo**.

---

## 1. A tese em uma frase

> **Defender bem deve ser a jogada mais violenta do jogo.**

Hoje o Arenamon já recompensa a defesa (dano zero, contra-ataque mais rápido, câmera de parry), mas a recompensa é **administrativa**: um tackle 18% mais rápido. O overhaul troca isso por uma recompensa **cinematográfica e física**: o inimigo é lançado longe, o tempo quebra, a silhueta do seu lutador fica desenhada no ar.

O objetivo não é "mais efeitos". É dar ao jogador uma segunda forma de ganhar o round — **ler** em vez de **apertar** — com o mesmo peso dramático de um PL3 carregado.

---

## 2. Os três pilares

| Pilar | O que significa na prática | O que o jogador sente |
|---|---|---|
| **Leitura** | A defesa exige antecipação real do golpe, não spam de D/C. A janela é curta, mas **legível** (silhueta, som, brilho). | "Eu vi o golpe vindo." |
| **Ritmo** | O tempo quebra no acerto defensivo e volta. A câmera respira com o jogador. | "O jogo parou para mim." |
| **Retribuição** | A defesa **devolve** violência: stagger, lançamento, parede, contra-golpe PL3. | "Eu cobrei com juros." |

**Anti-pilar (o que evitar):** defesa passiva lucrativa. Segurar D não pode ser melhor que aparar; esquivar para longe não pode ser melhor que esquivar *para dentro* do golpe.

---

## 3. O que existe hoje (auditoria, valores reais)

Nada abaixo é suposição: são os números e caminhos do código atual.

### 3.1 Defesa Perfeita (D)

- A janela abre no **toque** de D (`cmd.guardPressed`) e dura `rules.perfect` — **0,20 s de fábrica**, **0,34 s na calibração-base** (`sim/config.js`, `sim/calibration-base.js`).
- Se a janela expira sem sucesso, entra `perfectCooldown` de **2 s**. Sucesso **não** paga cooldown.
- No acerto frontal dentro da janela (`sim/combat.js`): dano 0, `applyReaction({kind:'perfectGuard', counterWindow})`, atacante recebe **recoil de 0,3 s**.
- A janela de contra-ataque é `extras.combat.perfectGuardCounterWindow`: **0,70 s de fábrica**, **1,98 s calibrado**.
- **Não existe stagger no defensor perfeito.** O atacante só recua (`recoil`), não cambaleia. O `stagger` real hoje só é usado no *footstool* (`map.footstoolStagger`, 0,55 s calibrado).
- Câmera: já é completa (snap 80°, letterbox 0,35 s, impact frame 0,035 s, speedlines 0,22 s, chroma 6, slow-mo **visual** 0,35× por 0,18 s, callout `PERFECT DEFLECTION!`).
- Som/feedback: variantes de VFX de defesa existem (`vfx.perfect`, `vfx.block`); nada exclusivo de "contra-ataque".

### 3.2 Esquiva Perfeita (C)

- `perfectDodge` só dispara quando o defensor está em ação `kind === 'dodge'` (esquiva **pura**, não um tackle que herdou i-frames) e o acerto é corpo a corpo (`sim/combat.js`).
- Invulnerabilidade da esquiva: `actions.dodge.invulnerable = 0,2 s`; a janela de contra-ataque é `actions.dodge.counterWindow = **0,55 s**`; bônus de stamina `perfectEvadeStamina = **0,2**`.
- **Projétil, área e beam contra alvo invulnerável retornam `invulnerable`** — não geram `perfectDodge`. Inconsistência real: a esquiva perfeita "não existe" contra ranged.
- Câmera: **apenas callout** (`PERFECT DODGE!`). Sem snap, sem slow-mo, sem afterimage dedicado.
- Afterimage: já existe infraestrutura. `vfx.ghost()` clona o esqueleto do personagem, tinge com blending aditivo e apaga por opacidade — pool de até **6 fantasmas por lutador**. Hoje é usado no rastro da esquiva (`vfx.js → dodgeC`), não como "eco" congelado.

### 3.3 O contra-golpe que já existe (molde técnico)

`startRiposteStrike()` (`sim/controller/ctrl-moves.js`) é o melhor molde do que queremos:

- troca a postura por um tackle com `fixedHeading` rumo a quem atacou;
- `pl = strikePl ?? 4`, `plDamage = dano / attackReference`;
- `kb` próprio (`knockbackH` / `knockbackV`);
- `invulnerableFor` cobre o resto da janela;
- flag `riposteStrike` → **nunca faz clash** (`noClash` em `sim/combat.js`), mesmo com PL igual.

Ou seja: a "máquina" de um contra-golpe cinematográfico já está pronta. Falta dar a ela **identidade, números e apresentação**.

### 3.4 Física de lançamento

- Calibração atual: `launchGravity = 39,6`, `launchUp = 7,1`, `launchHorizontal = 19,3`, `launchDrag = 1,15`.
- Voo típico: ~0,36 s no ar, ~7 m de deslocamento. Bom para um tackle; **pouco para um "impacto épico"**.
- `physics.js` já respeita **gravidade por voo**: `flight.gravity ?? R.launchGravity`. Isso permite um arco de contra-golpe próprio **sem mexer na gravidade global**.

### 3.5 Os dois relógios (decisivo para o slow-mo)

| Relógio | Onde | Efeito |
|---|---|---|
| **Simulação** | `FixedClock.timeScale` (`sim/game.js`) | Muda quantos ticks de 1/120 s rodam. **Muda o jogo.** O K.O. já usa 0,25× por 600 ms (`app/match-stats.js`). |
| **Apresentação** | `CinematicCamera.getVisualTimeScale()` (`view/cinematic-camera.js`, consumido em `view/view.js`) | Desacelera **animação e VFX**, sem tocar na simulação. É o slow-mo que o parry usa hoje. |

Essa distinção é a chave do overhaul: **slow-mo de leitura** (apresentação) não pode alterar a dificuldade; **slow-mo de impacto** (simulação) só pode acontecer quando o jogador não precisa mais reagir.

---

## 4. Fidelidade à referência (ZZZ / Banyue)

O que a referência realmente ensina — e o que **não** vamos copiar:

| Referência | O que tomamos | O que recusamos |
|---|---|---|
| **Perfect Dodge / Dodge Counter** (ZZZ) | O contra-golpe é uma **resposta**, não um buff; a esquiva atravessa o golpe e o mundo desacelera; o inimigo é arremessado com peso. | Automatismo: em ZZZ o counter costuma vir colado ao input. Aqui ele continua sendo **decisão do jogador** (janela + X). |
| **Banyue — Immovable Mountain** | Parry individual, sem troca de personagem: postura → impacto → domínio do tempo. | Números internos, frames, sons ou animações proprietárias. Tudo é tuning próprio. |
| **Vital View / Evasive Assist** | A ideia de que existe **uma janela dourada** legível. | Sistemas de equipe/assistência que não existem no Arenamon. |

**Regra de honestidade:** a referência é de *feel* e *timing*, não de valores. Todos os números deste documento são proposta, não importação.

---

## 5. A nova gramática defensiva

### 5.1 Um acerto = um veredito

Invariante que o overhaul deve preservar e **estender para ranged**:

```
acerto elegível
  ├─ ignoreInvulnerability / guardBreak       → hit / guardBreak (como hoje)
  ├─ i-frames de esquiva + janela de precisão → PERFECT DODGE
  ├─ i-frames de esquiva                      → dodgeInvulnerable
  ├─ guarda frontal + perfectLeft             → PERFECT GUARD
  ├─ guarda frontal                           → partialGuard
  └─ resto                                    → hit
```

Nenhum acerto pode gerar duas recompensas (`perfectDodge` + `perfectGuard`), nem repetir recompensa no mesmo `contactId` / multi-hit.

### 5.2 A "Janela de Resposta" substitui o "contra-ataque grátis"

Hoje `counterWindow` é um número solto que deixa o próximo X 18% mais rápido. Proposta:

```
veredito defensivo
   → abre resposta {kind: 'dodge' | 'guard', ticks, used: false}
   → X dentro da janela inicia o CONTRA-GOLPE (PL3)
   → janela fecha, ou X usado, ou o defensor é atingido → resposta morre
```

- Uma resposta por evento defensivo (`used`), sem empilhar.
- A resposta **não** sobrevive a levar um hit.
- O contra-golpe **consome** a resposta e entra em cooldown curto próprio (1,2 s) para não virar loop.

### 5.3 O que NÃO muda (inventário preservado)

D segura guarda; C esquiva; C→X preservado; cancelamentos, custos, cooldowns, buffer, PL, clash, wall-splat, meteor slam, riposte do Guard Break, passivas, IA, treino, replay, saves. O overhaul **acrescenta** um ramo de resposta e **reapresenta** dois eventos que já existem. Nada é removido ou escondido.

---

## 6. Esquiva Perfeita (Perfect Dodge)

### 6.1 Entrada e veredito

- Entrada: **C** (inalterada).
- Janela de precisão: os **primeiros 0,07 s** dos 0,20 s de i-frames (`perfectDodgeWindow`, novo, medido em ticks).
- Elegível: qualquer fonte de dano **evitada de fato** — corpo a corpo, projétil, área, beam, tackle carregado. Ranged passa a gerar `perfectDodge` (hoje retorna `invulnerable`).
- Não elegível: `ignoreInvulnerability`, guard break, dano ambiental sem hitbox, multi-hit já premiado no mesmo `sourceId`.
- Efeito mecânico imediato: dano 0, +0,2 de stamina (preservado), resposta aberta por **0,45 s** (proposta; hoje 0,55 s).
- A ação `dodge` **continua o curso** — sem teleporte, sem congelar o corpo. O "atravessar" é leitura, não colisão desligada.

### 6.2 O momento: tempo quebrado + eco

Três camadas, na ordem em que o jogador percebe:

1. **Corte de tempo (apresentação).** `visualSlowmo` 0,18× por 0,30 s reais: animação, partículas e smears desaceleram; a simulação **não** para. O jogador continua no controle.
2. **Eco (afterimage).** No instante do veredito, congelar **3 ecos** do lutador nas posições dos ticks −8, −4 e 0, usando `vfx.ghost()` com a cor de identidade do lutador (`fighterColorHex`), opacidade 0,55, vida 0,9 s. O eco do tick 0 fica 0,35 s **depois** do fim da esquiva — a "assinatura" parada no ar enquanto o corpo já saiu.
3. **Rasgo.** Chroma 8 + uma linha de varredura horizontal curta no ponto de passagem; speedlines radiais a partir do **golpe que falhou**, não do lutador.

> Regra de ouro: o eco é **silhueta chapada** (sem sombra, sem iluminação). Ele não pode parecer um segundo lutador nem confundir a leitura de hitbox.

### 6.3 O contra-golpe: "Golpe do Véu" (`counterVeil`)

Só existe se o jogador apertar **X** dentro da resposta.

| Fase | Tempo | O que acontece |
|---|---|---|
| Entrada | 0,00 s | X consome a resposta; o lutador **não** dá um passo para trás. |
| Arranque | 0,06 s | Dash de até 3,0 m rumo ao alvo (máx. engajamento 4,5 m), `fixedHeading`. |
| Ativo | 0,10 s | Golpe conecta. `pl = 3`, `plDamage = 1,7`, `noClash` (vence a disputa de PL sem gerar clash). |
| Impacto | 0,09 s | Hitstop + dilatação curta + câmera. |
| Voo | ~0,56 s | Lançamento balístico próprio (abaixo). |
| Recuperação | 0,18 s | Volta ao neutro; wall-splat elegível durante o voo. |

**Lançamento (o "para longe"):** o contra-golpe **não** usa o lançamento padrão. Ele usa um perfil próprio:

- `horizontal = 21 m/s`, `vertical = 6,8 m/s`;
- `gravityScale = 0,62` (via `flight.gravity`, já suportado pela física);
- `drag = 0,9`;
- resultado: ~0,56 s de voo e **9–11 m** de deslocamento, com chance real de wall-splat.

O objetivo é que o inimigo **saia do enquadramento** e volte. Sem isso, não é épico — é um empurrão.

### 6.4 Timeline (referência de implementação)

```
tick 0     veredito PERFECT DODGE
           ├─ dano 0, stamina +0,2
           ├─ resposta aberta (0,45 s)
           ├─ visualSlowmo 0,18× / 0,30 s reais
           └─ ecos −8 / −4 / 0

tick 0..N  X? ── não → janela fecha; nada acontece (a esquiva já pagou)
              └─ sim → counterVeil

counterVeil
  +0,00  arranque (dash, heading travado)
  +0,06  ativo
  +0,14  IMPACTO
         ├─ hitstop 0,09
         ├─ dilatação 0,35× por 0,10 s de simulação (~0,29 s reais)
         ├─ snap de câmera + FOV punch + impact frame
         └─ lançamento (h 21 / v 6,8 / g 0,62)
  +0,70  pouso do inimigo / parede
```

### 6.5 Falha e contra-jogo

- X depois da janela: **nada**. O inimigo já recuperou e tem a iniciativa — punição limpa.
- Contra-golpe **não persegue** alvo que saiu do alcance: erra, e o whiff tem recuperação de 0,18 s.
- Se o alvo morrer com o golpe, o lançamento vira "corpo morto" com física normal (sem slow-mo extra).
- Sem mirror em dobro: dois perfect dodges no mesmo tick não geram dois ecos nem duas respostas.

---

## 7. Defesa Perfeita (Perfect Guard)

### 7.1 Entrada e veredito

- Entrada: **toque de D** (inalterada). Segurar D continua sendo guarda comum.
- Janela: `perfectLeft` atual (0,34 s calibrado). Proposta: **manter** — é o valor que o jogo já ensinou.
- Frontal, bloqueável, não `ignoreInvulnerability`.
- Dano 0 (preservado), `perfectCooldown` 2 s só quando a janela expira (preservado).

### 7.2 O que muda: o inimigo cambaleia

Hoje o atacante só recua 0,3 s. Proposta: **`staggerBack`** — uma reação nova, composta:

| Componente | Proposta | Por quê |
|---|---|---|
| Deslocamento | 1,9 m para trás em 0,42 s | O corpo precisa **sair** do lugar, não vibrar. |
| Cambaleio lateral | ±0,22 m senoidal | Lê como "perdi o equilíbrio", não como "fui empurrado". |
| Stun | 0,55 s | Janela real de punição, comparável ao footstool. |
| Ação | cancelada (`action = null`) | O golpe do inimigo morre no impacto. |
| Guarda | derrubada (`guard = false`, `suppressed`) | Não pode virar um "bloqueio de graça". |
| Recuperação | 0,42 s + 0,13 s de "recompor" | O inimigo volta instável, não resetado. |

Isso resolve a maior fraqueza atual do parry: **ele não muda o estado do oponente**. Com `staggerBack`, o parry vira *tempo comprado* — e tempo é o recurso mais escasso do jogo (stamina 3, regeneração lenta).

### 7.3 Câmera lenta momentânea (diferente da esquiva)

A Defesa Perfeita é **peso**, não **velocidade**. Assinatura própria:

- Snap lateral **65°** (hoje 80°) a 2,8 m — mais próximo, mais "ombro".
- `visualSlowmo` **0,30× por 0,22 s reais** (hoje 0,35× por 0,18 s).
- Letterbox 0,45 s, impact frame 0,04 s, chroma 6.
- Callout `PARRY` (curto) em vez de `PERFECT DEFLECTION!` (longo) — o texto não pode competir com a leitura do cambaleio.
- Um anel de "vidro de guarda" quebrando no ponto de contato, na cor do lutador.

### 7.4 O contra-golpe também existe aqui: "Golpe de Ruptura" (`counterBreak`)

O pedido é explícito: **o contra-golpe existe na defesa perfeita também**. Ele compartilha a família PL3, mas **não** é o mesmo golpe:

| | Golpe do Véu (dodge) | Golpe de Ruptura (guard) |
|---|---|---|
| Entrada | X na resposta da esquiva | X na resposta da guarda |
| Arranque | dash 3,0 m | passo curto 1,2 m (o inimigo já está perto) |
| `pl` | 3 | 3 |
| Dano base | 34 (1,7 × 20) | 34 |
| Bônus de punição | — | **×1,25 se o alvo ainda estiver em `staggerBack`** |
| Lançamento | h 21 / v 6,8 / g 0,62 | h 17 / v 5,4 / g 0,70 |
| Assinatura | atravessar + eco + voo longo | **quebrar a postura** + arremesso curto e violento |
| Extra | wall-splat elegível | se o alvo cambaleia até a parede, o lançamento **garante** wall-splat |

**Por que não o mesmo golpe?** Porque a fantasia é diferente: a esquiva é *"eu não estava lá"*; a guarda é *"eu te parei e te quebrei"*. Números diferentes + apresentação diferente = duas memórias distintas.

### 7.5 Timeline

```
tick 0     veredito PERFECT GUARD
           ├─ dano 0
           ├─ atacante: staggerBack (1,9 m / 0,42 s, stun 0,55 s)
           ├─ defensor: resposta aberta (0,90 s)
           ├─ visualSlowmo 0,30× / 0,22 s reais
           └─ anel de guarda quebrada + snap 65°

tick 0..N  X? ── não → o stagger é a recompensa (espaço + tempo)
              └─ sim → counterBreak

counterBreak
  +0,00  passo curto
  +0,06  IMPACTO (×1,25 se ainda cambaleando)
         ├─ hitstop 0,07
         ├─ dilatação 0,40× por 0,08 s de simulação
         └─ lançamento (h 17 / v 5,4 / g 0,70)
  +0,45  pouso / parede
```

---

## 8. O contra-golpe por dentro (especificação comum)

### 8.1 PL3 de verdade, sem quebrar o triângulo

Hoje o riposte é `pl = 4` "por padrão" e `noClash`. Isso é honesto: ele ganha qualquer disputa. O pedido de **PL3** não pode significar "perde para PL3 do inimigo" (o contra-golpe precisa ser confiável), então:

- `pl = 3` → **números** de PL3 (velocidade 1,6×, dano 1,7×);
- flag `counterStrike` → **`noClash`** (como `riposteStrike` hoje);
- resultado: o golpe **se comporta** como PL3 em dano/alcance e **nunca** é neutralizado por clash.

Isso é uma decisão de design explícita, não um atalho: contra-golpe não é disputa, é **consequência**.

### 8.2 Contrato de dano

- `plDamage = 1,7` → **34 de dano** contra o perfil equilibrado (attack 20), antes de estágios e escudos.
- Contra-perfil `resistant` (defense 80), o pipeline central já reduz.
- O bônus de punição do `counterBreak` (**×1,25**) é aplicado **antes** dos estágios de defesa do alvo.
- Teto: nenhum contra-golpe pode matar de 100% (34–43 não matam). Se o alvo estiver abaixo, mata — e aí o K.O. cinematográfico assume.

### 8.3 Onde plugar (mapa técnico)

| Necessidade | Onde já existe | O que acrescentar |
|---|---|---|
| Iniciar o golpe | `startRiposteStrike` (`ctrl-moves.js`) | `startCounterStrike(f, kind)` com dois perfis |
| Travar direção | `a.fixedHeading` | reutilizar |
| Ignorar clash | `noClash` (`combat.js`) | incluir `counterStrike` |
| Lançar longe | `applyReaction('impulse')` + `flight.gravity` | perfil `counterLaunch` |
| Cambalear | `applyReaction('stagger')` + `displacement` | nova intenção `staggerBack` |
| Janela | `f.counterWindow` | `f.counterResponse = {kind, ticks, used}` |
| Evento | `moveEvent` / `game.events` | `counterStrike`, `guardStagger` |
| Câmera | `CinematicCamera.apply` | dois perfis + slow-mo de apresentação |
| Eco | `vfx.ghost` | `vfx.echoBurst(f, count, color)` |

---

## 9. Câmera, tempo, VFX e áudio

### 9.1 Perfis de câmera

| Evento | Snap | Slow-mo (apresentação) | Outros |
|---|---|---|---|
| **Perfect Dodge** | nenhum no veredito (não quebrar a leitura da passagem) | 0,18× / 0,30 s | chroma 8, speedlines do golpe falho, eco |
| **Golpe do Véu** | lateral 35°, 2,6 m, 0,22 s | 0,20× / 0,18 s + dilatação de impacto | FOV punch −10, impact frame 0,05, letterbox 0,5 |
| **Perfect Guard** | lateral 65°, 2,8 m, 0,20 s | 0,30× / 0,22 s | anel de guarda, chroma 6, callout curto |
| **Golpe de Ruptura** | frontal-baixo 25°, 2,4 m, 0,18 s | 0,25× / 0,16 s + dilatação | FOV punch −8, impact frame 0,05 |

**Prioridade:** KO > intro > clash > contra-golpe > perfect guard > perfect dodge > dash. Nunca dois snaps no mesmo contato.

### 9.2 Dilatação de impacto (o único slow-mo que pode tocar a simulação)

Regras para não virar exploite nem quebrar determinismo:

1. Só dispara **no impacto do contra-golpe**, quando nenhuma entrada é necessária.
2. Duração em **segundos de simulação** (`0,08–0,10 s`), não em segundos reais.
3. Implementada como **pilha** (`pushDilation(factor, simTime)`) com restauração ao valor do usuário — nunca sobrescrever `clock.timeScale` direto.
4. Teto: no máximo **1 dilatação ativa**; a segunda apenas estende a atual.
5. Desligável (`enableCounterDilation = 0`) sem alterar gameplay.

### 9.3 VFX (sem duplicar o que existe)

- Reutilizar `vfx.perfect` (defesa perfeita) e `vfx.dodge` (esquiva) como base.
- Novo: `echoBurst` (3 ecos + 1 persistente), `guardShards` (anel de vidro), `veilSlash` (corte em arco no ponto de passagem), `ruptureRing` (onda curta no chão).
- Todos com pooling e teto de partículas; pico medido pelo medidor de performance já existente.
- `prefers-reduced-motion` e `noFlash` **obrigatórios** em todos.

### 9.4 Áudio (camadas, não barulho)

| Momento | Camadas |
|---|---|
| Veredito dodge | whoosh invertido + sino curto + "vácuo" de 80 ms |
| Impacto do Véu | corpo (sub 60 Hz) + estalo seco + cauda de vento |
| Veredito guard | metal curto + estalo de madeira + respiração do lutador |
| Cambaleio | passos irregulares (2–3) + arrasto de pé |
| Impacto da Ruptura | impacto + "crack" de guarda + silêncio de 60 ms antes do lançamento |

**Regra:** um único disparo por evento (dedupe por `eventId`), como já é feito no `BoostFeedback`.

---

## 10. HUD e leitura (usar o que já foi entregue)

O HUD já tem identidade por lutador (`ui/fighter-identity.js`, `--fc`, glifo, cor). O overhaul **usa** isso:

1. **Chip de veredito** ao lado do nome: `PARRY` / `DODGE` / `COUNTER`, na cor do lutador, 0,9 s, sem cobrir o corpo.
2. **Anel de resposta**: durante a janela, um anel fino no cartão do lutador drena no tempo restante. É a mesma linguagem do cooldown de slot — o jogador já sabe ler.
3. **Contador de contra-golpes** no painel de estatísticas da partida (novo, mas derivado de eventos).
4. **Nada de tela cheia piscando**: o impacto é do mundo, não do HUD.

Acessibilidade: chip e anel podem ser desligados em `display.hud`; o callout também (`combatPopups.showLabels`).

---

## 11. Balanceamento proposto

Valores **propostos** (não testados). Fábrica/calibrado = estado atual real.

| Parâmetro | Fábrica | Calibrado | Proposta | Faixa segura | Justificativa |
|---|---:|---:|---:|---:|---|
| `rules.perfect` | 0,20 | 0,34 | **0,34** | 0,26–0,38 | Não mexer no que o jogo já ensinou. |
| `rules.perfectCooldown` | 2,0 | 2,0 | **1,8** | 1,4–2,4 | O stagger já paga o custo; 2 s pune demais o erro. |
| `perfectDodgeWindow` (novo) | — | — | **0,07** | 0,05–0,10 | Precisão real dentro dos 0,20 s de i-frames. |
| `dodge.counterWindow` | 0,55 | 0,55 | **0,45** | 0,35–0,60 | O contra-golpe ficou forte; janela menor. |
| `dodge.perfectEvadeStamina` | 0,20 | 0,20 | **0,20** | 0,15–0,30 | Preservar. |
| `perfectGuardCounterWindow` | 0,70 | 1,98 | **0,90** | 0,60–1,10 | 1,98 s é quase garantia; com stagger, 0,9 s basta. |
| `guardStaggerBackDistance` (novo) | — | — | **1,9 m** | 1,4–2,4 | Precisa sair do alcance do próximo golpe. |
| `guardStaggerBackDuration` (novo) | — | — | **0,42 s** | 0,32–0,55 | Cambaleio legível, não queda. |
| `guardStaggerStun` (novo) | — | — | **0,55 s** | 0,40–0,70 | Comparável ao footstool. |
| `counterStrike.pl` (novo) | — | — | **3** | 3 | Números de PL3, sem clash. |
| `counterStrike.plDamage` (novo) | — | — | **1,7** | 1,5–1,9 | 34 de dano base. |
| `counterStrike.startup` | — | — | **0,06 s** | 0,05–0,10 | Resposta, não cast. |
| `counterStrike.dashDistance` | — | — | **3,0 m** | 2,4–3,6 | Alcance de engajamento 4,5 m. |
| `counterStrike.recovery` | — | — | **0,18 s** | 0,14–0,24 | Whiff punível. |
| `counterStrike.launchH` | — | — | **21 m/s** | 18–24 | "Para longe". |
| `counterStrike.launchV` | — | — | **6,8 m/s** | 6,0–7,4 | Arco visível. |
| `counterStrike.gravityScale` | — | — | **0,62** | 0,55–0,75 | Voo longo sem gravidade zero. |
| `counterStrike.damageBonusStagger` | — | — | **1,25×** | 1,15–1,35 | Só no `counterBreak`. |
| `counterStrike.staminaCost` | — | — | **0 nos primeiros 0,30 s; 1 depois** | — | Recompensa cinemática grátis, spam pago. |
| `counterStrike.cooldown` (novo) | — | — | **1,2 s** | 1,0–2,0 | Evita loop. |
| `impactHitstop` (contra-golpe) | 0,035 | 0,008 | **0,09** | 0,06–0,12 | Peso. |
| `visualSlowmo` (dodge) | — | 0,35×/0,18 s | **0,18×/0,30 s** | — | Leitura, não dificuldade. |
| `visualSlowmo` (guard) | — | 0,35×/0,18 s | **0,30×/0,22 s** | — | Peso. |

### 11.1 Economia de stamina

Stamina máxima 3, regeneração lenta. O contra-golpe **não pode** ser mais um custo de 1 em cima de uma esquiva que já custou 1. Daí a regra "grátis nos primeiros 0,30 s": o jogador que **leu** o golpe recebe a execução; o que hesitou paga o preço normal.

### 11.2 Riscos de balanceamento

| Risco | Sintoma | Mitigação |
|---|---|---|
| Defesa dominante | Jogador só espera e pune | Janela curta + cooldown + whiff punível |
| Loop de contra-golpe | Perfect → counter → perfect | 1 resposta por evento + cooldown 1,2 s |
| Slow-mo exploit | Dilatação usada para "ganhar tempo" | Só no impacto, sem input pendente |
| Inimigo vira saco de pancada | Stagger 0,55 s sempre | IA com recuperação defensiva e redução de stagger repetido |
| Fuga do enquadramento | Lançamento de 10 m desorienta | Câmera acompanha por 0,4 s e volta com spring |

---

## 12. IA

O vermelho precisa **aprender** a nova gramática, sem trapaça:

1. **Reconhecer** a resposta aberta do jogador (percepção já modela defesa e ameaça) e **não** atacar dentro dela se tiver opção.
2. **Punir** contra-golpe no whiff: a IA já espera o pouso (`tactics.js`); usar a mesma leitura.
3. **Sofrer** o stagger com recuperação defensiva (guarda imediata ao sair do stun), não com contra-ataque heroico.
4. **Usar** a própria defesa perfeita contra o jogador — hoje o código já tem `lastSecondDefend`; estender para o stagger.
5. **Dificuldade:** no fácil, a IA não pune o whiff; no difícil, pune.

Proibido: ler o input do jogador no mesmo tick, teleportar para o contra-golpe, ignorar i-frames.

---

## 13. Determinismo, testes e instrumentação

### 13.1 Eventos novos (contrato)

| Evento | Campos |
|---|---|
| `perfectDodge` (estendido) | `source`, `contactId`, `counterTicks`, `echoCount` |
| `perfectGuard` (estendido) | `contactId`, `staggerTicks`, `displaced` |
| `guardStagger` | `attacker`, `target`, `distance`, `stun` |
| `counterStrike` | `kind: 'veil' \| 'rupture'`, `pl`, `damage`, `launch`, `bonus` |
| `counterWhiff` | `kind`, `reason` |

### 13.2 Testes mínimos

- **Unidade:** veredito único; `perfectDodge` contra projétil; `staggerBack` aplica deslocamento + stun + derruba guarda; `counterStrike` tem `pl 3` e `noClash`; dano 34; bônus 1,25 só com stagger ativo; janela `used` impede segundo counter.
- **Cenário:** dodge → counter → lançamento > 8 m; parry → stagger → counter → wall-splat; whiff punido; dois perfects no mesmo tick.
- **Determinismo:** replay de 2 min com 6 counters reproduz hash idêntico; dilatação não altera ticks.
- **Regressão:** `moves-cooldown-boost`, `prejogo`, `scenarios` verdes; nenhum evento antigo muda de forma.
- **Performance:** pico de partículas e tempo de quadro com 3 ecos + 2 counters simultâneos.

### 13.3 Instrumentação

- Contador por partida: perfects, counters, whiffs, distância média de lançamento.
- Telemetria já existente (`sim/telemetry.js`) ganha linha "Resposta de contra-golpe (janela)".
- Painel de calibração: sliders com unidade (s, m, m/s, ×) para **todos** os parâmetros novos.

---

## 14. Roadmap por fases

| Fase | Entrega | Critério de saída |
|---|---|---|
| **F0 — Decisão** | Este documento aprovado; dúvidas da §15 resolvidas | Diretor marca o que entra |
| **F1 — Contrato** | `counterResponse` + eventos + testes de unidade, **sem** visual novo | Testes verdes; jogo idêntico ao atual |
| **F2 — Stagger** | `staggerBack` + `perfectGuard` com cambaleio, câmera atual | Parry muda o estado do inimigo |
| **F3 — Contra-golpe** | `counterVeil` / `counterBreak`, PL3, lançamento, hitstop | Whiff punível; dano e voo dentro da faixa |
| **F4 — Cinema** | Perfis de câmera, slow-mo de apresentação, ecos, áudio | Nenhum efeito muda gameplay |
| **F5 — Dilatação** | Dilatação de impacto com pilha e teto | Determinismo intacto; opção de desligar |
| **F6 — Polimento** | HUD, treino, IA, acessibilidade, telemetria | Partida completa sem bug de leitura |

Cada fase é **jogável** e pode parar sem deixar o jogo pior.

---

## 15. Decisões abertas (para o diretor)

1. **O slow-mo da esquiva pode alterar a simulação?** Recomendo **não** (apresentação apenas). A dilatação fica só no impacto do contra-golpe.
2. **A janela de 1,98 s do parry cai para 0,90 s?** É o maior rebalanceamento do pacote. Recomendo **sim**, com o stagger como compensação.
3. **O contra-golpe custa stamina?** Recomendo grátis nos primeiros 0,30 s.
4. **Dois contra-golpes (Véu e Ruptura) ou um só?** Recomendo dois — a memória é diferente.
5. **Perfect dodge contra ranged entra agora?** Recomendo sim; é a maior inconsistência atual.
6. **O contra-golpe pode matar?** Recomendo sim, mas nunca de 100%.
7. **Eco do afterimage: 3 ou 5?** Recomendo 3 (legibilidade > espetáculo).
8. **Onde o HUD mostra o veredito?** Recomendo chip no cartão do lutador, não no centro da tela.

---

## 16. Riscos e anti-padrões

- **Efeito sem regra:** slow-mo bonito que não muda decisão nenhuma vira ruído. Cada efeito tem um contrato.
- **Cinema que rouba controle:** qualquer slow-mo com input pendente é dívida de balanceamento.
- **Duplicar VFX:** o projeto já tem defesa, esquiva, impacto e smear. Estender, não recriar.
- **Números mágicos:** todo parâmetro novo entra no painel com nome e unidade.
- **Reset silencioso:** nenhuma das fases pode apagar comportamento atual (ver §5.3).

---

## 17. Anexos

### 17.1 Glossário

| Termo | Significado |
|---|---|
| **Veredito** | Classificação única de um acerto defensivo. |
| **Resposta** | Janela curta que habilita o contra-golpe. |
| **Véu** | Contra-golpe da esquiva perfeita (atravessa e lança longe). |
| **Ruptura** | Contra-golpe da defesa perfeita (quebra postura e arremessa). |
| **Eco** | Afterimage congelado do lutador. |
| **Dilatação** | Slow-mo que altera a simulação (≠ slow-mo de apresentação). |

### 17.2 Referências internas

- `prototypes/combat-lab/src/sim/combat.js` — vereditos, `perfectDodge`, `perfectGuard`, `noClash`.
- `prototypes/combat-lab/src/sim/resolvers/reaction-resolver.js` — `stagger`, `perfectGuard`, `impulse`, `displacement`.
- `prototypes/combat-lab/src/sim/controller/ctrl-moves.js` — `startRiposteStrike` (molde).
- `prototypes/combat-lab/src/sim/controller/ctrl-update.js` — `perfectLeft`, `counterWindow`, `counterSpeed`.
- `prototypes/combat-lab/src/view/cinematic-camera.js` — perfis, slow-mo, prioridades.
- `prototypes/combat-lab/src/view/vfx.js` — `ghost()` / pool de ecos.
- `prototypes/combat-lab/src/sim/physics.js` — `flight.gravity` por voo.
- `prototypes/combat-lab/src/sim/config.js` + `sim/calibration-base.js` — todos os números citados.

### 17.3 Documentos irmãos

- [`OVERHAUL_DEFESA_PERFEITA_DODGE_PERFEITO_ZZZ_2026-10-23.md`](./OVERHAUL_DEFESA_PERFEITA_DODGE_PERFEITO_ZZZ_2026-10-23.md) — auditoria e contrato originais.
- [`CAMERA_CINEMATICA_ZZZ.md`](./CAMERA_CINEMATICA_ZZZ.md) — catálogo C01–C12.
- [`ANIMACAO_ESTILO_ZZZ_PLANO.md`](./ANIMACAO_ESTILO_ZZZ_PLANO.md) — direção de poses e timing.
