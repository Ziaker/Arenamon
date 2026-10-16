# Arquitetura e Integração Futura: Janelas de Combate da Animação na Arena

Este documento define o contrato versionado `animationCombatWindows`, formaliza a semântica de intervalos semiabertos `[startStep, endStep)` e especifica como uma fase posterior poderá conectar essas janelas ao runtime de `resolveHit()` em `sim/combat.js`, garantindo compatibilidade reversa estrita com o comportamento atual `[0, duration)`.

---

## 1. Diagnóstico do Comportamento Atual da Arena

Na implementação atual do Arenamon Combat Lab:
- **Tackle 100% Ativo:** A colisão ofensiva do tackle é considerada ativa durante **toda a sua duração** (`[0, duration)`), conforme avaliado em `tackleConnects()` e `resolveHit()`.
- **Colisores Físicos AABB:** Os contatos são detectados pela sobreposição de caixas AABB da física contínua com tolerâncias vetoriais de alinhamento e velocidade de fechamento.
- **Leitura Somente Diagnóstica:** Eventos do GLB (`hitbox_on`, `hitbox_off`, `impact`, `invulnerable_start`, `invulnerable_end`, `recovery_start`) são lidos exclusivamente para apresentação visual comparativa em `characters.js` e `main.js`.
- **Invulnerabilidade:** O tackle e a esquiva possuem janelas nominais próprias em `C.actions[kind].invulnerable` (padrão de 200 ms / 24 passos para ambos quando o toggle geral está ativo).
- **Sem Sliders de Edição em Tempo de Execução:** A Arena não possui nem deve possuir sliders enganosos de edição manual de hitbox que finjam alterar a física sem alterar a fonte de verdade.

---

## 2. Especificação do Contrato `animationCombatWindows` (v1.0.0)

O contrato é versionado, serializável e adota **passos da simulação** como unidade canônica inteira, vinculado à taxa configurada no snapshot (`C.test.step`, padrão 120 Hz).

### 2.1 Semântica Estrita de Intervalos Semiabertos `[startStep, endStep)`

Para eliminar inconsistências de contagem (+1 passo) e garantir composição limpa:
- Um passo $s$ está ativo se e somente se:
  $$\text{startStep} \le s < \text{endStep}$$
- A duração do intervalo em passos é exatamente:
  $$\Delta = \text{endStep} - \text{startStep}$$
- O comportamento legado de uma ação de 400 ms (48 passos a 120 Hz) é representado por:
  $$[0, 48)$$
- Duas janelas ativas contíguas (por exemplo, golpe duplo) $[10, 20)$ e $[20, 30)$ **não se sobrepõem**, pois o passo 20 pertence exclusivamente ao segundo intervalo.

### 2.2 Estrutura do Objeto de Contrato

```typescript
export interface AnimationCombatWindows {
  schemaVersion: "1.0.0";
  characterId: string;
  actionId: string;
  clipName: string;
  variantIndex: number;
  variantId?: string | null;
  unit: "step";
  intervalSemantics: "[startStep, endStep)";
  stepSeconds: number; // lido de config.test.step (ex: 1/120)
  fps: number;         // 1 / stepSeconds (ex: 120)
  
  clipDurationSeconds: number;
  clipDurationSteps: number;
  actionDurationSeconds: number;
  actionDurationSteps: number;
  timeScale: number;

  /** Janelas ativas ofensivas (hitboxes): lista de [startStep, endStep) */
  activeWindows: Array<[number, number]>;

  /** Janelas defensivas de invulnerabilidade: lista de [startStep, endStep) */
  invulnerabilityWindows: Array<[number, number]>;

  /** Janelas de cancelamento da ação: lista de [startStep, endStep) */
  cancelWindows: Array<[number, number]>;

  /** Marcador visual de recuperação (recovery_start da animação) */
  recoveryStart: number | null;

  /** Pistas pontuais de impacto com passo e tempo */
  impactHints: Array<{
    step: number;
    timeMs: number;
    hitIndex?: number;
    kind?: string;
    description?: string;
  }>;

  /** Volume opcional SOMENTE COMO METADADO (não participa da física da Arena) */
  volume?: {
    shape: "aabb" | "sphere" | "box" | "capsule";
    offset: [number, number, number];
    size: [number, number, number];
    boneName?: string | null;
    metadataOnly: true;
  } | null;

  source: {
    origin: "glb_events" | "manual_profile" | "synthetic";
    rawEventCount: number;
    computedAt: string;
  };
}
```

---

## 3. Distinção Conceitual entre Fases e Marcos

Para evitar sobreposição e ambiguidade no motor:

| Conceito | Fonte | Significado no Jogo |
| :--- | :--- | :--- |
| **`chainAfter`** | `C.actions[kind].chainAfter` | Passo/tempo a partir do qual outra ação ou cancelamento pode interromper a ação atual. |
| **`recovery_start`** | Marcador do GLB (`recovery_start`) | Marco puramente visual onde a pose de ataque transiciona para a pose de recuperação. |
| **`recoveryTime`** | `C.actions[kind].recoveryTime` | Fração da curva física contínua sem deslocamento ativo. |
| **`recovery` mecânica** | `C.rules.landingRecovery` / etc. | Bloqueio mecânico de comandos (stun/delay). |
| **Recuperação Pós-Ativo** | Derivada de `activeWindows` | Intervalo semiaberto $[lastActiveEnd, durationSteps)$ em que o golpe não é mais ofensivo. |

---

## 4. Plano de Conexão Futura a `resolveHit()`

### 4.1 Princípio de Compatibilidade Reversa Total
Nenhuma mudança será ativada sem autorização explícita. O sistema adotará um toggle em `C.extras.toggles.enableAnimationCombatWindows` com valor padrão `false`.
- Quando desativado (ou na ausência de contrato), o tackle opera em modo legado: ativo durante todo $[0, durationSteps)$.
- Quando ativado, `resolveHit()` consulta estritamente se o passo atual da ação recai em uma das `activeWindows`.

### 4.2 Proposta de Patch Não Invasivo em `sim/combat.js`

```javascript
// sim/combat.js — Exemplo de integração futura segura

function isHitboxActive(action, currentStep, fallbackDurationSteps) {
  // 1. Compatibilidade reversa estrita: toggle desligado ou ação sem contrato
  if (!C.extras.toggles?.enableAnimationCombatWindows || !action?.combatWindows) {
    return currentStep >= 0 && currentStep < fallbackDurationSteps; // Legado [0, duration)
  }

  // 2. Avaliação de intervalos semiabertos [start, end)
  return action.combatWindows.activeWindows.some(
    ([start, end]) => currentStep >= start && currentStep < end
  );
}

export function resolveHit(attacker, defender, normal, relative) {
  const R = C.rules, X = C.extras.combat, T = C.extras.toggles;
  
  // Passo atual da ação na taxa discreta da simulação
  const attackerStep = Math.round((attacker.action?.elapsed ?? 0) / C.test.step);
  const durSteps = Math.round((C.actions.tackle.duration) / C.test.step);

  // Verificação de janela ofensiva (filtra startup e recuperação)
  if (!isHitboxActive(attacker.action, attackerStep, durSteps)) {
    return null; // Golpe em fase de preparação ou pós-ativo: sem colisão ofensiva
  }

  // Suporte a Golpes Múltiplos (Multi-hit):
  // Cada janela ativa possui seu próprio registro de alvos já atingidos
  const currentWindowIndex = attacker.action.combatWindows?.activeWindows.findIndex(
    ([s, e]) => attackerStep >= s && attackerStep < e
  ) ?? 0;

  attacker.action.hitWindows ??= [];
  attacker.action.hitWindows[currentWindowIndex] ??= new Set();
  
  // Se o alvo já foi atingido nesta janela ativa específica, descarta contato redundante
  if (attacker.action.hitWindows[currentWindowIndex].has(defender.id)) {
    return null;
  }

  // Registra o hit nesta janela ativa e no histórico global da ação
  attacker.action.hitWindows[currentWindowIndex].add(defender.id);
  attacker.action.hits.add(defender.id);

  // ... restante da resolução de dano, recuo, lançamento e clash permanece rigorosamente idêntico ...
}
```

---

## 5. Rastreamento e Sorteio de Variantes

Cada estado da Arena suporta múltiplas animações (variantes). Para evitar falsas atribuições em relatórios e replays:
1. **Identificação com Telemetria Ativa:** Quando o contexto de execução fornece `tick` e `serial` (identificador da ação capturado em `Character.trackAction`), a variante é identificada determinísticamente via `hash(slot, actionId, tick, serial)`. O relatório exibe `Variante executada (tick X, serial Y)`.
2. **Identificação Simulada:** Na ausência de `serial` real, o relatório declara explicitamente `Variante simulada para esta seed/tick (serial assumido = 0)`.
3. **Modo Estático:** Sem parâmetros de partida, o relatório analisa a `Variante primária (índice 0)`.

---

## 6. Validação do Modelo Oficial Real (`personagem-studio.glb`)

Com a extração da duração real através dos accessors das trilhas do GLB, a animação oficial de tackle possui:
- **Duração real da animação no GLB:** **3,000 s**
- **Duração da ação na Arena:** **0,400 s** (48 passos @ 120 Hz)
- **Fator de escala temporal:** $\times 0,1333$ ($0,4 / 3,0$)

### Janelas Mapeadas em Intervalos Semiabertos:
| Marco do GLB | Tempo no Clipe | Tempo Reescalado na Ação | Passo a 120 Hz |
| :--- | :--- | :--- | :--- |
| `invulnerable_start` | 0,000 s | 0,000 s | **Passo 0** |
| `hitbox_on` | 0,600 s | 0,080 s | **Passo 10** |
| `impact` | 0,900 s | 0,120 s | **Passo 14** |
| `invulnerable_end` | 1,500 s | 0,200 s | **Passo 24** |
| `hitbox_off` | 2,400 s | 0,320 s | **Passo 38** |

- **Janela Ativa (Hitbox):** `[10, 38)` (28 passos, 233,3 ms).
- **Janela de Invulnerabilidade Marcada:** `[0, 24)` (24 passos, 200 ms).
- **Janela de Invulnerabilidade Efetiva da Arena:** `[0, 24)` (24 passos, 200 ms).
- **Concordância de Invulnerabilidade:** $\Delta = 0$ passos (**perfeita paridade entre animação e regra do motor**).
- **Erros de `TIME_EXCEEDS_DURATION`:** **Zero** (todos os eventos situam-se dentro da duração real de 3 s).
