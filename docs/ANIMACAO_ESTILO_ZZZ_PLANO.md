# Animação de combate no estilo Zenless Zone Zero — plano

Objetivo: o responsável atua como **diretor** (descreve a intenção e aprova), sem mexer em quaternions ou curvas. A linguagem visual buscada é a de Zenless Zone Zero: poses extremas, silhuetas fortes, timing explosivo e exagero estilizado.

## Inventário (23/10/2026)

| Item | Estado |
|---|---|
| Motion Lens 0.3.1 | No repositório (`scripts/blender-vision/addons/motion_lens.py`), idêntico ao instalado. 15 comandos, **todos de análise**. Não gera Smear/Stretch, só verifica janelas declaradas em contrato. |
| Direction Lines 0.1.0 | No repositório, idêntico ao instalado. Guias de direção/linha de ação e comparação. Não altera animação. |
| Blender MCP 1.8 | Ativo no Blender 5.2.2. Executa código, captura viewport, lê cena. |
| Mosh (Cogumelo) | `chars/mosh/Cogumelo_com_rig.fbx` (rig Mixamo) + ~50 clipes Mixamo. |
| Vigoroth | `chars/vigor/Vigoroth_rig_v2.blend`, Tackle v1–v20, Ombrada v1–v3 (somente local). |
| Croagunk / Drowzee | `croagunk-rigged.glb`; `drowzee-rig-ampliado.blend`. |
| Gumshoos | `gumshoos.glb`, rig não confirmado. |
| Parry (defesa perfeita) | Regra existe no Combat Lab (janela 0,2 s, cooldown 2 s, contra-ataque 0,70 s; evento `result: 'perfect'`, som e câmera próprios). **Sem animação própria**: reaproveita `guard_hit`. |
| Perfect Dodge | Regra existe (`perfectEvadeStamina`). **Sem animação nem evento visual próprio.** |

Detalhes e hashes: [BLENDER_ADDONS_MOTION_LENS.md](BLENDER_ADDONS_MOTION_LENS.md).

## Diagnóstico

- `perception_motion.py` e o `check` do Blender Vision **medem e diagnosticam, mas não geram animação**.
- `scripts/blender-vision/pose_lib.py` (aim, IK de perna, keyframes, duplicar action) é a base natural para um gerador de poses.
- O Animation Studio edita clipes, eventos, root motion e comparação, mas **não cria poses**.
- A auditoria do Tackle (v2 a v20) mostra que passar nas regras técnicas não garante qualidade artística: mãos só com 2 dedos, silhueta e peso visual ficaram sem julgamento.
- A equipe de ZZZ anima o combate majoritariamente à mão, com referência real, rigs com controles extras de estiramento e aceitação de exagero. O ganho está em **poses intencionais, ritmo e deformação estilizada**, não em suavizar.

## Fases (ordem de prioridade)

1. **Diretor de poses** — briefing em linguagem natural → poses-chave propostas e vistas em frente/lado/perspectiva → aprovação do diretor antes de gerar o intermediário.
2. **Controles de deformação estilizada** — stretch/squash/torção com preservação de volume, IK, rigs expressivos.
3. **Movimento intermediário** — timing, spacing, arcos e overlapping por fase (antecipação, ataque, impacto, recuperação), com interpolação stepped/linear/curva, sem suavização uniforme.
4. **Ciclo de avaliação** — comparar com referências escolhidas pelo diretor, apontar defeitos por frame e propor correções em versão derivada (nunca no original).
5. **Integração com combate** — eventos explícitos (início, antecipação, janelas defensivas, contato, recuperação, cancelamento). Os marcos mecânicos vêm das regras aprovadas do Combat Lab, nunca deduzidos da aparência.

## Próximo passo (Etapa 4, aguardando aprovação)

Piloto: **Parry do Mushroom** — recuar o tronco, bloquear com o braço direito de forma poderosa, voltar a uma postura ameaçadora; impacto brutal estilo ZZZ.

- Página no portal: briefing, lista de poses-chave editáveis (nome, frame, intenção), sliders por junta com nome e unidade, salvar/exportar JSON.
- Script no Blender que lê o JSON e aplica as poses via `pose_lib.py` em uma action derivada (`<nome>_vN`), renderizando frente, lado e 3/4 pelo `vision.py shot`.
- Sem intermediário nesta etapa.

Ponto em aberto: a janela do parry no jogo é de 0,2 s (24 passos a 120 Hz). As poses-chave do piloto devem respeitar esse marco, vindo de `config.js`, e não o contrário.
