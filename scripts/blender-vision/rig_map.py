"""Contrato e validador de Mapeamento Anatômico Semântico (F03).

Schema: arenamon.rig-map/1
Identifica e mapeia papéis anatômicos funcionais em armatures e rigs distintos
(Mixamo, Gigantic/Unreal, AlienRig, Pokémon Z-A, Rigify, Custom), sem alterar
nomes originais de ossos e sem pressupor conversão direta entre esqueletos.

Regras fundamentais:
1. Nomes originais preservados: cada mapeamento referencia o nome exato no armature.
2. Separação estrita: identificação automática, pontuação de confiança e overrides manuais.
3. Tratamento explícito de ausências e anatomias não-bípedes (sem preenchimento artificial).
4. Distinção mandatória entre root motion (deslocamento no mundo) e pelve (centro de massa).
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

SCHEMA_NAME = "arenamon.rig-map/1"

# Papéis canônicos padronizados
ROOT_ROLES = ("root",)
CORE_ROLES = ("pelvis", "spine_lower", "spine_middle", "spine_upper", "chest", "neck", "head")
LIMB_UPPER_LEFT = ("left_clavicle", "left_upper_arm", "left_forearm", "left_hand")
LIMB_UPPER_RIGHT = ("right_clavicle", "right_upper_arm", "right_forearm", "right_hand")
LIMB_LOWER_LEFT = ("left_thigh", "left_calf", "left_foot", "left_toe")
LIMB_LOWER_RIGHT = ("right_thigh", "right_calf", "right_foot", "right_toe")
SECONDARY_ROLES = (
    "tail_base", "tail_mid", "tail_tip",
    "jaw", "left_ear", "right_ear",
    "left_wing", "right_wing", "prop"
)

ALL_CANONICAL_ROLES = tuple(
    list(ROOT_ROLES)
    + list(CORE_ROLES)
    + list(LIMB_UPPER_LEFT)
    + list(LIMB_UPPER_RIGHT)
    + list(LIMB_LOWER_LEFT)
    + list(LIMB_LOWER_RIGHT)
    + list(SECONDARY_ROLES)
)

# Status de mapeamento
STATUS_MAPPED = "MAPPED"
STATUS_ABSENT = "ABSENT"
STATUS_UNMAPPED = "UNMAPPED"
STATUS_AMBIGUOUS = "AMBIGUOUS"
VALID_STATUSES = (STATUS_MAPPED, STATUS_ABSENT, STATUS_UNMAPPED, STATUS_AMBIGUOUS)

# Métodos de identificação
METHOD_OVERRIDE = "OVERRIDE"
METHOD_KNOWN_TEMPLATE = "KNOWN_TEMPLATE"
METHOD_TOKEN_HEURISTIC = "TOKEN_HEURISTIC"
METHOD_NOT_FOUND = "NOT_FOUND"

CONFIDENCE_THRESHOLD_LOW = 0.60
CONFIDENCE_THRESHOLD_HIGH = 0.85

# Templates conhecidos com variantes exatas
KNOWN_TEMPLATES: Dict[str, Dict[str, Sequence[str]]] = {
    "MIXAMO": {
        "pelvis": ("Hips", "mixamorig:Hips"),
        "spine_lower": ("Spine", "mixamorig:Spine"),
        "spine_middle": ("Spine1", "mixamorig:Spine1"),
        "spine_upper": ("Spine2", "mixamorig:Spine2"),
        "neck": ("Neck", "mixamorig:Neck"),
        "head": ("Head", "mixamorig:Head"),
        "left_clavicle": ("LeftShoulder", "mixamorig:LeftShoulder"),
        "left_upper_arm": ("LeftArm", "mixamorig:LeftArm"),
        "left_forearm": ("LeftForeArm", "mixamorig:LeftForeArm"),
        "left_hand": ("LeftHand", "mixamorig:LeftHand"),
        "right_clavicle": ("RightShoulder", "mixamorig:RightShoulder"),
        "right_upper_arm": ("RightArm", "mixamorig:RightArm"),
        "right_forearm": ("RightForeArm", "mixamorig:RightForeArm"),
        "right_hand": ("RightHand", "mixamorig:RightHand"),
        "left_thigh": ("LeftUpLeg", "mixamorig:LeftUpLeg"),
        "left_calf": ("LeftLeg", "mixamorig:LeftLeg"),
        "left_foot": ("LeftFoot", "mixamorig:LeftFoot"),
        "left_toe": ("LeftToeBase", "mixamorig:LeftToeBase"),
        "right_thigh": ("RightUpLeg", "mixamorig:RightUpLeg"),
        "right_calf": ("RightLeg", "mixamorig:RightLeg"),
        "right_foot": ("RightFoot", "mixamorig:RightFoot"),
        "right_toe": ("RightToeBase", "mixamorig:RightToeBase"),
    },
    "GIGANTIC_UNREAL": {
        "root": ("b_Root", "Root", "root"),
        "pelvis": ("b_Pelvis", "b_Hips", "Pelvis"),
        "spine_lower": ("b_Spine", "b_Spine1"),
        "spine_middle": ("b_Spine1", "b_Spine2"),
        "spine_upper": ("b_Spine2", "b_Spine3", "b_Ribcage"),
        "neck": ("b_Neck", "b_Neck1"),
        "head": ("b_Head",),
        "left_clavicle": ("b_LeftClavicle", "b_LeftShoulder"),
        "left_upper_arm": ("b_LeftUpperArm", "b_LeftArm"),
        "left_forearm": ("b_LeftForeArm",),
        "left_hand": ("b_LeftHand",),
        "right_clavicle": ("b_RightClavicle", "b_RightShoulder"),
        "right_upper_arm": ("b_RightUpperArm", "b_RightArm"),
        "right_forearm": ("b_RightForeArm",),
        "right_hand": ("b_RightHand",),
        "left_thigh": ("b_LeftUpLeg", "b_LeftThigh"),
        "left_calf": ("b_LeftLeg", "b_LeftCalf"),
        "left_foot": ("b_LeftFoot",),
        "left_toe": ("b_LeftToeBase", "b_LeftToe"),
        "right_thigh": ("b_RightUpLeg", "b_RightThigh"),
        "right_calf": ("b_RightLeg", "b_RightCalf"),
        "right_foot": ("b_RightFoot",),
        "right_toe": ("b_RightToeBase", "b_RightToe"),
    },
    "ALIEN_RIG": {
        "root": ("Root", "root"),
        "pelvis": ("Hips", "pelvis"),
        "spine_lower": ("Spine",),
        "spine_middle": ("Spine1",),
        "head": ("Head",),
        "left_upper_arm": ("LeftArm",),
        "left_forearm": ("LeftForeArm",),
        "left_hand": ("LeftHand",),
        "right_upper_arm": ("RightArm",),
        "right_forearm": ("RightForeArm",),
        "right_hand": ("RightHand",),
        "left_thigh": ("LeftUpLeg",),
        "left_calf": ("LeftLeg",),
        "left_foot": ("LeftFoot",),
        "right_thigh": ("RightUpLeg",),
        "right_calf": ("RightLeg",),
        "right_foot": ("RightFoot",),
        "tail_base": ("Tail1",),
        "tail_mid": ("Tail2", "Tail3"),
        "tail_tip": ("Tail4",),
    },
    "POKEMON_ZA": {
        "root": ("Origin", "Root", "pm_root"),
        "pelvis": ("Waist", "Hips", "Center"),
        "spine_lower": ("SpineA", "Spine1"),
        "spine_middle": ("SpineB", "Spine2"),
        "neck": ("Neck",),
        "head": ("Head",),
        "left_upper_arm": ("ArmL", "UpperArmL", "ShoulderL"),
        "left_forearm": ("ForeArmL", "ArmL2"),
        "left_hand": ("HandL",),
        "right_upper_arm": ("ArmR", "UpperArmR", "ShoulderR"),
        "right_forearm": ("ForeArmR", "ArmR2"),
        "right_hand": ("HandR",),
        "left_thigh": ("LegL", "ThighL", "UpLegL"),
        "left_calf": ("KneeL", "CalfL", "LegL2"),
        "left_foot": ("FootL",),
        "left_toe": ("ToeL",),
        "right_thigh": ("LegR", "ThighR", "UpLegR"),
        "right_calf": ("KneeR", "CalfR", "LegR2"),
        "right_foot": ("FootR",),
        "right_toe": ("ToeR",),
        "tail_base": ("TailA", "Tail1"),
        "tail_mid": ("TailB", "Tail2"),
        "tail_tip": ("TailC", "Tail3"),
    },
    "RIGIFY_BLENDER": {
        "root": ("root",),
        "pelvis": ("torso", "hips"),
        "spine_lower": ("spine",),
        "spine_middle": ("spine.001", "spine.002"),
        "spine_upper": ("chest",),
        "neck": ("neck",),
        "head": ("head",),
        "left_clavicle": ("shoulder.L",),
        "left_upper_arm": ("upper_arm.L",),
        "left_forearm": ("forearm.L",),
        "left_hand": ("hand.L",),
        "right_clavicle": ("shoulder.R",),
        "right_upper_arm": ("upper_arm.R",),
        "right_forearm": ("forearm.R",),
        "right_hand": ("hand.R",),
        "left_thigh": ("thigh.L",),
        "left_calf": ("shin.L",),
        "left_foot": ("foot.L",),
        "left_toe": ("toe.L",),
        "right_thigh": ("thigh.R",),
        "right_calf": ("shin.R",),
        "right_foot": ("foot.R",),
        "right_toe": ("toe.R",),
    }
}


@dataclass
class RoleMapping:
    role: str
    bone_name: Optional[str]
    status: str
    confidence: float
    method: str
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class RigMapError(Exception):
    pass


def _tokenize(name: str) -> List[str]:
    # Divide por underscores, pontos, dois pontos, hifens ou dígitos
    clean = re.sub(r"[:\.\-_]+", " ", name)
    # Divide CamelCase
    clean = re.sub(r"([a-z])([A-Z])", r"\1 \2", clean)
    return [t.lower() for t in clean.split() if t]


def _detect_template(bone_names: Sequence[str]) -> Tuple[str, float]:
    """Retorna o template mais aderente e a fração de matches de papéis-chave."""
    bones_set = set(bone_names)
    scores: Dict[str, float] = {}

    for t_name, mapping in KNOWN_TEMPLATES.items():
        matched = 0
        total = 0
        for role, candidates in mapping.items():
            total += 1
            if any(c in bones_set for c in candidates):
                matched += 1
        scores[t_name] = matched / max(1, total)

    best_template = max(scores, key=lambda k: scores[k])
    best_score = scores[best_template]

    if best_score >= 0.40:
        return best_template, round(best_score, 3)
    return "CUSTOM", round(best_score, 3)


def _heuristic_match_role(role: str, bone_names: Sequence[str], assigned_bones: Set[str]) -> Tuple[Optional[str], float, str]:
    """Heurística baseada em tokens quando não há match em template conhecido."""
    role_tokens_map = {
        "root": ({"root", "origin"}, {"motion", "master"}),
        "pelvis": ({"pelvis", "hips", "waist", "center", "crotch"}, set()),
        "spine_lower": ({"spine"}, {"1", "a", "lower"}),
        "spine_middle": ({"spine"}, {"2", "b", "mid", "middle"}),
        "spine_upper": ({"spine", "chest"}, {"3", "c", "upper", "ribcage"}),
        "chest": ({"chest", "ribcage"}, set()),
        "neck": ({"neck"}, set()),
        "head": ({"head"}, set()),
        "left_clavicle": ({"clavicle", "shoulder"}, {"l", "left"}),
        "left_upper_arm": ({"arm", "upperarm"}, {"l", "left"}),
        "left_forearm": ({"forearm", "arm2"}, {"l", "left"}),
        "left_hand": ({"hand", "wrist"}, {"l", "left"}),
        "right_clavicle": ({"clavicle", "shoulder"}, {"r", "right"}),
        "right_upper_arm": ({"arm", "upperarm"}, {"r", "right"}),
        "right_forearm": ({"forearm", "arm2"}, {"r", "right"}),
        "right_hand": ({"hand", "wrist"}, {"r", "right"}),
        "left_thigh": ({"thigh", "upleg", "leg"}, {"l", "left"}),
        "left_calf": ({"calf", "shin", "knee", "leg2"}, {"l", "left"}),
        "left_foot": ({"foot", "ankle"}, {"l", "left"}),
        "left_toe": ({"toe"}, {"l", "left"}),
        "right_thigh": ({"thigh", "upleg", "leg"}, {"r", "right"}),
        "right_calf": ({"calf", "shin", "knee", "leg2"}, {"r", "right"}),
        "right_foot": ({"foot", "ankle"}, {"r", "right"}),
        "right_toe": ({"toe"}, {"r", "right"}),
        "tail_base": ({"tail"}, {"1", "a", "base"}),
        "tail_mid": ({"tail"}, {"2", "b", "mid"}),
        "tail_tip": ({"tail"}, {"tip", "end", "3", "c"}),
        "jaw": ({"jaw", "mouth"}, set()),
        "left_ear": ({"ear"}, {"l", "left"}),
        "right_ear": ({"ear"}, {"r", "right"}),
        "left_wing": ({"wing"}, {"l", "left"}),
        "right_wing": ({"wing"}, {"r", "right"}),
        "prop": ({"prop", "weapon", "sword", "shield"}, set()),
    }

    if role not in role_tokens_map:
        return None, 0.0, "Papel não reconhecido"

    primary, secondary = role_tokens_map[role]
    candidates: List[Tuple[str, float]] = []

    for name in bone_names:
        if name in assigned_bones:
            continue
        toks = set(_tokenize(name))
        
        # Checa primários
        p_matches = primary.intersection(toks)
        if not p_matches:
            continue
            
        score = 0.50 + 0.15 * len(p_matches)
        
        # Checa secundários / lateralidade
        if secondary:
            s_matches = secondary.intersection(toks)
            if s_matches:
                score += 0.25
            else:
                # Se exige lateralidade e não encontrou, penaliza fortemente
                if any(side in secondary for side in ("l", "left", "r", "right")):
                    # Verifica se o outro lado está presente
                    opposite = {"r", "right"} if ("l" in secondary or "left" in secondary) else {"l", "left"}
                    if opposite.intersection(toks):
                        continue # osso do lado oposto!
                    score -= 0.20
        else:
            # Papéis centrais não devem conter tokens de lateralidade
            if any(side in toks for side in ("l", "left", "r", "right")):
                score -= 0.30

        candidates.append((name, max(0.0, min(1.0, score))))

    if not candidates:
        return None, 0.0, "Nenhum osso candidato encontrado"

    candidates.sort(key=lambda x: x[1], reverse=True)
    best_name, best_score = candidates[0]

    # Se há empate no score mais alto
    if len(candidates) > 1 and abs(candidates[0][1] - candidates[1][1]) < 0.05 and candidates[0][1] < 0.80:
        return best_name, round(best_score * 0.7, 2), f"Ambiguidade entre '{candidates[0][0]}' e '{candidates[1][0]}'"

    return best_name, round(best_score, 2), "Mapeado por heurística de tokens"


def build_rig_map(
    bone_names: Sequence[str],
    rig_id: str = "custom_rig",
    armature_name: str = "Armature",
    overrides: Optional[Dict[str, str]] = None,
    absent_roles: Optional[Sequence[str]] = None,
    enforce_roles: Optional[Sequence[str]] = None,
) -> Dict[str, Any]:
    """Gera um documento de mapeamento anatômico semântico no formato arenamon.rig-map/1.

    Args:
        bone_names: Lista dos nomes exatos de todos os ossos do armature.
        rig_id: Identificador legível do modelo ou armature.
        armature_name: Nome do objeto Armature no Blender.
        overrides: Dicionário {role: bone_name} para fixar papéis manualmente com confiança 1.0.
        absent_roles: Papéis expressamente inexistentes neste personagem (ex: ser sem cauda ou sem asas).
        enforce_roles: Subconjunto de papéis a mapear (se None, avalia ALL_CANONICAL_ROLES).
    """
    if not bone_names:
        raise RigMapError("A lista de nomes de ossos não pode estar vazia.")

    unique_bones = list(dict.fromkeys(bone_names))
    bones_set = set(unique_bones)
    overrides = overrides or {}
    declared_absent = set(absent_roles or [])
    target_roles = tuple(enforce_roles) if enforce_roles else ALL_CANONICAL_ROLES

    # Valida overrides
    for role, bname in overrides.items():
        if role not in ALL_CANONICAL_ROLES:
            raise RigMapError(f"Override com papel canônico inválido: '{role}'")
        if bname is not None and bname not in bones_set:
            raise RigMapError(f"Osso do override '{bname}' não existe no armature.")

    template_name, template_fit = _detect_template(unique_bones)
    template_data = KNOWN_TEMPLATES.get(template_name, {})

    assigned_bones: Set[str] = set()
    mappings: Dict[str, Dict[str, Any]] = {}
    overrides_applied: Dict[str, str] = {}

    # 1. Aplica overrides manuais primeiro
    for role in target_roles:
        if role in overrides:
            bname = overrides[role]
            if bname is None:
                mappings[role] = RoleMapping(
                    role=role,
                    bone_name=None,
                    status=STATUS_ABSENT,
                    confidence=1.0,
                    method=METHOD_OVERRIDE,
                    notes="Declarado ausente via override explícito"
                ).to_dict()
            else:
                mappings[role] = RoleMapping(
                    role=role,
                    bone_name=bname,
                    status=STATUS_MAPPED,
                    confidence=1.0,
                    method=METHOD_OVERRIDE,
                    notes=f"Fixado explicitamente por override em '{bname}'"
                ).to_dict()
                assigned_bones.add(bname)
                overrides_applied[role] = bname

    # 2. Avalia papéis declarados ausentes
    for role in target_roles:
        if role in mappings:
            continue
        if role in declared_absent:
            mappings[role] = RoleMapping(
                role=role,
                bone_name=None,
                status=STATUS_ABSENT,
                confidence=1.0,
                method=METHOD_OVERRIDE,
                notes="Declarado ausente pela anatomia do modelo"
            ).to_dict()

    # 3. Mapeia por template conhecido
    if template_data:
        for role in target_roles:
            if role in mappings:
                continue
            candidates = template_data.get(role, ())
            found_bone = None
            for c in candidates:
                if c in bones_set and c not in assigned_bones:
                    found_bone = c
                    break
            if found_bone:
                mappings[role] = RoleMapping(
                    role=role,
                    bone_name=found_bone,
                    status=STATUS_MAPPED,
                    confidence=0.95,
                    method=METHOD_KNOWN_TEMPLATE,
                    notes=f"Template {template_name} match exato em '{found_bone}'"
                ).to_dict()
                assigned_bones.add(found_bone)

    # 4. Mapeia restantes por heurística de tokens
    for role in target_roles:
        if role in mappings:
            continue
        bname, conf, note = _heuristic_match_role(role, unique_bones, assigned_bones)
        if bname and conf >= CONFIDENCE_THRESHOLD_LOW:
            status = STATUS_MAPPED if conf >= CONFIDENCE_THRESHOLD_HIGH else STATUS_AMBIGUOUS
            mappings[role] = RoleMapping(
                role=role,
                bone_name=bname,
                status=status,
                confidence=conf,
                method=METHOD_TOKEN_HEURISTIC,
                notes=note
            ).to_dict()
            assigned_bones.add(bname)
        else:
            mappings[role] = RoleMapping(
                role=role,
                bone_name=None,
                status=STATUS_UNMAPPED,
                confidence=0.0,
                method=METHOD_NOT_FOUND,
                notes="Nenhum candidato com confiança mínima satisfatória"
            ).to_dict()

    # Estatísticas de confiança
    mapped_roles = [m for m in mappings.values() if m["status"] in (STATUS_MAPPED, STATUS_AMBIGUOUS)]
    confidences = [m["confidence"] for m in mapped_roles]
    low_conf = [m["role"] for m in mapped_roles if m["confidence"] < CONFIDENCE_THRESHOLD_HIGH]

    unmapped_bones = [b for b in unique_bones if b not in assigned_bones]

    rig_map_doc = {
        "schema": SCHEMA_NAME,
        "rig_id": rig_id,
        "armature_name": armature_name,
        "detected_template": template_name,
        "template_fit": template_fit,
        "total_bones": len(unique_bones),
        "mapped_count": len(mapped_roles),
        "unmapped_bones_count": len(unmapped_bones),
        "absent_roles": sorted(list(declared_absent.union({r for r, m in mappings.items() if m["status"] == STATUS_ABSENT}))),
        "unmapped_bones": unmapped_bones,
        "overrides_applied": overrides_applied,
        "confidence_summary": {
            "min": round(min(confidences), 3) if confidences else 0.0,
            "max": round(max(confidences), 3) if confidences else 0.0,
            "mean": round(sum(confidences) / max(1, len(confidences)), 3) if confidences else 0.0,
            "low_confidence_roles": low_conf,
        },
        "roles": mappings,
    }

    validate_rig_map(rig_map_doc)
    return rig_map_doc


def validate_rig_map(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Valida um dicionário contra as regras de integridade do arenamon.rig-map/1.

    Retorna (is_valid, error_list). Lança RigMapError em caso de invalidade estrita.
    """
    errors: List[str] = []

    if not isinstance(data, dict):
        raise RigMapError("O documento deve ser um objeto JSON.")

    if data.get("schema") != SCHEMA_NAME:
        errors.append(f"Campo 'schema' deve ser '{SCHEMA_NAME}', recebido '{data.get('schema')}'")

    for req_field in ("rig_id", "armature_name", "detected_template", "total_bones", "roles"):
        if req_field not in data:
            errors.append(f"Campo obrigatório ausente: '{req_field}'")

    roles = data.get("roles", {})
    if not isinstance(roles, dict):
        errors.append("O campo 'roles' deve ser um dicionário.")
    else:
        assigned_bones: Dict[str, str] = {}
        for r_name, r_data in roles.items():
            if not isinstance(r_data, dict):
                errors.append(f"Papel '{r_name}' deve conter um objeto RoleMapping.")
                continue
            for rf in ("role", "status", "confidence", "method"):
                if rf not in r_data:
                    errors.append(f"Papel '{r_name}' sem campo obrigatório '{rf}'")

            st = r_data.get("status")
            if st not in VALID_STATUSES:
                errors.append(f"Status inválido '{st}' no papel '{r_name}'")

            conf = r_data.get("confidence", 0.0)
            if not (0.0 <= conf <= 1.0):
                errors.append(f"Confiança fora da faixa [0.0, 1.0] no papel '{r_name}': {conf}")

            bname = r_data.get("bone_name")
            if bname:
                # Regra de não-duplicação: um osso não pode ser mapeado para múltiplos papéis
                if bname in assigned_bones:
                    other_role = assigned_bones[bname]
                    errors.append(f"Colisão de osso: '{bname}' mapeado simultaneamente para '{other_role}' e '{r_name}'")
                else:
                    assigned_bones[bname] = r_name

    if errors:
        raise RigMapError("Falha de validação no rig-map:\n- " + "\n- ".join(errors))

    return True, []


def resolve_bone_role(
    bone_names: Sequence[str],
    role: str,
    rig_map: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Resolve o nome original de um osso para um determinado papel canônico.

    Se rig_map não for fornecido, constrói sob demanda a partir de bone_names.
    Retorna o nome original do osso se mapeado, ou None se ausente/não-mapeado.
    """
    if rig_map is None:
        rig_map = build_rig_map(bone_names)
    role_entry = rig_map.get("roles", {}).get(role)
    if role_entry and role_entry.get("status") in (STATUS_MAPPED, STATUS_AMBIGUOUS):
        return role_entry.get("bone_name")
    return None

