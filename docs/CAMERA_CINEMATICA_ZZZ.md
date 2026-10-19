# Sistema de Câmera Cinemática de Combate — Estilo Anime / Zenless Zone Zero (ZZZ)

Documentação oficial da implementação da cinematografia dinâmica de combate no jogo principal Arenamon (**Combat Lab**).

---

## 1. Visão Geral e Filosofia de Design

Inspirado na direção cinematográfica de animes de ação modernos e no dinamismo visual de *Zenless Zone Zero* (ZZZ), o sistema introduz uma camada opcional de apresentação expressiva com inclinações dinâmicas de horizonte (*dutch angle*), enquadramentos rasantes de alta velocidade (*worm's-eye view*), cortes laterais de perfil em parries e clashes, respiração de campo de visão (*FOV breathing*), pulsos elásticos de liberação (*FOV punch*), contraplongée de impactos aéreos, clímax de K.O., *impact frames* em silhueta de alto contraste, *speedlines* radiais de choque, *letterbox* cinemático e transições amortecidas por física de molas (*spring damping*).

> [!IMPORTANT]
> **Princípio Arquitetural Inviolável:** O sistema de câmera cinemática atua **exclusivamente como camada de apresentação visual** sobre o `CameraRig`. O ângulo `yaw` funcional da câmera orbital é preservado com 100% de integridade, garantindo que o referencial direcional dos comandos do jogador (`Input.js`) e a simulação de combate permaneçam absolutamente inalterados e determinísticos.

---

## 2. Catálogo Oficial dos 12 Efeitos Cinemáticos (C01 a C12)

| Código | Efeito Cinemático | Gatilho / Condição | Comportamento Visual |
|---|---|---|---|
| **C01** | **Dutch Angle na Esquiva** | Esquiva do jogador (`action.kind === 'dodge'`) | Inclina o horizonte em até ±10°–14° conforme a componente lateral do movimento. |
| **C02** | **Câmera Baixa de Velocidade** | Sprint contínuo ou arrancada de Tackle | Abaixa a câmera suavemente (worm's-eye view) e aproxima o zoom para transmitir porte e velocidade. |
| **C03** | **Snap Lateral de Impacto** | Defesa Perfeita (*Parry*) ou *Clash* de tackles | Corta momentaneamente para uma perspectiva de perfil a ~80° em relação à normal de choque. |
| **C04** | **Respiração de FOV na Carga** | Golpe carregado sendo retido (`fighter.charge`) | Comprime o FOV progressivamente conforme o nível de carga, criando efeito de foco tenso. |
| **C05** | **FOV Punch no Disparo** | Liberação do golpe carregado (`chargeRelease`) | Expansão instantânea do FOV seguida de retorno elástico amortecido por mola. |
| **C06** | **Câmera de Meteor Slam** | Queda aérea pesada ou slam vertical | Contraplongée de baixo para cima acompanhando o impacto maciço no solo. |
| **C07** | **Câmera de K.O. e Clímax** | Fim da partida por K.O. (`game.phase === 'result'`) | Enquadramento dramático em ângulo baixo com inclinação e arco orbital cinematográfico. |
| **C08** | **Impact Frames Estilizados** | Parries, clashes e acertos críticos pesados | Flash de 1–2 quadros alternando silhueta de alto contraste branco e negativo com inversão. |
| **C09** | **Speedlines Radiais** | Impactos massivos e liberação de carga | Raios radiais estilizados em canvas 2D convergindo para o ponto exato de colisão na tela. |
| **C10** | **Barras Cinematográficas (Letterbox)** | Parries, clashes e finalização | Faixas pretas dinâmicas no topo e base da tela nos modos Sutil (6%) ou Cinema 2.39:1. |
| **C11** | **Câmera Lenta Visual (Bullet Time)** | Defesa perfeita e momentos de clímax | Desaceleração suave transitória de apresentação sem adulterar o relógio físico da simulação. |
| **C12** | **Inércia e Amortecimento de Mola** | Retorno contínuo após qualquer efeito | Sistema de física elástica de segunda ordem que elimina cortes secos e garante suavidade orgânica. |

---

## 3. Painel de Controle e Controles de Interface

O usuário possui controle total sobre a câmera cinemática diretamente na interface do jogo:

1. **Acesso Rápido:**
   - Botão **🎬 Câmera Cinemática** na barra superior de controles do Combat Lab.
   - Opção **🎬 Câmera Cinemática** no menu popover de ferramentas (`#tools-pop`).
2. **Toggle Mestre & Intensidade:**
   - Interruptor mestre para ligar/desligar todo o sistema com um clique.
   - Slider de **Intensidade Cinematográfica Global** (0% a 200%).
   - Botão de **Comparação Rápida (Normal ⇄ Cine)** para teste comparativo A/B em tempo real.
3. **Controles Individuais (C01 a C12):**
   - Checkbox individual para cada efeito.
   - Sliders de ajuste fino calibrados com unidades explícitas (graus `°`, metros `m`, segundos `s`, porcentagem `%`).
   - Botão **▶ Prévia** para cada efeito, permitindo disparar e inspecionar a resposta visual imediatamente sem aguardar eventos do combate.
4. **Segurança e Restauração:**
   - Botão **Padrões** para restaurar a configuração calibrada recomendada.
   - Botões **Ativar todos** e **Desativar todos**.
   - Persistência automática das opções no `localStorage` e no `Workspace` da partida.

---

## 4. Invariantes de Segurança e Acessibilidade

- **Yaw Funcional Intocado:** A rotação direcional usada pelo controlador do jogador é calculada estritamente com base no `rig.yaw` orbital original, sem sofrer influência de rolls ou snaps visuais.
- **Piso Seguro (Anti-Colapso):** Trava rígida garantindo que nem a posição da câmera nem o alvo visual fiquem abaixo de `0.2m` do solo, eliminando qualquer risco da câmera afundar na arena.
- **Acessibilidade:**
  - `noFlash / flashReduce`: Desativa impact frames e flashes bruscos de tela.
  - `reduceMotion`: Reduz inclinações bruscas e atenua o roll para evitar desconforto visual.
- **Comportamento Padrão Não-Intrusivo:** O sistema inicia com `enabled: false` por padrão em instalações limpas, garantindo que testes automatizados anteriores rodem sem alteração de baseline visual.

---

## 5. Como Abrir e Testar

1. **Ponto de Entrada:** Abra [`JOGAR_ARENAMON.html`](file:///c:/Users/zerke/OneDrive/Área%20de%20Trabalho/Arenamon/JOGAR_ARENAMON.html) ou acesse via [`ABRIR_ARENAMON.html`](file:///c:/Users/zerke/OneDrive/Área%20de%20Trabalho/Arenamon/ABRIR_ARENAMON.html).
2. Clique no ícone **🎬** na barra superior para abrir o modal de configurações da câmera.
3. Marque **Ativar Câmera Cinemática** ou clique nos botões **▶ Prévia** dos efeitos.
4. Jogue normalmente usando **X** (Tackle), **C** (Esquiva), **D** (Defesa) ou segure **A/S** (Ataque Carregado) para vivenciar as respostas de câmera em tempo real.

---

## 6. Verificação Automatizada

Suíte de testes dedicada:

- **Teste Unitário (31 verificações):**
  ```bash
  node prototypes/combat-lab/test/cinematic-camera.test.mjs
  ```
- **Teste no Navegador (20 verificações em Playwright Chromium/Edge):**
  ```bash
  node prototypes/combat-lab/test/cinematic-camera.browser.mjs
  ```

---

## 7. Histórico de Correções e Auditorias Independentes

### Rodada 3 de Correções:
1. **P1 — Reset completo de Bullet Time:** `clearAll()` e `reset()` agora limpam explicitamente `this.slowMoState = null;`, garantindo restauração instantânea de `getVisualTimeScale() === 1.0` ao desativar ou reiniciar a partida.
2. **P1 — Projeção de Speedlines em Matriz Atualizada:** A atualização de `camera.aspect`, `camera.updateProjectionMatrix()` e `camera.updateMatrixWorld(true)` foi reordenada para ocorrer *antes* de `cinematic.renderOverlays(this.camera)`, garantindo precisão subpixel na projeção 3D-para-tela.
3. **P1 — Silhuetas WebGL Protegidas por `try / finally`:** O swap de materiais dos lutadores (`silhouetteWhiteMat` / `silhouetteBlackMat`) e a ocultação do piso/cenário foram envolvidos em bloco `try ... finally` no `view.js`, blindando contra qualquer estado residual mesmo se ocorrer exceção.
4. **P2 — Pillarbox 2.39:1 em Monitores Ultrawide:** O Letterbox em modo cinema calcula proporção real em qualquer tela e adiciona barras verticais laterais (`.cine-bar-left`, `.cine-bar-right`) em monitores ultrawide (> 2.39:1), preservando a proporção de cinema 2.39:1 sem distorção.
5. **Sincronização de Branch:** Todos os 47 commits mais recentes da `main` (incluindo documentação e passivas) foram incorporados via merge limpo.
