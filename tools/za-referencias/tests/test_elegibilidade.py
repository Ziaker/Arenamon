"""Filtro de espécies do lote 03: sem baby; só 2º/3º estágio; sem evolução só se o egg group for Humanoide ou Monster."""
import os
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import elegibilidade  # noqa: E402

MONSTER, HUMANSHAPE, WATER1 = 1, 8, 2


def sp(i, de=None, cadeia=1, baby=0):
    return {"id": i, "evolves_from_species_id": de, "evolution_chain_id": cadeia, "is_baby": baby}


class TestEstagio(unittest.TestCase):
    def test_estagios_da_linha(self):
        e = elegibilidade.estagios([sp(1), sp(2, 1), sp(3, 2)])
        self.assertEqual((e[1], e[2], e[3]), (1, 2, 3))


class TestElegiveis(unittest.TestCase):
    def _run(self, especies, ovos):
        return elegibilidade.elegiveis(especies, ovos)

    def test_segundo_e_terceiro_estagio_entram(self):
        r = self._run([sp(1), sp(2, 1), sp(3, 2)], {})
        self.assertEqual(r, {2, 3})

    def test_primeiro_estagio_com_evolucao_fica_de_fora(self):
        self.assertNotIn(1, self._run([sp(1), sp(2, 1)], {1: {MONSTER}}))

    def test_baby_fica_de_fora_mas_a_evolucao_dele_entra(self):
        r = self._run([sp(1, baby=1), sp(2, 1), sp(3, 2)], {})
        self.assertNotIn(1, r)
        self.assertEqual(r, {2, 3})   # Pichu fora; Pikachu (2º estágio da linha) e Raichu entram

    def test_sem_evolucao_so_com_humanoide_ou_monster(self):
        esp = [sp(10, cadeia=10), sp(11, cadeia=11), sp(12, cadeia=12)]
        r = self._run(esp, {10: {HUMANSHAPE}, 11: {MONSTER, WATER1}, 12: {WATER1}})
        self.assertEqual(r, {10, 11})

    def test_sem_evolucao_e_sem_egg_group_fica_de_fora(self):
        self.assertEqual(self._run([sp(20, cadeia=20)], {}), set())

    def test_ramificada_conta_estagio_pela_pre_evolucao(self):
        r = self._run([sp(133, cadeia=67), sp(134, 133, 67), sp(135, 133, 67)], {})
        self.assertEqual(r, {134, 135})


if __name__ == "__main__":
    unittest.main()
