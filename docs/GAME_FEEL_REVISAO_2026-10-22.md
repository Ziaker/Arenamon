# Game feel — revisão das propostas pendentes no GitHub (22/10/2026)

Base: `main` @ v1.18.2. Fontes lidas: PR #98 (`docs/PROPOSTA_RESPONSIVE_MOVEMENT_V2.md`), PR #99 (`docs/PROPOSTA_GAME_FEEL_5_MELHORIAS.md`), issues #95, #96 e #97. Os dois documentos existem **só nas branches dos PRs** (rascunhos, 21/10/2026, escritos sobre a `main` de 21/10 `68eda6c`); as duas propostas foram escritas antes do overhaul de colisões, do salto 3D e da calibração de 22/10, então várias premissas ficaram desatualizadas. Comparação feita no código e nos testes; nada foi implementado por este documento.

## Resumo

| Proposta | O que o documento assume | Estado real na `main` v1.18.2 | Veredito |
|---|---|---|---|
| **Responsive Movement V2** (#98), pacote numérico | «Não implementada»; 7 valores de ensaio | **Já adotado na base de calibração do responsável**: aceleração 40, frenagem 34, reversão 62, aderência 52, sprint acel. 26, `turnGrip` do sprint 28 (V2: 30), fade 0,19 s (V2: 0,14 s). Diferença importante: o sprint ficou ×1,8 (a V2 pedia preservar ×1,55) | Numérica **adotada** (variante dele); fora dela: aderência adaptativa e camada visual **não feitas** |
| V2, camada visual (inclinação de intenção, freio responsivo, locomoção por velocidade) | Experimentos futuros | Nada no código (`view/characters.js` sem inclinação/lean) | **Pendente**, sem aprovação |
| **GF-01 Momentum Bridge** | Pendente | `advanceAction` ainda zera `f.velocity`; só existem `sprintCarry` e o escorregão de pouso (`landingSlide`) | **Pendente** |
| **GF-02 Collision Flow** | Refinamento do que `collideFighter` já faz | O overhaul de colisões (v1.15.8–1.15.17) entregou deslize guiado por normais (`solid-contact.js`, `slideAlong`), resposta por estado, contatos simultâneos e testes (`collision-slide`, `collision-multi`, `collision-solid`) | **Em grande parte implementado**; checar contra T01–T06 do documento |
| **GF-03 Coyote + Jump Buffer** | «Salto normal planejado, não implementado» | **Implementado** (Plano D, v1.15): coyote 0,10 s, buffer 0,12 s, salto normal, footstool | **Implementado** (valores de ensaio do doc coincidem: 0,08–0,10 e 0,10–0,15) |
| **GF-04 Ground Snap + Step Assist** | Depende de apoio 3D | Contrato de apoio físico (`groundSurface`, `f.support`, v1.15.10), queda de borda e tolerância de montagem (`map.mountTolerance` 0,25 m). Não há *step assist* nem *snap* dedicados | **Parcial**: apoio sim; degrau e snap não |
| **GF-05 Adaptive Hitstop** | Hitstop fixo 0,035/0,085 s | Hitstop por faixa de dano existe (`hitstopDamageBoost`/`hitstopDamageRef`, v1.13.0; teste `hitstop-tiers`), **desligado por padrão** (0). Sem assinatura própria por evento (clash, defesa perfeita, slam) | **Parcial** |
| **#95 Ledge Grab & Mantle** | Ideia | **Implementado na v1.19.0** com decisões provisórias e controles (`docs/LEDGE_GRAB.md`) | **Implementado, aguardando decisão e homologação** |
| **#96 Directional Influence** | Ideia | Nenhum código (existe só o controle aéreo do salto e o recovery rápido com C) | **Pendente**, não aprovada |
| **#97 Wall Tech** | Ideia | Nenhum código (wall-splat existe; tech de chão existe; tech de parede não) | **Pendente**, não aprovada |

## O que isso muda para os PRs
- **#98:** a parte numérica já foi tomada pela calibração; o PR deveria registrar isso ou ser fechado. Falta decidir se vale testar a aderência adaptativa e a camada visual.
- **#99:** GF-02 e GF-03 estão (quase) feitos; GF-04 e GF-05 parciais; só GF-01 é totalmente novo. Os testes T01–T06 de GF-02/03/05 podem ser reaproveitados dos arquivos existentes antes de qualquer trabalho novo.
- Nenhum dos documentos está na `main`; se forem mantidos, convém trazê-los com estas anotações.

## Sugestão de ordem (só se o responsável quiser avançar)
1. **GF-01 Momentum Bridge** (único item inteiro novo), isolado e com toggle, comparando com a calibração atual.
2. Decidir sobre **GF-05**: ligar/ajustar o hitstop por dano já existente antes de criar perfis novos.
3. **GF-04**: avaliar se o degrau/snap faz falta depois de jogar com o overhaul de colisões e a faixa de montagem de 2,2 m (resíduo conhecido).
4. Propostas #95–#97 só depois de decisão explícita.

## Limites desta revisão
Não rodei partidas nem medi sensação; comparei texto de proposta com código, configuração e testes. «Em grande parte implementado» significa que o mecanismo e os testes existem, não que o responsável o homologou jogando.
