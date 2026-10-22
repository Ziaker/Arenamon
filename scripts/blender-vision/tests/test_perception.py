"""Testes unitarios puros (sem Blender) da percepcao ativa, da analise de movimento, do validador de diagnostico e das referencias.

  python scripts/blender-vision/tests/test_perception.py        (unittest; roda com o Python do sistema + numpy + PIL)

Cobre: laco de investigacao com observador simulado (pede nova vista, para por suficiencia/limite/ganho zero, nunca declara
suficiente por cansaco), independencia de vistas, antecipacao/snap/arco/sequenciamento/deformacao com sinais analiticos, regras de
rejeicao do diagnostico (leitura, regiao nao observada, vistas, texto generico, aprovacao sem referencia, correcao aplicada),
referencias (aprovacao obrigatoria, escopo, nada de veredito global) e imagens/dados invalidos.
"""
import json
import math
import os
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import perception_diagnosis as D  # noqa: E402
import perception_geom as G  # noqa: E402
import perception_motion as M  # noqa: E402
import perception_principles as PR  # noqa: E402
import perception_refs as RF  # noqa: E402


def view(name, direction, vis_by_frame, clip=0.0):
    return {"name": name, "direction": direction, "per_frame": {f: {"visible_frac": v, "clipped_frac": clip} for f, v in vis_by_frame.items()}}


FR = G.body_frame({"RightUpLeg": [-0.1, 0, 0.9], "LeftUpLeg": [0.1, 0, 0.9]})
CANDS = {c["name"]: c for c in G.candidate_views(FR)}


class TestGeom(unittest.TestCase):
    def test_body_frame_faces_minus_y(self):
        self.assertAlmostEqual(FR["forward"][1], -1.0, places=6)  # direita do personagem = -X, olha para -Y
        self.assertAlmostEqual(FR["right"][0], -1.0, places=6)

    def test_candidates_cover_sides_and_top(self):
        names = set(CANDS)
        for n in ("frente_e12", "lado_D_e12", "lado_E_e12", "tras_e12", "topo", "q3_frente_D_e35"):
            self.assertIn(n, names)
        front, side = CANDS["frente_e12"]["direction"], CANDS["lado_D_e12"]["direction"]
        self.assertGreater(G.angle_between_vectors_deg(front, side), 80)

    def test_near_identical_views_are_not_independent(self):
        a = CANDS["frente_e12"]["direction"]
        b = CANDS["frente_e35"]["direction"]            # mesma frente com 23 graus de diferenca de elevacao
        self.assertFalse(G.independent_of(b, [a]))
        self.assertTrue(G.independent_of(CANDS["lado_D_e12"]["direction"], [a]))
        self.assertTrue(G.independent_of(CANDS["tras_e12"]["direction"], [a]))   # opostas mostram superficies diferentes

    def test_assess_needs_two_independent_good_views_per_frame(self):
        v1 = view("frente_e12", CANDS["frente_e12"]["direction"], {1: 0.9, 2: 0.9})
        v2 = view("frente_e35", CANDS["frente_e35"]["direction"], {1: 0.95, 2: 0.95})   # quase igual: nao conta como 2a evidencia
        r = G.assess([v1, v2], [1, 2])
        self.assertEqual(r["status"], "OBSERVADO_PARCIAL")
        self.assertEqual(r["frames_one_view"], [1, 2])
        v3 = view("lado_D_e12", CANDS["lado_D_e12"]["direction"], {1: 0.8, 2: 0.2})
        r = G.assess([v1, v2, v3], [1, 2])
        self.assertEqual(r["frames_ok"], [1])
        self.assertEqual(r["frames_one_view"], [2])

    def test_clipped_view_is_not_good(self):
        v1 = view("frente_e12", CANDS["frente_e12"]["direction"], {1: 0.9}, clip=0.3)
        self.assertFalse(G.frame_good(v1, 1, 0.6, 0.02))
        self.assertEqual(G.assess([v1], [1])["status"], "NAO_OBSERVAVEL")

    def test_loop_requests_new_view_and_stops_when_sufficient(self):
        world = {"frente_e12": {1: 0.1}, "lado_D_e12": {1: 0.9}, "tras_e12": {1: 0.8}, "lado_E_e12": {1: 0.7}}

        def mk(n):
            return view(n, CANDS[n]["direction"], world.get(n, {1: 0.0}))
        asked = []

        def observe(vs):
            asked.append([v["name"] for v in vs])
            return [mk(v["name"]) for v in vs]

        def probe():
            return [dict(mk(n), visible_mean=world[n][1]) for n in world]
        r = G.investigate([{"name": "frente_e12"}, {"name": "lado_D_e12"}], [1], probe, observe, max_rounds=3)
        self.assertEqual(r["final"]["status"], "OBSERVADO_SUFICIENTE")
        self.assertGreaterEqual(len(r["rounds"]), 2)
        self.assertEqual(asked[0], ["frente_e12", "lado_D_e12"])
        self.assertIn("tras_e12", asked[1] + (asked[2] if len(asked) > 2 else []))

    def test_loop_never_declares_sufficient_when_nothing_sees_the_region(self):
        world = {n: {1: 0.0} for n in ("frente_e12", "lado_D_e12", "tras_e12", "lado_E_e12")}

        def observe(vs):
            return [view(v["name"], CANDS[v["name"]]["direction"], world[v["name"]]) for v in vs]

        def probe():
            return [dict(view(n, CANDS[n]["direction"], world[n]), visible_mean=0.0) for n in world]
        r = G.investigate([{"name": "frente_e12"}, {"name": "lado_D_e12"}], [1], probe, observe, max_rounds=3)
        self.assertEqual(r["final"]["status"], "NAO_OBSERVAVEL")
        self.assertNotIn("suficiente", r["stop_reason"])

    def test_loop_respects_round_limit(self):
        # sempre ha uma candidata nova com visibilidade, mas so 1 por vez e todas quase colineares entre si
        names = ["frente_e12", "q3_frente_D_e12", "lado_D_e12", "q3_tras_D_e12", "tras_e12"]
        vis = {n: {1: 0.5} for n in names}      # nunca chega a 0.6

        def observe(vs):
            return [view(v["name"], CANDS[v["name"]]["direction"], vis[v["name"]]) for v in vs]

        def probe():
            return [dict(view(n, CANDS[n]["direction"], vis[n]), visible_mean=0.5) for n in names]
        r = G.investigate([{"name": "frente_e12"}], [1], probe, observe, max_rounds=2)
        self.assertLessEqual(len(r["rounds"]), 3)
        self.assertNotEqual(r["final"]["status"], "OBSERVADO_SUFICIENTE")

    def test_fit_span_contains_points(self):
        b = G.camera_basis(CANDS["frente_e12"]["direction"])
        pts = [[0.3, 0, 0], [-0.3, 0, 0.2], [0, 0, -0.2]]
        s = G.fit_span(pts, b, margin=1.3, floor=0.1)
        self.assertGreater(s, 2 * 0.3 * 1.3 - 1e-3)

    def test_bone_label_mapping(self):
        self.assertEqual(G.label_of_bone("mixamorig:RightHandIndex2"), "hand_R")
        self.assertEqual(G.label_of_bone("LeftToeBase"), "foot_L")
        self.assertEqual(G.label_of_bone("Spine1"), "torso")
        self.assertIsNone(G.label_of_bone("Cape1"))


def pose_from(paths, extra_joints=None, n=None, quats=None):
    """pose sintetica minima: Hips parado; juntas dadas por caminhos {nome: array(n,3)}"""
    n = n or len(next(iter(paths.values())))
    z = np.zeros((n, 3))
    J = {"Hips": z.copy(), "Spine2": z + [0, 0, 0.4], "RightArm": z + [-0.25, 0, 0.4], "RightForeArm": z + [-0.5, 0, 0.4], "RightHand": z + [-0.8, 0, 0.4],
         "LeftArm": z + [0.25, 0, 0.4], "LeftForeArm": z + [0.5, 0, 0.4], "LeftHand": z + [0.8, 0, 0.4]}
    J.update({k: np.asarray(v, float) for k, v in paths.items()})
    ident = np.tile([1.0, 0, 0, 0], (n, 1))
    Q = {k: ident.copy() for k in ("Hips", "Spine2", "RightArm", "RightForeArm", "RightHand", "LeftArm", "LeftForeArm", "LeftHand")}
    Q.update(quats or {})
    return {"frames": list(range(1, n + 1)), "joints": {k: v.tolist() for k, v in J.items()}, "quat": {k: v.tolist() for k, v in Q.items()},
            "pose_scale": {"Hips": np.ones((n, 3)).tolist()}, "bone_length": {"Hips": np.ones(n).tolist()}, "mesh_centroid": z.tolist(),
            "label_min_z": {l: [0.0] * n for l in G.LABELS}, "floor_z": 0.0, "fps": 30}


def line(n, a, b, frames_move):
    """mao parada em a, move linearmente para b entre frames_move (indices), depois para"""
    p = np.tile(np.asarray(a, float), (n, 1))
    f0, f1 = frames_move
    for i in range(n):
        t = 0.0 if i <= f0 else 1.0 if i >= f1 else (i - f0) / float(f1 - f0)
        p[i] = np.asarray(a) + t * (np.asarray(b) - np.asarray(a))
    return p


class TestMotion(unittest.TestCase):
    def test_snap_isolated_vs_ramp(self):
        n = 30
        snap = line(n, [-0.8, 0, 0.4], [-0.8, -0.6, 0.4], (9, 10))
        ev = M.snap_events(snap, list(range(1, n + 1)))
        self.assertTrue(any(e["classe"] == "salto_isolado" for e in ev))
        t = np.linspace(0, 1, 6)
        eased = (3 * t ** 2 - 2 * t ** 3)
        p = np.tile([-0.8, 0, 0.4], (n, 1)).astype(float)
        for i in range(n):
            u = 0.0 if i < 7 else 1.0 if i >= 12 else eased[i - 7]
            p[i, 1] = -0.6 * u
        ev = M.snap_events(p, list(range(1, n + 1)))
        self.assertFalse(any(e["classe"] == "salto_isolado" for e in ev))
        self.assertTrue(any(e["classe"] == "rapido_com_rampa" for e in ev))

    def test_anticipation_present_and_absent(self):
        n = 30
        fr = list(range(1, n + 1))
        absent = line(n, [0, 0, 0], [0, -0.6, 0], (8, 14))
        self.assertFalse(M.anticipation(absent, fr)["presente"])
        p = np.zeros((n, 3))
        for i in range(n):
            y = 0.0 if i < 4 else 0.15 * (i - 4) / 5.0 if i < 9 else 0.15 - 0.75 * (i - 9) / 5.0 if i < 14 else -0.6
            p[i, 1] = y
        r = M.anticipation(p, fr)
        self.assertTrue(r["presente"])
        self.assertGreater(r["razao_recuo_curso"], 0.12)

    def test_stationary_effector_has_no_claims(self):
        p = np.zeros((10, 3))
        r = M.anticipation(p, list(range(1, 11)))
        self.assertIsNone(r["presente"])
        self.assertEqual(M.phase_hypotheses(p, list(range(1, 11)))["fases"], [])
        self.assertEqual(M.snap_events(p, list(range(1, 11))), [])

    def test_arc_smooth_vs_corner(self):
        n = 30
        fr = list(range(1, n + 1))
        ang = np.linspace(0, math.pi / 2, n)
        arc = np.stack([np.sin(ang), -np.cos(ang) + 1, np.zeros(n)], 1)
        self.assertEqual(M.arc_continuity(arc, fr)["classe"], "arco_continuo")
        corner = np.zeros((n, 3))
        for i in range(n):
            corner[i] = [0.05 * min(i, 10), 0.0, 0.05 * max(0, i - 10)]
        r = M.arc_continuity(corner, fr)
        self.assertEqual(r["classe"], "mudanca_abrupta")
        self.assertAlmostEqual(r["quinas_em_velocidade"][0]["virada_graus"], 90.0, delta=1.0)

    def test_phase_never_chooses_contact(self):
        p = line(30, [0, 0, 0], [0, -0.6, 0], (8, 14))
        ph = M.phase_hypotheses(p, list(range(1, 31)))
        self.assertIsNone(ph["contact_frame"])
        self.assertTrue(all(x["status"] == "HIPOTESE" for x in ph["fases"]))
        self.assertIn("NAO e frame de contato", " ".join(x["base"] for x in ph["fases"] if x["fase"] == "pico_de_movimento"))

    def test_body_sequence_onsets(self):
        n = 30
        # mao se move a partir do indice 5; tronco gira (quaternion) a partir do indice 12
        hand = np.zeros((n, 3))
        hand[:, 0] = -0.8
        hand[5:, 1] = -0.04 * np.arange(0, n - 5)
        q = np.tile([1.0, 0, 0, 0], (n, 1))
        for i in range(12, n):
            a = math.radians(1.5 * (i - 11))
            q[i] = [math.cos(a / 2), 0, 0, math.sin(a / 2)]
        pose = pose_from({"RightHand": hand}, quats={"Spine2": q})
        r = M.body_sequence(pose, "Right")
        self.assertEqual(r["mao_vs_tronco"], "mao_antes_do_tronco")
        self.assertIn("onset_by_alpha", r)

    def test_deformation_declared_vs_unexpected(self):
        pose = pose_from({"RightHand": np.zeros((10, 3))})
        pose["pose_scale"]["Spine1"] = [[1, 1, 1]] * 4 + [[1, 1.4, 1]] * 3 + [[1, 1, 1]] * 3
        r = M.deformation_report(pose, [])
        self.assertGreater(r["inesperados"], 0)
        r2 = M.deformation_report(pose, [{"bones": ["Spine1"], "frames": [5, 7], "kind": "stretch"}])
        self.assertEqual(r2["inesperados"], 0)
        self.assertEqual(r2["documentados"], 3)

    def test_foot_classes(self):
        pose = pose_from({"RightHand": np.zeros((4, 3))})
        pose["label_min_z"]["foot_L"] = [0.0, 0.02, 0.08, None]
        cl = [r["classe"] for r in M.foot_ground(pose, "Left")["rows"]]
        self.assertEqual(cl, ["apoiado", "proximo_ambiguo", "suspenso", "sem_geometria"])

    def test_ground_penetration_measured_per_label(self):
        pose = pose_from({"RightHand": np.zeros((4, 3))})
        pose["floor_z"] = 0.01
        pose["label_min_z"]["hand_R"] = [0.5, 0.0, -0.19, -0.2]
        pose["label_min_z"]["foot_L"] = [0.009, 0.01, 0.005, 0.0]   # sola ate 1 cm abaixo do plano e tolerada
        g = M.ground_penetration(pose)
        self.assertEqual(g["por_rotulo"]["hand_R"]["frames"], [3, 4])
        self.assertAlmostEqual(g["por_rotulo"]["hand_R"]["prof_max_m"], 0.21, places=3)
        self.assertNotIn("foot_L", g["por_rotulo"])

    def test_missing_bones_fail_loudly(self):
        pose = pose_from({"RightHand": np.zeros((5, 3))})
        del pose["joints"]["RightForeArm"]
        with self.assertRaises(KeyError):
            M.body_sequence(pose, "Right")


MOTION = {"frames": [1, 30], "fases": {"fases": [{"fase": "aceleracao_candidata", "frames": [3, 7], "base": "x", "status": "HIPOTESE"}], "pico": {"frame": 8}},
          "antecipacao": {"presente": False, "razao_recuo_curso": 0.0, "frames_de_recuo": 0},
          "sequencia_do_corpo": {"defasagem_total_frames": 3, "onset_by_alpha": {}, "ordem": []},
          "deformacao": {"eventos": [], "inesperados": 0, "documentados": 0}, "arco": {"quinas_em_velocidade": [], "virada_max_graus": 10}, "snap": []}


class TestPrinciples(unittest.TestCase):
    def test_twelve_principles_questions_without_scores(self):
        qs = PR.build_questions(MOTION, [1, 8, 30], 30.0)
        self.assertEqual([q["principio"] for q in qs], PR.PRINCIPIOS)
        for q in qs:
            self.assertEqual(q["status"], "pendente_de_leitura_visual")
            self.assertNotIn("nota_final", q)
            self.assertTrue(q["a_medida_nao_responde"])
        self.assertFalse(next(q for q in qs if q["principio"] == "squash_and_stretch")["aplicavel"])

    def test_stationary_motion_does_not_crash(self):
        m = dict(MOTION, fases={"fases": [], "contact_frame": None})
        qs = PR.build_questions(m, None, 30.0)
        self.assertEqual(len(qs), 12)


def bundle_and_files(tmp, vis_front=0.9, vis_side=0.9, token_ok=True, clipped=0.0):
    inv = {"params": {"min_visible": 0.6, "max_clipped": 0.02}, "regions": {}}
    sheets = []
    for nm, dirn, vis, tok in (("frente_e12", CANDS["frente_e12"]["direction"], vis_front, "AAAAA"), ("lado_D_e12", CANDS["lado_D_e12"]["direction"], vis_side, "BBBBB")):
        sheets.append({"file": "sheets/folha_mao_D_%s.png" % nm, "kind": "rgb", "region": "mao_D", "view": nm, "token": tok, "frames": [10, 11, 12], "direction": dirn,
                       "per_frame": {str(f): {"visible_frac": vis, "clipped_frac": clipped} for f in (10, 11, 12)}})
    sheets.append({"file": "sheets/passes_mao_D_frente_e12.png", "kind": "passes", "region": "mao_D", "view": "frente_e12", "token": "CCCCC", "frames": [10, 11, 12]})
    motion = {"antecipacao": {"presente": False}}
    return {"investigation": inv, "index": {"sheets": sheets}, "motion": motion}


def good_entry(**over):
    e = {"id": "d1", "region": "mao_D", "frames": [10, 11],
         "A_visivel": {"descricao": "Nas folhas frente e lado D, a mao direita aparece aberta e abaixo da linha do ombro em g10-g11, sem o antebraco cobrir os dedos.",
                       "folhas": [{"file": "sheets/folha_mao_D_frente_e12.png", "leitura": "aaaaa"}, {"file": "sheets/folha_mao_D_lado_D_e12.png", "leitura": "BBBBB"}]},
         "B_interpretacao": "A mao ainda nao iniciou o golpe: indica preparacao curta antes do avanco do braco.",
         "C_dados": {"medicoes": ["motion.antecipacao.presente"]}, "D_alternativas": ["A pose pode ser o inicio de um golpe lento, nao uma preparacao"],
         "E_falta_observar": [], "F_correcao": {"descricao": "Investigar um recuo maior do braco antes do avanco", "aplicada": False},
         "G_sustentacao": {"nivel": "observacao_visual", "justificativa": "Duas vistas independentes com a mao visivel nos dois frames citados."}}
    e.update(over)
    return e


class TestDiagnosis(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def check(self, entry, bundle=None):
        b = bundle or bundle_and_files(self.tmp)
        return D.validate({"entries": [entry]}, b, self.tmp)["entries"][0]

    def test_good_entry_is_accepted(self):
        r = self.check(good_entry())
        self.assertEqual(r["status"], "ACEITO", r["motivos"])

    def test_wrong_reading_code_is_rejected(self):
        e = good_entry()
        e["A_visivel"]["folhas"][0]["leitura"] = "ZZZZZ"
        r = self.check(e)
        self.assertEqual(r["status"], "REJEITADO")
        self.assertTrue(any("codigo de leitura" in m for m in r["motivos"]))

    def test_single_view_cannot_support_visual_observation(self):
        e = good_entry()
        e["A_visivel"]["folhas"] = e["A_visivel"]["folhas"][:1]
        r = self.check(e)
        self.assertEqual(r["status"], "REJEITADO")
        self.assertTrue(any("2 vistas independentes" in m for m in r["motivos"]))

    def test_region_not_observed_is_rejected(self):
        b = bundle_and_files(self.tmp, vis_front=0.1)   # mao escondida na vista frontal
        r = self.check(good_entry(), b)
        self.assertEqual(r["status"], "REJEITADO")

    def test_clipped_view_does_not_count(self):
        b = bundle_and_files(self.tmp, clipped=0.3)
        self.assertEqual(self.check(good_entry(), b)["status"], "REJEITADO")

    def test_choreographic_hypothesis_with_one_view_needs_what_is_missing(self):
        e = good_entry(G_sustentacao={"nivel": "hipotese_coreografica", "justificativa": "Apenas a vista lateral mostra a mao com clareza nos frames citados."})
        e["A_visivel"]["folhas"] = e["A_visivel"]["folhas"][1:]
        self.assertEqual(self.check(e)["status"], "REJEITADO")           # falta E
        e["E_falta_observar"] = ["uma segunda vista independente (tras ou q3) para confirmar o recuo"]
        self.assertEqual(self.check(e)["status"], "ACEITO")

    def test_generic_text_is_rejected(self):
        e = good_entry()
        e["A_visivel"]["descricao"] = "A animacao esta fluida e o impacto esta forte em todos os frames observados nas folhas citadas."
        r = self.check(e)
        self.assertEqual(r["status"], "REJEITADO")
        self.assertTrue(any("generico" in m for m in r["motivos"]))

    def test_correction_cannot_be_applied(self):
        r = self.check(good_entry(F_correcao={"descricao": "Mudei o recuo", "aplicada": True}))
        self.assertTrue(any("aplicada" in m for m in r["motivos"]))

    def test_artistic_approval_needs_approved_reference(self):
        r = self.check(good_entry(aprovacao_artistica=True))
        self.assertEqual(r["status"], "REJEITADO")
        self.assertTrue(any("referencia" in m for m in r["motivos"]))
        e = good_entry(G_sustentacao={"nivel": "preferencia_artistica", "justificativa": "Corresponde ao gosto do diretor segundo a referencia citada."})
        self.assertEqual(self.check(e)["status"], "REJEITADO")

    def test_unapproved_reference_is_not_enough(self):
        RF.add("ref_x", "x", "approved_example", "teste", ["timing"], None, refs_dir=self.tmp, fixture=True)  # sem approved_by
        r = self.check(good_entry(aprovacao_artistica=True, referencia_aprovada="ref_x", aspecto="timing"))
        self.assertTrue(any("nao esta aprovada" in m for m in r["motivos"]))

    def test_approved_reference_with_scope_passes_and_wrong_scope_fails(self):
        RF.add("ref_ok", "ok", "approved_example", "teste fixture", ["timing"], "Diretor (fixture de teste)", refs_dir=self.tmp, fixture=True)
        r = self.check(good_entry(aprovacao_artistica=True, referencia_aprovada="ref_ok", aspecto="timing"))
        self.assertEqual(r["status"], "ACEITO", r["motivos"])
        r = self.check(good_entry(aprovacao_artistica=True, referencia_aprovada="ref_ok", aspecto="silhouette"))
        self.assertTrue(any("apenas para" in m for m in r["motivos"]))

    def test_geometric_fact_needs_resolvable_measurement(self):
        e = good_entry(G_sustentacao={"nivel": "fato_geometrico", "justificativa": "A medicao de recuo e zero na trilha de poses do efetuador."})
        e["C_dados"]["medicoes"] = []
        self.assertEqual(self.check(e)["status"], "REJEITADO")
        e["C_dados"]["medicoes"] = ["motion.nao.existe"]
        self.assertTrue(any("nao existe nos relatorios" in m for m in self.check(e)["motivos"]))

    def test_unknown_sheet_and_wrong_region_sheet(self):
        e = good_entry()
        e["A_visivel"]["folhas"][0]["file"] = "sheets/inexistente.png"
        self.assertTrue(any("nao consta no indice" in m for m in self.check(e)["motivos"]))
        e = good_entry(region="tronco_quadril")
        self.assertEqual(self.check(e)["status"], "REJEITADO")

    def test_empty_diagnosis_and_missing_alternatives(self):
        self.assertEqual(D.validate({"entries": []}, bundle_and_files(self.tmp), self.tmp)["status"], "REJEITADO")
        self.assertEqual(self.check(good_entry(D_alternativas=[]))["status"], "REJEITADO")

    def test_frames_not_in_sheet_rejected(self):
        self.assertEqual(self.check(good_entry(frames=[10, 99]))["status"], "REJEITADO")

    def test_template_lists_only_applicable_questions(self):
        qs = PR.build_questions(MOTION, [1, 8], 30.0)
        t = D.template(qs, bundle_and_files(self.tmp))
        self.assertEqual(len(t["entries"]), sum(1 for q in qs if q["aplicavel"]))
        self.assertTrue(all(e["F_correcao"]["aplicada"] is False for e in t["entries"]))


class TestRefs(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def test_requires_scope_origin_and_justification(self):
        with self.assertRaises(RF.RefError):
            RF.add("a", "a", "approved_example", "", ["timing"], "x", refs_dir=self.tmp)
        with self.assertRaises(RF.RefError):
            RF.add("a", "a", "approved_example", "o", [], "x", refs_dir=self.tmp)
        with self.assertRaises(RF.RefError):
            RF.add("a", "a", "rejected_example", "o", [], "x", rejected_aspects=["timing"], refs_dir=self.tmp)

    def test_no_overwrite_and_unapproved_by_default(self):
        r = RF.add("a", "a", "approved_example", "o", ["timing"], None, refs_dir=self.tmp)
        self.assertFalse(r["approved"])
        with self.assertRaises(RF.RefError):
            RF.add("a", "a", "approved_example", "o", ["timing"], "x", refs_dir=self.tmp)

    def test_compare_refuses_unapproved_and_never_gives_global_verdict(self):
        mot = dict(MOTION)
        mot["antecipacao"] = {"presente": False, "razao_recuo_curso": 0.0}
        feats = RF.features_from_motion(mot)
        un = RF.add("u", "u", "approved_example", "o", ["timing"], None, feats, refs_dir=self.tmp)
        self.assertEqual(RF.compare(un, mot)["status"], "REFERENCIA_NAO_APROVADA")
        ok = RF.add("ok", "ok", "approved_example", "o", ["timing", "silhouette"], "Diretor (fixture)", feats, refs_dir=self.tmp, fixture=True)
        res = RF.compare(ok, mot)
        self.assertEqual(res["adequacao_artistica"], "NAO_AVALIADA")
        self.assertIn("timing", res["semelhanca_medida"])
        self.assertEqual(res["semelhanca_medida"]["silhouette"]["status"], "SEM_MEDIDA_AUTOMATICA")
        self.assertNotIn("veredito", res)
        self.assertNotIn("score", res)

    def test_rejection_is_scoped(self):
        r = RF.add("rej", "r", "rejected_example", "o", [], "Diretor", rejected_aspects=["anticipation"], justification="antecipacao curta demais", refs_dir=self.tmp)
        self.assertEqual(r["rejected_aspects"], ["anticipation"])
        self.assertEqual(r["scope"], [])


if __name__ == "__main__":
    unittest.main(verbosity=1)
