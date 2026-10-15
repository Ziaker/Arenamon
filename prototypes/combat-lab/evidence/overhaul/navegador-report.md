# Overhaul — teste de navegador

111/111 verificações aprovadas. Capturas e sequência de quadros nesta pasta.

| Grupo | Verificação | | Detalhe |
|---|---|---|---|
| Stamina | barra de stamina visível (altura e largura) | ✓ | {"h":7,"w":178,"app":"none"} |
| Stamina | barra acompanha a stamina em tempo real | ✓ |  |
| Interface | grupos com mais de dois itens têm botão de recolher | ✓ | 32 botões |
| Interface | Exportar só importa/exporta/compara (restaurar padrões fica em Ajustes) | ✓ |  |
| Interface | IA do oponente na aba Partida; teclas na aba Controles | ✓ |  |
| Interface | controles de VFX somente na aba Visualizar | ✓ |  |
| IA do oponente | desligada: o vermelho não se move sozinho | ✓ | 0.0000 m |
| Sprint | C mantido com seta após a esquiva entra em sprint | ✓ | {"s":true,"st":1.6791666666666631,"log":true} |
| Sprint | stamina consumida durante o sprint | ✓ | 1.68 |
| Sprint | speedlines do sprint disparadas | ✓ |  |
| VFX | hit variante A: gera partículas | ✓ | 28 criadas |
| VFX | hit variante B: gera partículas | ✓ | 13 criadas |
| VFX | hit variante C: gera partículas | ✓ | 13 criadas |
| VFX | dodge variante A: gera partículas | ✓ | 10 criadas |
| VFX | dodge variante B: gera partículas | ✓ | 10 criadas |
| VFX | dodge variante C: gera partículas | ✓ | 2 criadas |
| VFX | sprint variante A: gera partículas | ✓ | 9 criadas |
| VFX | sprint variante B: gera partículas | ✓ | 20 criadas |
| VFX | sprint variante C: gera partículas | ✓ | 9 criadas |
| VFX | block variante A: gera partículas | ✓ | 14 criadas |
| VFX | block variante B: gera partículas | ✓ | 9 criadas |
| VFX | block variante C: gera partículas | ✓ | 8 criadas |
| VFX | perfect variante A: gera partículas | ✓ | 37 criadas |
| VFX | perfect variante B: gera partículas | ✓ | 37 criadas |
| VFX | perfect variante C: gera partículas | ✓ | 37 criadas |
| VFX | ground variante A: gera partículas | ✓ | 18 criadas |
| VFX | ground variante B: gera partículas | ✓ | 11 criadas |
| VFX | ground variante C: gera partículas | ✓ | 16 criadas |
| VFX | clash variante A: gera partículas | ✓ | 42 criadas |
| VFX | clash variante B: gera partículas | ✓ | 30 criadas |
| VFX | clash variante C: gera partículas | ✓ | 49 criadas |
| VFX | exhaust variante A: gera partículas | ✓ | 4 criadas |
| VFX | exhaust variante B: gera partículas | ✓ | 9 criadas |
| VFX | exhaust variante C: gera partículas | ✓ | 3 criadas |
| VFX | regen variante A: gera partículas | ✓ | 5 criadas |
| VFX | regen variante B: gera partículas | ✓ | 7 criadas |
| VFX | regen variante C: gera partículas | ✓ | 3 criadas |
| VFX | desligado: o hit não é criado e o motivo é registrado | ✓ |  |
| VFX | slider de quantidade altera o efeito real | ✓ | 16 → 61 partículas |
| VFX | slider de tamanho altera a escala real | ✓ | 0.63 → 2.50 |
| VFX | limpeza: partículas liberadas após o efeito | ✓ | 2 restantes (regeneração/exaustão podem continuar) |
| VFX | preset exportável por efeito | ✓ |  |
| VFX | variante persiste no preset salvo | ✓ |  |
| VFX | colisão com o solo disparada pelo evento físico real | ✓ | colisão com o solo (vertical 7.3 m/s) |
| VFX | exaustão do adversário mostra indicadores | ✓ |  |
| VFX | indicadores somem quando a exaustão termina (stamina cheia, sem regeneração) | ✓ | 0 partículas novas |
| VFX | regeneração real mostra indicadores amarelos | ✓ |  |
| Tremor | desloca a câmera sem alterar o rig/yaw (referencial de entrada) | ✓ | {"mag":0.08502232463899755,"dx":-0.0014165065501634544,"yawSame":true} |
| Tremor | opção global desliga todos os tremores | ✓ | 0 |
| Sombras | estilo A: no chão, na posição física, sem duplicar | ✓ | {"x":0,"z":0,"y":0.012,"count":2,"maps":false} |
| Sombras | estilo B: no chão, na posição física, sem duplicar | ✓ | {"x":0,"z":0,"y":0.012,"count":2,"maps":false} |
| Sombras | estilo C: no chão, na posição física, sem duplicar | ✓ | {"x":0,"z":0,"y":0.012,"count":2,"maps":false} |
| Indicador C → X | raio configurável (só desenho) | ✓ |  |
| Animação (GLB) | uma entrada de animação por ação X/C (sem reinício por detecção repetida) | ✓ | 11 entradas para 12 ações |
| Animação (GLB) | ações concluídas tocam até o fim (tolerância de 2 quadros) | ✓ | tolerância 34% · 85.4, 81.3, 91.7, 89.6 |
| Animação (GLB) | cancelamentos legítimos identificados | ✓ | 2 cancelamentos pela defesa |
| Animação (GLB) | telemetria registra motivo e origem | ✓ | 77 trocas |
| Animação (GLB) | altura visual por personagem (sem mover a física) | ✓ | 0.300 |
| Animação (GLB) | importar animação para a biblioteca | ✓ | 38 clipes |
| Desempenho | tempo de quadro com tempestade de efeitos (dois lutadores, 5 efeitos a cada 250 ms) | ✓ | 50.1 ms sem VFX → 86.5 ms com VFX (Edge headless, GL por software) |
| Desempenho | limite de partículas respeitado | ✓ | pico 593 ≤ 1400 |
| HUD | Atual 1280×720: um único HUD visível | ✓ |  |
| HUD | A 1280×720: um único HUD visível | ✓ |  |
| HUD | A 1280×720: HP real exibido | ✓ | 60/90 × 60/90 |
| HUD | A 1280×720: quatro cooldowns demonstrativos, sem nomes de habilidades | ✓ | Demo 1, Demo 2, Demo 3, Demo 4 |
| HUD | A 1280×720: dentro da arena e sem cobrir o centro | ✓ | {"inside":true,"covers":false} |
| HUD | B 1280×720: um único HUD visível | ✓ |  |
| HUD | B 1280×720: HP real exibido | ✓ | 60/90 × 60/90 |
| HUD | B 1280×720: quatro cooldowns demonstrativos, sem nomes de habilidades | ✓ | Demo 1, Demo 2, Demo 3, Demo 4 |
| HUD | B 1280×720: dentro da arena e sem cobrir o centro | ✓ | {"inside":true,"covers":false} |
| HUD | C 1280×720: um único HUD visível | ✓ |  |
| HUD | C 1280×720: HP real exibido | ✓ | 60/90 × 60/90 |
| HUD | C 1280×720: quatro cooldowns demonstrativos, sem nomes de habilidades | ✓ | Demo 1, Demo 2, Demo 3, Demo 4 |
| HUD | C 1280×720: dentro da arena e sem cobrir o centro | ✓ | {"inside":true,"covers":false} |
| HUD | A 1280×720: exaustão indicada | ✓ |  |
| HUD | B 1280×720: exaustão indicada | ✓ |  |
| HUD | C 1280×720: exaustão indicada | ✓ |  |
| HUD | Atual 1920×1080: um único HUD visível | ✓ |  |
| HUD | A 1920×1080: um único HUD visível | ✓ |  |
| HUD | A 1920×1080: HP real exibido | ✓ | 60/90 × 60/90 |
| HUD | A 1920×1080: quatro cooldowns demonstrativos, sem nomes de habilidades | ✓ | Demo 1, Demo 2, Demo 3, Demo 4 |
| HUD | A 1920×1080: dentro da arena e sem cobrir o centro | ✓ | {"inside":true,"covers":false} |
| HUD | B 1920×1080: um único HUD visível | ✓ |  |
| HUD | B 1920×1080: HP real exibido | ✓ | 60/90 × 60/90 |
| HUD | B 1920×1080: quatro cooldowns demonstrativos, sem nomes de habilidades | ✓ | Demo 1, Demo 2, Demo 3, Demo 4 |
| HUD | B 1920×1080: dentro da arena e sem cobrir o centro | ✓ | {"inside":true,"covers":false} |
| HUD | C 1920×1080: um único HUD visível | ✓ |  |
| HUD | C 1920×1080: HP real exibido | ✓ | 60/90 × 60/90 |
| HUD | C 1920×1080: quatro cooldowns demonstrativos, sem nomes de habilidades | ✓ | Demo 1, Demo 2, Demo 3, Demo 4 |
| HUD | C 1920×1080: dentro da arena e sem cobrir o centro | ✓ | {"inside":true,"covers":false} |
| HUD | A 1920×1080: exaustão indicada | ✓ |  |
| HUD | B 1920×1080: exaustão indicada | ✓ |  |
| HUD | C 1920×1080: exaustão indicada | ✓ |  |
| HUD | Atual 1024×768: um único HUD visível | ✓ |  |
| HUD | A 1024×768: um único HUD visível | ✓ |  |
| HUD | A 1024×768: HP real exibido | ✓ | 60/90 × 60/90 |
| HUD | A 1024×768: quatro cooldowns demonstrativos, sem nomes de habilidades | ✓ | Demo 1, Demo 2, Demo 3, Demo 4 |
| HUD | A 1024×768: dentro da arena e sem cobrir o centro | ✓ | {"inside":true,"covers":false} |
| HUD | B 1024×768: um único HUD visível | ✓ |  |
| HUD | B 1024×768: HP real exibido | ✓ | 60/90 × 60/90 |
| HUD | B 1024×768: quatro cooldowns demonstrativos, sem nomes de habilidades | ✓ | Demo 1, Demo 2, Demo 3, Demo 4 |
| HUD | B 1024×768: dentro da arena e sem cobrir o centro | ✓ | {"inside":true,"covers":false} |
| HUD | C 1024×768: um único HUD visível | ✓ |  |
| HUD | C 1024×768: HP real exibido | ✓ | 60/90 × 60/90 |
| HUD | C 1024×768: quatro cooldowns demonstrativos, sem nomes de habilidades | ✓ | Demo 1, Demo 2, Demo 3, Demo 4 |
| HUD | C 1024×768: dentro da arena e sem cobrir o centro | ✓ | {"inside":true,"covers":false} |
| HUD | A 1024×768: exaustão indicada | ✓ |  |
| HUD | B 1024×768: exaustão indicada | ✓ |  |
| HUD | C 1024×768: exaustão indicada | ✓ |  |
| HUD | cooldown demonstrativo dispara e recarrega | ✓ |  |
| Geral | sem erros de página | ✓ |  |