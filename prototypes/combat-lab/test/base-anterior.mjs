// Base de calibração de 22/10/2026 (congelada em fixtures/): testes de mecânica escritos contra ela continuam caracterizando o mesmo cenário
// depois que a 3ª exportação (28/10/2026) virou o padrão do jogo. O padrão atual é coberto por calibration-base.test.mjs e pelos testes de ambiente.
import {factoryDefaults} from '../src/sim/config.js';
import {applyCalibrationBase} from './fixtures/calibration-base-2026-10-22.mjs';
export const baseAnterior = () => applyCalibrationBase(factoryDefaults());
