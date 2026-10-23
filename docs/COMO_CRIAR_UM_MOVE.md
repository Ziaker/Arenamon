# Como criar ou editar um Move (ficha única)

**Versão 1.27.0.** Um Move novo são **dois arquivos pequenos** em `prototypes/combat-lab/src/sim/moves/`: `<id>.js` (regras e efeito) e `<id>.params.js` (parâmetros). Dos parâmetros saem o padrão em `C.world`, os sliders da aba **Moves**, o padrão de fábrica, a exportação em JSON, a linha do tempo, o comparador A/B e a cobertura dos testes. Nenhuma tabela precisa ser editada em `config.js`, `moves-panel.js` ou `new-moves.js`.

## 1. Especificar (opcional, recomendado)

Aba **Moves › ✚ Assistente de ficha de Move**: formulário guiado com a ficha obrigatória de `docs/REGRAS_CRIACAO_MOVES.md` §2. Responda só o que está decidido; o resto fica **pendente** (o assistente nunca preenche por suposição). Cada campo guarda status (proposto, aprovado, implementado, homologado) e fonte. Exporta Markdown (pessoas) e JSON (máquina) e já mostra o comando do passo 2.

## 2. Criar

```bash
npm run novo-move -- "Nome do Move"
```

Cria `src/sim/moves/<id>.js`, `src/sim/moves/<id>.params.js` e `test/moves-<id>.test.mjs` (teste de fumaça) e atualiza os índices automáticos. O modelo já funciona (um buff de Defesa por alguns segundos). Depois:

1. Em `<id>.js`, troque o efeito pelo que o Move faz e preencha a descrição.
2. Em `<id>.params.js`, ajuste ou acrescente linhas (rótulo, dica, mínimo, máximo, passo, unidade, padrão). Cada linha vira um slider.
3. Opcional: perfil da IA (campo `ai` da ficha) e metadados (`meta`: categoria, tipos, PL e os quatro status).
4. `node prototypes/combat-lab/test/moves-<id>.test.mjs`, depois `npm run build:combat-lab`.
5. Abra `JOGAR_ARENAMON.html` › **Moves**: o cartão do Move já está lá. Equipe em **⚔ Ações › Moves**.

## 3. Anatomia

```js
// <id>.params.js (módulo puro: só importa params-registry.js)
export const params = defineMoveParams('meuMove', {   // 'meuMove' = grupo em C.world = def.group
  id: 'meu-move', title: 'Meu Move',
  meta: {category: 'Burst', types: ['Projectile'], pl: 'PL1', status: {proposto: true, aprovado: false, implementado: true, homologado: false}},
  hint: 'Texto de apoio da aba Moves.',
  rows: [
    ...standardRows({cost: .8, cooldown: 10, cast: .35}),
    paramRow({key: 'duration', label: 'Duração', tip: 'O que muda.', min: .5, max: 20, step: .25, unit: 'sec', value: 5}),
    ...hitShakeRows(),   // opcional: tremor de câmera ao acertar
  ],
});

// <id>.js
export const ficha = defineFicha({
  def: meuMoveDef, effect: ['meu-move', meuMoveEffect],   // ou tackle / hooks / steps / effects
  params,
  ai: {kind: 'tap', p: .3, why: 'motivo no log da IA', distance: {min: 3, max: 9}, requires: ['tGround'], minStamina: 1.5},   // opcional
});
```

- **Unidades:** `num`, `int`, `sec`, `pct`, `m`, `ms` (m/s), `ms2` (m/s²), `deg`, `x`, `yesno`. Valor fora da faixa, chave repetida ou unidade desconhecida param o carregamento com a causa.
- **Perfil da IA (`ai`):** `kind` `tap`/`charge`/`aim`, chance base `p`, `why`, `distance {min,max}`, `minStamina`/`maxStamina`, `requires`/`forbids`/`anyOf` (`tGround`, `tGuard`, `facing`, `tackling`, `tCharging`), `notStatus`, `goal` (carga), `mode`/`offset` (marcador) e `when` para casos especiais. A IA continua passando pelas mesmas permissões do jogador. Sem `ai`, a IA não usa o Move.

## 4. Editar um Move existente

Mude `value`, a faixa ou o texto da linha em `<id>.params.js`. Para mexer só em números durante o teste, use os sliders (entram no desfazer e no JSON de Exportar). Cada cartão da aba Moves tem:

- **Mecânica:** sliders + **⚖ Comparar variantes (A/B)**: atual × padrão de fábrica ou um preset, mesmo cenário e semente, com métricas e o primeiro tick em que as execuções se separam.
- **Visual (VFX):** controles de aparência.
- **Animação:** atalho para **Ações › Moves**.
- **Linha do tempo:** marcas em ticks de 120 Hz (cast, efeito, hitbox, invulnerabilidade, cancelamento, fim) e **⏱ Medir no motor**, que roda o Move de verdade e compara.
- **▶ Disparar:** usa o Move com a tecla do slot (segura pelo tempo ajustado; opção de redisparar ao soltar um slider).

## 5. O que é automático e como conferir

| O que | Como |
|---|---|
| Índices das fichas (`fichas.generated.js`, `params.generated.js`) | `npm run fichas` (e todo `npm run build:combat-lab`); o teste `moves-fichas` falha se estiverem velhos |
| Contratos de todos os Moves (grupo, sliders, faixas, efeitos registrados) | `moves-contracts.test.mjs`; conflitos conhecidos ficam explícitos no teste |
| Matriz de cenários (chão, ar, plataforma, parede, guarda, esquiva, hitstop, lock-on, determinismo, save/load, simultâneo) | `move-matrix.test.mjs`; Move novo entra sozinho |
| Índice vivo (arquivos, testes e documentos que citam cada Move) | `npm run indice` → `docs/INDICE_VIVO_MOVES.md` |
| Bug reproduzível | aba Partida › 🐞 Capturar bug; abra o JSON no mesmo campo |

## 6. Moves em ficha e o que falta

Em ficha: **Harden** e **Second Wind** (Normal), **Swift** (Burst), **Guard Break** (Charge). Os outros 15 ainda usam a tabela antiga em `ui/moves-panel.js` e as linhas em `sim/config.js`; migrar um é mover essas duas partes para a ficha dele e apagar as originais. Também fora da ficha, por enquanto: ícone no menu (`ui/menu-styles-model.js`), efeito compartilhado de VFX (`ui/moves-vfx-panel.js`) e aura de status (`view/status-aura.js`). Estado de cada item do plano de melhorias: `docs/PLANO_15_MELHORIAS_STATUS_2026-10-23.md`.
