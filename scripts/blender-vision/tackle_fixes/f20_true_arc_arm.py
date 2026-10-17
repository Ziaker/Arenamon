import math

DESCRIPTION = ("CORRECAO DO ARCO (o diretor viu: 'nao e um arco, e uma reta que se entorta'): a mao D dava um salto de 1.07 m em UM frame (g3->g4), subia em linha reta e descia em diagonal reta. "
               "Agora o braco D gira em torno do ombro num ARCO circular de ~213 graus (de tras/alto, g3, ate a frente/baixo, g17), com velocidade angular em SINO (pico unico ~35 graus/frame em g8-g9, chegada suave em g17) e deslocamento lateral suave da direita para a esquerda (cruza a frente do tronco em ~g11). "
               "Tronco, quadril e pernas inalterados.")

# velocidade angular por frame (graus/frame) de g3->g4 ... g16->g17; soma 213
_raw = [math.exp(-(((g + 0.5) - 8.8) / 3.4) ** 2) for g in range(3, 17)]          # sino de velocidade: pico unico ~g8-g9, chegada suave
VEL = [213.0 * r / sum(_raw) for r in _raw]
PHI0 = -55.0


def S(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


EXTRA = {15: 4.0, 16: 8.0, 17: 11.0}          # compensa o ombro subindo quando o lunge assenta (senao a mao subiria no fim do arco)


def phi(g):
    if g <= 3:
        return PHI0
    base = PHI0 + sum(VEL[: min(g, 17) - 3])
    return base + EXTRA.get(g, EXTRA[17] if g > 17 else 0.0)


def direction(g, ph):
    lat = -0.35 + 1.15 * S((min(g, 17) - 5) / 12.0)
    r = math.sqrt(max(0.0, 1.0 - lat * lat))
    return (lat, r * math.cos(math.radians(ph)), r * math.sin(math.radians(ph)))


def apply(ctx):
    pl, arm = ctx.pl, ctx.arm
    for g in range(3, 27):
        ctx.go(g)
        ph = phi(g)
        if g >= 18:                      # sustentacao: pequeno assentamento (+-2.5 graus) em torno do fim do arco
            ph = phi(17) + 2.5 * math.sin(2 * math.pi * (g - 17) / 8.0)
        d = direction(g, ph)
        for b in ("RightArm", "RightForeArm", "RightHand"):
            pl.aim_fix(arm, b, d)
        pl.key(arm, ["RightArm", "RightForeArm", "RightHand"], g + 1)
        ctx.log.append("g%d: phi %.1f dir (%.2f,%.2f,%.2f)" % (g, ph, *d))
    pl.set_interp(ctx.action, "BEZIER", frames=set(range(4, 28)))
