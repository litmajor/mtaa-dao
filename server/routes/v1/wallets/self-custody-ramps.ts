import { Router, type Request, type Response, type NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { isAuthenticated, requireAdmin } from '../../../auth';
import { KotaniSelfCustodyRampService, RampServiceError } from '../../../services/kotaniSelfCustodyRampService';
import { logger } from '../../../utils/logger';

const router = Router();

const phoneSchema = z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid international phone number.');
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Enter a valid EVM wallet address.');
const fiatAmountSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, 'KES amount supports up to 2 decimal places.')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero.');
const amountSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/, 'Enter a valid positive amount.')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero.');

const onrampQuoteSchema = z.object({
  phoneNumber: phoneSchema,
  walletAddress: addressSchema,
  fiatAmount: fiatAmountSchema,
});
const offrampQuoteSchema = z.object({
  phoneNumber: phoneSchema,
  walletAddress: addressSchema,
  cryptoAmount: amountSchema,
});
const transactionHashSchema = z.object({
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Enter a valid transaction hash.'),
});

export const kotaniRampWebhookRouter = Router();

function getUserId(req: Request): string | undefined {
  const user = (req as Request & { user?: { id?: string; claims?: Record<string, unknown> } }).user;
  const subject = user?.id || user?.claims?.sub;
  return typeof subject === 'string' ? subject : undefined;
}

function getRawBody(req: Request): Buffer | undefined {
  return (req as Request & { rawBody?: Buffer }).rawBody;
}

function verifyWebhook(req: Request, body: Record<string, unknown>): boolean {
  const rawBody = getRawBody(req);
  if (KotaniSelfCustodyRampService.getWebhookSignatureMode() === 'raw-body-header') {
    return rawBody
      ? KotaniSelfCustodyRampService.verifyWebhookSignature(
        rawBody,
        req.header('x-kotani-signature'),
        undefined,
        KotaniSelfCustodyRampService.getWebhookSignedBody(rawBody),
      )
      : false;
  }
  if (KotaniSelfCustodyRampService.getWebhookSignatureMode() === 'canonical-envelope') {
    const signature = typeof body.signature === 'string' ? body.signature : undefined;
    const canonicalBody = Buffer.from(JSON.stringify({ event: body.event, data: body.data }));
    return KotaniSelfCustodyRampService.verifyWebhookSignature(canonicalBody, signature);
  }
  return false;
}

async function handleWebhook(req: Request, res: Response): Promise<unknown> {
  let requestBody: unknown = req.body;
  const rawBody = getRawBody(req);
  if (rawBody) {
    try {
      requestBody = JSON.parse(rawBody.toString('utf8'));
    } catch {
      logger.warn('Invalid JSON in KotaniPay ramp webhook acknowledged');
      return res.status(400).json({ success: false, error: 'Invalid JSON payload.' });
    }
  }
  const parsedBody = z.object({
    event: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
    signature: z.string().optional(),
  }).passthrough().safeParse(requestBody);
  if (!parsedBody.success) {
    logger.warn('Malformed KotaniPay ramp webhook acknowledged', {
      error: parsedBody.error.message,
    });
    return res.status(400).json({ success: false, error: 'Malformed webhook payload.' });
  }

  const body = parsedBody.data;
  if (!verifyWebhook(req, body)) {
    logger.warn('Invalid KotaniPay ramp webhook signature acknowledged', { event: body.event });
    return res.status(401).json({ success: false, error: 'Invalid webhook signature.' });
  }
  const signatureMode = KotaniSelfCustodyRampService.getWebhookSignatureMode();
  const referenceId = typeof body.data.referenceId === 'string'
    ? body.data.referenceId
    : typeof body.data.reference_id === 'string' ? body.data.reference_id : undefined;
  if (!body.event.startsWith('transaction.onramp.')
    && !body.event.startsWith('transaction.offramp.')
    && body.event !== 'refund.completed'
    && body.event !== 'refund.failed') {
    return res.status(200).json({ success: true, received: true, ignored: true });
  }

  logger.info('Signed KotaniPay ramp webhook received', {
    event: body.event,
    referenceId,
    signatureMode,
  });
  const eventDigest = createHash('sha256')
    .update(JSON.stringify({ event: body.event, data: body.data }))
    .digest('hex');
  try {
    const inboxEvent = await KotaniSelfCustodyRampService.persistWebhookEvent(
      eventDigest,
      body.event,
      body.data,
    );
    if (inboxEvent.status === 'processed' || inboxEvent.status === 'processing') {
      return res.status(200).json({ success: true, received: true, duplicate: true, referenceId });
    }
    if (!await KotaniSelfCustodyRampService.claimWebhookEvent(eventDigest)) {
      return res.status(200).json({ success: true, received: true, duplicate: true, referenceId });
    }
    const webhookData = referenceId && typeof body.data.referenceId !== 'string'
      ? { ...body.data, referenceId }
      : body.data;
    const reconciled = await KotaniSelfCustodyRampService.reconcileWebhook(webhookData, body.event);
    if (!reconciled) {
      await KotaniSelfCustodyRampService.markWebhookEventFailed(eventDigest, 'No matching ramp transaction exists yet.');
      logger.warn('Signed KotaniPay webhook is stored for later reconciliation', { event: body.event, referenceId });
      return res.status(200).json({ success: true, received: true, pendingReconciliation: true, referenceId });
    }
    await KotaniSelfCustodyRampService.markWebhookEventProcessed(eventDigest);
    logger.info('KotaniPay ramp webhook reconciled', {
      event: body.event,
      referenceId: reconciled.referenceId,
      status: reconciled.status,
    });
    return res.status(200).json({
      success: true,
      received: true,
      referenceId: reconciled.referenceId,
      status: reconciled.status,
    });
  } catch (error) {
    await KotaniSelfCustodyRampService.markWebhookEventFailed(
      eventDigest,
      error instanceof Error ? error.message : 'Unknown reconciliation error',
    ).catch((inboxError: unknown) => {
      logger.error('KotaniPay webhook inbox failure could not be recorded', {
        referenceId,
        error: inboxError instanceof Error ? inboxError.message : 'Unknown inbox error',
      });
    });
    logger.error('KotaniPay ramp webhook reconciliation failed', {
      event: body.event,
      referenceId,
      error: error instanceof Error ? error.message : 'Unknown reconciliation error',
    });
    return res.status(500).json({ success: false, error: 'Webhook reconciliation failed.' });
  }
}

function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch((error: unknown) => {
      if (error instanceof RampServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }
      next(error);
    });
  };
}

kotaniRampWebhookRouter.post('/', (req, res) => {
  void handleWebhook(req, res);
});

router.post('/webhook', (req, res) => {
  void handleWebhook(req, res);
});

router.use(isAuthenticated);

router.get('/admin/open', requireAdmin, asyncRoute(async (_req, res) => {
  const transactions = await KotaniSelfCustodyRampService.listOpenTransactions();
  return res.json({ success: true, data: transactions });
}));

router.get('/admin/webhook-inbox', requireAdmin, asyncRoute(async (_req, res) => {
  const events = await KotaniSelfCustodyRampService.listUnresolvedWebhookEvents();
  return res.json({ success: true, data: events });
}));

router.get('/availability', (_req, res) => {
  return res.json({
    success: true,
    data: { enabled: KotaniSelfCustodyRampService.isAvailable(), chain: 'CELO', token: 'CUSD' },
  });
});

router.post('/onramp/quote', asyncRoute(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const input = onrampQuoteSchema.parse(req.body);
  const quote = await KotaniSelfCustodyRampService.createOnrampQuote({ ...input, userId });
  return res.status(201).json({ success: true, data: quote });
}));

router.post('/offramp/quote', asyncRoute(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const input = offrampQuoteSchema.parse(req.body);
  const quote = await KotaniSelfCustodyRampService.createOfframpQuote({ ...input, userId });
  return res.status(201).json({ success: true, data: quote });
}));

router.post('/:referenceId/initiate', asyncRoute(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const referenceId = z.string().uuid().parse(req.params.referenceId);
  const transaction = await KotaniSelfCustodyRampService.initiate(userId, referenceId);
  return res.status(201).json({ success: true, data: transaction });
}));

router.post('/:referenceId/transaction', asyncRoute(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const referenceId = z.string().uuid().parse(req.params.referenceId);
  const { transactionHash } = transactionHashSchema.parse(req.body);
  const transaction = await KotaniSelfCustodyRampService.recordOfframpTransaction(userId, referenceId, transactionHash);
  return res.json({ success: true, data: transaction });
}));

router.get('/history', asyncRoute(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const transactions = await KotaniSelfCustodyRampService.listUserTransactions(userId);
  return res.json({ success: true, data: transactions });
}));

router.get('/:referenceId', asyncRoute(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const referenceId = z.string().uuid().parse(req.params.referenceId);
  const transaction = await KotaniSelfCustodyRampService.getUserTransaction(userId, referenceId);
  if (!transaction) return res.status(404).json({ success: false, error: 'Ramp transaction not found.' });
  return res.json({
    success: true,
    data: {
      referenceId: transaction.referenceId,
      direction: transaction.direction,
      status: transaction.status,
      fiatAmount: transaction.fiatAmount,
      fiatCurrency: transaction.fiatCurrency,
      cryptoAmount: transaction.cryptoAmount,
      token: transaction.token,
      chain: transaction.chain,
      walletAddress: transaction.walletAddress,
      depositAddress: transaction.depositAddress,
      transactionHash: transaction.transactionHash,
      refundTransactionHash: transaction.refundTransactionHash,
      cryptoAmountSettled: transaction.cryptoAmountSettled,
      fiatAmountSettled: transaction.fiatAmountSettled,
      onchainStatus: transaction.onchainStatus,
      fiatStatus: transaction.fiatStatus,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
    },
  });
}));

export default router;
