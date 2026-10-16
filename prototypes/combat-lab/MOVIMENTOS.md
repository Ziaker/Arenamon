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

## Psyshock — Fase 3 (segundo Move real)

Registrado no bootstrap (como o Reflect), **sem slot equipado por padrão**; tecla padrão **S** (slot 2). Definição e efeito em `sim/moves/psyshock.js`; voo, homing, acertos por alvo e colisão entre pedras em `sim/world.js`; sorteios em `sim/moves/rng.js`; valores provisórios em `C.world.psyshock` (M30.10), capturados ao apertar o botão (M28.4).

| Regra | Valor |
|---|---|
| Pedras | 3 iniciais, +1 a cada 0,8 s de carga (contagem de passos), 8 no máximo; disparam **todas juntas** na soltura |
| Igualdade (M30.2) | todas as pedras da execução têm o **mesmo PL** (nível da carga), o **mesmo dano-base** (0,2 × Ataque do lançador, gravado no disparo, M30.1) e a mesma física; tamanho e altura visuais variam sem efeito |
| Velocidade | sorteada por pedra entre 10 e 14 m/s (D4); sorteios determinísticos por passo, lutador e execução |
| Posição de partida | arco à frente do lançador (anéis e alturas sorteados); se um ponto não está livre, busca à frente até 3 m (M27.3); sem espaço para todas, **falha** (stamina devolvida, sem recarga, M29.3) |
| Com alvo travado | cada pedra mira um ponto **sorteado dentro da caixa lógica do alvo** (M30.8) e faz homing de 0,3 s a no máximo 180°/s; perder o alvo (derrota) encerra o homing; **reflexão** o cancela |
| Sem alvo | leque frontal discreto de 20°, espaçamento igual, sem homing |
| Acertos | cada pedra atinge o primeiro lutador e se despedaça; dano × **0,8ⁿ** (n = acertos que causaram dano no mesmo alvo na mesma execução, aplicado no impacto); knockback de 0,3 m/s por pedra com teto de **0,9 m/s por alvo e execução** (M30.3); defesa, defesa perfeita e i-frames valem por pedra |
| Pedras entre si | do **mesmo** Psyshock nunca colidem (mesmo refletidas); de donos diferentes: PL igual → as duas somem; PL superior vence e continua |
| Reflexão | pelo Reflect (barreira) conforme a Fase 2: dono troca, dano recalculado com o Ataque do refletor, PL conservado |

**Provisórios documentados:** o 0,8ⁿ conta impactos e defesas comuns (não defesa perfeita nem invulnerabilidade); o Ataque usado é o **atributo-base** (P13); o teto de knockback conta só o horizontal e só impactos com lançamento (P14); distribuição uniforme dos sorteios (P15). **Eventos:** `spawn`, `impact`/`partial`, `reflected`, `stoneClash`, `groundHit`, `moveFailed`. **Testes:** `test/psyshock.test.mjs` e `test/moves.browser.mjs`. **Ainda não:** formação visual das pedras durante a carga, VFX e gesto da mão (Fase 6), clash/counter com Reflect de PL diferente em outros Moves (Fase 4), uso pela IA (Fase 5).

## Power Level, Clash e Counter — Fase 4

O PL pertence à **execução** do Move (M18.4): Reflect e Psyshock recebem PL1–PL3 pela carga e as entidades herdam esse nível. **Tackle: PL1 fixo** (M21.1). Disputas implementadas, só entre entidades marcadas como disputáveis (`clashable`):

| Disputa | Resultado |
|---|---|
| Pedra × Reflect | PL ≤ barreira: refletida; PL > barreira: a barreira é destruída e a pedra neutralizada (Fase 2) |
| Pedra × Tackle em curso (fora da invulnerabilidade) | PL1: **Clash** — só a pedra se despedaça, o Tackle segue. PL ≥ 2: **Counter** — a pedra vence e segue; o Tackle fica **neutralizado** (não conecta mais nesta ação, nem destrói barreira) e a pedra atinge o corpo do derrotado |
| Pedra × pedra (donos diferentes, execuções diferentes) | PL igual: as duas se destroem; PL superior vence e continua; só as envolvidas somem |
| Tackle × Reflect | o Tackle destrói em qualquer PL (M19.9) |

**Counter Stagger** (M20.8, M21.4–M21.7): 0,2 s (`C.world.psyshock.counterStagger`, capturado nas pedras), só quando o ataque **vencedor atinge o corpo** do derrotado (disputa à distância não machuca); não acumula nem reinicia enquanto ativo; interrompe o Charge pela regra comum. **Eventos:** `tackleClash`, `counter`, `counterStagger`, `stoneClash`; eventos de acerto e reflexão trazem o `pl`.

**Não aplicável aos dois primeiros Moves (decisão a tomar quando houver Moves ofensivos de área):** Clash entre áreas e projétil × explosão (M22.2–M22.4), neutralização local × integral (M22.3), defesas herdadas com PL (M21.8) e elegibilidade configurável por Move (M18.6).

## IA com Moves — Fase 5

A IA tática (`sim/ai-moves.js`) usa Reflect e Psyshock **só quando equipados**, pelos mesmos campos de comando do jogador (`skill`, `skillHeld`) e **só pede o que o motor aceitaria agora** (mesma função de permissão: stamina, recarga, recuperação, apoio no chão, esquiva/defesa). Sem Moves equipados nada muda (nenhum sorteio consumido; luta idêntica à anterior).

| Situação | O que a IA faz |
|---|---|
| Projétil hostil a caminho | **Reflect reativo**: só carrega se der tempo de chegar a um PL ≥ o do projétil (senão uma barreira de PL menor seria destruída); caso contrário defende (D) em cima da hora |
| Adversário longe, caminho livre, stamina ≥ 2 | **Psyshock** com probabilidade pelo estilo (`attack`) e pela distância; PL1/PL2/PL3 sorteados conforme o estilo (`reserve`, `bait`) e a distância; trava o alvo (homing) |
| Barreira refletora do adversário na linha | **Tackle** para destruí-la quando está a menos de 3,2 m (em vez de atirar contra ela) |
| Projétil imediato durante uma carga | defende (cancela a carga, como um jogador faria) |

Decisões (momento, Move, motivo, PL) ficam em `brain.t.mv.log` (telemetria opcional, serializável com o resto do estado da IA). A IA lê o mundo por `brain.getWorld()`, função ligada pelo `Game` que **não** entra no estado salvo. **Provisório:** pesos e limiares das decisões (calibráveis; sem medição de equilíbrio com Moves — `ai-eval` só mede sem Moves). **Testes:** `test/ai-moves.test.mjs`.

## Interface do laboratório — Fase 6

**Aba Moves** (`ui/moves-panel.js`): equipar Reflect (A) e Psyshock (S) para o jogador e o vermelho (vêm **desligados**; valem já na partida atual); **emissores técnicos** (projétil hostil PL1/PL2/PL3 do vermelho rumo ao azul; explosão no centro, PL2); **10 cenários técnicos** repetíveis (`sim/scenarios-moves.js`, duelo isolado, semente fixa, ajustes atuais, esperado × obtido, exportável em JSON); **parâmetros** de `C.world.charge/reflect/psyshock` com tooltip, formato e marca **aprovado** × **provisório**, botão ↺ por parâmetro e restaurar todos (valem para os **próximos usos**, M28.4); **avaliação jogável dos Moves** (10 itens, aprovado/reprovado/observação, salva no navegador e no JSON — é a aprovação **sua**, M28.9).

**HUD dos slots** (`ui/moves-hud.js`, `sim/move-state.js`): para cada lutador com Moves, tecla, nome e estado real — pronto, carregando (% e PL com a cor do nível), recarga, recuperação ou bloqueado **com o motivo do motor** (a tela usa as mesmas permissões do controlador). **Aviso discreto** quando um Move falha (ex.: “Reflect: sem espaço — stamina devolvida, sem recarga”). O aviso de contato da arena e a linha de contato passaram a entender os eventos novos (reflexão, barreira destruída, Counter, stagger, proteção).

**Visual** (`view/world-view.js`): barreira e pedras coloridas pelo PL (PL1 ciano, PL2 âmbar, PL3 magenta), barreira com contorno e piscar no último segundo, **prévia** da barreira durante a carga (verde se cabe, vermelha se faltar espaço), pedras que se formam ao redor de quem carrega o Psyshock (3 + 1 a cada 0,8 s) e **anéis de impacto** nos eventos. É representação mínima e **provisória**; animações do personagem, gesto da mão e VFX definitivos dependem da sua avaliação e dos modelos.

**Fica fora desta fase:** lasers e seus emissores (Fase 7), overlays técnicos específicos dos Moves além dos já existentes em Visualizar, persistência dos equipamentos no workspace (equipar vale na sessão).

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
