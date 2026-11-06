import { sql, type SQL } from 'drizzle-orm';
import Decimal from 'decimal.js';

type LedgerTransaction = {
  execute: (query: SQL) => Promise<unknown>;
};

export async function postPlatformTransfer<Tx extends LedgerTransaction>(
  tx: Tx,
  input: {
    reference: string;
    fromAccountId: string;
    toAccountId: string;
    amount: string;
    currency: string;
    description: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const amount = new Decimal(input.amount);
  if (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 8) {
    throw new Error('Platform transfer amount must be positive and fit ledger precision');
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error('Platform transfer requires two distinct accounts');
  }
  if (!input.reference.trim()) {
    throw new Error('Platform transfer requires an idempotency reference');
  }

  await tx.execute(sql`SELECT set_config('app.platform_ledger_skip_delta', 'on', true)`);
  await tx.execute(sql`
    INSERT INTO public.platform_ledger_accounts
      (account_id, owner_type, owner_id, account_code, currency)
    SELECT account.id, 'platform_account', account.id::text, account.account_type, account.currency
    FROM public.accounts account
    WHERE account.id IN (${input.fromAccountId}::uuid, ${input.toAccountId}::uuid)
    ON CONFLICT (account_id) DO NOTHING
  `);

  const ledgerTransaction = await tx.execute(sql`
    INSERT INTO public.platform_ledger_transactions
      (reference, source_type, source_id, description, metadata)
    VALUES (
      ${`transfer:${input.reference}`},
      'internal_transfer',
      ${input.reference},
      ${input.description},
      ${JSON.stringify({
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amount: amount.toFixed(8),
        currency: input.currency,
        ...input.metadata,
      })}::jsonb
    )
    RETURNING id
  `);

  const transactionId = (ledgerTransaction as { rows?: Array<{ id: string }> }).rows?.[0]?.id;
  if (!transactionId) {
    throw new Error(`Failed to create journal transaction for transfer ${input.reference}`);
  }

  const debit = await tx.execute(sql`
    INSERT INTO public.platform_ledger_entries
      (transaction_id, ledger_account_id, side, amount)
    SELECT ${transactionId}::uuid, ledger.id, 'debit', ${amount.toFixed(8)}::numeric
    FROM public.platform_ledger_accounts ledger
    WHERE ledger.account_id = ${input.fromAccountId}::uuid
      AND ledger.currency = ${input.currency}
    RETURNING id
  `);
  const credit = await tx.execute(sql`
    INSERT INTO public.platform_ledger_entries
      (transaction_id, ledger_account_id, side, amount)
    SELECT ${transactionId}::uuid, ledger.id, 'credit', ${amount.toFixed(8)}::numeric
    FROM public.platform_ledger_accounts ledger
    WHERE ledger.account_id = ${input.toAccountId}::uuid
      AND ledger.currency = ${input.currency}
    RETURNING id
  `);

  const debitCount = (debit as { rows?: unknown[] }).rows?.length ?? 0;
  const creditCount = (credit as { rows?: unknown[] }).rows?.length ?? 0;
  if (debitCount !== 1 || creditCount !== 1) {
    throw new Error(`Unable to post both sides of platform transfer ${input.reference}`);
  }
}
