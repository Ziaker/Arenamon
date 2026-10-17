"""Testes unitários puros do Animation Witness.

Cobre:
- Avaliação multi-dimensional (geométrica, temporal, visual, artística, final);
- Regras de síntese fail-closed (falha fechada);
- Validador de utilidade visual de imagens;
- Independência geométrica de vistas (mínimo 35 graus);
- Câmera adaptativa com filtragem de colinearidade e solo;
- Matriz de exclusão anatômica para auto-colisão;
- Medição de torção da pelve (hips twist);
- Validador estrito de revisão de agentes (review).
"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
if PARENT not in sys.path:
    sys.path.insert(0, PARENT)

import witness_core as w
import witness_utility as util
import witness_camera as cam
import witness_review as review


def dummy_observation():
    frames = []
    for f in range(4):
        frames.append({
            "author_frame": f,
            "bones": {
                "Hips": {
                    "world_head": [float(f), 0, 0],
                    "body_head": [0, 0, 0],
                    "local_basis_quaternion": [1, 0, 0, 0.05 * f],
                    "local_scale": [1, 1, 1],
                },
                "RightHand": {
                    "world_head": [0.2, 0, 0.5],
                    "body_head": [0.02 * f, 0, 0],
                    "body_tail": [0.02 * f + 0.1, 0, 0],
                    "local_scale": [1, 1, 1],
                },
                "Spine": {"world_head": [0, 0, 0.4], "body_head": [0, 0, 0.4], "local_scale": [1, 1, 1]},
                "Spine2": {"world_head": [0, 0, 0], "body_head": [0.01 * f, 0, 0], "local_scale": [1, 1, 1]},
                "Head": {"world_head": [0, 0, 1.2], "body_head": [0, 0, 1.2], "local_scale": [1, 1, 1]},
                "RightForeArm": {"world_head": [0.2, 0.2, 0.6], "world_tail": [0.2, 0, 0.5]},
                "FingerA": {"body_tail": [0.15, 0.05, 0.0]},
                "FingerB": {"body_tail": [0.15, -0.05, 0.0]},
            },
        })
    return {
        "scene": {"actions": ["idle", "Attack"]},
        "action": {"frame_count": 4},
        "rig": {"digit_chains": {"Right": [["FingerA"], ["FingerB"]], "Left": []}},
        "frames": frames,
        "target": None,
        "self_collision": [],
    }


def test_baseline_and_fail_closed():
    spec = {"name": "test_spec", "claims": [
        {"id": "frames", "type": "frame_count", "expected": 4, "statement": "frames"},
        {"id": "contact_no_target", "type": "target_contact_window", "frames": [0, 3], "statement": "contact"},
        {"id": "art_no_ref", "type": "artistic_judgement", "statement": "good attack"},
        {"id": "unknown_future", "type": "future_unknown_rule", "statement": "unknown"},
        {"id": "root_move", "type": "root_displacement", "statement": "root displacement"},
        {"id": "claw_spread", "type": "hand_configuration", "side": "Right", "frames": [0, 2],
         "statement": "claw spread", "min_tip_distance_over_palm": 0.5,
         "requires_approved_criterion": True, "criterion_status": "proposed"},
    ]}
    res = w.evaluate(dummy_observation(), spec)
    by_id = {x["claim_id"]: x for x in res["claims"]}

    assert by_id["frames"]["status"] == w.PROVEN
    assert by_id["contact_no_target"]["status"] == w.UNPROVABLE
    assert "alvo" in " ".join(by_id["contact_no_target"]["missing"])
    assert by_id["art_no_ref"]["status"] == w.UNPROVABLE
    assert by_id["unknown_future"]["status"] == w.UNPROVABLE
    assert by_id["root_move"]["status"] == w.MEASURED
    assert by_id["claw_spread"]["status"] == w.MEASURED  # proposto -> nunca aprovado direto
    assert res["policy"]["unknown_claims_fail_closed"] is True
    print("PASS: test_baseline_and_fail_closed")


def test_multi_dimensional_fields():
    spec = {"name": "dimensions", "claims": [
        {"id": "c1", "type": "frame_count", "expected": 4, "statement": "frames"},
        {"id": "c2", "type": "target_contact_window", "frames": [0, 2], "statement": "contact"},
        {"id": "c3", "type": "artistic_judgement", "statement": "art"},
    ]}
    res = w.evaluate(dummy_observation(), spec)
    for c in res["claims"]:
        assert "geometric_status" in c
        assert "temporal_status" in c
        assert "visual_status" in c
        assert "artistic_status" in c
        assert "criterion_status" in c
    by_id = {x["claim_id"]: x for x in res["claims"]}
    assert by_id["c1"]["geometric_status"] == w.PROVEN
    assert by_id["c2"]["geometric_status"] == w.UNPROVABLE
    assert by_id["c3"]["artistic_status"] == w.ART_NO_REF
    print("PASS: test_multi_dimensional_fields")


def test_view_independence():
    # 90 graus
    ok90, a90 = util.are_views_independent([1, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0])
    assert ok90 is True and abs(a90 - 90.0) < 0.1

    # Mesmo ângulo, distância diferente (colinear)
    ok_col, a_col = util.are_views_independent([2, 0, 0], [0, 0, 0], [4, 0, 0], [0, 0, 0])
    assert ok_col is False and abs(a_col - 0.0) < 0.1

    # 30 graus (abaixo do limiar de 35)
    import math
    v30 = [math.cos(math.radians(30)), math.sin(math.radians(30)), 0]
    ok30, a30 = util.are_views_independent([1, 0, 0], [0, 0, 0], v30, [0, 0, 0])
    assert ok30 is False and abs(a30 - 30.0) < 0.5

    # 45 graus (acima do limiar de 35)
    v45 = [math.cos(math.radians(45)), math.sin(math.radians(45)), 0]
    ok45, a45 = util.are_views_independent([1, 0, 0], [0, 0, 0], v45, [0, 0, 0])
    assert ok45 is True and abs(a45 - 45.0) < 0.5
    print("PASS: test_view_independence")


def test_visual_utility_validator():
    # Borda: ponto fora do quadro ou perigosamente na borda
    pts_ok = [[256, 256], [200, 220]]
    ok, min_d, r = util.check_edge_clipping(pts_ok, 512, 512, 0.05)
    assert ok is True and not r

    pts_clipped = [[10, 256], [256, 256]]  # 10px < 512*0.05 (25.6px)
    ok_clip, min_d_clip, r_clip = util.check_edge_clipping(pts_clipped, 512, 512, 0.05)
    assert ok_clip is False and len(r_clip) > 0

    # Separação projetada de dedos
    tips_open = [[100, 100], [130, 100]]
    s_ok, d_ok, _ = util.check_projected_separation(tips_open, min_pixel_distance=8.0)
    assert s_ok is True and d_ok == 30.0

    tips_collapsed = [[100, 100], [103, 102]]
    s_bad, d_bad, reason = util.check_projected_separation(tips_collapsed, min_pixel_distance=8.0)
    assert s_bad is False
    assert "REJEITADA_COLAPSO_PROJETADO" in reason

    # Avaliação completa de visão
    info = {
        "view_name": "front",
        "image_width": 512,
        "image_height": 512,
        "keypoints_2d": [[256, 256]],
        "digit_tips_2d": [[240, 256], [260, 256]],
        "cam_location_z": 0.5,
        "target_pixels": 400,
        "is_forearm_collinear": False,
    }
    res_util = util.evaluate_view_utility(info)
    assert res_util["is_useful"] is True
    assert res_util["utility_score"] == 1.0

    # Caso com câmera no chão (Z < 0.05)
    info_ground = dict(info, cam_location_z=0.01)
    res_ground = util.evaluate_view_utility(info_ground)
    assert res_ground["is_useful"] is False
    assert any("REJEITADA_SOLO" in x for x in res_ground["rejection_reasons"])
    print("PASS: test_visual_utility_validator")


def test_adaptive_camera():
    wrist = [0.2, 0.0, 0.5]
    palm = [0.2, -0.08, 0.5]
    forearm = [0.2, 0.3, 0.7]
    tips = [[0.22, -0.20, 0.52], [0.18, -0.20, 0.48]]

    ac = cam.AdaptiveHandCamera(wrist, palm, forearm, tips)
    center, span = ac.compute_center_and_span()
    assert span >= 0.25
    assert center[1] < palm[1]  # Centro deslocado para a frente em direção às pontas

    candidates = ac.generate_candidates()
    assert len(candidates) >= 5

    # Seleção de independentes
    best = ac.select_best_independent_views(count=2, min_angle_deg=35.0)
    assert len(best) == 2
    indep, ang = util.are_views_independent(best[0]["location"], best[0]["target"],
                                           best[1]["location"], best[1]["target"])
    assert indep is True
    assert ang >= 35.0
    print("PASS: test_adaptive_camera")


def test_anatomical_exclusion_and_self_collision():
    # Juntas adjacentes não colidem
    assert w.is_anatomically_adjacent("RightHand", "RightForeArm") is True
    assert w.is_anatomically_adjacent("Hips", "Spine") is True
    assert w.is_anatomically_adjacent("LeftUpLeg", "LeftLeg") is True
    assert w.is_anatomically_adjacent("RightHand", "RightHandIndex1") is True

    # Partes não conectadas
    assert w.is_anatomically_adjacent("RightHand", "Head") is False
    assert w.is_anatomically_adjacent("RightHand", "Spine") is False
    assert w.is_anatomically_adjacent("RightHand", "LeftHand") is False

    obs = dummy_observation()
    # Adiciona colisão não-adjacente severa (RightHand interpenetrando Spine em 2cm)
    obs["self_collision"] = [
        {"frame": 1, "part_a": "RightHand", "part_b": "Spine", "penetration_m": 0.02, "distance_m": 0.0},
        {"frame": 1, "part_a": "RightHand", "part_b": "RightForeArm", "penetration_m": 0.05, "distance_m": 0.0},
    ]

    spec = {"name": "collision", "claims": [
        {"id": "no_self_penetration", "type": "self_collision", "max_penetration_m": 0.005,
         "statement": "sem auto-penetração severa"},
    ]}
    res = w.evaluate(obs, spec)
    claim = res["claims"][0]
    # RightHand-RightForeArm foi ignorado pela matriz, mas RightHand-Spine disparou REFUTADO
    assert claim["status"] == w.REFUTED
    assert "penetração excessiva" in " ".join(claim["limitations"])

    # Sem colisões mas sem cobertura de malha declarada -> fail-closed (NAO_COMPROVAVEL)
    obs_safe = dummy_observation()
    obs_safe["self_collision"] = []
    obs_safe["self_collision_full_mesh_coverage"] = False
    res_safe = w.evaluate(obs_safe, spec)
    assert res_safe["claims"][0]["status"] == w.UNPROVABLE
    assert "proxy de ossos" in " ".join(res_safe["claims"][0]["limitations"])

    # Sem colisões COM cobertura de malha declarada -> COMPROVADO
    obs_mesh = dummy_observation()
    obs_mesh["self_collision"] = []
    obs_mesh["self_collision_full_mesh_coverage"] = True
    res_mesh = w.evaluate(obs_mesh, spec)
    assert res_mesh["claims"][0]["status"] == w.PROVEN
    print("PASS: test_anatomical_exclusion_and_self_collision")


def test_pelvis_twist():
    obs = dummy_observation()
    spec = {"name": "twist", "claims": [
        {"id": "hips_yaw", "type": "pelvis_twist", "min_twist_deg": 5.0,
         "statement": "torção da pelve"},
    ]}
    res = w.evaluate(obs, spec)
    claim = res["claims"][0]
    # Local basis quaternion tinha yaw progressivo
    assert claim["status"] == w.PROVEN
    print("PASS: test_pelvis_twist")


def test_agent_review_validation():
    with tempfile.TemporaryDirectory(prefix="review-test-", dir=HERE) as d:
        verdict_path = os.path.join(d, "verdict.json")
        utility_path = os.path.join(d, "views_utility.json")

        verdict_content = {
            "claims": [
                {"claim_id": "c_ok", "status": "COMPROVADO", "missing": [], "requires_visual_evidence": True},
                {"claim_id": "c_measured", "status": "MEDIDO_SEM_CRITERIO", "missing": []},
                {"claim_id": "c_no_target", "status": "NAO_COMPROVAVEL", "missing": ["alvo geometrico"]},
                {"claim_id": "c_refuted", "status": "REFUTADO", "missing": []},
                {"claim_id": "artistic_quality", "status": "NAO_COMPROVAVEL", "missing": ["referencia artistica"], "type": "artistic_judgement"},
            ]
        }
        w.dump_json(verdict_path, verdict_content)

        # Cria arquivos dummy para checagem estrita de existência física
        for fname in ["good_view1.png", "good_view2.png", "bad_occluded.png", "outside.png"]:
            with open(os.path.join(d, fname), "w", encoding="utf-8") as f:
                f.write("fake_png_data")

        utility_content = {
            "good_view1.png": {
                "is_useful": True,
                "rejection_reasons": [],
                "camera": {"location": [1, 0, 0], "target": [0, 0, 0]},
            },
            "good_view2.png": {
                "is_useful": True,
                "rejection_reasons": [],
                "camera": {"location": [0, 1, 0], "target": [0, 0, 0]},
            },
            "bad_occluded.png": {"is_useful": False, "rejection_reasons": ["REJEITADA_OCLUSAO: antebraco"]},
        }
        w.dump_json(utility_path, utility_content)

        # 1. Tentativa de Path Traversal
        traversal_review = {
            "reviews": [{
                "claim_id": "c_ok",
                "status": "COMPROVADO",
                "cited_images": ["../../outside.png"],
            }]
        }
        try:
            review.validate_review(d, traversal_review)
            assert False, "Deveria ter rejeitado path traversal"
        except review.ReviewValidationError as exc:
            assert "Path traversal" in str(exc)

        # 2. Tentativa de converter MEDIDO_SEM_CRITERIO em COMPROVADO
        convert_review = {
            "reviews": [{
                "claim_id": "c_measured",
                "status": "COMPROVADO",
                "cited_images": [],
            }]
        }
        try:
            review.validate_review(d, convert_review)
            assert False, "Deveria ter rejeitado upgrade sem critério"
        except review.ReviewValidationError as exc:
            assert "MEDIDO_SEM_CRITERIO" in str(exc)

        # 3. Citar imagem rejeitada
        bad_img_review = {
            "reviews": [{
                "claim_id": "c_ok",
                "status": "COMPROVADO",
                "cited_images": ["bad_occluded.png"],
            }]
        }
        try:
            review.validate_review(d, bad_img_review)
            assert False, "Deveria ter rejeitado imagem inútil"
        except review.ReviewValidationError as exc:
            assert "rejeitada pelo witness" in str(exc)

        # 4. Provar contato sem alvo (NAO_COMPROVAVEL com pendências)
        contact_review = {
            "reviews": [{
                "claim_id": "c_no_target",
                "status": "COMPROVADO",
                "cited_images": [],
            }]
        }
        try:
            review.validate_review(d, contact_review)
            assert False, "Deveria ter rejeitado prova de contato sem alvo"
        except review.ReviewValidationError as exc:
            assert "alvo geometrico" in str(exc) or "pendências não supridas" in str(exc)

        # 5. Tentativa de elevar claim REFUTADO para COMPROVADO (quebra de monotonicidade)
        refuted_review = {
            "reviews": [{
                "claim_id": "c_refuted",
                "status": "COMPROVADO",
                "justification": "Tentativa indevida de reverter refutação técnica",
                "cited_images": ["good_view1.png", "good_view2.png"],
            }]
        }
        try:
            review.validate_review(d, refuted_review)
            assert False, "Deveria ter rejeitado alteração de REFUTADO para COMPROVADO"
        except review.ReviewValidationError as exc:
            assert "REFUTADO" in str(exc)

        # 6. Forjamento de qualidade artística sem referência e com justificativa vazia
        forged_art_review = {
            "reviews": [{
                "claim_id": "artistic_quality",
                "status": "COMPROVADO",
                "justification": "afirmação sem evidência",
                "cited_images": [],
            }]
        }
        try:
            review.validate_review(d, forged_art_review)
            assert False, "Deveria ter rejeitado aprovação forjada de artistic_quality"
        except review.ReviewValidationError as exc:
            assert "artístico" in str(exc).lower() or "referência" in str(exc).lower()

        # 7. Revisão correta com 2 vistas independentes com metadados do bundle
        valid_review = {
            "reviewer": "Antigravity Reviewer",
            "reviews": [{
                "claim_id": "c_ok",
                "status": "COMPROVADO",
                "justification": "Mão perfeitamente visível e sem oclusões em duas vistas independentes auditadas",
                "cited_images": ["good_view1.png", "good_view2.png"],
            }]
        }
        res = review.validate_review(d, valid_review)
        assert res["status"] == "REVIEW_VALIDATED"
        assert res["claims_reviewed"] == 1
    print("PASS: test_agent_review_validation")


def test_art_reference_comparison():
    with tempfile.TemporaryDirectory(prefix="art-ref-test-", dir=HERE) as d:
        ref_file = os.path.join(d, "ref_attack.json")
        cand_match = os.path.join(d, "cand_match.json")
        cand_mismatch = os.path.join(d, "cand_mismatch.json")

        ref_data = {
            "timing_windows": {"anticipation": [0, 5], "strike": [6, 10]},
            "energy_profile": {"peak_frame": 8},
        }
        cand_match_data = {
            "timing_windows": {"anticipation": [0, 6], "strike": [6, 11]},
            "energy_profile": {"peak_frame": 9},
        }
        cand_mismatch_data = {
            "timing_windows": {"anticipation": [0, 15], "strike": [16, 25]},
            "energy_profile": {"peak_frame": 20},
        }
        w.dump_json(ref_file, ref_data)
        w.dump_json(cand_match, cand_match_data)
        w.dump_json(cand_mismatch, cand_mismatch_data)

        res_match = review.compare_art_reference(cand_match, ref_file)
        assert res_match["status"] == "ART_MATCH"
        assert res_match["is_match"] is True

        res_mismatch = review.compare_art_reference(cand_mismatch, ref_file)
        assert res_mismatch["status"] == "ART_MISMATCH"
        assert res_mismatch["is_match"] is False
        assert len(res_mismatch["mismatches"]) > 0
    print("PASS: test_art_reference_comparison")


def test_project_3d_to_pixel():
    cam_loc = [0.0, -2.0, 0.0]
    cam_target = [0.0, 0.0, 0.0]
    ortho_scale = 2.0
    # Target (0,0,0) deve projetar no centro da imagem (256, 256)
    px = util.project_3d_to_pixel([0.0, 0.0, 0.0], cam_loc, cam_target, [0, 0, 1], ortho_scale, 512, 512)
    assert px is not None
    assert abs(px[0] - 256) < 1.0 and abs(px[1] - 256) < 1.0

    # Ponto à direita em X (+0.5) deve projetar em X > 256
    px_right = util.project_3d_to_pixel([0.5, 0.0, 0.0], cam_loc, cam_target, [0, 0, 1], ortho_scale, 512, 512)
    assert px_right is not None
    assert px_right[0] > 256
    print("PASS: test_project_3d_to_pixel")


def run_all():
    test_baseline_and_fail_closed()
    test_multi_dimensional_fields()
    test_view_independence()
    test_visual_utility_validator()
    test_adaptive_camera()
    test_anatomical_exclusion_and_self_collision()
    test_pelvis_twist()
    test_agent_review_validation()
    test_art_reference_comparison()
    test_project_3d_to_pixel()

    with tempfile.TemporaryDirectory(prefix="witness-core-", dir=HERE) as d:
        a = os.path.join(d, "A.txt")
        open(a, "w", encoding="utf-8").write("x")
        assert w.same_path(a, a.upper())
    print("\nALL_WITNESS_CORE_TESTS_OK (10 suites passed)")


if __name__ == "__main__":
    run_all()

