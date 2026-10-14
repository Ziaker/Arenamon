# Arenamon · Laboratório de combate v7

Gere com `npm run build` e abra `dist/arenamon-combate-laboratorio.html` por duplo clique (offline, sem modelos embutidos).

## Origem

O laboratório v6 (`arenamon-combate-laboratorio-v6.html`) era um único HTML com o jogo compilado editado à mão e um script de ajustes colado no fim. A física dele (lançamento aéreo, clash, salto da esquiva, rebote na parede, contra-ataque, hitstop, deslizamento ao aterrissar e IA estendida) **não existia em nenhuma branch**: só naquele arquivo. Esta versão reconstrói tudo como fontes em `src/`.

O porto é verificado por `test/parity.mjs`. O teste executa o v6 original e esta simulação na mesma página, com os mesmos comandos, e compara o estado completo a cada passo. São 16 execuções e 76.800 passos idênticos, cobrindo impacto, clash, defesa parcial e perfeita, esquiva perfeita e invulnerabilidade. O teste usa o HTML v6 local do usuário (`ARENAMON_LAB_V6`, padrão `~/Downloads/...`) e é ignorado se o arquivo não existir.

**Divergências em relação ao jogo oficial** (`prototypes/game/src/config.ts`):
- O laboratório usa os valores do v6, não os do jogo: arena 32 × 32 m (jogo 20 × 20), velocidade base 4,8 (jogo 4), perfis ágil e resistente, e câmera mais rápida, mais próxima do alvo e com distância máxima maior.
- O ajustador marca cada parâmetro como **jogo** (igual), **≠ jogo** (difere) ou **lab** (só existe no laboratório). O relatório em Exportar lista as diferenças.
- O laboratório nunca altera o jogo.

| Pasta | Conteúdo |
| --- | --- |
| `src/sim/` | Simulação pura (testável em Node): configuração, IA, controle, combate, física, partida, telemetria, replay e cenários. |
| `src/view/` | Three.js: arena, blocos, efeitos, sobreposições técnicas, câmera e personagens do Studio. |
| `src/ui/` | HUD, entrada (teclado/gamepad), ajustador, doca da linha do tempo e referência ao `config.ts`. |

## As dez melhorias

1. **Fontes versionadas:** módulos legíveis, build reproduzível, paridade exata com o v6 e testes.
2. **Personagens do Studio** (aba Personagens): carregue o `.glb` exportado pelo Animation Studio. O mapa de ações do Studio associa cada estado da simulação a uma animação; também dá para associar por nome ou manualmente. O tempo das animações com duração definida (tackle, esquiva, recuo, guard stun, voo e aterrissagem) é calculado a partir do estado da simulação, então acompanha a física inclusive no replay. Opções: travar o deslocamento da raiz, ajustar a altura ao colisor, duração da transição e cópia tingida para o vermelho.
3. **Eventos do Studio × jogo:** compara as janelas marcadas no Studio (hitbox, invulnerabilidade, início da recuperação) com as janelas reais. O clip é reescalado para a duração da ação do jogo. A linha do tempo ganha uma faixa “Studio” sobre cada tackle e esquiva reais. É só visualização.
4. **Replay e passo a passo:** os últimos 12 s ficam gravados por estado completo. Use ◂/▸ (ou `,`/`.`) para andar um passo, clique na linha do tempo para voltar, retome a partir do passado (o futuro gravado é descartado) e use câmera lenta de 0,1× a 1×.
5. **Cenários:** oito cenários roteirizados e repetíveis: tackle contra defesa, defesa perfeita, clash frontal, esquiva perfeita com contra-ataque, esquiva lateral, lançamento, knockback na parede e exaustão. Cada um mostra esperado × obtido, com o esperado calculado a partir dos ajustes atuais. Podem ser executados ao vivo ou todos de uma vez.
6. **Ajustador reformulado:**
   - Os 295 parâmetros ficam em 8 abas, com busca.
   - Filtros: alterados, ≠ jogo, só lab.
   - Desfazer/refazer, restaurar por grupo e botão “= jogo”.
   - Presets salvos neste navegador e comparação entre presets, padrão do laboratório e jogo.
7. **Telemetria e dados de quadros:**
   - Linha do tempo por lutador: estado, invulnerabilidade, janela perfeita, hitstop e stamina.
   - Registro de golpes: em que passo da ação houve contato, quando cada lutador fica livre para agir e para se mover, vantagem e lançamento.
   - Tabela de quadros nominais.
8. **Sobreposições:** colisores coloridos pelo estado, trajetória de X/C, arco de defesa, normais de contato, vetor e arco balístico previsto do lançamento (com rebote) e anel de alcance. Também mostra dados ao vivo (distância, espaço entre colisores, velocidade de aproximação).
9. **Controles:**
   - Modos de dummy: parado, sempre defendendo, sempre esquivando, defende e contra-ataca, aleatório com semente.
   - IA do jogador configurável e presets de dificuldade.
   - Gamepad: A tackle, B esquiva, LB/RB defesa, Y alvo, Start pausa.
   - Histórico de comandos estilo modo treino.
10. **Levar ajustes ao jogo com segurança:** JSON versionado (v7, com `differencesFromGame`). A importação aceita v5, v6 e v7 e é validada e pré-visualizada antes de aplicar. Há relatório de diferenças em relação ao `config.ts`, aviso ao sair com ajustes não exportados e restauração da sessão anterior.

## Aleatoriedade das IAs

Cada IA tem personalidade própria, editável em **Ajustes › IA**:
- **Tempo de reação:** atraso mínimo mais uma variação sorteada.
- **Chance de erro:** não reagir a um tackle ou deixar passar uma oportunidade de ataque.
- **Agressividade:** alcance e intervalo entre ataques.
- **Variação de ritmo:** intervalos, troca de lado e distância preferida sorteados.
- **Hesitação:** pausas curtas.
- **Preferência por esquivar.**

Os padrões são diferentes: o vermelho reage mais devagar e hesita mais; o azul é mais agressivo e prefere esquivar. Cada combate sorteia uma semente nova; marque “Semente fixa” em Controles para repetir uma luta. Dentro de uma luta, tudo continua determinístico (replay e cenários exatos). Com a personalidade neutra (zeros e agressividade 0,5), a IA é exatamente a do v6; o teste de paridade usa essa configuração.

## Animações dos personagens

- **Associação por nome:** sem o mapa do Studio, as animações são associadas por nome com sinônimos em inglês e português (ex.: `guard` → defesa, `front`/`side`/`back` → esquivas, `push` → lançado, `recover` → levantar, `turn` → girar no lugar).
- **Estados novos:** girar no lugar, entrar/sair da defesa, defesa perfeita e recuperação após exaustão.
- **Estados sem animação:** o painel lista os estados que ainda caem em “parado” e mostra a animação tocando agora.
- **Velocidade:** cada ação tem um slider (0,25× a 3×), e há um slider geral.
- **Durações no jogo:** com “As durações das animações definem as regras”, as durações do tackle (X, agora separado da esquiva), da esquiva, do recuo, do guard stun e da aterrissagem passam a ser *duração do clip ÷ velocidade*. A invulnerabilidade vem dos eventos marcados no Studio na esquiva. Aplica com desfazer e aparece como ≠ jogo nos Ajustes.
- **Sem sincronizar:** o clip é esticado para caber na ação, e a velocidade acelera o clip dentro dela.

## Achados da telemetria (para avaliação)

- **Bloqueio:** a vantagem **para agir** é 0. O recuo do atacante e o guard stun do defensor são canceláveis desde o primeiro passo. A vantagem **para se mover** é −12 passos (100 ms) para o atacante: recuo de 36 passos contra 24 de guard stun.
- **Lançamento:** o tempo no ar real é de 101 passos para 100 previstos por 2·v/g (integração discreta). O impacto acrescenta 5 passos de hitstop, contados à parte.

## Testes

- `node prototypes/combat-lab/test/sim.test.mjs`: 18 testes (8 cenários, determinismo, replay por estado, telemetria, tabela de quadros, personalidade das IAs).
- `node prototypes/combat-lab/test/local-character.mjs modelo.glb`: diagnóstico local do mapa de animações de um modelo seu (resultado em `validation/`).
- `node prototypes/combat-lab/test/parity.mjs`: paridade passo a passo com o v6 local (opcional).
- `node prototypes/combat-lab/verify.mjs`: 15 verificações no Edge offline, incluindo o GLB gerado pelo próprio Animation Studio com mapa de ações e eventos.
