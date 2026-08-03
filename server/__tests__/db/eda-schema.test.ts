import { describe, it, expect } from 'vitest';
import { domainEvents, processedEvents, commandLog } from '../../db/schema/eda';
import { getTableName } from 'drizzle-orm';

describe('Phase 1: EDA Database Schema', () => {

  describe('domain_events table', () => {
    it('should be named domain_events', () => {
      expect(getTableName(domainEvents)).toBe('domain_events');
    });

    it('should have required columns for outbox and OCC', () => {
      const cols = domainEvents;
      expect(cols.id).toBeDefined();
      expect(cols.eventType).toBeDefined();
      expect(cols.version).toBeDefined();
      expect(cols.aggregateType).toBeDefined();
      expect(cols.aggregateId).toBeDefined();
      expect(cols.payload).toBeDefined();
      expect(cols.actor).toBeDefined();
      expect(cols.publishAttempts).toBeDefined();
    });
  });

  describe('processed_events table', () => {
    it('should be named processed_events', () => {
      expect(getTableName(processedEvents)).toBe('processed_events');
    });

    it('should have required columns for recovery state machine', () => {
      const cols = processedEvents;
      expect(cols.eventId).toBeDefined();
      expect(cols.consumerName).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.processingStartedAt).toBeDefined();
      expect(cols.retryCount).toBeDefined();
    });
  });

  describe('command_log table', () => {
    it('should be named command_log', () => {
      expect(getTableName(commandLog)).toBe('command_log');
    });

    it('should have required columns for audit and replay', () => {
      const cols = commandLog;
      expect(cols.commandId).toBeDefined();
      expect(cols.payload).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.actor).toBeDefined();
    });
  });

});
