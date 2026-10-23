# Decisões provisórias — Moves novos (registro vivo)

Cada linha é um **padrão provisório** adotado para não bloquear a implementação onde a fonte marca o detalhe como pendente.
**Nada aqui é aprovação do diretor.** Cada item indica a fonte, o valor adotado e o controle visível que permite trocá-lo.
Criado em 21/10/2026 junto com `PROMPT_IMPLEMENTACAO_MOVES_NOVOS.md` (a tabela §5 do prompt é o ponto de partida).

| ID | Move | Pendência (fonte) | Padrão adotado | Controle | Status |
|---|---|---|---|---|---|
| MV-P01 | Harden | "+30% Defesa" sem atributo `defense` (catálogo §4) | dano × 1/(1+0,30), mesma convenção da passiva de Defesa | slider `harden.defensePct` | **implementado/testado** |
| MV-P02 | Quick Attack | origem inacessível / interrupção (catálogo §10a) | ponto físico válido mais próximo; sem teleporte | — | implementado |
| MV-P03 | Harden | empurrão contínuo de Fields (catálogo §10b) | não nega (só `knockbackTaken` de ataques/projéteis) | — (sem Field contínuo ainda) | implementado |
| MV-P04 | Bounce | estados aéreos (catálogo §10c) | só no chão | — (o efeito falha sem apoio) | implementado (só no chão) |
| MV-P05 | Spikes | perda de suporte e Sturdy (catálogo §10d) | some sem efeito; dano comum | toggle | implementado/testado |
| MV-P06 | Guard Break | GM-P04…P07 | guard stun 0,50 s; perfeita anula; Harden não anula guard stun | sliders | implementado/testado |
| MV-P07 | Riposte | GM-P10…P12 | janela 0,13–0,30 s; multi-hit consome no 1º | sliders | implementado/testado |
| MV-P08 | Feint | GM-P08/P09 | cancela Tackle/Lunge/Guard Break; fora da janela pune | — | implementado/testado |
| MV-P09 | Second Wind | "+40%/s" ambíguo (GM-P13…P15) | +40% da stamina máxima por segundo | slider `secondWind.regenPctPerSecond` | **implementado/testado** |
| MV-P10 | Lunge e demais | conversão g→passos do documento-fonte; i-frames do Lunge | remapeamento proporcional recalculado; i-frames 0,133 s | slider `lunge.invulnerableSeconds` | implementado |

Atualizar esta tabela a cada Move entregue (status: planejado → implementado → testado). Homologação é sempre do diretor.
| MV-P11 | todos os Normal/Burst sem marcador | "após confirmar e soltar" quando não há alvo/local a confirmar | a pressão do botão é a confirmação; cobrança e cooldown no início do cast | — | adotado |
| MV-P12 | Harden | o que conta como "knockback ofensivo" | só o lançamento/empurrão calculado pelo golpe; o empurrão físico de corpo do atacante (dash continuado) e a gravidade ficam | — | adotado |
| MV-P13 | Swift, Lunge, Quick Attack, Guard Break, Bounce, Riposte | "Dano nominal N HP" sem dizer se escala com o Ataque | final = N × Ataque ÷ referência (`test.attackReference` = 20): com Ataque 20 vale N; Sand Wave é a exceção (dano fixo aprovado) | slider "Dano nominal" de cada Move | adotado |
| MV-P14 | Burst sem tempo de recuperação definido (Swift) | duração da ação | 0,25 s (slider `cast`) | slider | adotado |
| MV-P15 | Lunge, Quick Attack, Guard Break | interação com Reflect | como o Tackle (são ações de Tackle reais) | — | adotado |
| MV-P16 | Quick Attack | i-frames do atacante não definidos | 0 | slider `quickAttack.invulnerableSeconds` | adotado |
| MV-P17 | Quick Attack | sem adversário elegível a ≤ 7 m | o Move não começa e não cobra (motivo `noTarget`) | slider `acquireRange` | adotado |
| MV-P18 | Guard Break | contato com guarda comum | derruba a guarda, guard stun 0,5 s, dano reduzido, sem empurrão; atacante não recua | slider `stun` | adotado |
| MV-P19 | Guard Break | PL × dano | o PL só decide disputas; o dano não cresce | slider `damage` | adotado |
| MV-P20 | Guard Break | distância do avanço não definida | 2,6 m | slider `range` | adotado |
| MV-P21 | Feint | uso fora da janela de cancelamento (GM-P09) | gasta o Move sem efeito; a ação anterior continua | slider `cancelWindow` | adotado |
| MV-P22 | Feint | direção/distância do recuo | para o lado do input (≥ 60° do rumo) ou para trás; 0,25 m | slider `retreat` | adotado |
| MV-P23 | Feint | quando libera outras ações | 0,033 s | slider `cancelAfter` | adotado |
| MV-P24 | Riposte | quando sai o contra-golpe | na hora do acerto anulado (não espera o fim da janela) | sliders de janela | adotado |
| MV-P25 | Riposte | alcance do contra-golpe | 1,6 m rumo a quem atacou | slider `strikeRange` | adotado |
| MV-P26 | Feint | reembolso da ação cancelada | nenhum | — | adotado |
| MV-P27 | Bounce | Bounce × Tackle ofensivo | PL maior vence, igual anula os dois, menor perde; gravidade 17,5 | slider `gravity` | adotado |
| MV-P28 | Bounce | raios de contato e de pouso | corpo + 0,3 m na descida; 1,4 m no pouso | sliders | adotado |
| MV-P29 | Spikes, mira por marcador | controle do marcador | a direção move o marcador (8 m/s) e o corpo fica parado; começa a 3 m | sliders | adotado |
| MV-P30 | Spikes, mira por marcador | soltar com marcador inválido | cancela sem custo | — | adotado |
| MV-P31 | Spikes | armação | 0,25 s antes de acionar | slider `armDelay` | adotado |
| MV-P32 | Sand Wave | grade do caminho livre | célula 0,25 m, margem de desvio 3 m, recálculo a cada 6 passos | sliders técnicos | adotado |
| MV-P33 | Sand Wave | "reposicionamento" da IA cegada | guarda levantada e passos lentos ao centro, sem perseguir | — | adotado |
| MV-P34 | Bullet Punch | velocidade/recuperação da investida de 3 m | velocidade do Tackle preservada (duração e distância escalam juntas) | slider `reach` | adotado |
| MV-P35 | Emerging Stone | dano "20 × Ataque"; busca da rocha; rocha só em plataformas planas | 20 nominais × Ataque ÷ 20; busca até 4 m; sem rampas/plataformas móveis | sliders | adotado (limitações declaradas na ficha) |
| MV-P36 | Water Pulse, Air Slash | Knockback horizontal com vertical 0 (EL-P04) | usar o empurrão do motor: 1,5 × H metros + 0,63 s de recuperação (o mesmo do Lunge); o slider mostra a consequência | sliders `knockbackPl1…3` / `knockbackH` | adotado |
| MV-P37 | Water Pulse | "Emissão no passo 12 depois da soltura" (WP-P08) | o projétil sai **no passo da soltura**; recuperação de 36 passos a partir dela | slider `chargeRecovery` | adotado |
| MV-P38 | Air Slash | Colisor orientado 1,20 × 0,70 × 0,22 m (AS-P02); "mira na soltura" (AS-P08) | colisor = círculo de raio 0,6 m (o desenho tem a caixa); Burst por **pressão**, mira do alvo capturada no toque | slider `radius` | adotado |
| MV-P39 | Seed Bomb | Volume da explosão (SB-P04); gravidade e destino inviável (SB-P03) | esfera 3D de 1,8 m com y herdado e oclusão; g = 17,5; destino acima da velocidade máx. falha | sliders `explosionRadius`, `gravity`, `maxSpeed`, `occlusion` | adotado |
| MV-P40 | Fire Spin | Guard stun nos pulsos (FS-P07); Clash de área (FS-P01); múltiplas zonas (FS-P04) | pulsos sem guard stun; sem Clash de área; 1 zona por dono | sliders `guardStun`, `maxActive` | adotado |
| MV-P41 | os 4 elementais | Origem do projétil e spawn inválido (WP-P05, AS-P04, SB-P02) | nasce na altitude real do atirador + 0,8 m (o padrão do Swift usava y absoluto e morria em plataforma); sólido no ponto de nascimento: Charge/Normal falham com reembolso onde o motor reembolsa, Burst é gasto sem efeito | sliders `originHeight`, `spawnForward` | adotado |

