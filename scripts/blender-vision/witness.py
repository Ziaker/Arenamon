"""CLI do Animation Witness: observa sem salvar o .blend e avalia afirmações."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import uuid

import witness_core as core
import witness_utility as utility
import witness_review as review


HERE = os.path.dirname(os.path.abspath(__file__))
INSIDE = os.path.join(HERE, "witness_inside.py")
VISION = os.path.join(HERE, "vision.py")
MARKER = ".animation_witness_output"
BLENDER = os.environ.get("BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")


def fail(message: str, code: int = 2) -> None:
    print("WITNESS_ERROR:", message, file=sys.stderr)
    raise SystemExit(code)


def ensure_fresh_output(path: str, overwrite: bool) -> None:
    if not os.path.exists(path):
        return
    marker = os.path.join(path, MARKER)
    if not overwrite:
        fail("saída já existe; escolha outra pasta ou use --overwrite")
    if not os.path.isfile(marker):
        fail("recusa apagar pasta sem marcador do Animation Witness")
    resolved = core.canonical(path)
    if resolved in {core.canonical(os.path.sep), core.canonical(os.getcwd())}:
        fail("recusa apagar caminho amplo")
    shutil.rmtree(path)


def write_summary(path: str, verdict: dict) -> None:
    lines = ["ANIMATION WITNESS", "", "Resumo: " + json.dumps(verdict["summary"], ensure_ascii=False), ""]
    for claim in verdict["claims"]:
        lines.append("[%s] %s" % (claim["status"], claim["statement"]))
        for item in claim["missing"]:
            lines.append("  falta: " + item)
        for item in claim["limitations"]:
            lines.append("  limite: " + item)
    lines += ["", "Regra: MEDIDO_SEM_CRITERIO não é aprovação. NAO_COMPROVAVEL não pode ser convertido em PASS."]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def capture_visual_evidence(tmp: str, blend: str, args, spec: dict, observation: dict | None = None) -> list[dict]:
    from witness_camera import AdaptiveHandCamera
    from witness_utility import project_3d_to_pixel

    captures = []
    obs_frames = {}
    if observation:
        for r in observation.get("frames", []):
            obs_frames[r["author_frame"]] = r
    digit_chains_right = observation.get("rig", {}).get("digit_chains", {}).get("Right", []) if observation else []

    for plan in spec.get("visual_plans", []):
        name = plan["name"]
        dest = os.path.join(tmp, "visual", name)
        views = list(plan["views"])
        custom_cameras = {}

        # Câmera adaptativa focada na mão quando o plano inspeciona mão/dedos
        is_hand_plan = "RightHand" in str(plan.get("zoom")) or "mao" in name.lower() or plan.get("adaptive")
        if is_hand_plan and observation and plan.get("frames"):
            target_af = plan["frames"][0]
            row = obs_frames.get(target_af)
            if row:
                bones = row.get("bones", {})
                rh = bones.get("RightHand")
                rfa = bones.get("RightForeArm")
                if rh and rfa:
                    wrist = rh.get("world_head", [0, 0, 0])
                    palm_end = rh.get("world_tail", [0, 0, 0])
                    forearm_start = rfa.get("world_head", [0, 0, 0])
                    claw_tips = []
                    for chain in digit_chains_right:
                        last_b = bones.get(chain[-1])
                        if last_b:
                            claw_tips.append(last_b.get("world_tail", [0, 0, 0]))

                    adaptive = AdaptiveHandCamera(wrist, palm_end, forearm_start, claw_tips)
                    adaptive_views = adaptive.select_best_independent_views(count=2)
                    for av in adaptive_views:
                        vname = f"adaptive_{av['name']}"
                        custom_cameras[vname] = {
                            "direction": av["direction"],
                            "location": av["location"],
                            "target": av["target"],
                            "up": av["up"],
                            "span": av["span"],
                            "ortho": True,
                            "desc": f"Camera adaptativa de mao: {av['name']}"
                        }
                        if vname not in views:
                            views.append(vname)

        cmd = [sys.executable, VISION, "shot", "--blend", blend, "--action", args.action,
               "--offset", str(args.offset), "--frames", ",".join(str(x) for x in plan["frames"]),
               "--views", ",".join(views), "--modes", ",".join(plan["modes"]),
               "--size", str(plan.get("size", 420)), "--cols", str(plan.get("cols", 6)),
               "--out", dest]
        if args.armature:
            cmd += ["--armature", args.armature]
        if plan.get("zoom"):
            cmd += ["--zoom", plan["zoom"]]
        if plan.get("zoom_preset"):
            cmd += ["--zoom-preset", plan["zoom_preset"]]

        if custom_cameras:
            cams_json_path = os.path.join(tmp, f"_cams_{name}.json")
            core.dump_json(cams_json_path, custom_cameras)
            cmd += ["--custom-cameras", cams_json_path]

        run = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                             timeout=args.timeout)
        log = os.path.join(tmp, "visual-%s.log" % name)
        with open(log, "w", encoding="utf-8") as f:
            f.write(run.stdout + "\n" + run.stderr)
        if run.returncode:
            raise RuntimeError("captura visual '%s' falhou; consulte %s" % (name, log))
        manifest_path = os.path.join(dest, "manifest.json")
        if not os.path.isfile(manifest_path):
            raise RuntimeError("captura visual '%s' não produziu manifest.json" % name)
        manifest = json.load(open(manifest_path, encoding="utf-8"))
        if not manifest.get("blend_untouched"):
            raise RuntimeError("captura visual '%s' não confirmou integridade" % name)
        captures.append({
            "name": name,
            "purpose": plan.get("purpose"),
            "frames": plan["frames"],
            "views": views,
            "modes": plan["modes"],
            "relative_dir": os.path.relpath(dest, tmp),
            "manifest_sha256": core.sha256(manifest_path),
            "required_for_claims": plan.get("required_for_claims", []),
        })

    # Avaliação de utilidade visual de todas as imagens geradas
    views_utility = {}
    for cap in captures:
        cap_dest = os.path.join(tmp, cap["relative_dir"])
        man_p = os.path.join(cap_dest, "manifest.json")
        if os.path.isfile(man_p):
            m_data = json.load(open(man_p, encoding="utf-8"))
            reg_vis = m_data.get("visibilidade_por_regiao") or m_data.get("extra", {}).get("region_visibility", {})
            for it in m_data.get("items", []):
                fname = it["file"]
                key = "%s_g%s" % (it.get("view"), it.get("frame_autoral"))
                vis = reg_vis.get(key, {})
                ocultas = vis.get("ocultas", [])
                is_hand_occluded = "indicador_D" in ocultas or "polegar_D" in ocultas or "palma_D" in ocultas

                w_px = it.get("camera", {}).get("size") or m_data.get("size") or 512
                h_px = w_px
                cam_rec = it.get("camera", {})
                cam_loc = cam_rec.get("location") or [0, -1, 1]
                cam_target = cam_rec.get("center") or [0, 0, 0]
                cam_scale = cam_rec.get("ortho_scale") or 1.0

                # Projeção 2D dos keypoints e pontas dos dedos a partir da observação real
                keypoints_2d = []
                digit_tips_2d = []
                af = it.get("frame_autoral")
                row = obs_frames.get(af)
                if row:
                    b_dict = row.get("bones", {})
                    rh = b_dict.get("RightHand")
                    if rh:
                        keypoints_2d.append(project_3d_to_pixel(rh["world_head"], cam_loc, cam_target, [0, 0, 1], cam_scale, w_px, h_px)[:2])
                        keypoints_2d.append(project_3d_to_pixel(rh["world_tail"], cam_loc, cam_target, [0, 0, 1], cam_scale, w_px, h_px)[:2])
                    for chain in digit_chains_right:
                        for b_name in chain:
                            bone_data = b_dict.get(b_name)
                            if bone_data:
                                keypoints_2d.append(project_3d_to_pixel(bone_data["world_tail"], cam_loc, cam_target, [0, 0, 1], cam_scale, w_px, h_px)[:2])
                        last_b = b_dict.get(chain[-1])
                        if last_b:
                            digit_tips_2d.append(project_3d_to_pixel(last_b["world_tail"], cam_loc, cam_target, [0, 0, 1], cam_scale, w_px, h_px)[:2])

                px_map = vis.get("pixels", {})
                target_pixels = None
                if px_map:
                    target_pixels = px_map.get("palma_D", 0) + px_map.get("indicador_D", 0) + px_map.get("polegar_D", 0)
                    if px_map.get("alvo"):
                        target_pixels += px_map.get("alvo", 0)

                util_info = {
                    "view_name": it.get("view"),
                    "image_width": w_px,
                    "image_height": h_px,
                    "cam_location_z": cam_loc[2],
                    "keypoints_2d": keypoints_2d,
                    "digit_tips_2d": digit_tips_2d,
                    "target_pixels": target_pixels,
                    "is_forearm_collinear": "antebraco" in it.get("view", ""),
                    "camera": {"location": cam_loc, "target": cam_target},
                }
                eval_res = utility.evaluate_view_utility(util_info)
                if is_hand_occluded and "RightHand" in str(it.get("zoom")):
                    eval_res["is_useful"] = False
                    eval_res["rejection_reasons"].append(
                        f"REJEITADA_OCLUSAO: dedos/palma da mão direita ocluídos nesta vista ({', '.join(ocultas)})"
                    )
                views_utility[fname] = eval_res

    core.dump_json(os.path.join(tmp, "views_utility.json"), views_utility)
    return captures


def write_agent_review(path: str, captures: list[dict], verdict: dict) -> None:
    lines = [
        "# Pacote de evidência para o agente",
        "",
        "Este arquivo é uma fila de inspeção, não uma aprovação. Abra as imagens em resolução integral.",
        "",
        "## Regras obrigatórias",
        "",
        "- Cite no mínimo duas vistas independentes para uma afirmação visual.",
        "- Uma região ocluída em IDs não pode ser julgada por essa câmera.",
        "- Sobreposição 2D não prova contato ou interpenetração 3D.",
        "- Sem alvo explícito, contato permanece NAO_COMPROVAVEL.",
        "- Sem referência aprovada, qualidade artística permanece NAO_COMPROVAVEL.",
        "- Não converta MEDIDO_SEM_CRITERIO em aprovação.",
        "",
        "## Capturas",
        "",
    ]
    for cap in captures:
        lines += ["### " + cap["name"], "", cap.get("purpose") or "", "",
                  "Pasta: `" + cap["relative_dir"].replace("\\", "/") + "`", "",
                  "Claims: " + ", ".join(cap["required_for_claims"]), ""]
    if verdict.get("exact_visualizations"):
        lines += ["## Visualizações exatas", ""]
        for item in verdict["exact_visualizations"]:
            lines.append("- `%s`: %s" % (item["file"], item["note"]))
        lines.append("")
    lines += ["## Afirmações ainda abertas", ""]
    for claim in verdict["claims"]:
        if claim["status"] in (core.MEASURED, core.UNPROVABLE):
            lines.append("- `%s`: %s — %s" % (claim["claim_id"], claim["status"], claim["statement"]))
    lines += ["", "Uma revisão visual deve registrar: claim_id, status, imagens citadas, o que está visível, o que está oculto e limitações."]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def write_hand_svg(path: str, observation: dict, side: str = "Right", wanted=(9, 11, 13)) -> bool:
    """Prancha vetorial dos dedos em XY/XZ/YZ; elimina oclusão da malha."""
    chains = observation.get("rig", {}).get("digit_chains", {}).get(side, [])
    rows = [x for x in observation.get("frames", []) if int(x["author_frame"]) in wanted]
    if not chains or not rows:
        return False
    projections = [(0, 1, "XY"), (0, 2, "XZ"), (1, 2, "YZ")]
    cell_w, cell_h, pad = 360, 280, 34
    colors = ["#22c1ff", "#ff4fb3", "#ffd34d", "#7cff72"]
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' %
             (cell_w * len(rows), cell_h * len(projections), cell_w * len(rows), cell_h * len(projections)),
             '<rect width="100%" height="100%" fill="#17191d"/>']
    for col, row in enumerate(rows):
        for rix, (ax, ay, label) in enumerate(projections):
            segments = []
            bones = row["bones"]
            hand = bones.get(side + "Hand")
            if hand:
                segments.append((hand["body_head"], hand["body_tail"], "#f4f4f4", 7))
            for ci, chain in enumerate(chains):
                for name in chain:
                    b = bones.get(name)
                    if b:
                        segments.append((b["body_head"], b["body_tail"], colors[ci % len(colors)], 5))
            pts = [p for a, b, _, _ in segments for p in (a, b)]
            if not pts:
                continue
            xs, ys = [p[ax] for p in pts], [p[ay] for p in pts]
            minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
            scale = min((cell_w - 2 * pad) / max(maxx - minx, 1e-6),
                        (cell_h - 2 * pad) / max(maxy - miny, 1e-6))
            ox, oy = col * cell_w, rix * cell_h
            parts.append('<rect x="%d" y="%d" width="%d" height="%d" fill="none" stroke="#464a52"/>' % (ox, oy, cell_w, cell_h))
            parts.append('<text x="%d" y="%d" fill="#fff" font-family="sans-serif" font-size="18">g%s · %s</text>' %
                         (ox + 12, oy + 24, row["author_frame"], label))
            def project(p):
                return (ox + pad + (p[ax] - minx) * scale,
                        oy + cell_h - pad - (p[ay] - miny) * scale)
            for a, b, color, width in segments:
                x1, y1 = project(a); x2, y2 = project(b)
                parts.append('<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="%s" stroke-width="%d" stroke-linecap="round"/>' %
                             (x1, y1, x2, y2, color, width))
                parts.append('<circle cx="%.2f" cy="%.2f" r="4" fill="%s"/>' % (x2, y2, color))
    parts.append('</svg>')
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))
    return True


def inspect(args) -> None:
    blend = os.path.abspath(args.blend)
    spec_path = os.path.abspath(args.spec)
    out = os.path.abspath(args.out)
    if not os.path.isfile(blend):
        fail(".blend não encontrado")
    if not os.path.isfile(spec_path):
        fail("spec não encontrada")
    if not os.path.isfile(BLENDER):
        fail("Blender não encontrado; defina BLENDER_EXE")
    spec = json.load(open(spec_path, encoding="utf-8-sig"))
    before = core.sha256(blend)
    allowed = [x.lower() for x in spec.get("source_constraints", {}).get("allowed_blend_sha256", [])]
    source_pinned = not allowed or before.lower() in allowed
    if not source_pinned and not args.allow_unpinned_source:
        fail("o hash do .blend não pertence à fonte autorizada por este spec; use o arquivo correto (ou --allow-unpinned-source conscientemente)", 10)
    ensure_fresh_output(out, args.overwrite)
    parent = os.path.dirname(out)
    os.makedirs(parent, exist_ok=True)
    tmp = out + ".in-progress-" + uuid.uuid4().hex
    os.makedirs(tmp)
    open(os.path.join(tmp, MARKER), "w", encoding="utf-8").write("Animation Witness output\n")
    observation_path = os.path.join(tmp, "observation.json")
    cfg = {"action": args.action, "armature": args.armature, "offset": args.offset,
           "target": args.target, "observation_path": observation_path}
    cfg_path = os.path.join(tmp, "config.json")
    core.dump_json(cfg_path, cfg)
    command = [BLENDER, "-b", blend, "--python", INSIDE, "--", cfg_path]
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        run = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace",
                             timeout=args.timeout)
    except subprocess.TimeoutExpired as exc:
        core.dump_json(os.path.join(tmp, "failure.json"), {"stage": "blender", "reason": "timeout", "seconds": args.timeout})
        os.replace(tmp, out + ".FAILED-timeout")
        fail("Blender excedeu o timeout", 4)
    with open(os.path.join(tmp, "blender.log"), "w", encoding="utf-8") as f:
        f.write(run.stdout + "\n" + run.stderr)
    after = core.sha256(blend)
    if before != after:
        core.dump_json(os.path.join(tmp, "INTEGRITY_FAILURE.json"), {"before": before, "after": after, "blend": blend})
        os.replace(tmp, out + ".FAILED-integrity")
        fail("o .blend mudou durante a observação", 3)
    if run.returncode or not os.path.isfile(observation_path):
        core.dump_json(os.path.join(tmp, "failure.json"), {"stage": "blender", "returncode": run.returncode})
        os.replace(tmp, out + ".FAILED-blender")
        fail("extração Blender falhou; consulte blender.log", 8)

    observation = json.load(open(observation_path, encoding="utf-8"))
    verdict = core.evaluate(observation, spec)
    hand_svg = os.path.join(tmp, "right_hand_skeleton.svg")
    if write_hand_svg(hand_svg, observation):
        hand_png = os.path.join(tmp, "right_hand_skeleton.png")
        image_file = os.path.basename(hand_svg)
        try:
            converted = subprocess.run(["magick", hand_svg, hand_png], capture_output=True, timeout=60)
            if converted.returncode == 0 and os.path.isfile(hand_png):
                image_file = os.path.basename(hand_png)
        except (OSError, subprocess.TimeoutExpired):
            pass
        verdict["exact_visualizations"] = [{"kind": "digit_skeleton", "file": image_file,
                                             "frames": [9, 11, 13], "projections": ["XY", "XZ", "YZ"],
                                             "note": "transformações exatas do rig; não representa a superfície da malha"}]
    else:
        verdict["exact_visualizations"] = []
    captures = []
    if args.visual:
        try:
            captures = capture_visual_evidence(tmp, blend, args, spec, observation)
        except (RuntimeError, subprocess.TimeoutExpired) as exc:
            core.dump_json(os.path.join(tmp, "failure.json"), {"stage": "visual", "reason": str(exc)})
            os.replace(tmp, out + ".FAILED-visual")
            fail(str(exc), 9)
    verdict["visual_evidence"] = captures
    utility_file = os.path.join(tmp, "views_utility.json")
    if os.path.isfile(utility_file):
        views_utility = json.load(open(utility_file, encoding="utf-8"))
        core.update_visual_evidence_in_verdict(verdict, captures, views_utility)
    verdict["provenance"] = {
        "run_id": uuid.uuid4().hex,
        "started_utc": started,
        "finished_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "blend": blend,
        "blend_sha256": after,
        "spec": spec_path,
        "spec_sha256": core.sha256(spec_path),
        "witness_sha256": core.sha256(os.path.abspath(__file__)),
        "inside_sha256": core.sha256(INSIDE),
        "core_sha256": core.sha256(os.path.join(HERE, "witness_core.py")),
        "python": platform.python_version(),
        "command": command,
        "source_untouched": True,
        "source_matches_spec": source_pinned,
        "unpinned_source_override": bool(args.allow_unpinned_source and not source_pinned),
    }
    core.dump_json(os.path.join(tmp, "verdict.json"), verdict)
    write_summary(os.path.join(tmp, "SUMMARY.txt"), verdict)
    write_agent_review(os.path.join(tmp, "AGENT_REVIEW.md"), captures, verdict)
    os.replace(tmp, out)
    print(json.dumps({"out": out, "summary": verdict["summary"], "source_untouched": True}, ensure_ascii=False, indent=2))


def run_review(args) -> None:
    review_path = os.path.abspath(args.review)
    if not os.path.isfile(review_path):
        fail("Arquivo de review não encontrado: " + review_path)
    try:
        data = json.load(open(review_path, encoding="utf-8"))
        res = review.validate_review(args.bundle, data)
        out_dest = args.out or os.path.join(args.bundle, "review_verdict.json")
        core.dump_json(out_dest, res)
        print(json.dumps(res, indent=2, ensure_ascii=False))
    except (review.ReviewValidationError, Exception) as exc:
        fail(f"Revisão rejeitada: {exc}", 11)


def run_calibrate_claw(args) -> None:
    try:
        res = review.calibrate_claw(args.blend, args.action, args.out, armature=args.armature)
        print(json.dumps(res, indent=2, ensure_ascii=False))
    except Exception as exc:
        fail(f"Calibração de garra falhou: {exc}", 12)


def run_art_reference(args) -> None:
    crit_dir = os.path.join(HERE, "criteria")
    os.makedirs(crit_dir, exist_ok=True)
    if args.list:
        refs = [f for f in os.listdir(crit_dir) if f.endswith(".json")]
        print(json.dumps({"art_references": refs}, indent=2, ensure_ascii=False))
    elif args.register:
        src = os.path.abspath(args.register)
        if not os.path.isfile(src):
            fail("Arquivo de referência não encontrado")
        dest = os.path.join(crit_dir, os.path.basename(src))
        shutil.copy2(src, dest)
        print(json.dumps({"registered": dest, "sha256": core.sha256(dest)}, indent=2))
    elif getattr(args, "compare", None) and getattr(args, "reference", None):
        try:
            res = review.compare_art_reference(args.compare, args.reference)
            print(json.dumps(res, indent=2, ensure_ascii=False))
        except Exception as exc:
            fail(f"Comparação de referência artística falhou: {exc}", 13)


def main() -> None:
    parser = argparse.ArgumentParser(description="Animation Witness: evidência antes de conclusão")
    sub = parser.add_subparsers(dest="command", required=True)

    # Subcomando inspect
    p = sub.add_parser("inspect", help="inspeciona e extrai evidências do .blend")
    p.add_argument("--blend", required=True)
    p.add_argument("--action", required=True)
    p.add_argument("--spec", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--offset", type=int, default=0)
    p.add_argument("--armature")
    p.add_argument("--target", help="objeto-alvo explícito; sem ele contato fica NAO_COMPROVAVEL")
    p.add_argument("--visual", action="store_true", help="gera o pacote multivista exigido pelo spec")
    p.add_argument("--allow-unpinned-source", action="store_true", dest="allow_unpinned_source",
                   help="permite conscientemente um .blend cujo hash não consta no spec; fica registrado na proveniência")
    p.add_argument("--timeout", type=int, default=900)
    p.add_argument("--overwrite", action="store_true")
    p.set_defaults(fn=inspect)

    # Subcomando review
    pr = sub.add_parser("review", help="valida relatório de revisão submetido por agente")
    pr.add_argument("--bundle", required=True, help="pasta do pacote de evidência gerado")
    pr.add_argument("--review", required=True, help="arquivo JSON com o review do agente")
    pr.add_argument("--out", help="destino do veredito da revisão (padrão: <bundle>/review_verdict.json)")
    pr.set_defaults(fn=run_review)

    # Subcomando calibrate-claw
    pc = sub.add_parser("calibrate-claw", help="calibra critérios de garra sem modificar .blend")
    pc.add_argument("--blend", required=True)
    pc.add_argument("--action", required=True)
    pc.add_argument("--out", required=True)
    pc.add_argument("--armature")
    pc.set_defaults(fn=run_calibrate_claw)

    # Subcomando art-reference
    pa = sub.add_parser("art-reference", help="gerencia corpus de referências artísticas")
    pa.add_argument("--list", action="store_true")
    pa.add_argument("--register")
    pa.set_defaults(fn=run_art_reference)

    args = parser.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()

