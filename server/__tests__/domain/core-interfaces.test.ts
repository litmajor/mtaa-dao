import { describe, it, expect } from 'vitest';
import { EventCatalog } from '../../domain/events/catalog';
import { DomainEvent } from '../../domain/events/DomainEvent';
import { Command } from '../../domain/commands/Command';
import { CommandResult } from '../../domain/commands/CommandBus';

describe('Phase 1: Core Interfaces & Types', () => {
  it('EventCatalog should contain expected strict event types', () => {
    expect(EventCatalog.OrderFilled).toBe('OrderFilled');
    expect(EventCatalog.CandleClosed).toBe('CandleClosed');
    
    // Enforce that values match keys
    Object.entries(EventCatalog).forEach(([key, value]) => {
      expect(key).toBe(value);
    });
  });

  it('DomainEvent interface allows required metadata and payload typing', () => {
    const mockEvent: DomainEvent<{ price: number }> = {
      id: 'uuid-123',
      type: EventCatalog.OrderFilled,
      version: 1,
      aggregateType: 'Order',
      aggregateId: 'ord-123',
      correlationId: 'corr-123',
      actor: 'system',
      timestamp: new Date(),
      payload: { price: 64000 },
      metadata: {
        source: 'binance-adapter',
        environment: 'production',
        schemaVersion: 1,
      },
    };

    expect(mockEvent.type).toBe('OrderFilled');
    expect(mockEvent.payload.price).toBe(64000);
    expect(mockEvent.metadata.schemaVersion).toBe(1);
  });

  it('Command interface allows required intent tracking', () => {
    const mockCommand: Command<{ vaultId: string }> = {
      id: 'cmd-123',
      type: 'RequestRebalance',
      actor: 'user_xyz',
      correlationId: 'corr-xyz',
      timestamp: new Date(),
      payload: { vaultId: 'vlt-123' },
    };

    expect(mockCommand.id).toBe('cmd-123');
    expect(mockCommand.payload.vaultId).toBe('vlt-123');
  });
  
  it('CommandResult encapsulates successful execution state', () => {
    const result: CommandResult = {
      success: true,
      commandId: 'cmd-123',
      eventsCreated: ['evt-1', 'evt-2'],
    };
    
    expect(result.success).toBe(true);
    expect(result.eventsCreated.length).toBe(2);
  });
});
