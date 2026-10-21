# Decisões provisórias — Moves novos (registro vivo)

Cada linha é um **padrão provisório** adotado para não bloquear a implementação onde a fonte marca o detalhe como pendente.
**Nada aqui é aprovação do diretor.** Cada item indica a fonte, o valor adotado e o controle visível que permite trocá-lo.
Criado em 21/10/2026 junto com `PROMPT_IMPLEMENTACAO_MOVES_NOVOS.md` (a tabela §5 do prompt é o ponto de partida).

| ID | Move | Pendência (fonte) | Padrão adotado | Controle | Status |
|---|---|---|---|---|---|
| MV-P01 | Harden | "+30% Defesa" sem atributo `defense` (catálogo §4) | a definir na implementação (M1) | slider | planejado |
| MV-P02 | Quick Attack | origem inacessível / interrupção (catálogo §10a) | ponto físico válido mais próximo; sem teleporte | — | planejado |
| MV-P03 | Harden | empurrão contínuo de Fields (catálogo §10b) | não nega | toggle | planejado |
| MV-P04 | Bounce | estados aéreos (catálogo §10c) | só no chão | toggle | planejado |
| MV-P05 | Spikes | perda de suporte e Sturdy (catálogo §10d) | some sem efeito; dano comum | toggle | planejado |
| MV-P06 | Guard Break | GM-P04…P07 | guard stun 0,50 s; perfeita anula; Harden não anula guard stun | sliders | planejado |
| MV-P07 | Riposte | GM-P10…P12 | janela 0,13–0,30 s; multi-hit consome no 1º | sliders | planejado |
| MV-P08 | Feint | GM-P08/P09 | cancela Tackle/Lunge/Guard Break; fora da janela pune | — | planejado |
| MV-P09 | Second Wind | "+40%/s" ambíguo (GM-P13…P15) | +40% da stamina máxima por segundo | slider | planejado |
| MV-P10 | 5 genéricos | conversão g→passos do documento-fonte | remapeamento proporcional recalculado | — | planejado |

Atualizar esta tabela a cada Move entregue (status: planejado → implementado → testado). Homologação é sempre do diretor.
