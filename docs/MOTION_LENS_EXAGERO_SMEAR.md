# Motion Lens 0.4 — Exagero e Smear 3D

O Motion Lens agora combina diagnóstico e autoria não destrutiva. Ele não altera a Action original, rest pose, pesos, hierarquia, hitboxes ou mecânicas do combate.

## Onde usar

No Blender, abra **View3D → Sidebar → Motion Lens → Criar exagero e smear**.

1. Escolha os ossos, o intervalo e a forma.
2. Use **Encontrar oportunidades** para medir trajetórias.
3. Use **Criar malhas de smear** para gerar auxiliares na coleção `ML_Exaggeration`.
4. Use **Criar variantes Sutil / Estilizada / Extrema** para criar três Actions derivadas.
5. Use **Relatório para agentes** para salvar `motion_lens_exaggeration.json`.
6. **Limpar auxiliares** remove somente os objetos gerados pelo Motion Lens.

## As dez capacidades

| Ideia | Entrega no addon |
|---|---|
| Smear entre poses | amostra a trajetória real de cada osso no intervalo escolhido |
| Membros múltiplos | preset **Ecos** cria volumes sucessivos ao longo do arco |
| Silhueta inteira | preset **Silhueta inteira** cria uma casca convexa das trajetórias combinadas |
| Direção artística | **Curva guia opcional** aceita Curve editável, inclusive criada pelo Direction Lines |
| Exagerador de pose | intensidade visível e três Actions derivadas, sem tocar na fonte |
| Detector de oportunidades | mede pico, deslocamento e sugere `smear` ou `exagerar_pose` |
| Biblioteca de formas | Fita, Tubo, Cone, Gota, Lâmina, Arco, Ecos e Silhueta inteira |
| Material procedural | cor, emissão, opacidade e fade longitudinal configuráveis |
| Antecipação/overshoot | variantes Sutil, Estilizada e Extrema ampliam o gesto dentro da janela |
| Pose → Smear → Impacto | fluxo único e relatório JSON rastreável para Claude, Codex e outros agentes |

## Preservação e limites

- As malhas são auxiliares visuais; não ampliam hitboxes.
- A Action original é comparada antes/depois nos testes e permanece idêntica.
- A variante **Estilizada** fica ativa após geração para inspeção; as três cópias têm nomes únicos.
- Action e Action Slot são restaurados durante análise e geração de malha; falhas removem resultados parciais.
- O detector mede trajetória, mas não decide sozinho se uma pose é artisticamente boa.
- O smear do Blender serve à autoria offline. O runtime já existente no Combat Lab não foi substituído nem modificado.

## Teste específico

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup --python scripts/blender-vision/tests/test_motion_lens_exaggeration_background.py -- scripts/blender-vision/addons/motion_lens.py
```

O teste cria um rig sintético com dois Action Slots, exercita as oito formas, injeta falha, cria as três variantes e confere que as curvas da Action fonte não mudaram.
