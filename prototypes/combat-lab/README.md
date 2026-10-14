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

## Achados da telemetria (para avaliação)

- **Bloqueio:** a vantagem **para agir** é 0. O recuo do atacante e o guard stun do defensor são canceláveis desde o primeiro passo. A vantagem **para se mover** é −12 passos (100 ms) para o atacante: recuo de 36 passos contra 24 de guard stun.
- **Lançamento:** o tempo no ar real é de 101 passos para 100 previstos por 2·v/g (integração discreta). O impacto acrescenta 5 passos de hitstop, contados à parte.

## Testes

- `node prototypes/combat-lab/test/sim.test.mjs`: 15 testes (8 cenários, determinismo, replay por estado, telemetria, tabela de quadros).
- `node prototypes/combat-lab/test/parity.mjs`: paridade passo a passo com o v6 local (opcional).
- `node prototypes/combat-lab/verify.mjs`: 13 verificações no Edge offline, incluindo o GLB gerado pelo próprio Animation Studio com mapa de ações e eventos.
