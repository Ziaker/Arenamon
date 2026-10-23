"""Os 12 principios da animacao como GERADOR DE PERGUNTAS VISUAIS (nao como 12 testes numericos).

Cada principio vira uma pergunta concreta, com os frames e as vistas que o agente deve abrir, a medida relevante (quando existe) e o que a
medida NAO responde. Nada aqui produz nota, aprovacao ou 'passou': o status de toda pergunta e `pendente_de_leitura_visual` ate o agente
registrar a leitura no diagnostico (perception_diagnosis.py), que por sua vez exige imagens realmente observadas.
"""
from __future__ import annotations

from typing import Any

PRINCIPIOS = ["squash_and_stretch", "anticipation", "staging", "straight_ahead_pose_to_pose", "follow_through_overlapping", "slow_in_slow_out",
              "arcs", "secondary_action", "timing", "exaggeration", "solid_drawing", "appeal"]


def _q(principio, pergunta, frames, regioes, medidas, limite, aplicavel=True, nota=None):
    return {"principio": principio, "aplicavel": aplicavel, "pergunta_visual": pergunta, "frames": sorted(set(frames)), "regioes_para_abrir": regioes,
            "medidas_relacionadas": medidas, "a_medida_nao_responde": limite, "status": "pendente_de_leitura_visual", **({"nota": nota} if nota else {})}


def build_questions(motion: dict[str, Any], key_frames: list[int] | None = None, fps: float = 30.0) -> list[dict[str, Any]]:
    """motion = motion_report.json. Devolve perguntas na ordem dos principios."""
    fases = {p["fase"]: p["frames"] for p in motion["fases"]["fases"]}
    pico = (motion["fases"].get("pico") or {}).get("frame")
    ant = motion["antecipacao"]
    f0_, f1_ = motion["frames"]
    if pico is None:  # sem movimento mensuravel do efetuador: nao ha pico; as perguntas usam o inicio e o fim do clipe
        pico = f0_
    seq = motion["sequencia_do_corpo"]
    f0, f1 = motion["frames"]
    around_peak = [f for f in (pico - 2, pico - 1, pico, pico + 1, pico + 2) if pico is not None and f0 <= f <= f1]
    pre = fases.get("antecipacao_candidata") or fases.get("aceleracao_candidata") or [f0, f0 + 3]
    pre_frames = [pre[0], pre[1]]
    qs = []
    deform = motion["deformacao"]
    qs.append(_q("squash_and_stretch", "O volume da malha se comprime/estica de modo coerente com o impacto, ou a deformacao observada nas imagens e um defeito de rig?",
                 sorted({e["frame"] for e in deform["eventos"]}) or around_peak, ["corpo_todo"],
                 ["motion.deformacao.eventos", "motion.deformacao.inesperados"],
                 "se a deformacao foi pedida pelo diretor; 'documentada' so significa que foi declarada",
                 aplicavel=bool(deform["eventos"]), nota=None if deform["eventos"] else "sem escala de pose nem esticamento de osso acima do limite: nada a avaliar (nao significa ausencia de squash/stretch no desenho da pose)"))
    qs.append(_q("anticipation", "Antes da acao principal, o corpo INTEIRO (nao so o efetuador) se prepara de modo que um observador entenda o que vem? Ou a acao ja comeca sem aviso?",
                 pre_frames + [f0], ["corpo_todo", "tronco_quadril"], ["motion.antecipacao.razao_recuo_curso", "motion.antecipacao.frames_de_recuo", "motion.fases.fases"],
                 "se o recuo medido e LEGIVEL, exagerado ou longo demais; um clipe que comeca ja em movimento pode ser escolha deliberada"))
    qs.append(_q("staging", "A silhueta dos frames-chave comunica a acao e quem a faz? Alguma parte importante fica escondida (cabeca/chapeu, braco atras do tronco)?",
                 [f0, pico or f0, f1] + around_peak[:1], ["corpo_todo"], ["investigation.regions.*.views.*.occluded_by", "investigation.regions.*.final.frames_not_observed"],
                 "legibilidade para uma pessoa; a ocultacao medida diz O QUE esconde e em que fracao, nao se isso prejudica"))
    kf = key_frames or []
    qs.append(_q("straight_ahead_pose_to_pose", "A sequencia parece feita por poses-chave com interpolacao, ou por quadros continuos? Ha poses de 'parada' que dao ritmo ou congelamentos acidentais?",
                 kf[:12] or [f0, f1], ["corpo_todo"], ["pose_track.key_frames"],
                 "intencao; poucas chaves podem ser decisao de estilo", aplicavel=bool(kf), nota=None if kf else "sem lista de chaves da action"))
    qs.append(_q("follow_through_overlapping", "Apos o pico, partes do corpo continuam e assentam em tempos diferentes (arrasto), ou tudo para junto? A cabeca/chapeu acompanha?",
                 [pico or f0] + list(range((pico or f0) + 1, min((pico or f0) + 8, f1 + 1))), ["corpo_todo", "cabeca"],
                 ["motion.fases.fases", "motion.sequencia_do_corpo.defasagem_total_frames"], "se o arrasto e agradavel; so mostra se existe e quando"))
    qs.append(_q("slow_in_slow_out", "Nos extremos do golpe a velocidade aumenta e diminui gradualmente (entrada/saida suave) ou ha arranque/parada secos?",
                 around_peak or [f0], ["corpo_todo"], ["motion.snap"], "o gosto por arranque seco (impacto) ou suave; so classifica rampa x salto isolado"))
    qs.append(_q("arcs", "O caminho da mao/membro e do corpo forma um arco natural ou tem quinas? Veja varios frames consecutivos na mesma vista.",
                 list(range(max(f0, (pico or f0) - 4), min(f1, (pico or f0) + 4) + 1)), ["ombros_bracos_D", "ombros_bracos_E"], ["motion.arco.quinas_em_velocidade", "motion.arco.virada_max_graus"],
                 "se a quina e erro ou escolha; a trajetoria do efetuador nao e o arco do corpo inteiro"))
    qs.append(_q("secondary_action", "Alem da acao principal, ha acao secundaria (cabeca, braco livre, tronco) que reforca ou compete com a leitura?",
                 [pico or f0, f1], ["cabeca", "ombros_bracos_E", "tronco_quadril"], ["motion.sequencia_do_corpo.onset_by_alpha"],
                 "se ajuda ou atrapalha; so diz quando cada segmento comeca a se mover"))
    dur = (f1 - f0 + 1) / fps
    qs.append(_q("timing", "A distribuicao de tempo entre preparar, executar e recuperar deixa a acao legivel? Alguma fase e curta demais para ser percebida?",
                 [p[0] for p in fases.values()] + [f1], ["corpo_todo"], ["motion.fases.fases"], "o ritmo desejado; duracao total ~%.2f s (%d frames a %g fps)" % (dur, f1 - f0 + 1, fps)))
    qs.append(_q("exaggeration", "O exagero (queda, extensao, escala do gesto) e claramente intencional e coerente com o personagem, ou parece deformacao acidental?",
                 [f0, pico or f0, f1], ["corpo_todo"], ["motion.antecipacao.curso_m", "motion.deformacao.eventos"], "o limite aceitavel de exagero: e decisao artistica do diretor"))
    qs.append(_q("solid_drawing", "Em vistas independentes, o volume do corpo permanece claro (nenhuma parte colapsa, atravessa ou some)? Em caso de atravessamento, distinga de oclusao.",
                 [pico or f0] + around_peak, ["tronco_quadril", "ombros_bracos_D", "ombros_bracos_E"], ["contacts.rows", "motion.chao.por_rotulo", "investigation.regions.*.views.*.occluded_by"],
                 "penetracao so e HIPOTESE geometrica; confirme em imagem onde a interseccao e visivel"))
    qs.append(_q("appeal", "O conjunto e carismatico e consistente com o personagem?", [pico or f0], ["corpo_todo"], [],
                 "tudo: e preferencia estetica e exige referencia aprovada pelo diretor; sem referencia, so descrever, nunca aprovar", nota="sem referencia aprovada: nao ha como julgar"))
    return qs
