import {classifyComposerEvent, type ComposerEventType} from './events';
import {validateJsonData} from '../core/json-safety';

export interface EventEnvelope {
  eventId: string; tick: number; seed: number; result: string;
  position: {x: number; y: number; z: number};
}
export interface AcceptedEvent extends EventEnvelope {type: ComposerEventType}

// O produtor fornece identidade/contato: nenhum evento é inferido a partir da aparência.
export class EventStream {
  private readonly seen = new Set<string>();
  constructor(private readonly capacity = 10000) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 100000) throw new Error('Capacidade inválida');
  }
  accept(input: unknown): {ok: true; event: Readonly<AcceptedEvent>} | {ok: false; reason: string} {
    if (validateJsonData(input).length) return {ok: false, reason: 'Dados de evento inválidos'};
    if (!input || typeof input !== 'object') return {ok: false, reason: 'Evento inválido'};
    const event = input as EventEnvelope;
    if (typeof event.eventId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(event.eventId) || !Number.isSafeInteger(event.tick) || event.tick < 0 || !Number.isInteger(event.seed) || event.seed < 0 || event.seed > 0xffffffff) return {ok: false, reason: 'Identidade, tick ou seed inválidos'};
    const type = classifyComposerEvent(event.result);
    if (type === 'unsupported') return {ok: false, reason: 'Evento desconhecido'};
    const p = event.position;
    if (!p || ![p.x, p.y, p.z].every(n => typeof n === 'number' && Number.isFinite(n))) return {ok: false, reason: 'Contato ausente ou inválido'};
    if (this.seen.has(event.eventId)) return {ok: false, reason: 'Evento duplicado'};
    if (this.seen.size >= this.capacity) return {ok: false, reason: 'Limite de eventos; iniciar nova sessão de replay'};
    this.seen.add(event.eventId);
    return {ok: true, event: Object.freeze({eventId: event.eventId, tick: event.tick, seed: event.seed, result: event.result, type, position: Object.freeze({x: p.x, y: p.y, z: p.z})})};
  }
  reset(): void {this.seen.clear();}
}
