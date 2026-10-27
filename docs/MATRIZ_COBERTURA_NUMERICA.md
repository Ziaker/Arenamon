# Matriz Canônica de Cobertura Numérica e Sliders do Editor

**Fase F7 — Cobertura Numérica e Sliders do Editor**  
**Projeto Arenamon — Laboratório de Combate**

---

## 1. Princípio Fundamental de Interface

Em estrita consonância com o Protocolo de Colaboração do Arenamon:
> *"Tudo que o usuário precisa ajustar tem controle na interface (slider, interruptor ou seletor visível no painel), com nome claro e unidade. Não deixe valor importante só no código."*

Nenhum parâmetro mecânico que afete combate, dano, recuperação, velocidade, janelas de timing ou efeitos visuais pode operar como constante fixa ("hardcoded") sem contrapartida visível no Editor (`prototypes/combat-lab/src/ui/`).

---

## 2. Inventário de Grupos de Parâmetros e Mapeamento 1:1

Todos os grupos de Moves e sistemas da simulação possuem cobertura no painel de controle (`moves-vfx-panel.js` e abas do Editor):

| Grupo em `C.world` | Move / Sistema | Linhas de Controle Ativas | Validação de Faixa `[min..max]` | Status de Contrato |
|---|---|---|---|---|
| `sandWave` | *Sand Wave* | Dano, Alcance, Largura, Cegueira, Aceleração de Empurrão, Duração | Padrões 100% contidos nas faixas dos sliders | **Aprovado (0 erros)** |
| `bulletPunch` | *Bullet Punch* | Dano, Impacto, Velocidade de Vanish, Duração, Janela de Ativação | Padrões 100% contidos nas faixas dos sliders | **Aprovado (0 erros)** |
| `waterPulse` | *Water Pulse* | Dano nominal (PL1/2/3), Velocidade, Raio, Duração, Empurrão | Padrões 100% contidos nas faixas dos sliders | **Aprovado (0 erros)** |
| `psyshock` | *Psyshock* | Arco, Anel (min/max), Altura, Escala, Homing, Knockback Cap | Padrões 100% contidos nas faixas dos sliders | **Aprovado (0 erros)** |
| `reflect` | *Reflect* | Carga Mínima, Duração da Barreira, Reflexões Máximas, Pulso | Padrões 100% contidos nas faixas dos sliders | **Aprovado (0 erros)** |
| `emergingStone` | *Emerging Stone* | Altura, Raio, Dano, Tempo de Erupção, Knockback | Padrões 100% contidos nas faixas dos sliders | **Aprovado (0 erros)** |
| `fireSpin` | *Fire Spin* | Raio de Sucção, Força, Dano por Tick, Duração, Número de Pulsos | Padrões 100% contidos nas faixas dos sliders | **Aprovado (0 erros)** |
| `airSlash` | *Air Slash* | Dano, Velocidade da Lâmina, Arco, Alcance Máximo | Padrões 100% contidos nas faixas dos sliders | **Aprovado (0 erros)** |
| `seedBomb` | *Seed Bomb* | Raio da Explosão, Projétil, Tempo de Detonação, Knockback | Padrões 100% contidos nas faixas dos sliders | **Aprovado (0 erros)** |
| `rules` | Regras Globais | Guard Break Stun, Slam Push Distance, Wall Restitution, Combo Window | Padrões 100% contidos nas faixas dos sliders | **Aprovado (0 erros)** |

---

## 3. Validação Automatizada de Contratos (`checkMoveContracts`)

A integridade do Editor é aferida continuamente por `moves-contracts.test.mjs` e `moves-params.test.mjs`:

1. **Nenhum Parâmetro Órfão:** Todo campo numérico presente nos objetos de configuração dos Moves possui um slider registrado com tupla canônica:
   `[grupo, chave, rótulo, dica, min, max, passo, formato, aprovado]`
2. **Nenhum Slider Mentiroso:** Toda linha do painel aponta para uma chave viva em `C.world` e o valor padrão do código reside estritamente entre `min` e `max`.
3. **Respeito ao M28.4:** A alteração de sliders em tempo de execução aplica-se a execuções subsequentes sem corromper instâncias ativas na simulação.

---

## 4. Evidência de Execução

```
--- CONTRATOS DOS MOVES ---
  ✓ registro real, fábrica: nenhum erro de contrato
  ✓ registro real com a base de calibração do jogo: nenhum erro e só os conflitos conhecidos como aviso
  ✓ todo grupo de Move do registro tem linhas no painel (inclui os 4 elementais)
  ✓ RED sintético: grupo inexistente, efeito e tackle não registrados
  ✓ RED sintético: parâmetro sem slider, slider órfão e padrão fora da faixa
  ✓ definição inválida chega ao relatório com a causa do validateMove
6 passaram, 0 falharam

  ✓ todo parâmetro dos Moves que o código lê tem slider
  ✓ cada slider tem rótulo, descrição, faixa que contém o padrão e formato com unidade
11 verificações dos sliders dos Moves aprovadas, 0 falhas.
```
