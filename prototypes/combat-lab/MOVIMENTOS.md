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

**Entrada:** os slots 1–4 usam as teclas **1, 2, 3 e 4** (vermelho manual: H, G, N e M). No gamepad, X, RT, LT e o clique do analógico direito acionam os slots 1 a 4. Tudo é configurável em Controles.

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
