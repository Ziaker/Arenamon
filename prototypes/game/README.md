# Arenamon — primeiro combate jogável

Abra `dist/arenamon-jogavel.html` por duplo clique. O arquivo inclui Three.js e sua licença MIT; funciona em `file://` sem servidor, CDN, modelos ou texturas. Requer navegador com WebGL. O código-fonte e os testes são locais; nada foi publicado.

## Execução e controles

No menu, escolha IA inativa, defensiva, ofensiva ou combate e um perfil provisório de atributos. Inicie a partida. WASD move relativamente ao alvo fixado; Espaço inicia uma esquiva, com W/sem direção produzindo tackle frontal. A/D/S + Espaço esquivam para lados/trás. F mantido defende; um novo pressionamento pode abrir defesa perfeita. Tab alterna lock-on. Sem alvo, movimento usa o referencial da câmera e orienta o corpo. Botão direito arrastado gira a câmera; roda ajusta distância. Esc pausa, R reinicia e F3 mostra depuração. Ao perder foco ou ocultar a aba, o jogo pausa e limpa as entradas.

O teste termina em zero HP, com resultado, reinício ou retorno ao menu. Essa condição de encerramento é provisória: o GDD não define vitória final. Os modos da IA podem ser trocados ao voltar ao menu.

## Auditoria inicial

Raiz auditada: `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon`. Base inicial: `5d362c1`, branch `main`, árvore limpa, nenhum remoto configurado. `git fetch origin` foi tentado; não há `origin` para sincronizar. Fonte de design: `docs/GDD_Pokemon_Arena_Fighter_v0_1.docx`, lido diretamente do OOXML. O GDD duplicado na raiz não é a fonte canônica.

O código ativo em `prototypes/placeholders` apenas renderizava dois blocos e câmera orbital. O arquivo `archives/2026-10-13-impeto/placeholders/src/motion.ts` contém deslocamentos ilustrativos de animação, não um controlador jogável. Reutilizou-se o padrão de empacotamento esbuild/Three.js e de teste Edge/Playwright, mantendo o novo gameplay separado em `prototypes/game`. Laboratórios, arquivos de pesquisa, rigs, modelos locais e arquivos do GDD foram preservados.

## Build e validação

Na raiz, use `npm ci` se necessário e `npm run verify`. Esse comando verifica TypeScript, gera ambos os HTMLs, testa o laboratório existente, executa cenários mecânicos determinísticos e joga pelo teclado/mouse no Edge com rede desabilitada. A dependência de Node/Edge existe para desenvolvimento e testes, não para quem recebe o HTML.

Comandos específicos: `node prototypes/game/build.mjs`, `node prototypes/game/test.mjs`, `node prototypes/game/verify.mjs`. Os resultados e capturas ficam em `validation/`, ignorado pelo Git; o HTML em `dist/` também é gerado e ignorado. Os testes do navegador observam `window.__arenamon.snapshot()`, uma interface somente de leitura; não alteram HP, posições nem resultados para simular acertos.

Validação executada em 13/10/2026: `npm run verify` aprovado, com 19 cenários mecânicos, 16 cenários no navegador e regressão do visualizador anterior. Foram exercitados resultados de vitória e derrota usando controles do jogo. Nenhum erro de console ou pedido HTTP(S) foi registrado no HTML offline. Capturas de menu, impacto, bloqueio, resultado e layout estreito foram geradas; menu, impacto, bloqueio e layout estreito foram inspecionados visualmente. A inspeção adicional pelo navegador interativo do Codex não foi possível: sua política bloqueia URLs `file://`; o teste offline no Edge foi executado pelo pipeline autorizado.

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
| input.ts | Teclas mantidas/pressionadas/liberadas e referenciais |
| view.ts | Arena, blocos substituíveis e câmera independente |
| ui.ts / template.html | Menu, HUD, resultado, controles e depuração |
| main.ts | Composição dos sistemas, pausa por foco e renderização |

A posição e a velocidade são autoritativas na simulação. A caixa visual mede 1 × 1,3 × 1 m e não gira; apenas o indicador frontal gira, preservando correspondência com o colisor AABB de 1 × 1 m no chão. Todos os corpos ficam sobre o mesmo plano vertical, portanto os contatos horizontais são suficientes neste cenário. Não há saltos nem lançamento vertical.

## Regras atendidas e parâmetros provisórios

Implementados: movimento normalizado; lock-on híbrido; defesa com rotação acelerada até 540°/s em 200 ms; defesa parcial frontal de 180°, mitigação 50% e velocidade 60%; perfeita por 200 ms e recarga de falha de 2 s; guard stun de 200 ms sem extensão por acertos repetidos e cancelável por esquiva ou perfeita; stamina para três esquivas, espera de 1 s, regeneração cúbica de 5 s e exaustão até reserva completa (movimento 70%, ou 42% defendendo).

Esquiva: 400 ms, invulnerabilidade inicial de 200 ms, distância 2,5 × velocidade × 400 ms, distribuição 70/30. A curva técnica escolhida é `p(u) = 1,6u − 0,2u² − 0,4u³`, com velocidade contínua, decrescente e zero ao fim. Esterçamento até ±30° do rumo inicial, limitado a 180°/s. Encadeamento após 200 ms e transições Smoothstep de 100 ms. Defesa após 200 ms cancela a esquiva e dissipa sua velocidade em 100 ms. Paredes restringem distância sem compensação artificial.

Tackle: esquiva frontal ofensiva por todos os 400 ms, contato real entre caixas, um dano por alvo por ação, lateral/traseira sem dano. Bloqueio encerra a investida, recuo físico de 15% da distância nominal em 300 ms, sem dano ao atacante. Defesa cancela o recuo imediatamente; nova esquiva válida interpola velocidade em 100 ms. Dano interrompe a ação ofensiva do alvo, sem inventar hit stun para tackle.

Empurrão: `F = 0,6 × Ataque/Aref + 0,4 × velocidadeDeAproximação/Vref`; resistência `R = 0,5 × Defesa/(Defesa + mediana)`; distância `C × F × (1−R)`. A velocidade usada é a projeção relativa na normal antes da resolução. Contatos podem ser combinados por peso de aproximação, com fallback por centros e depois velocidade relativa. Não existe impulso aleatório quando não há direção confiável. Empurrão é deslocamento físico separado de guard stun e de dano.

Calibração **provisória**, centralizada em `TEST`: arena 20 m, HP comum 100, dano de tackle igual a Ataque, referências Ataque 20/velocidade 10, mediana Defesa 50, C=2 m, empurrão de 300 ms com Smoothstep, tolerância frontal de 22,5°, perfis e parâmetros da IA/câmera. A mediana 50 corresponde aos três perfis de teste (35/50/80), não a um elenco final. Não há transferência adicional calibrada da velocidade do atacante; o contato sólido remove sua componente de aproximação e a esquiva ainda ativa retoma sua curva no próximo passo. Esse comportamento continua sujeito à decisão de design.

## Estados e transições

| Estado | Entrada / duração | Ações e saída |
| --- | --- | --- |
| Livre / movimentação | Sem ação temporizada | Mover, orientar, defender ou esquivar |
| Defesa | F mantido e acesso permitido | Movimento a 60%; soltar sai; esquiva cancela e exige soltar F antes de defender novamente |
| Esquiva / tackle | Espaço com stamina e sem exaustão / 400 ms | Sem movimento comum; esterçamento limitado; encadear ou defender após 200 ms; dano vulnerável interrompe |
| Guard stun | Bloqueio parcial / 200 ms | Bloqueia movimento comum; esquiva ou perfeita cancelam; soltar F remove proteção sem remover stun |
| Recuo | Tackle bloqueado / 300 ms | Bloqueia movimento comum; defesa ou esquiva válida cancelam |
| Empurrão | Impacto não perfeito / calibração de 300 ms | Deslocamento físico independente, sem hit stun inventado; movimento comum e defesa permitidos, esquiva remove impulso restante |
| Derrotado | HP zero | Sem ação; partida passa ao resultado |

Recuperação é o término das ações temporizadas e retorno ao controle, sem adicionar duração de recuperação não aprovada. Dano e empurrão não são apresentados como hit stun. A lógica não depende de partes de modelos ou animação.

## Limitações e pendências

- Quatro movimentos equipados, seus cooldowns, buffer de ataques e hit stun/anti-stunlock aguardam definição dos movimentos; nenhum ataque genérico foi inventado.
- Fórmula geral de dano, valores finais de atributos/HP, calibração de força e perda de impulso do atacante, duração/curva final de empurrão e vitória definitiva continuam pendentes no GDD.
- Arena plana, caixas alinhadas aos eixos, sem contatos verticais/articulados, obstáculos complexos, rede ou multiplayer. As entidades e os pares de colisão são iteráveis, mas o fluxo jogável validado é 1 contra 1.
- Câmera básica com órbita manual e enquadramento dos dois combatentes; não há sistema de oclusão para cenários complexos. Interface estreita é verificada, mas jogar exige teclado/mouse.
- Não foi realizado teste humano de conforto prolongado. Testes de partida usam entradas reais no navegador e inspeção visual das capturas; ajustes de sensação de controle dependem da avaliação do usuário.

## Entrega e sincronização

Arquivos novos: esta pasta (`src/`, scripts de build/testes, configuração TypeScript e documentação). Modificados fora dela: `package.json`, `README.md` e `prototypes/index.html`. Nenhum recurso proprietário é usado/importado. O GDD permanece inalterado.

Sem remoto configurado, a entrega pode ter commit local, mas não há push, URL GitHub ou hash remoto para confirmar. A branch usada é `codex/jogavel-blocos`. O hash exato do commit deve ser consultado com `git rev-parse HEAD`; não se declara sincronização apenas por salvar o HTML.
