import { describe, it, expect, vi } from 'vitest';
import { CorrelationContext } from '../../observability/CorrelationContext';
import { correlationMiddleware } from '../../observability/middleware';
import { runWorkerTask } from '../../observability/workerContext';
import type { Request, Response, NextFunction } from 'express';

describe('Phase 0: Observability & Safety', () => {

  describe('CorrelationContext', () => {
    it('should propagate correlationId within context', () => {
      CorrelationContext.run({ correlationId: 'test-123', actor: 'system' }, () => {
        expect(CorrelationContext.getCorrelationId()).toBe('test-123');
        expect(CorrelationContext.getActor()).toBe('system');
        
        // Nested context simulation (e.g., calling another function)
        const innerFunction = () => {
          return CorrelationContext.getCorrelationId();
        };
        expect(innerFunction()).toBe('test-123');
      });
    });

    it('should return undefined outside context', () => {
      expect(CorrelationContext.getCorrelationId()).toBeUndefined();
    });
  });

  describe('Express Middleware', () => {
    it('should use provided x-correlation-id header', () => {
      const req = {
        headers: {
          'x-correlation-id': 'client-provided-id'
        },
      } as unknown as Request;
      const res = {} as Response;
      
      const next = vi.fn(() => {
        expect(CorrelationContext.getCorrelationId()).toBe('client-provided-id');
        expect(CorrelationContext.getActor()).toBe('anonymous');
      });

      correlationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should generate a UUID if header is missing', () => {
      const req = {
        headers: {}
      } as Request;
      const res = {} as Response;
      
      const next = vi.fn(() => {
        const id = CorrelationContext.getCorrelationId();
        expect(id).toBeDefined();
        expect(typeof id).toBe('string');
        // basic UUID format check
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      correlationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
    
    it('should extract actor from req.user if authenticated', () => {
      const req = {
        headers: {},
        user: { id: 'admin123' }
      } as unknown as Request;
      const res = {} as Response;
      
      const next = vi.fn(() => {
        expect(CorrelationContext.getActor()).toBe('user_admin123');
      });

      correlationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Worker Context', () => {
    it('should inject correlationId and system actor for worker tasks', async () => {
      let capturedId: string | undefined;
      
      await runWorkerTask('test_job', async () => {
        capturedId = CorrelationContext.getCorrelationId();
        expect(CorrelationContext.getActor()).toBe('system');
      });
      
      expect(capturedId).toBeDefined();
    });
    
    it('should re-throw errors from worker task', async () => {
      await expect(runWorkerTask('fail_job', async () => {
        throw new Error('Worker failure');
      })).rejects.toThrow('Worker failure');
    });
  });

});
