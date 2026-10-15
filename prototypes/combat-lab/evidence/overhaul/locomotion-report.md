# Locomoção — verificação (overhaul)

Passo de simulação: 8.33 ms. 67/67 verificações aprovadas.

Gráficos (SVG) e registros por passo (CSV: tempo, posição X/Z, velocidade X/Z, velocidade desejada, aceleração aplicada, direção de entrada, orientação visual, estado e fase) nesta pasta.

| Grupo | Verificação | Esperado | Obtido | |
|---|---|---|---|---|
| Inversão (caminhada) | velocidade estável antes da inversão | variação < 2% em 25 passos | 4.80 → 4.80 m/s | ✓ |
| Inversão (caminhada) | não inverte no passo seguinte (+v → −v proibido) | queda < 2.40 m/s no 1º passo | 0.3167 | ✓ |
| Inversão (caminhada) | atravessa zero progressivamente | ≥ 4 passos até zero | 15 passos (125 ms) | ✓ |
| Inversão (caminhada) | desacelera e acelera no novo sentido sem oscilar | monótona | monótona | ✓ |
| Inversão (caminhada) | \|Δv\| por passo ≤ limite de aceleração × passo | ≤ 0.425 m/s | 0.3167 | ✓ |
| Inversão (caminhada) | termina estável no sentido oposto | < -4.32 | -4.8 | ✓ |
| Inversão (sprint) | velocidade estável antes da inversão | variação < 2% em 25 passos | 7.44 → 7.44 m/s | ✓ |
| Inversão (sprint) | não inverte no passo seguinte (+v → −v proibido) | queda < 3.72 m/s no 1º passo | 0.3167 | ✓ |
| Inversão (sprint) | atravessa zero progressivamente | ≥ 4 passos até zero | 23 passos (192 ms) | ✓ |
| Inversão (sprint) | desacelera e acelera no novo sentido sem oscilar | monótona | monótona | ✓ |
| Inversão (sprint) | \|Δv\| por passo ≤ limite de aceleração × passo | ≤ 0.358 m/s | 0.3167 | ✓ |
| Inversão (sprint) | termina estável no sentido oposto | < -6.70 | -7.44 | ✓ |
| Inversão (diagonal) | velocidade estável antes da inversão | variação < 2% em 25 passos | 4.80 → 4.80 m/s | ✓ |
| Inversão (diagonal) | não inverte no passo seguinte (+v → −v proibido) | queda < 2.40 m/s no 1º passo | 0.3167 | ✓ |
| Inversão (diagonal) | atravessa zero progressivamente | ≥ 4 passos até zero | 15 passos (125 ms) | ✓ |
| Inversão (diagonal) | desacelera e acelera no novo sentido sem oscilar | monótona | monótona | ✓ |
| Inversão (diagonal) | \|Δv\| por passo ≤ limite de aceleração × passo | ≤ 0.425 m/s | 0.3167 | ✓ |
| Inversão (diagonal) | termina estável no sentido oposto | < -4.32 | -4.8 | ✓ |
| Inversão (diagonal) | diagonal não é mais rápida que o eixo | ≤ 4.8 | 4.8 | ✓ |
| Inversão (lock-on) | velocidade estável antes da inversão | variação < 2% em 25 passos | 4.80 → 4.80 m/s | ✓ |
| Inversão (lock-on) | não inverte no passo seguinte (+v → −v proibido) | queda < 2.40 m/s no 1º passo | 0.3167 | ✓ |
| Inversão (lock-on) | atravessa zero progressivamente | ≥ 4 passos até zero | 15 passos (125 ms) | ✓ |
| Inversão (lock-on) | desacelera e acelera no novo sentido sem oscilar | monótona | monótona | ✓ |
| Inversão (lock-on) | \|Δv\| por passo ≤ limite de aceleração × passo | ≤ 0.425 m/s | 0.3167 | ✓ |
| Inversão (lock-on) | termina estável no sentido oposto | < -4.32 | -4.8 | ✓ |
| Curva 90° | componente antiga se dissipa em vários passos | ≥ 5 passos | 16 | ✓ |
| Frenagem | para em vários passos (velocidade residual) | ≥ 6 passos | 28 passos | ✓ |
| Frenagem | nunca inverte ao frear | vz ≥ 0 | 0 | ✓ |
| Curva 90° | \|Δv\| por passo ≤ limite | ≤ 0.425 | 0.3567 | ✓ |
| Lock-on | referencial travado: direção da trajetória constante enquanto a seta é mantida | < 0,01 rad | 0 | ✓ |
| Lock-on | sem trava (v6): a câmera que gira encurva a trajetória (órbita) | > 0,2 rad | 0.7902 | ✓ |
| Lock-on | orientação visual acompanha o alvo (lockFacing = alvo) | < 0,05 rad | -0.0044 | ✓ |
| Mira | X parado com lock-on sai rumo ao alvo | 0 rad | 0 | ✓ |
| Jogador × IA | mesmas intenções → mesmas velocidades em todos os passos | 0 | 0 | ✓ |
| Jogador × IA | giro da intenção limitado a moveSmoothing por segundo | ≤ 10 rad/s | ok | ✓ |
| Jogador × IA | IA × IA (40 s): Δv da locomoção livre ≤ limite (azul) | ≤ 100% do limite | 100.0% | ✓ |
| Jogador × IA | IA × IA (40 s): Δv da locomoção livre ≤ limite (vermelho) | ≤ 100% do limite | 100.0% | ✓ |
| Tackle | distância nominal preservada | 4.800 m | 4.8 | ✓ |
| Tackle | começa devagar (preparação): 1º passo < 25% do pico | < 6.61 | 0.0251 | ✓ |
| Tackle | sem salto: maior variação por passo < 25% do pico | < 6.61 m/s | 5.3249 | ✓ |
| Tackle | recuperação: velocidade final ≈ 0 | < 5% do pico | 0 | ✓ |
| Tackle | duração preservada | 0.4 s | 0.3917 | ✓ |
| Esquiva | distância nominal preservada | 4.800 m | 4.8 | ✓ |
| Esquiva | começa devagar (preparação): 1º passo < 25% do pico | < 6.08 | 0.0201 | ✓ |
| Esquiva | sem salto: maior variação por passo < 25% do pico | < 6.08 m/s | 4.412 | ✓ |
| Esquiva | recuperação: velocidade final ≈ 0 | < 5% do pico | 0 | ✓ |
| Esquiva | duração preservada | 0.4 s | 0.3917 | ✓ |
| Tackle após corrida | velocidade do 1º passo continua a da corrida (sem queda brusca) | ≈ 4.80 m/s | 4.7307 | ✓ |
| Tackle após corrida | distância nominal preservada mesmo com a mistura de entrada | 4.800 m | 4.8 | ✓ |
| Esquiva após corrida | velocidade do 1º passo continua a da corrida (sem queda brusca) | ≈ 4.80 m/s | 4.7256 | ✓ |
| Esquiva após corrida | distância nominal preservada mesmo com a mistura de entrada | 4.800 m | 4.8 | ✓ |
| Duração × distância | duração 0.3 s: distância | 4,8 m | 4.8 | ✓ |
| Duração × distância | duração 0.4 s: distância | 4,8 m | 4.8 | ✓ |
| Duração × distância | duração 0.7 s: distância | 4,8 m | 4.8 | ✓ |
| Colisores | separação mínima entre centros ≥ 2 × meia largura | ≥ 1 | 1 | ✓ |
| Sprint | entra em sprint vindo da esquiva com C mantido | esquiva → sprint | passo 36, antes: dodge | ✓ |
| Sprint | entra herdando a velocidade da esquiva (sem queda brusca) | < 1 m/s de diferença | -0.1 | ✓ |
| Sprint | mais rápido que a caminhada | > 5.76 m/s | 7.44 | ✓ |
| Sprint | velocidade de cruzeiro do sprint respeitada | ≤ 7.44 | 7.44 | ✓ |
| Sprint | consome stamina por segundo | 0.747 | 0.7471 | ✓ |
| Sprint | ao soltar C desacelera progressivamente até a caminhada | queda gradual | 7.34 → 4.80 m/s | ✓ |
| Sprint | \|Δv\| por passo ≤ limite | ≤ 0.425 | 0.1 | ✓ |
| Sprint | stamina zerada encerra o sprint e deixa exausto | sprint encerrado | passo 196, sprint depois: 0 | ✓ |
| Sprint | após a exaustão anda na velocidade de exausto | 3.36 m/s | 3.36 | ✓ |
| Sprint | desligado nos ajustes: nunca entra em sprint | nunca | nunca | ✓ |
| IA desligada | não se move antes de ser atingido | 0 m | 0 | ✓ |
| IA desligada | recebe o impacto e é lançado | impact | impact | ✓ |