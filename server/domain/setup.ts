import { CommandBusImpl } from './commands/CommandBusImpl';
import { CommandHandlerRegistry } from './commands/handlers/CommandHandlerRegistry';

// Middlewares
import { AuthorizationMiddleware } from './commands/middlewares/AuthorizationMiddleware';
import type { AuthorizationService, CommandCapabilityMap } from './commands/middlewares/AuthorizationMiddleware';
import { IdempotencyMiddleware } from './commands/middlewares/IdempotencyMiddleware';
import { TransactionMiddleware } from './commands/middlewares/TransactionMiddleware';
import { OutboxMiddleware } from './commands/middlewares/OutboxMiddleware';

// Infrastructure
import { PgCommandLogRepository } from '../infrastructure/postgres/PgCommandLogRepository';
import { PostgresEventPublisher } from '../infrastructure/events/PostgresEventPublisher';

// Trading Domain
import { OrderRepository } from './trading/OrderRepository';
import {
  CreateOrderHandler,
  UpdateOrderFillHandler,
  CancelOrderHandler,
  ExpireOrderHandler
} from './trading/TradingHandlers';

// Payment Domain
import { DrizzlePaymentRepository } from './payments/PaymentRepository';
import {
  CreatePaymentHandler,
  ReceiveWebhookHandler,
  CompletePaymentHandler,
  FailPaymentHandler,
  ReconcilePaymentHandler,
  UpdatePaymentMetadataHandler,
} from './payments/PaymentHandlers';

// Vault Domain
import { DrizzleVaultRepository } from './vaults/VaultRepository';
import {
  CreateVaultHandler,
  DepositVaultHandler,
  WithdrawVaultHandler,
} from './vaults/VaultHandlers';

// ---------------------------------------------------------------------------
// Mock Implementations for Phase 1
// ---------------------------------------------------------------------------

class MockAuthorizationService implements AuthorizationService {
  async getCapabilities(actor: string): Promise<string[]> {
    // For Phase 1, assume all actors have superuser capabilities
    return ['*'];
  }
}

class MockCommandCapabilityMap implements CommandCapabilityMap {
  getRequiredCapability(commandType: string): string | undefined {
    return undefined; // Unrestricted for now
  }
}

// ---------------------------------------------------------------------------
// Composition Root
// ---------------------------------------------------------------------------

// 1. Repositories & Publishers
const commandLogRepo = new PgCommandLogRepository();
const eventPublisher = new PostgresEventPublisher();
const orderRepo = new OrderRepository();
const paymentRepo = new DrizzlePaymentRepository();

// 2. Middlewares
const authMiddleware = new AuthorizationMiddleware(
  new MockAuthorizationService(),
  new MockCommandCapabilityMap()
);
const idempotencyMiddleware = new IdempotencyMiddleware(commandLogRepo);
const transactionMiddleware = new TransactionMiddleware();
const outboxMiddleware = new OutboxMiddleware(eventPublisher);

// 3. Registry & Handlers
const registry = new CommandHandlerRegistry();

// Trading
registry.register(new CreateOrderHandler(orderRepo));
registry.register(new UpdateOrderFillHandler(orderRepo));
registry.register(new CancelOrderHandler(orderRepo));
registry.register(new ExpireOrderHandler(orderRepo));

// Payments
registry.register(new CreatePaymentHandler(paymentRepo));
registry.register(new ReceiveWebhookHandler(paymentRepo));
registry.register(new CompletePaymentHandler(paymentRepo));
registry.register(new FailPaymentHandler(paymentRepo));
registry.register(new ReconcilePaymentHandler(paymentRepo));
registry.register(new UpdatePaymentMetadataHandler(paymentRepo));

// Vault
const vaultRepo = new DrizzleVaultRepository();
registry.register(new CreateVaultHandler(vaultRepo));
registry.register(new DepositVaultHandler(vaultRepo));
registry.register(new WithdrawVaultHandler(vaultRepo));

// 4. CommandBus (Pipeline order matters!)
export const commandBus = new CommandBusImpl(
  [
    authMiddleware,
    // ValidationMiddleware would go here
    idempotencyMiddleware, // Tracks lifecycle, locks execution
    transactionMiddleware, // Opens DB transaction for the handler + outbox
    outboxMiddleware,      // Takes handler events and writes them to the outbox in the tx
  ],
  registry
);
