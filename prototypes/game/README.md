# Arenamon — primeiro combate jogável

Abra `dist/arenamon-jogavel.html` por duplo clique. O arquivo inclui Three.js e sua licença MIT; funciona em `file://` sem servidor, CDN, modelos ou texturas. Requer navegador com WebGL. O código-fonte e os testes são locais; nada foi publicado.

## Execução e controles

No menu, escolha IA e perfil de atributos. A partida começa **sem lock-on**. Movimentação exclusivamente pelas setas.

- **X** é a investida (tackle) e **C** é a esquiva. As duas seguem as setas nas 8 direções. Sem seta, vão para o alvo fixado; sem alvo, usam a orientação de combate atual do bloco.
- **X durante C** cancela a esquiva em investida (C → X).
- **F** é defesa provisória. **Tab** fixa ou solta o alvo.
- A/S/D/Z permanecem reservadas. W e Espaço também não movem nem atacam.
- Arrastar com o botão direito gira a câmera, e a roda ajusta a distância.
- **Esc** pausa, **R** reinicia e **F3** mostra depuração. Perder o foco ou ocultar a aba pausa e limpa as entradas.

### Regras da Etapa A (aprovada em 14/10/2026)

Referência: `prototypes/combat-lab`, branch `feat/combat-core-etapa-a`. Os parâmetros ficam em `ACTIONS` (`src/config.ts`), com os mesmos valores que o jogo já usava.

- **X e C independentes:** cada um tem duração, custo, invulnerabilidade, distância, curva, esterçamento, transição, encadeamento e recuperação próprios.
- **X:** acerta pela trajetória real, não pela orientação do corpo. Cada ação acerta cada alvo uma vez.
- **C:** nunca causa dano. Salta por cima do adversário quando a trajetória o atravessa; acima de 1,3 m não há contato.
- **C → X:**
  - permitido desde o primeiro passo da esquiva;
  - C fica pago e X cobra o próprio custo; sem stamina, a esquiva continua;
  - X vai na direção pedida, ou na de C quando não há seta;
  - a velocidade é contínua, com transição de 0,06 s;
  - a invulnerabilidade de X é só o que restava da de C;
  - no ar, X desce da altura atual em 0,18 s.
- **Recuo:** X não sai durante o recuo (GDD 8.2); C e defesa saem.
- **Guard stun:** X pedido no guard stun fica guardado e sai quando o stun termina (GDD 5). Segurar F não descarta o pedido; um novo toque em F descarta.
- **Defesa:** a defesa parcial não desloca o defensor; só o atacante recua.
- **Defesa perfeita:** anula o dano e abre uma janela de contra-ataque de 0,7 s.
- **Esquiva perfeita:** C invulnerável contra um X devolve 0,2 de stamina e abre uma janela de 0,55 s. O X seguinte é ×1,18.
- **Clash (X contra X):** cada um recebe 30% do ataque do outro. Os dois são empurrados para trás pelo empurrão do GDD (fórmula inalterada).
- **Buffer de entrada:** X ou C pedidos até 100 ms antes de serem permitidos saem no primeiro passo permitido.
- **IA:** a lógica é a mesma; ataca com X e esquiva lateralmente com C.

Na aplicação ao jogo também mudaram duas coisas:
- a esquiva deixou de ser ofensiva;
- a defesa parcial deixou de empurrar o defensor.

As diferenças que continuam em relação ao laboratório estão em `docs/REVISAO_GDD_COMBATE.md`, seção 5.

Sem lock-on, as setas usam a referência horizontal da câmera, e o corpo gira progressivamente para a intenção de movimento. Com lock-on, ↑/↓ avançam/recuam em relação ao alvo, e ←/→ deslocam lateralmente na tela mantendo a orientação para o adversário. Diagonais combinam o avanço/recuo com a lateralidade ortogonal de combate com velocidade perfeitamente normalizada e transição contínua. Para X e C a direção é explícita e a mesma das setas: ↑ + X investe para frente, ↓ + C esquiva para trás, ←/→ + C esquiva lateralmente, e assim por diante nas diagonais.

A calibração `LOCOMOTION` define aceleração 60 m/s², frenagem 100 m/s², reversão 140 m/s² e giro comum até 720°/s. No perfil de 4 m/s, partida em aproximadamente 67 ms e parada em aproximadamente 42 ms, com menos de 9 cm residuais nos testes. Defesa conserva seus limites de giro aprovados. A velocidade de locomoção é independente da curva de esquiva e dos impulsos.

A câmera de combate em terceira pessoa (`CAMERA`) é inspirada no padrão arena fighter (Naruto Ultimate Ninja Storm): mais baixa e próxima (altura 2,2 m, distância inicial 6,2 m, olhar a 1,1 m de altura e 1,8 m à frente com deslocamento lateral suave de ombro de 0,45 m). A âncora acompanha o jogador sem se fixar no ponto médio. Com alvo fixado, reenquadra suavemente a até 45°/s, com zona morta ampla durante locomoção (60°) para evitar giros bruscos na tela durante strafes laterais. Sem alvo, girar o corpo nunca gira a câmera. Câmera e gameplay atualizam a 120 Hz de forma desacoplada e determinística.

**A movimentação reconstruída aguarda aprovação jogável do usuário.** Testes aprovados não significam aprovação da sensação de controle.

O teste termina em zero HP, com resultado, reinício ou retorno ao menu. Essa condição de encerramento é provisória: o GDD não define vitória final. Os modos da IA podem ser trocados ao voltar ao menu.

## Auditoria inicial

Raiz auditada: `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon`. Base inicial: `5d362c1`, branch `main`, árvore limpa, nenhum remoto configurado. `git fetch origin` foi tentado; não há `origin` para sincronizar. Fonte de design: `docs/GDD_Pokemon_Arena_Fighter_v0_1.docx`, lido diretamente do OOXML. O GDD duplicado na raiz não é a fonte canônica.

O código ativo em `prototypes/placeholders` apenas renderizava dois blocos e câmera orbital. O arquivo `archives/2026-10-13-impeto/placeholders/src/motion.ts` contém deslocamentos ilustrativos de animação, não um controlador jogável. Reutilizou-se o padrão de empacotamento esbuild/Three.js e de teste Edge/Playwright, mantendo o novo gameplay separado em `prototypes/game`. Laboratórios, arquivos de pesquisa, rigs, modelos locais e arquivos do GDD foram preservados.

## Build e validação

Na raiz, use `npm ci` se necessário e `npm run verify`. Esse comando verifica TypeScript, gera ambos os HTMLs, testa o laboratório existente, executa cenários mecânicos determinísticos e joga pelo teclado/mouse no Edge com rede desabilitada. A dependência de Node/Edge existe para desenvolvimento e testes, não para quem recebe o HTML.

Comandos específicos: `node prototypes/game/build.mjs`, `node prototypes/game/test.mjs`, `node prototypes/game/etapa-a.test.mjs` (após test.mjs; regras da Etapa A, esperado × obtido em `validation/etapa-a.json`), `node prototypes/game/locomotion.test.mjs` (após test.mjs), `node prototypes/game/verify.mjs`. Os resultados e capturas ficam em `validation/`, ignorado pelo Git; o HTML em `dist/` também é gerado e ignorado. Os testes do navegador observam `window.__arenamon.snapshot()`, uma interface somente de leitura; não alteram HP, posições nem resultados para simular acertos.

Validação executada em 13/10/2026: `npm run verify` aprovado, com 19 cenários mecânicos, 10 cenários de locomoção/câmera, 18 cenários no navegador e regressão do visualizador anterior. Foram exercitados resultados de vitória e derrota usando controles do jogo. Nenhum erro de console ou pedido HTTP(S) foi registrado no HTML offline. Capturas de menu, impacto, bloqueio, resultado e layout estreito foram geradas; menu, impacto, bloqueio e layout estreito foram inspecionados visualmente. A inspeção adicional pelo navegador interativo do Codex não foi possível: sua política bloqueia URLs `file://`; o teste offline no Edge foi executado pelo pipeline autorizado.

## Organização

| Arquivo em src/ | Responsabilidade |
| --- | --- |
| config.ts | Regras aprovadas, calibração provisória e perfis |
| entity.ts | Atributos, entidades, ações e comandos sem Three.js |
| math.ts | Vetores, ângulos, Smoothstep e curva nominal de esquiva |
| controller.ts | Entrada mecânica, orientação, stamina e transições |
| physics.ts | Caixas sólidas, limites, subpassos e projeção de contato |
| combat.ts | Dano, defesa, eventos e empurrão por normal de contato |
| ai.ts | Comportamento determinístico em quatro modos |
| game.ts | Ciclo de partida e acumulador fixo de 120 Hz |
| input.ts | Leitura das teclas mantidas/pressionadas/liberadas |
| commands.ts | Intenção direcional relativa à câmera/alvo, independente da malha |
| locomotion.ts | Aceleração, frenagem e reversão configuráveis |
| camera.ts | Acompanhamento fixo no tempo, independente da orientação visual |
| view.ts | Arena, blocos substituíveis e câmera independente |
| ui.ts / template.html | Menu, HUD, resultado, controles e depuração |
| main.ts | Composição dos sistemas, pausa por foco e renderização |

A posição e a velocidade são autoritativas na simulação. A caixa visual mede 1 × 1,3 × 1 m e não gira; apenas o indicador frontal gira, preservando correspondência com o colisor AABB de 1 × 1 m no chão. Todos os corpos ficam sobre o mesmo plano vertical, portanto os contatos horizontais são suficientes neste cenário. Não há saltos nem lançamento vertical.

## Regras atendidas e parâmetros provisórios

Implementados: movimento normalizado; lock-on híbrido; defesa com rotação acelerada até 540°/s em 200 ms; defesa parcial frontal de 180°, mitigação 50% e velocidade 60%; perfeita por 200 ms e recarga de falha de 2 s; guard stun de 200 ms sem extensão por acertos repetidos e cancelável por esquiva ou perfeita; stamina para três esquivas, espera de 1 s, regeneração cúbica de 5 s e exaustão até reserva completa (movimento 70%, ou 42% defendendo).

Esquiva: 400 ms, invulnerabilidade inicial de 200 ms, distância 2,5 × velocidade × 400 ms, distribuição 70/30. A curva técnica escolhida é `p(u) = 1,6u − 0,2u² − 0,4u³`, com velocidade contínua, decrescente e zero ao fim. Esterçamento até ±30° do rumo inicial, limitado a 180°/s. Encadeamento após 200 ms e transições Smoothstep de 100 ms. Defesa após 200 ms cancela a esquiva e dissipa sua velocidade em 100 ms. Paredes restringem distância sem compensação artificial.

Tackle: esquiva frontal ofensiva por todos os 400 ms, contato real entre caixas, um dano por alvo por ação, lateral/traseira sem dano. Bloqueio encerra a investida, recuo físico de 15% da distância nominal em 300 ms, sem dano ao atacante. Defesa cancela o recuo imediatamente; nova esquiva válida interpola velocidade em 100 ms. Dano interrompe a ação ofensiva do alvo, sem inventar hit stun para tackle.

Empurrão: `F = 0,6 × Ataque/Aref + 0,4 × velocidadeDeAproximação/Vref`; resistência `R = 0,5 × Defesa/(Defesa + mediana)`; distância `C × F × (1−R)`. A velocidade usada é a projeção relativa na normal antes da resolução. Contatos podem ser combinados por peso de aproximação, com fallback por centros e depois velocidade relativa. Não existe impulso aleatório quando não há direção confiável. Empurrão é deslocamento físico separado de guard stun e de dano.

Calibração **provisória**, centralizada em `TEST`: arena 20 m, HP comum 100, dano de tackle igual a Ataque, referências Ataque 20/velocidade 10, mediana Defesa 50, C=2 m, empurrão de 300 ms com Smoothstep, tolerância frontal de 22,5°, perfis e parâmetros da IA; locomoção e câmera em LOCOMOTION/CAMERA. A mediana 50 corresponde aos três perfis de teste (35/50/80), não a um elenco final. Não há transferência adicional calibrada da velocidade do atacante; o contato sólido remove sua componente de aproximação e a esquiva ainda ativa retoma sua curva no próximo passo. Esse comportamento continua sujeito à decisão de design.

## Estados e transições

| Estado | Entrada / duração | Ações e saída |
| --- | --- | --- |
| Livre / movimentação | Sem ação temporizada | Mover, orientar, defender ou esquivar |
| Defesa | F mantido e acesso permitido | Movimento a 60%; soltar sai; esquiva cancela e exige soltar F antes de defender novamente |
| Esquiva / tackle | C com stamina e sem exaustão / 400 ms | Sem movimento comum; esterçamento limitado; encadear ou defender após 200 ms; dano vulnerável interrompe |
| Guard stun | Bloqueio parcial / 200 ms | Bloqueia movimento comum; esquiva ou perfeita cancelam; soltar F remove proteção sem remover stun |
| Recuo | Tackle bloqueado / 300 ms | Bloqueia movimento comum; defesa ou esquiva válida cancelam |
| Empurrão | Impacto não perfeito / calibração de 300 ms | Deslocamento físico independente, sem hit stun inventado; movimento comum e defesa permitidos, esquiva remove impulso restante |
| Derrotado | HP zero | Sem ação; partida passa ao resultado |

Recuperação é o término das ações temporizadas e retorno ao controle, sem adicionar duração de recuperação não aprovada. Dano e empurrão não são apresentados como hit stun. A lógica não depende de partes de modelos ou animação.

## Limitações e pendências

- Quatro movimentos equipados, seus cooldowns, buffer de ataques e hit stun/anti-stunlock aguardam definição dos movimentos; nenhum ataque genérico foi inventado.
- Fórmula geral de dano, valores finais de atributos/HP, calibração de força e perda de impulso do atacante, duração/curva final de empurrão e vitória definitiva continuam pendentes no GDD.
- Arena plana, caixas alinhadas aos eixos, sem contatos verticais/articulados, obstáculos complexos, rede ou multiplayer. As entidades e os pares de colisão são iteráveis, mas o fluxo jogável validado é 1 contra 1.
- Câmera de acompanhamento com órbita manual; ao cruzar rapidamente para trás, o adversário pode sair temporariamente do quadro durante o reenquadramento limitado em velocidade. Não há sistema de oclusão para cenários complexos. Interface estreita é verificada, mas jogar exige teclado/mouse.
- Não foi realizado teste humano de conforto prolongado. Testes de partida usam entradas reais no navegador e inspeção visual das capturas; ajustes de sensação de controle dependem da avaliação do usuário.

## Entrega e sincronização

Arquivos novos: esta pasta (`src/`, scripts de build/testes, configuração TypeScript e documentação). Modificados fora dela: `package.json`, `README.md` e `prototypes/index.html`. Nenhum recurso proprietário é usado/importado. O GDD permanece inalterado.

Atualização 13/10/2026: remoto privado `https://github.com/Ziaker/Arenamon` configurado como `origin`; `main` e `codex/jogavel-blocos` enviados. Cobertura do roadmap em `docs/ROADMAP_COBERTURA.md`. A branch usada é `codex/jogavel-blocos`. O hash exato do commit deve ser consultado com `git rev-parse HEAD`; não se declara sincronização apenas por salvar o HTML.
