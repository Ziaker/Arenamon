# Otimização de Desempenho e Pré-aquecimento (Warm-up / Loading) do Combat Lab

## Contexto e Diagnóstico

Nas sessões de jogo do Arenamon Combat Lab, foi detectada uma perda severa de quadros por segundo (stuttering / engasgos de 300 ms a 1,2 s) logo após o carregamento dos modelos 3D dos lutadores e início do round.

### Causas Raiz Identificadas
1. **Compilação Tardia de Shaders WebGL (Shader Hitching):**  
   O Three.js é *lazy* por padrão; a compilação dos programas GLSL de `SkinnedMesh`, iluminação PBR e mapas de normais/rugosidade só acontecia no exato instante em que o primeiro frame do combate tentava ser renderizado.
2. **Cálculo Concorrente de Curvas de Solo na CPU (`warmGround`):**  
   O método `warmGround` recalculava 17 caixas delimitadoras (`computeBoundingBox`) em malhas de milhares de vértices para dezenas de animações a cada 60 ms concorrentemente aos primeiros golpes da luta.
3. **Upload de Texturas e Efeitos na VRAM:**  
   Inexistência de estágio de pré-aquecimento assíncrono para subir texturas e shaders de partículas para a memória da GPU antes de liberar a entrada do jogador.

---

## Soluções Implementadas

### 1. Pré-aquecimento com `compileAsync` no WebGL (`view.js`)
- Criado o método `view.warmUp(characters, {onProgress})`.
- Utiliza a extensão `KHR_parallel_shader_compile` nativa do Three.js (`renderer.compileAsync(scene, camera)`) com fallback automático para `renderer.compile`.
- Pré-renderiza 1 quadro de preparação na resolução ativa para carregar buffers e texturas na VRAM.

### 2. Priorização de Solo Essencial e Proteção do Combate (`characters.js`)
- Implementado `warmEssentialGround()`: pré-calcula imediatamente as curvas de solo das 25 ações prioritárias de início de round (`idle`, `walk`, `run`, `sprint`, `tackle`, `guard`, `dodge`, `hit`, `knockback`, etc.) durante a fase de loading.
- Adicionada a flag `Character.isLiveCombat`: quando a luta está em andamento, o agendamento em segundo plano de clipes secundários é desacelerado para não competir com a taxa de 60 FPS.

### 3. Tela de Carregamento & Notificação Visual (`template.html` e `styles.css`)
- Componente visual `#arena-loader` com spinner animado, barra de progresso em tempo real e backdrop com desfoque (*backdrop-filter: blur*).
- Transição suave de opacidade (*fade-out* de 280 ms) que revela a arena pronta, sem travamentos de câmera.

### 4. Controle Manual no Painel de Desempenho (`perf-panel.js`)
- Adicionada a linha de telemetria `Shaders WebGL / Warm-up: ✓ Pré-compilados (GPU pronta)` no medidor ao vivo.
- Adicionado o botão `⚡ Pré-compilar Shaders` no painel "Visualizar › Desempenho", permitindo forçar o reaquecimento a qualquer momento.

---

## Verificação e Testes
- Suíte completa de testes de desempenho (`perf.test.mjs` e `perf.browser.mjs`): 26 de 26 verificações aprovadas.
- Testes globais do laboratório (`verify.mjs`): 19 de 19 verificações aprovadas.
- Verificação de tipos TypeScript (`npm run typecheck`): 0 erros.
- Verificação de operação offline (`npm run check:offline`): 11 de 11 arquivos HTML aprovados sem dependências externas.
