import { isErr, isOk } from '../../../../shared/kernel/result';
import {
  EstadoSolicitud,
  type EstadoSolicitudValue,
  InvalidStateTransitionError,
} from './estado-solicitud.vo';

describe('EstadoSolicitud (máquina de estados)', () => {
  describe('factory methods', () => {
    it('initial() devuelve DRAFT', () => {
      expect(EstadoSolicitud.initial().value).toBe('DRAFT');
    });
    it('from(value) devuelve un VO con ese valor', () => {
      expect(EstadoSolicitud.from('IN_REVIEW').value).toBe('IN_REVIEW');
    });
  });

  describe('transiciones permitidas', () => {
    const validTransitions: Array<[EstadoSolicitudValue, EstadoSolicitudValue]> = [
      ['DRAFT', 'IN_REVIEW'],
      ['DRAFT', 'ABANDONED'],
      ['IN_REVIEW', 'APPROVED'],
      ['IN_REVIEW', 'REJECTED'],
      ['IN_REVIEW', 'ABANDONED'],
      ['APPROVED', 'FINALIZED'],
      ['APPROVED', 'ABANDONED'],
    ];

    it.each(validTransitions)('%s → %s es ok', (from, to) => {
      const result = EstadoSolicitud.from(from).transitionTo(to);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value.value).toBe(to);
    });
  });

  describe('transiciones inválidas (todas las combinaciones)', () => {
    const allStates: EstadoSolicitudValue[] = [
      'DRAFT',
      'IN_REVIEW',
      'APPROVED',
      'REJECTED',
      'FINALIZED',
      'ABANDONED',
    ];
    const validSet = new Set([
      'DRAFT->IN_REVIEW',
      'DRAFT->ABANDONED',
      'IN_REVIEW->APPROVED',
      'IN_REVIEW->REJECTED',
      'IN_REVIEW->ABANDONED',
      'APPROVED->FINALIZED',
      'APPROVED->ABANDONED',
    ]);

    const invalidPairs: Array<[EstadoSolicitudValue, EstadoSolicitudValue]> = [];
    for (const from of allStates) {
      for (const to of allStates) {
        if (from === to) continue;
        if (!validSet.has(`${from}->${to}`)) invalidPairs.push([from, to]);
      }
    }

    it.each(invalidPairs)('%s → %s rechaza con InvalidStateTransitionError', (from, to) => {
      const result = EstadoSolicitud.from(from).transitionTo(to);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(InvalidStateTransitionError);
        expect(result.error.code).toBe('INVALID_STATE_TRANSITION');
        expect(result.error.details).toMatchObject({ from, to });
      }
    });
  });

  describe('estados terminales', () => {
    it.each([['REJECTED'], ['FINALIZED'], ['ABANDONED']] as const)(
      '%s es terminal',
      (state) => {
        expect(EstadoSolicitud.from(state).isTerminal()).toBe(true);
      },
    );
    it.each([['DRAFT'], ['IN_REVIEW'], ['APPROVED']] as const)(
      '%s NO es terminal',
      (state) => {
        expect(EstadoSolicitud.from(state).isTerminal()).toBe(false);
      },
    );
  });

  describe('inmutabilidad', () => {
    it('transitionTo no muta el VO original', () => {
      const draft = EstadoSolicitud.initial();
      const result = draft.transitionTo('IN_REVIEW');
      expect(draft.value).toBe('DRAFT'); // sin cambios
      expect(isOk(result) && result.value.value).toBe('IN_REVIEW');
    });
  });

  describe('equals', () => {
    it('compara por valor, no por referencia', () => {
      const a = EstadoSolicitud.from('APPROVED');
      const b = EstadoSolicitud.from('APPROVED');
      const c = EstadoSolicitud.from('REJECTED');
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });

  describe('canTransitionTo', () => {
    it('responde true para transiciones válidas', () => {
      expect(EstadoSolicitud.from('IN_REVIEW').canTransitionTo('APPROVED')).toBe(true);
    });
    it('responde false para transiciones inválidas', () => {
      expect(EstadoSolicitud.from('FINALIZED').canTransitionTo('IN_REVIEW')).toBe(false);
    });
  });
});
