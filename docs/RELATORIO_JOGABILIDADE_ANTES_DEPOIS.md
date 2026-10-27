# Relatório Comparativo de Jogabilidade: Antes vs. Depois

**Fase F8 — Homologação e Validação de Gameplay**  
**Projeto Arenamon — Laboratório de Combate**

---

## 1. Visão Geral

Este relatório documenta as melhorias estruturais de combate, física, efeitos visuais e estabilidade operacional alcançadas após a execução integral do plano P0 no Laboratório de Combate do Arenamon (`prototypes/combat-lab/`).

---

## 2. Comparativo Detalhado por Sistema

### 2.1 Transições de Estado e Recuperação de Knockback (EST-01, EST-03)
- **Antes:**
  - Ao concluir a recuperação de qualquer lançamento ou pouso (`knockRecovery <= 0`), o lutador entrava involuntariamente em estado de atordoamento (`hitstun`) por exatamente 1 frame (16.6 ms a 60 Hz ou 8.3 ms a 120 Hz).
  - Isso gerava um "piscar" na animação e um micro-travamento que impedia a transição imediata para corrida ou defesa.
  - Ao sofrer *Footstool* (pisão aéreo na cabeça), o defensor tinha suas velocidades zeradas, mas seu estado lógico continuava preso em `'moving'` ou `'dodge'`, impedindo a reação visual de atordoamento.
- **Depois:**
  - Ao zerar `knockRecovery`, o lutador transiciona deterministicamente para `'moving'` (se o analógico/teclado tiver comando) ou `'neutral'` (repouso absoluto). O falso frame de `hitstun` foi 100% extinto.
  - O *Footstool* agora transiciona o defensor para `'stagger'`, emite normal descendente `{x: 0, y: -1, z: 0}` e permite leitura imediata pelos despachantes de VFX e câmera.

### 2.2 Quebra de Guarda e Triângulo Tático (EST-02)
- **Antes:**
  - Quando um lutador utilizava um ataque com propriedade de quebra de guarda (*Guard Break*) contra um oponente em bloqueio comum, a simulação substituía a ação atacante por `{kind: 'recoil', ...}` prematuramente.
  - O bloco condicional que aplicaria a quebra de guarda nunca era executado; o defensor sofria apenas recuo comum de 0.15s e o atacante ficava vulnerável em recoil, invertendo completamente a vantagem tática.
- **Depois:**
  - O flag `guardBreak` é inspecionado antes de qualquer atribuição de recuo.
  - O atacante mantém a iniciativa e o defensor em guarda comum tem seu escudo quebrado (`broken: true`), entrando em atordoamento pesado prolongado (`stagger = 0.6s`), restaurando o triângulo tático do jogo.

### 2.3 Resolução Visual de Entidades Destruídas e Projéteis (VFX-01, ARC-01)
- **Antes:**
  - Quando um projétil colidia com uma barreira e a quebrava (`barrierBroken`), ou quando pedras colidiam (`stoneClash`), a simulação marcava `dead = true` e removia as entidades do grafo.
  - O evento emitido não continha coordenadas espaciais `{x, y, z}`.
  - A camada de apresentação (`wv-update.js`) recebia o evento, avaliava `pos` como `null` e descartava o efeito (`if (!pos) continue;`). Ondas de choque, anéis de poder e estilhaços geométricos eram silenciados.
  - Projéteis com capacidade de perfuração (`pierce > 1`) morriam no primeiro impacto porque o código verificava `|| ev?.result === 'impact'`.
- **Depois:**
  - Coordenadas tridimensionais canônicas (`position: {x, y, z}`) e normais de contato são congeladas antes de qualquer exclusão de entidade.
  - Ondas de choque e estilhaçamento de rochas e barreiras disparam com 100% de confiabilidade.
  - Projéteis perfurantes atravessam o número exato de alvos configurado no slider (`pierce`), respeitando o limite físico.

### 2.4 Robustez do Editor e Pilotos VFX (EST-04, EST-05, VFX-05)
- **Antes:**
  - Cancelar um golpe carregado sem parâmetro `step` lançava `TypeError` no console.
  - Sofrer derrota durante o teletransporte do *Bullet Punch* deixava o personagem invisível para sempre na cena.
  - O despachante de VFX classificava quebras de barreira e choques de projéteis cegamente como socos comuns (`'hit'`).
  - O método `reset()` não limpava partículas nem anéis acumulados.
- **Depois:**
  - `cancelCharge` possui fallback numérico seguro.
  - O lutador derrotado limpa `absent = false` e todas as estruturas de carga, garantindo visualização da pose de derrota.
  - `classifyVisualType` mapeia todos os 18 resultados canônicos da simulação.
  - `WorldView.reset()` e `view.reset()` limpam geometrias, materiais e restauram a neblina da cena.

---

## 3. Onde e Como Testar no Jogo Real

O usuário pode verificar diretamente todas as melhorias sem necessidade de qualquer comando de terminal:

1. **Laboratório de Combate Principal:**
   - Dê dois cliques em `JOGAR_ARENAMON.html` na raiz da pasta oficial (ou abra `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`).
2. **Portal Geral do Projeto:**
   - Abra `ABRIR_ARENAMON.html` na raiz para acessar os demais módulos e laboratórios.
3. **Cenários Recomendados para Teste Manual:**
   - **Teste de Guard Break:** Equipe o Move de *Guard Break*, faça o adversário defender e ataque a guarda. Observe que a guarda estoura e o defensor entra em stagger sem que seu lutador entre em recoil.
   - **Teste de Fim de Recuperação:** Pule ou seja lançado por um golpe e observe a aterrissagem: o personagem transiciona imediatamente para movimento ou neutral sem piscar ou travar em hitstun.
   - **Teste de Perfuração e Destruição:** Atire com projéteis perfurantes contra barreiras e múltiplos alvos; observe os anéis de onda de choque e estilhaços geométricos surgindo exatamente nos pontos de impacto.
