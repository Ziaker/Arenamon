# VFX · Pouso do pulo regular e impacto vertical em paredes e objetos (v1.18.2)

Só apresentação: não altera regras, dano, stamina, física nem tempos. Renderizador legado (`view/vfx.js`), que é o ativo por padrão.

## Como abrir
`JOGAR_ARENAMON.html` → **Visualizar** → efeitos (cada bloco tem **Prévia**) ou **Ajustes** → blocos **VFX · Pouso do pulo regular**, **VFX · Impacto vertical em paredes e objetos** e **Tremor · Tremor ao bater em parede ou objeto**.

## 1. Pouso do pulo regular
- **Antes:** qualquer pouso (inclusive de pulo comum) disparava o efeito de «colisão com o chão» de knockback (poeira, anel, fragmentos, tremor).
- **Agora:** pulo normal, queda de borda e vault convertido em voo disparam só **uma onda circular simples rente ao chão, sem tremor e sem a poeira 3D de pouso**. Knockback (lançado por golpe), Bounce e Meteor Slam continuam com o efeito de colisão com o chão e o tremor de antes.
- A simulação marca o pouso (`lastLanding.regular`); o efeito escolhe a versão.

| Controle | Efeito |
|---|---|
| Ligado | liga/desliga a onda |
| Raio · Expansão | tamanho final da onda |
| Quantidade de ondas | 1 a 3 em sequência |
| Escala pela velocidade da queda | 0% = sempre igual |
| Impacto mínimo | queda abaixo disso não mostra nada |
| Duração · Opacidade · Intensidade · Dissipação · Cor | aparência |

## 2. Impacto vertical em paredes e objetos
Dispara quando o lutador **bate** na parede das extremidades da arena ou em objeto do cenário (pilar, caixa, plataforma, destrutível), usando o contato real da física. Só a **primeira batida** conta: andar encostado ou deslizar na parede não repete, e há um intervalo mínimo entre impactos do mesmo lutador.

Camadas (cada uma liga/desliga): **onda circular no plano da parede**, **faixa vertical de luz** (cresce com a altura do objeto), **faíscas** que correm ao longo da parede e **poeira** que sobe.

**Tamanho:** a escala vem da largura × altura do objeto tocado (média geométrica contra um tamanho de referência) e da velocidade do choque. A parede da arena é baixa; ela usa uma **altura equivalente** ajustável.

| Controle | Efeito |
|---|---|
| Velocidade mínima do choque | abaixo disso nada aparece |
| Intervalo entre impactos do mesmo lutador | evita repetição |
| Escala pela velocidade do choque | 0% = sempre igual |
| Parede da arena · Escala · Altura equivalente | liga/desliga e dimensiona a parede das extremidades |
| Objetos do cenário · Escala | pilares, caixas, plataformas, destrutíveis |
| Influência do tamanho do objeto · Tamanho de referência | 0% = igual para qualquer objeto; 100% = objeto grande, efeito grande |
| Onda da parede · Expansão | círculo no plano da parede |
| Faixa vertical · Comprimento | luz que sobe |
| Faíscas · Quantidade · Comprimento | faíscas ao longo da parede |
| Poeira · Quantidade · Subida | nuvem que sobe |
| Tamanho · Duração · Intensidade · Opacidade · Brilho · Dissipação · Cor · Cor secundária | aparência geral |

**Tremor:** há um bloco próprio, **Tremor ao bater em parede ou objeto**, **desligado por padrão**.

## Limites
- O sistema novo (`VfxRuntime`) não tem esses efeitos (está inativo).
- Móveis criados por Moves (barreiras, paredes de Reflect) não disparam o impacto: só parede da arena e objetos do mapa.
- Verificado por testes de simulação (`test/vfx.test.mjs`, 74) e por uma simulação completa (pulo → só onda; esquiva contra pilar → impacto). Não foi visto na tela.
