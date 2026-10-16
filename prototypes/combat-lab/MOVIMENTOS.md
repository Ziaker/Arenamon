# Base para os movimentos dos Pokémon

O motor do laboratório de combate já está **preparado** para receber movimentos especiais, mas ainda **não tem nenhum**: o registro começa vazio e o jogo continua idêntico enquanto nada for registrado (todas as suítes de regressão passam).

Adicionar um movimento é só uma questão de **dados**: uma definição validada, registrada com `registerMove` e equipada num dos 4 slots do lutador. Não é preciso mexer no motor.

## Peças

| Módulo | O que faz |
|---|---|
| `src/sim/moves.js` | Registro (`registerMove`, `getMove`, `listMoves`, `validateMove`), slots (`setLoadout`) e posicionamento relativo ao lutador. |
| `src/sim/world.js` | Entidades do mundo: **projéteis, barreiras, paredes e áreas** (explosões, pulsos radiais, auras). Acertos por uma função única (`applyHit`). |
| `src/sim/status.js` | **Buffs e debuffs**: modificadores de atributos, flags de bloqueio, dano/cura periódicos e empilhamento. |
| `src/sim/controller.js` | Ação `move` no mesmo controlador de X e C: permissão (`movePermission`), custo, recarga, deslocamento e linha do tempo. |
| `src/sim/game.js` | Dispara os efeitos da linha do tempo, avança o mundo e os status a cada passo e guarda tudo em save/load. |
| `src/view/world-view.js` | Desenho genérico das entidades, pela cor do dono. Pode ser trocado por modelos e VFX próprios. |

**Entrada:** os slots 1–4 usam as teclas **A, S, 3 e 4** (vermelho manual: H, G, N e M); A e S são os padrões de Reflect e Psyshock (D3). No gamepad, X, RT, LT e o clique do analógico direito acionam os slots 1 a 4. Tudo é configurável em Controles. O comando da simulação traz a borda do botão (`skill`) e os botões de slot **mantidos** (`skillHeld`, array por slot ou `null`), que seguram e soltam um Charge.

**Animação:** os estados `move_1` a `move_4` ficam disponíveis em Personagens. O Studio já exporta esses ids no mapa de ações; um slot sem clipe próprio usa o do tackle.

**Diagnóstico:** quando um movimento é negado, o motivo aparece como nos outros comandos, por exemplo "Movimento 1 ignorado: em recarga (620 ms restantes)". Os motivos possíveis são slot vazio, recarga, silenciado, atordoado, stamina, cadeia, recuo e guard stun.

**Janelas:** em Visualizar › Janelas de combate, os buffs, debuffs e recargas aparecem acima dos lutadores.

## Definição de um movimento

```js
registerMove({
  id: 'brasa', name: 'Brasa', type: 'fogo', category: 'special',
  duration: 0.45,          // s, ação inteira
  cost: 1,                 // stamina (modificável por status: staminaCost)
  cooldown: 2.5,           // s, conta a partir do início do movimento
  cancelAfter: 0.35,       // a partir daqui X, C, D ou outro movimento podem interromper (padrão: duration)
  cancelFrom: ['dodge'],   // ações que este movimento pode interromper (ex.: sair de uma esquiva)
  fromGuard: true, fromGuardStun: false,
  invulnerable: [0, 0.1],  // janela própria de invulnerabilidade (s)
  aim: 'target',           // 'target' (alvo/travado), 'facing' (frente) ou 'input' (direção das setas)
  motion: {type: 'none'},  // 'none' (desliza até parar), 'root' (parado) ou 'dash' {distance, start, end}
  timeline: [              // efeitos no instante `at` (s), em ordem
    {at: 0.15, spawn: {kind: 'projectile', offset: {forward: 0.8}, radius: 0.3, speed: 14, life: 1.5,
      hit: {damage: 12, knockback: {horizontal: 6, vertical: 4}, statuses: [/* debuffs aplicados no acerto */]},
      onHit: {kind: 'area', radius: 2.5, falloff: 'linear', life: 0.1, hit: {damage: 20}}}},   // explosão no impacto
    {at: 0.2, status: {id: 'foco', duration: 3, mul: {attack: 1.2}, tags: ['buff']}, target: 'self'},
    {at: 0.1, hit: {damage: 9, range: 1.4}},  // golpe corpo a corpo à frente
  ],
});
```

Este exemplo **não está registrado**: é só a documentação do formato.

### Entidades (`spawn`)

O que vale para todos os tipos:
- **Forma:** `shape: 'circle'` (`radius`) ou `'box'` (`hx`, `hz` e `angle`).
- **Altura:** `y` e `height`.
- **Duração:** `life` em segundos.
- **Posição relativa ao lutador:** `offset: {forward, side, up}`.
- **Dono:** o lutador que usou o movimento.

| Tipo | Campos próprios |
|---|---|
| `projectile` | `speed`, `pierce` (alvos antes de sumir), `gravity`, `blockedBy` (`['barrier', 'wall']`), `hitsOwner`, `onHit` (entidade criada ao acertar, bater ou cair) e `onExpire`. |
| `barrier` | `hp` (absorve o dano dos projéteis; ao zerar, rompe), `blocksProjectiles`, `blocksFighters` e `blocksOwner` (por padrão o dono atravessa a própria barreira). |
| `wall` | `blocksFighters` e `blocksProjectiles`. Lutadores andando param na parede; lutadores lançados rebatem; funciona girada. |
| `area` | Explosão, pulso radial ou aura: `pulses` e `interval` (cada alvo é atingido no máximo uma vez por pulso), `grow` e `startRadius` (crescimento), `falloff` (`'linear'`: a força cai com a distância), `follow` (acompanha o dono) e `affectsOwner`. O empurrão é sempre radial, do centro para fora. |

### Acerto (`hit`)

Campos: `damage`, `knockback: {horizontal, vertical}`, `guardable` (padrão `true`), `guardStun`, `flinch` (recuperação sem lançar), `ignoreInvulnerability` e `statuses`.

Ordem de resolução, a mesma do tackle:
1. Alvo invulnerável: o acerto não tem efeito.
2. Defesa frontal:
   - **perfeita:** sem dano e com janela de contra-ataque;
   - **comum:** dano × multiplicador da defesa e guard stun.
3. Acerto: dano × ataque do dono × dano recebido do alvo, lançamento e aplicação dos status.

### Status (buffs e debuffs)

```js
{id: 'queimadura', duration: 3, stacking: 'stack', maxStacks: 3, tags: ['debuff'],
 mul: {attack: 0.8}, add: {}, flags: {}, tick: {interval: 0.5, damage: 2}}
```

- **Atributos:** `speed`, `attack`, `damageTaken`, `staminaRegen`, `staminaCost`, `knockbackTaken` e `cooldownRate`.
- **Flags:** `rooted` (não anda), `silenced` (não usa movimentos), `disarmed` (não usa X) e `stunned` (não age).
- **Empilhamento:** `refresh`, `stack` (fator elevado ao número de pilhas), `independent` e `ignore`.
- **Remoção por etiqueta:** `cleanse(f, 'debuff')`.

Sem status ativos, todos os modificadores valem exatamente 1. O combate básico (tackle, clash, lançamento, stamina, locomoção) já lê esses atributos.

## Movimentos de carga (Charge) — Fase 1

Um movimento com `charge: {max}` é **segurar para carregar, soltar para executar** (infraestrutura para Reflect e Psyshock; **nenhum está registrado**). Não é uma ação: o lutador continua andando, com **−25%** de velocidade e de giro. Estado em `fighter.charge`; regras em `sim/charge.js` (puro) e no controlador (`chargePermission`, `startCharge`, `cancelCharge`, `stepCharge`).

| Regra | Valor (provisório, `C.world.charge`, M30.10) |
|---|---|
| Custo | cobrado ao iniciar; não é devolvido em interrupção |
| Recarga | começa na **soltura**; interrupção/cancelamento aplica **metade** (`interruptCooldownFactor`) |
| Carga máxima | `charge.max` (padrão 4 s); parado no máximo até soltar |
| Power Level | PL1 < 50% da carga, PL2 de 50% a antes de 100%, PL3 na carga máxima — por contagem de **passos** |
| Cancelamento | defesa cancela; C só após 0,2 s (`dodgeCancelAfter`); Tackle indisponível durante a carga |
| Interrupção | golpe com lançamento ou hit stun; perda de apoio; derrota. Dano puro não interrompe |
| Recuperação | 0,25 s após soltar: bloqueia Tackle e novos Moves; movimento, defesa e Dodge permitidos |
| Do Dodge | começa no fim do deslocamento principal; comando guardado nos últimos 0,15 s (`bufferWindow`) |
| Aceleração de recarga | `cooldownBoost: true`: novo toque (borda) gasta 0,5 de stamina por 1 s encurtado, proporcional na fração final; vale durante outro Charge |
| Ordem no mesmo passo | defesa → X/C → soltar o Move (M30.9) |

**Efeitos:** a linha do tempo de um Charge dispara **na soltura** e usa eventos `{effect: 'nome'}` ligados a manipuladores registrados em `sim/move-effects.js` (`registerEffect`); o manipulador recebe `fx.charge = {ticks, seconds, level, params}`. Se devolver `{ok: false, reason}`, o jogo devolve a stamina (uma vez), remove recarga e recuperação e emite `moveFailed`.

**Contrato M28.4 (D1):** ao apertar, o controlador captura `chargeParams(def)` — cópia **congelada** de `C.world.charge` com as substituições de `def.charge`. Alterar sliders durante a carga só vale para os próximos usos.

**Eventos:** `chargeStart`, `chargeRelease`, `chargeCancel`, `chargeInterrupt`, `cooldownBoost`, `moveFailed`. **Testes:** `test/charge.test.mjs`.

## Reflect — Fase 2 (primeiro Move real)

**Registrado no bootstrap do laboratório** (`main.js` → `registerStandardMoves()`, D2); **nenhum slot vem equipado** (opt-in: `__lab.moves.equipStandard(0)` ou `game.setLoadout(0, ['reflect'])`). Tecla padrão **A** (slot 1). Definição e efeito em `sim/moves/reflect.js`; reflexão, destruição e proteção em `sim/world.js`; geometria em `sim/geometry.js`; valores provisórios em `C.world.reflect` (M30.10).

| Regra | Valor |
|---|---|
| Custo / recarga | 1 de stamina ao iniciar / 8 s a partir da soltura; recarga acelerável |
| Tamanho | largura 1,5×–3× e altura 1,5×–2,5× das dimensões **lógicas** (largura/profundidade = 2 × `halfExtent`, altura = `bodyHeight`, M30.4), crescendo **linearmente** com a carga (curva provisória); espessura 0,10 m |
| Posição | à frente, a 50% da profundidade do personagem; base no chão; orientação congelada ao soltar |
| Duração | 4 s + tempo carregado (4–8 s); Power Level = nível da carga (PL1–PL3) |
| Falta de espaço | encolhe até o maior retângulo válido (mínimo 1,5×); sem espaço, **falha**: devolve a stamina, sem recarga (arena, paredes e lutadores contam) |
| Colisão com projéteis | varredura de segmento; primeira superfície atingida; **frente e bordas refletem** (borda pela própria normal, mesmo vindo de trás); **pelo verso atravessa** e ignora a barreira até sair do volume; empate: frente > borda > verso (M30.5) |
| Ao refletir | o refletor vira o dono; homing cancelado; PL conservado; dano recalculado com o Ataque do refletor (`captured.attackFraction × Ataque`, M30.1); no máximo 16 reflexões do mesmo projétil por passo (salvaguarda, M17.2) |
| PL | projétil de PL ≤ barreira reflete; PL superior **destrói** a barreira e é neutralizado (sem explosão) |
| Tackle | destrói a barreira (qualquer PL, frente/verso/borda, inclusive a própria); o atacante recua (`tackleRecoil` 15% do deslocamento nominal) e fica em stagger de 0,25 s |
| Explosões | entidades `area` com `explosion: true` destroem as barreiras que alcançam; quem está com o **segmento 3D do centro da explosão ao centro do corpo** cruzando uma barreira fica **protegido** daquela explosão (inclusive o dono; mesmo que a barreira seja destruída por ela, M30.6/M30.7) |
| Sólida | bloqueia os dois lutadores (deslizam pelas laterais); o Dodge pode passar por cima se a trajetória permitir |

**Contrato M28.4:** a barreira guarda `captured` (tolerância de empate, limite de reflexões, recuo e stagger do Tackle, dimensões) e nunca mais lê `C.world.reflect`. **Eventos:** `reflected`, `neutralized`, `barrierBroken` (`by`: `pl`, `tackle`, `explosion`), `shielded`, `reflectCycle`, `moveFailed`. **Testes:** `test/reflect.test.mjs`. **Ainda não:** prévia visual e VFX (Fase 6), laser (Fase 7), clash/counter entre Moves (Fase 4), uso pela IA (Fase 5).

## Garantias verificadas (`test/moves.test.mjs`)

- O registro está vazio, e nenhum código do laboratório registra movimentos.
- Teclas de slot sem movimento equipado não mudam nada na partida.
- Definições inválidas são recusadas com o motivo.
- Projétil: custo, recarga, criação na frente do dono, voo em subpassos, dano, lançamento e consumo.
- Defesa comum, defesa perfeita e invulnerabilidade da esquiva valem também contra entidades.
- Barreiras: respeitam o dono, têm vida e rompem; o projétil do próprio dono atravessa.
- Paredes: seguram lutadores andando, rebatem lançados, bloqueiam projéteis e funcionam giradas.
- Explosão no impacto com queda linear e empurrão radial; pulsos radiais acertam uma vez por alvo por pulso.
- Buffs e debuffs: pilhas, limite, expiração exata, dano periódico, enraizar, silenciar, desarmar, ataque, dano recebido e custo.
- Golpe corpo a corpo, status no adversário, deslocamento (dash) e cancelamento a partir da esquiva.
- Determinismo e save/load (replay) com projéteis no ar, áreas, status e recargas.

## Ainda não preparado (decisões para quando os movimentos chegarem)

- **IA:** a IA tática ainda não usa movimentos especiais nem desvia de projéteis. O mundo já é legível por ela (`game.world`).
- **Esquiva perfeita contra projéteis:** hoje um projétil atravessado durante a invulnerabilidade só é ignorado; não dá bônus de contra-ataque. É uma regra a decidir.
- **HUD:** as propostas A, B e C ainda mostram cooldowns de demonstração. A ligação aos slots reais é simples: `f.loadout` e `f.moveCooldowns`.
- **Jogo oficial** (`prototypes/game`): não foi alterado. O porte depende de autorização.
