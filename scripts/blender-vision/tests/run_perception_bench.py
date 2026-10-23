#!/usr/bin/env python
"""Benchmark de percepcao com casos controlados (resultado esperado conhecido de antemao, positivos/negativos/inconclusivos).

  python tests/run_perception_bench.py --split dev  --work PASTA_TEMP   # ajuste de limiares permitido SOMENTE aqui
  python tests/run_perception_bench.py --split eval --work PASTA_TEMP   # avaliacao: congelada, nada pode ser ajustado depois de rodar

Gera os .blend sinteticos (perception_synth.py), roda os comandos reais de perception.py e compara com as expectativas abaixo.
Mede INFRAESTRUTURA geometrica/temporal: nao mede se uma imagem foi bem interpretada por um modelo (isso e feito a mao e registrado a parte).
Registra acertos, falsos positivos, falsos negativos e casos em que a ferramenta devolveu 'nao sei' quando deveria decidir.
"""
import argparse
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
VIS = os.path.dirname(HERE)
PERC = os.path.join(VIS, "perception.py")
BLENDER = os.environ.get("BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")
PY = sys.executable
SHIFT = {"dev": 0, "eval": 2}


def sh(cmd, check=True):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900)
    if check and p.returncode != 0:
        raise RuntimeError("falhou: %s\n%s\n%s" % (" ".join(cmd[:6]), p.stdout[-800:], p.stderr[-800:]))
    return p


def perc(*args):
    return sh([PY, PERC] + list(args))


def load(path):
    return json.load(open(path, encoding="utf-8"))


class Bench:
    def __init__(self, split, work):
        self.split, self.work = split, work
        self.blend = os.path.join(work, "synth_%s.blend" % split)
        self.shift = SHIFT[split]
        self.results = []
        os.makedirs(work, exist_ok=True)

    def build(self):
        p = sh([BLENDER, "-b", "--factory-startup", "--python", os.path.join(HERE, "perception_synth.py"), "--", "--split", self.split, "--out", self.blend])
        if "SYNTH_OK" not in p.stdout:  # o Blender sai com codigo 0 mesmo quando o script Python levanta excecao
            raise RuntimeError("gerador sintetico falhou: " + p.stdout[-1500:] + p.stderr[-800:])

    def out(self, name):
        return os.path.join(self.work, "%s_%s" % (self.split, name))

    def motion(self, action, **kw):
        o = self.out("mot_" + action)
        args = ["motion", "--blend", self.blend, "--action", action, "--frames", "1-30", "--stroke-bone", "RightHand", "--out", o, "--overwrite"]
        if kw.get("declared"):
            args += ["--declared", kw["declared"]]
        perc(*args)
        return load(os.path.join(o, "motion_report.json"))

    def contacts(self, action, pair, frame):
        o = self.out("con_%s_%s" % (action, pair.replace(":", "-")))
        perc("contacts", "--blend", self.blend, "--action", action, "--frames", str(frame), "--pairs", pair, "--baseline-action", "rest", "--out", o, "--overwrite")
        c = load(os.path.join(o, "contacts.json"))
        return c["classificacao"][pair.replace(":", "|")][str(frame)]

    def investigate(self, action, region, frames, initial="frente_e12,lado_D_e12"):
        o = self.out("inv_%s_%s" % (action, region))
        perc("investigate", "--blend", self.blend, "--action", action, "--frames", frames, "--regions", region, "--initial-views", initial, "--out", o, "--overwrite", "--size", "200")
        return load(os.path.join(o, "investigation.json"))["regions"][region], o

    def record(self, tid, desc, expected, observed, ok, kind):
        self.results.append({"id": tid, "descricao": desc, "tipo": kind, "esperado": expected, "observado": observed, "ok": bool(ok)})
        print(("PASS " if ok else "FAIL ") + tid, "|", desc, "| esperado:", expected, "| observado:", observed, flush=True)

    # ---------------------------------------------------------------- casos
    def run(self):
        S = self.shift
        # 1 atravessar x oculto x dentro (geometria + visibilidade)
        c = self.contacts("arm_through_torso", "arm_R:torso", 20)
        self.record("T1a", "braco atravessando o tronco", "ATRAVESSAMENTO_PROVAVEL", c["classe"], c["classe"] == "ATRAVESSAMENTO_PROVAVEL", "positivo")
        c = self.contacts("arm_behind_torso", "arm_R:torso", 20)
        self.record("T1b", "braco apenas oculto atras do tronco (sem atravessar)", "SEM_INDICIO", c["classe"], c["classe"] == "SEM_INDICIO", "negativo")
        reg, _ = self.investigate("arm_behind_torso", "mao_D", "20")
        front = next(v for v in reg["views"] if v["name"] == "frente_e12")
        fv = front["per_frame"]["20"]["visible_frac"]
        self.record("T1c", "mao oculta atras do tronco: vista frontal detecta oclusao pelo tronco", "visivel<0.6 e ocluida pelo corpo (tronco/cabeca), nao por si mesma", {"visible": fv, "occluded_by": front["occluded_by"]},
                    fv is not None and fv < 0.6 and (front["occluded_by"].get("torso", 0) + front["occluded_by"].get("head", 0)) > 0.5, "negativo")
        self.record("T3a", "pose frontal ambigua: o laco pede nova vista e chega a evidencia suficiente", "rodadas>=2 e SUFICIENTE", {"rodadas": len(reg["rounds"]), "final": reg["final"]["status"], "pedidas": [r["requested"] for r in reg["rounds"]]},
                    len(reg["rounds"]) >= 2 and reg["final"]["status"] == "OBSERVADO_SUFICIENTE", "positivo")
        c = self.contacts("hand_inside_torso", "hand_R:torso", 20)
        self.record("T1d", "mao dentro do tronco: geometria acusa atravessamento", "ATRAVESSAMENTO_PROVAVEL", c["classe"], c["classe"] == "ATRAVESSAMENTO_PROVAVEL", "positivo")
        reg, _ = self.investigate("hand_inside_torso", "mao_D", "20")
        self.record("T1e", "mao dentro do tronco: nenhuma vista a observa -> NAO afirma ver (inconclusivo)", "NAO_OBSERVAVEL e sem 'suficiente'", {"final": reg["final"]["status"], "parou": reg["stop_reason"]},
                    reg["final"]["status"] == "NAO_OBSERVAVEL" and "suficiente" not in reg["stop_reason"], "inconclusivo")
        # 2 pe
        for act, want in (("foot_planted", "apoiado"), ("foot_near", "proximo_ambiguo"), ("foot_air", "suspenso")):
            m = self.motion(act)
            row = next(r for r in m["pe_E"]["rows"] if r["frame"] == 15)
            self.record("T2-" + act, "pe %s" % act, want, {"folga_m": row["folga_m"], "classe": row["classe"]}, row["classe"] == want, "positivo" if want != "proximo_ambiguo" else "inconclusivo")
        # 3 snap x rapido
        m = self.motion("snap_jump")
        iso = [e for e in m["snap"] if e["classe"] == "salto_isolado"]
        self.record("T4a", "snap de interpolacao (1 frame)", "salto_isolado", [e["classe"] for e in m["snap"]], bool(iso), "positivo")
        m = self.motion("fast_ramp")
        iso = [e for e in m["snap"] if e["classe"] == "salto_isolado"]
        ramp = [e for e in m["snap"] if e["classe"] == "rapido_com_rampa"]
        self.record("T4b", "acao rapida intencional (rampa de 5 frames)", "sem salto_isolado e com rampa", [e["classe"] for e in m["snap"]], not iso and bool(ramp), "negativo")
        # 4 antecipacao
        m = self.motion("no_anticipation")
        self.record("T5a", "sem antecipacao", False, m["antecipacao"]["presente"], m["antecipacao"]["presente"] is False, "negativo")
        m = self.motion("with_anticipation")
        self.record("T5b", "com antecipacao (recuo antes do golpe)", True, {"p": m["antecipacao"]["presente"], "razao": m["antecipacao"]["razao_recuo_curso"]}, m["antecipacao"]["presente"] is True, "positivo")
        # 5 arco
        m = self.motion("arc_smooth")
        self.record("T6a", "arco continuo", "arco_continuo", m["arco"]["classe"], m["arco"]["classe"] == "arco_continuo", "negativo")
        m = self.motion("arc_corner")
        self.record("T6b", "trajetoria com quina de 90 graus em velocidade", "mudanca_abrupta", {"classe": m["arco"]["classe"], "quinas": m["arco"]["quinas_em_velocidade"][:2]}, m["arco"]["classe"] == "mudanca_abrupta", "positivo")
        # 6 sequenciamento
        m = self.motion("arm_before_torso")
        self.record("T7a", "braco inicia antes do tronco", "mao_antes_do_tronco", {"rel": m["sequencia_do_corpo"]["mao_vs_tronco"], "ordem": m["sequencia_do_corpo"]["ordem"]},
                    m["sequencia_do_corpo"]["mao_vs_tronco"] == "mao_antes_do_tronco", "positivo")
        m = self.motion("arm_with_torso")
        self.record("T7b", "braco e tronco simultaneos", "simultaneo", {"rel": m["sequencia_do_corpo"]["mao_vs_tronco"], "ordem": m["sequencia_do_corpo"]["ordem"]},
                    m["sequencia_do_corpo"]["mao_vs_tronco"] == "simultaneo", "negativo")
        # 7 deformacao
        decl = os.path.join(self.work, "decl_%s.json" % self.split)
        json.dump([{"bones": [], "frames": [8 + S, 14 + S], "kind": "stretch intencional documentado"}], open(decl, "w"))
        m = self.motion("stretch_spine", declared=decl)
        self.record("T8a", "esticamento declarado/documentado", "inesperados=0 e documentados>0", {"inesp": m["deformacao"]["inesperados"], "doc": m["deformacao"]["documentados"]},
                    m["deformacao"]["inesperados"] == 0 and m["deformacao"]["documentados"] > 0, "positivo")
        m = self.motion("stretch_spine")
        self.record("T8b", "mesmo esticamento SEM declaracao", "inesperados>0", {"inesp": m["deformacao"]["inesperados"]}, m["deformacao"]["inesperados"] > 0, "positivo")
        # 9 casos dificeis (adicionados depois do primeiro ciclo; nao participaram do ajuste)
        c = self.contacts("arm_hanging", "arm_R:torso", 20)
        self.record("T9a", "braco pendurado a ~3 cm do tronco (nao atravessa)", "SEM_INDICIO", c["classe"], c["classe"] == "SEM_INDICIO", "negativo")
        m = self.motion("two_frame_fast")
        self.record("T9b", "movimento rapido em 2 frames nao e 'salto isolado de 1 frame'", "sem salto_isolado", [e["classe"] for e in m["snap"]],
                    not [e for e in m["snap"] if e["classe"] == "salto_isolado"], "negativo")
        # 10 geometria sob o chao: mao enterrada nao pode contar como visivel (achado real do Mosh, g11-g21)
        m = self.motion("hand_underground")
        hd = m["chao"]["por_rotulo"].get("hand_R", {})
        self.record("T10a", "mao enterrada: penetracao no chao medida", "hand_R prof_max > 0.10 m", hd.get("prof_max_m"), hd.get("prof_max_m", 0) > 0.10, "positivo")
        reg, _ = self.investigate("hand_underground", "mao_D", "20")
        occ = {k: v for v in reg["views"] for k, v in [(v["name"], v["occluded_by"])]}
        self.record("T10b", "mao enterrada: nenhuma vista a observa e o oclusor e o chao", "NAO_OBSERVAVEL e 'chao' entre os oclusores", {"final": reg["final"]["status"], "ocluida_por": {k: list(v)[:2] for k, v in occ.items()}},
                    reg["final"]["status"] == "NAO_OBSERVAVEL" and all("chao" in v for v in occ.values()), "inconclusivo")
        m = self.motion("foot_planted")
        self.record("T10c", "pe apoiado nao gera 'penetracao no chao' falsa", "sem rotulos afundados", list(m["chao"]["por_rotulo"]), not m["chao"]["por_rotulo"], "negativo")
        # contato indevido de aprovacao artistica e imagens: cobertos nos testes unitarios (test_perception_diagnosis)

    def summary(self):
        n = len(self.results)
        ok = sum(r["ok"] for r in self.results)
        fails = [r for r in self.results if not r["ok"]]
        # classificacao de falhas: esperado positivo e nao detectado = falso negativo; esperado negativo e detectado = falso positivo
        fn = [r["id"] for r in fails if r["tipo"] == "positivo"]
        fp = [r["id"] for r in fails if r["tipo"] == "negativo"]
        inc = [r["id"] for r in fails if r["tipo"] == "inconclusivo"]
        return {"split": self.split, "total": n, "ok": ok, "falsos_negativos": fn, "falsos_positivos": fp, "inconclusivos_errados": inc, "resultados": self.results,
                "data": time.strftime("%Y-%m-%d %H:%M"), "aviso": "mede a infraestrutura em casos sinteticos de caixas fechadas; nao mede interpretacao de imagem por modelo nem desempenho em malhas reais"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", choices=["dev", "eval"], required=True)
    ap.add_argument("--work", required=True)
    ap.add_argument("--out")
    a = ap.parse_args()
    b = Bench(a.split, a.work)
    b.build()
    b.run()
    s = b.summary()
    print("\n%s: %d/%d | FN=%s FP=%s INC=%s" % (a.split, s["ok"], s["total"], s["falsos_negativos"], s["falsos_positivos"], s["inconclusivos_errados"]))
    if a.out:
        json.dump(s, open(a.out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    sys.exit(0 if s["ok"] == s["total"] else 1)


if __name__ == "__main__":
    main()
