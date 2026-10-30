import importlib.util
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


class QuantitativeTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec('ia_cinematica'), 'módulo de medição ainda não implementado')
        import ia_cinematica
        self.m = ia_cinematica

    def test_noise_is_not_onset_and_hold_is_separate(self):
        # Adding isolated noise to an onset detector must not move its onset.
        s = [0, 0.001, 0, 0.1, 0.2, 0.1, 0, 0, 0, 0, 0.3, 0.5, 0.2, 0]
        r = self.m.segment_signal(s, absolute_threshold=0.01, relative_threshold=0.1, min_run=2)
        self.assertEqual(r['intervalos'], [[3, 5], [10, 12]])
        self.assertEqual(r['picos'], [4, 11])
        self.assertEqual(r['inicio'], 3)

    def test_empty_or_static_signal_has_no_event(self):
        self.assertEqual(self.m.segment_signal([])['inicio'], None)
        self.assertEqual(self.m.segment_signal([0]*10)['picos'], [])

    def test_two_peaks_not_replaced_by_global_maximum(self):
        r = self.m.segment_signal([0, 1, 2, 1, 0, 1, 3, 1, 0], min_run=2)
        self.assertEqual(r['picos'], [2, 6])

    def test_velocity_indexes_destination_frame(self):
        import numpy as np
        p = np.array([[[0,0,0]], [[0,0,0]], [[0,0,2]], [[0,0,3]]], float)
        self.assertEqual(self.m.linear_speed(p, 2).ravel().tolist(), [0, 0, 4, 2])

    def test_visibility_masks_discontinuity_both_sides(self):
        import numpy as np
        p = np.array([[[0,0,0]], [[0,0,20]], [[0,0,1]], [[0,0,2]]], float)
        hidden = np.array([[False], [True], [False], [False]])
        self.assertEqual(self.m.linear_speed(p, 1, hidden).ravel().tolist(), [0, 0, 0, 1])


if __name__ == '__main__':
    unittest.main()
