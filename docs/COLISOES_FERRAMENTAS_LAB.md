# Ferramentas de colisão no Laboratório de Combate

Tudo abre em `JOGAR_ARENAMON.html` (Laboratório de Combate), sem comandos. Resultados e decisões do overhaul: [COLISOES_FASE0_FASE1_RESULTADOS.md](COLISOES_FASE0_FASE1_RESULTADOS.md).

## 1. Cenários de um clique — aba «Cenários»
No topo da lista há o grupo **Colisões e ambiente (15)** com o botão **▶ Executar os 15** (roda todos sem animação e mostra «esperado × obtido») e um **▶ Executar** em cada cenário (roda na arena, com animação, e dá para ligar as sobreposições abaixo para ver o que a física faz).

| # | Cenário | O que mostra |
|---|---|---|
| 1 | Parede reta e inclinada (30°) | não penetra e desliza pela tangente |
| 2 | Deslocamento paralelo à parede | a parede não rouba velocidade |
| 3 | Personagem preso em quina | sem penetração, sem oscilação, sem «conflito de espaço» |
| 4 | Dois obstáculos muito próximos | passa pelo vão mínimo sem ficar preso |
| 5 | Corredor sem saída (Tackle comprime) | corpos não se sobrepõem, paredes não são penetradas |
| 6 | Tackle contra destrutível | dano uma vez por ação |
| 7 | Arremesso contra pilar | rebate pelo ângulo (R3.12), sem dano |
| 8 | Projétil rápido × barreira fina | a varredura contínua acha o primeiro contato |
| 9 | Salto sobre obstáculo baixo | passa por cima (R7.16) |
| 10 | Pouso no topo de plataforma | altura e superfície de apoio corretas |
| 11 | Parte inferior de um bloco suspenso | contato de teto, a cabeça não entra |
| 12 | Destruição do suporte | perde o apoio e cai até o chão |
| 13 | Drop e respawn de destrutível | drop cai; volta pela prévia, em outra posição (tempos encurtados só no cenário) |
| 14 | Objeto gerado em posição inválida | adia enquanto o corpo estiver na folga |
| 15 | Vários ataques e contatos ao mesmo tempo | sem NaN, sem conflito, sem afundar |

## 2. Sobreposições visuais — aba «Visualizar»
Ligue com os interruptores (nomes exatos):
- **Colisores do cenário** — contorno físico real de plataformas (verde), obstáculos (azul), destrutíveis (laranja) e a prévia de respawn (amarelo), com a altura de cada um.
- **Apoio atual** — anel na superfície que segura cada lutador e linha dos pés até ela.
- **Contatos com o ambiente** — normal (ciano), profundidade corrigida (vermelho), velocidade antes (branco) e depois (verde) do último toque.
- **Varredura dos projéteis** — trecho por subpasso e ponto do primeiro contato (anel vermelho).
- **Sobreposições e vãos** — linha vermelha entre sólidos sobrepostos, laranja se o vão for menor que o mínimo; anel vermelho em lutador penetrando.
- (já existentes) **Colisores por estado**, **Normais de contato**, **Arco de lançamento previsto** — este agora segue a borda circular da arena.

## 3. Números — «Dados ao vivo»
Por lutador: **apoio** (tipo, id, altura, há quantos passos) e **último contato** (bloqueador, profundidade em cm, normal, velocidade antes → depois). Gerais: **Objetos do cenário** (pares com vão menor que o mínimo, sobrepostos, sem posição válida) e **Penetração em sólidos**.

## 4. Ajustes (aba «Ajustes» → Objetos destrutíveis)
`Vão mínimo entre objetos sólidos` (1,2 m), `Folga mínima lutador × objeto novo` (0,6 m), `Velocidade mínima do impacto em destrutível`, `Dano ao destrutível por m/s do impacto`, `Dano ao arremessado por m/s do impacto`; e em «Arena circular» o `Multiplicador de rebote (borda circular, pilares e caixas)`.

## 5. Evidências
Capturas e resultado do teste de navegador: `prototypes/combat-lab/evidence/collision-tools/` (`arremesso-contra-pilar.png`, `pouso-no-topo-da-plataforma.png`, `resultado.json`).

## 6. Limites conhecidos (não verificados)
- Nenhuma medição de GPU real; o desempenho foi medido só na simulação (ver resultados, §15).
- As sobreposições são diagnóstico: a simulação nunca lê a sonda de colisão (`src/sim/collision-probe.js`), que fica fora do save e do replay.
