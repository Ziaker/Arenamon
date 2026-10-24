# Impacto (hit) · variante D "Direcional"

Quarta variante do efeito de acerto, no renderizador legado (`prototypes/combat-lab/src/view/vfx.js`, `hitD`), que é o ativo por padrão. As variantes A, B e C continuam iguais. Só apresentação: não altera regras, dano, stamina nem tempos.

## Como abrir
`JOGAR_ARENAMON.html` → **Visualizar** → efeitos → **Impacto (hit)** → botão **D · Direcional** → **Prévia**. Para ver em jogo, deixe a variante D escolhida e acerte um golpe.

## O que ela faz de diferente
- **Direção real:** leque de fagulhas, lâmina de luz e anel de pressão nascem da normal do contato (de quem atacou para quem apanhou). Cerca de 3/4 das fagulhas atravessam o alvo; o resto respinga para trás.
- **Força real:** a escala vem do dano e do empurrão horizontal do golpe (1× no golpe padrão). Golpe forte (força ≥ 1,15) deixa uma rachadura marcada no chão.
- **Camadas com corpo:** detritos que quicam no chão e poeira rente ao chão empurrada no sentido do golpe, além do brilho aditivo.

## Controles (painel do Impacto, todos com nome e unidade)
| Controle | Efeito |
|---|---|
| Abertura do cone de fagulhas | ângulo para cada lado (0° = jato reto) |
| Detritos | quantidade de lascas (0 = sem) |
| Poeira rente ao chão | quantidade de nuvem baixa (0 = sem) |
| Rachadura no chão | tamanho da marca em golpe forte (0 = desligada) |
| Escala pelo dano e lançamento reais | 0% = sempre a mesma força; 100% = golpe fraco e forte se distinguem |
| Cor / Cor secundária | cor das fagulhas / núcleo quente |
| **Núcleo de brilho — o círculo central** (liga/desliga) · Tamanho do núcleo | remove ou dimensiona o clarão circular no contato |
| **Anel de pressão** (círculo vertical) e **Anel no chão** (liga/desliga cada um) · Expansão de cada anel · Opacidade dos anéis | remove os círculos que se abrem ao redor do golpe, ou só reduz |
| **Lâmina de luz** (liga/desliga) · Comprimento · Espessura | a faixa de luz na direção do golpe |
| **Fagulhas em risco** (liga/desliga) · Comprimento · Espessura · Respingo para trás (0–100%) | 0% de respingo = todas as fagulhas atravessam o alvo |
| **Faíscas que caem** (liga/desliga) · Tamanho | os pontos de luz que sobem e caem |
| Tamanho dos detritos · Tamanho da poeira | complementam Detritos e Poeira (0 = sem) |
| Tamanho, duração, quantidade, intensidade, velocidade, opacidade, brilho, dissipação | os mesmos das outras variantes |

## Limites conhecidos
- O sistema novo (`VfxRuntime`, `vfx/effects/impact.js`) ainda não tem a variante D; escolhendo D lá ele usa a A.
- A cor não muda por tipo de golpe, porque o evento da simulação não informa o tipo do golpe (só dano, normal, lançamento e se foi slam). Isso exigiria mexer na simulação.
- Os botões de estilo global (A/B/C) não incluem a D; ela se escolhe só no próprio Impacto.
- Teste: `node prototypes/combat-lab/test/vfx.test.mjs` (a partir da raiz do repositório), caso "hit D".
