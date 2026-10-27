# Contrato Canônico de Reações e Estados dos Lutadores

**Fase F1 — Padronização de Contratos e Eventos Compartilhados**  
**Projeto Arenamon — Laboratório de Combate**

---

## 1. Visão Geral da Arquitetura de Estados

Para eliminar inconsistências históricas — onde variáveis físicas eram misturadas com estados de combate e estados visuais — o Arenamon adota uma separação rigorosa em quatro camadas ortogonais:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CAMADA FÍSICA (physics.js / movement.js)                 │
│    grounded | airborne | sliding | vaulting | landing       │
├─────────────────────────────────────────────────────────────┤
│ 2. CAMADA DE COMBATE (combat.js / ctrl-update.js)           │
│    neutral | moving | dodge | hitstun | stagger | guard | ko│
├─────────────────────────────────────────────────────────────┤
│ 3. RESTRIÇÕES E MODIFICADORES (flags atômicos)             │
│    canMove | canAttack | invulnerable | armored | absent    │
├─────────────────────────────────────────────────────────────┤
│ 4. CAMADA DE APRESENTAÇÃO (characters.js / view.js)         │
│    clipe ativo | progresso [0..1] | blend | VFX anexos      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Invariantes Canônicas das Camadas

### 2.1 Camada Física
- Um lutador é considerado **físicamente no solo** (`grounded`) se e somente se sua distância vertical à superfície de suporte (solo, rampa ou plataforma) for inferior à tolerância de contato (`eps <= 0.005 m`) e sua velocidade vertical descendente foi resolvida contra a superfície.
- O estado transitório de **pouso** (`landing`) só é disparado quando há uma transição real de `airborne` para `grounded` com velocidade de impacto vertical superior a `C.vfx.ground.minImpact`. Pulos e quedas simples utilizam amortecimento suave sem travar o lutador em frames de impacto pesado.

### 2.2 Camada de Combate e Transições
- **Neutral:** Lutador apto a receber qualquer input (movimento, ataque, esquiva, guarda, salto).
- **Moving:** Deslocamento voluntário no plano horizontal pelo analógico/teclado.
- **Hitstun:** Estado de atordoamento temporário decorrente de dano não bloqueado. **Invariante crítica:** O lutador SÓ permanece em `hitstun` enquanto `f.stun > 0`. Ao zerar o tempo de atordoamento ou knockback (`knockRecovery <= 0`), o lutador DEVE transicionar diretamente para `'moving'` (se houver input de direção ativo) ou `'neutral'` (se o controle estiver em repouso). É proibido qualquer fallback temporário ou transitório para `'hitstun'`.
- **Stagger:** Atordoamento prolongado resultante de quebra de guarda (`guardBreak`), choque pesado de investidas (`tackleClash`) ou pisão na cabeça (`footstool`).
- **Guard:** Estado de sustentação de defesa. Pode ser quebrado por ataques com flag `guardBreak`.
- **KO:** Vida zerada (`hp <= 0`). Nenhum input é processado, timers de ação são interrompidos e flags de ocultação são anulados.

### 2.3 Restrições e Modificadores
- **`absent`:** Ativado durante manobras evasivas especiais (ex.: *Bullet Punch* no momento de avanço dimensional/vanish).
  - **Invariante:** Se o lutador for derrotado (`hp <= 0`) ou o combate for interrompido/reiniciado enquanto `absent === true`, o flag DEVE ser imediatamente resetado para `false`, garantindo que a malha 3D e o colisor reapareçam na cena para a sequência de derrota.
- **`charge` / `tackleCharge` / `aim`:** Estruturas transitórias de preparação de golpe.
  - **Invariante:** Ao cancelar a carga (`cancelCharge`), a leitura de passos ou multiplicadores deve adotar valores defensivos (`ch.params?.step ?? C.test.step ?? 0.05`), impedindo falhas por desreferenciamento de nulo (`TypeError`).

---

## 3. Matriz de Resolução de Bloqueio e Quebra de Guarda (Guard Break)

Quando um ataque atinge um oponente em estado de guarda (`defensor.defending === true`):

| Atributo do Ataque | Ação do Atacante | Estado do Defensor | Dano | Resultado |
|---|---|---|---|---|
| Golpe Comum | Entra em `recoil` (recuo de bloqueio) | Permanece em `guard` (guardStun curto) | Chip damage | `'partial'` |
| Golpe com `guardBreak: true` | Conclui o golpe sem recuo penalizante | Entra em `stagger` (`f.stun = C.rules.guardBreakStun`) | Dano pleno ou ampliado | `'impact'` (com `broken: true`) |
| Ataque Perfeito (timing no frame) | Atacante sofre repulsão massiva | Transiciona para `perfect` (janela de contra-ataque) | 0 | `'perfect'` |

**Correção P0 Obrigatória (EST-02):** Em `combat.js`, o código deve inspecionar `attacker.action?.guardBreak` **antes** de atribuir qualquer recuo ao atacante, assegurando que o golpe quebre o escudo do oponente em vez de colocar o próprio atacante em recoil.

---

## 4. Normalização da Apresentação de Animações (`characters.js`)

Ao tocar clipes com base no tempo de atordoamento (`hitstun` ou `stagger`):
- O progresso do clipe deve ser computado por:
  $$\text{progresso} = 1.0 - \text{clamp}\left(\frac{f.stun}{f.stunMax},\; 0,\; 1\right)$$
- Onde $f.stunMax$ é a duração real do atordoamento atribuída no momento do impacto.
- É estritamente proibido normalizar por constantes estáticas pequenas (como `R.guardStun` de 0.15s), pois stuns pesados de 0.6s a 1.2s geravam valores fora do intervalo $[0, 1]$, travando a animação no primeiro frame.
