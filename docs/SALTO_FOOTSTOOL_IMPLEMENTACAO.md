# Salto 3D estilo SM64 + Footstool — Implementação (Plano D)

Data: 2026-10-20 · Branch: `feat/salto-footstool` · Protótipo: `prototypes/combat-lab`

Documento de implementação do overhaul de salto e do footstool (pisar no rival) do
Combat Lab, seguindo o plano diretor em `docs/ARENAMON-PLANO-DIRETOR-2026-10-20.txt`.
Jogável em `JOGAR_ARENAMON.html` → `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`.

## 1. Salto (pacote `jumpImprovements`, padrão LIGADO)

Sensação estilo SM64, com física legada preservada quando `map.jumpImprovements = 0`
(toggle A/B no painel, aba Mapa › Plataformas e salto):

| Parâmetro | Padrão | Faixa | Efeito |
|---|---|---|---|
| `jumpGravityUp` | 17,5 m/s² | 5–40 | Gravidade enquanto sobe (botão segurado) |
| `jumpGravityDown` | 22,0 m/s² | 5–40 | Gravidade na descida (queda mais pesada) |
| `jumpReleaseMult` | 2,2× | 1–4 | Soltar o botão na subida multiplica a gravidade → salto curto |
| `jumpMaxFallSpeed` | 12,0 m/s | 2–30 | Velocidade terminal de queda |
| `jumpAirAccel` | 8,0 m/s² | 0–40 | Aceleração do controle aéreo |
| `jumpAirMaxSpeed` | 4,5 m/s | 0–15 | Teto do controle aéreo |
| `jumpCoyoteTime` | 0,10 s | 0–0,5 | Salto válido logo após sair da borda |
| `jumpBufferWindow` | 0,12 s | 0–0,5 | Salto apertado antes do pouso dispara ao aterrissar |
| `jumpInterval` | 0,12 s | 0,05–5 | Intervalo mínimo entre saltos (era 0,25) |

### Decisões
- **Salto variável:** segurar o botão sobe com `jumpGravityUp`; soltar aplica
  `jumpGravityUp × jumpReleaseMult` na subida. Salto completo ≈ 2,0 m, curto ≈ metade.
- **Controle aéreo por aceleração (não esterçamento):** o vetor horizontal GIRA sem
  encolher — a velocidade total nunca fica abaixo do momento do salto nem acima do
  teto `max(momento, jumpAirMaxSpeed)`. Inverter exige desaceleração real.
- **Coyote time:** concedido na queda natural de borda (`isEdgeFall`); dentro da janela,
  o salto converte o voo em salto normal. Quem só caiu da borda (sem apertar salto)
  continua em queda — preserva o invariante "dano só com ação" das partidas de IA.
- **Buffer:** apertar salto no ar arma `jumpBuffered`; o consumo respeita o cooldown
  de pouso (o buffer não contorna o `jumpInterval` — congela durante ele e dispara logo
  em seguida).
- **Gamepad:** botão 10 (L3) pula; `jumpHeld` propagado por teclado e gamepad.

## 2. Footstool (`footstoolEnabled`, padrão LIGADO)

Pisar na cabeça do rival durante um salto em queda:

| Parâmetro | Padrão | Faixa | Efeito |
|---|---|---|---|
| `footstoolDamage` | 5 HP | 0–30 | Dano exato em alvo desprotegido |
| `footstoolBounce` | 3,7 m/s | 0–10 | Rebote vertical do atacante |
| `footstoolStagger` | 0,25 s | 0–2 | Stagger (stun real) do defensor |
| `footstoolTolerance` | 0,12 m | 0–1 | Tolerância lateral de sobreposição |
| `footstoolMinFallSpeed` | 1,0 m/s | 0–10 | Velocidade mínima de queda |
| `footstoolCooldown` | 0,5 s | 0–3 | Recarga por lutador |
| `footstoolVault` | 0 (desligado) | 0/1 | Experimental: também durante o vault de C |

### Contratos
- Só com salto voluntário (`isNormalJump`, inclui coyote); **a IA não pula**, então o
  footstool é só posicional contra a IA (dano dela contra o jogador não ocorre — teste
  de propriedade "dano sem ação" protege isso).
- Contato: pés cruzam o topo do colisor do defessor VINDO DE CIMA, com sobreposição
  horizontal real; exige `vy ≤ −footstoolMinFallSpeed`.
- Dano pelo pipeline central (`processDamageWithShieldAndStages`): escudo absorve
  primeiro, estágios de defesa reduzem o residual; contato superior **ignora a defesa
  frontal D**.
- Invulnerável: atacante rebate (física aplica o impulso), mas sem dano/stagger —
  evento `result: 'invulnerable'`, `contact: 'footstool'`.
- Stagger por `stun` real (sem reuso de `counterStagger`); zero knockback/launch/push,
  zero stamina; ação/carga/guarda em curso interrompidas.
- Anti-abuso: um footstool por trajetória (`footstoolDoneWith`) + cooldown por lutador.
- Meteor slam tem prioridade: X no ar converte o voo antes da física — sem dano duplo.

### Feedback
- HUD: aviso central `FOOTSTOOL −N HP` (respeita duração do aviso de impacto).
- Som: hit comum; estatísticas da partida contam dano/acertos.
- VFX: partículas discretas de impacto + tremor leve; câmera cinematográfica exibe
  callout "FOOTSTOOL!" com impact frame curto.

## 3. Painel
- Aba **Mapa › Plataformas e salto** (estendida) e nova seção **Footstool (pisar no rival)**.
- Nova aba **🦘 Salto** na gaveta de Ações (Sistemas / Salto / Controle aéreo / Footstool),
  com os sliders e seletores de animação (`jump`, `fall`, `land`).
- Toggles principais no nível "Básico" do Ajustes.

## 4. Testes
- Nova suíte `test/footstool.test.mjs` (15 verificações) incluída na cadeia
  `npm run test:combat-lab:unit`: dano exato 5, rebote 3,7, stagger, um acerto por
  contato, lateral inválido, subindo inválido, queda lenta inválida, sistema desligado,
  invulnerável, escudo, estágios de defesa, interrupção, salto curto×completo, coyote,
  buffer, controle aéreo sem ganho de momentum.
- Testes existentes atualizados: `map.test.mjs` (controle aéreo, cooldown pós-pouso,
  raio da arena 32,5 m conforme decisão anterior). `ai-eval.test.mjs` é lento por
  natureza (~1–2 min) e permanece aprovado.

## 5. Limitações conhecidas
- `footstoolVault` (footstool durante o vault de C) fica desligado por padrão,
  aguardando aprovação de jogabilidade.
- Plataformas móveis não existem no motor; o footstool usa `groundY + flight.y` do
  defensor, então já funciona sobre plataformas estáticas.
- O intervalo de salto padrão mudou de 0,25 s para 0,12 s (alinhado ao buffer) —
  ajustável no painel se o ritmo ficar rápido demais.
