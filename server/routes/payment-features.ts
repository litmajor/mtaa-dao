/**
 * REST API routes for Bill Splits and Recurring Payments
 * POST /api/wallet/bill-split - Create new bill split
 * GET  /api/wallet/bill-splits - Get all bill splits
 * GET  /api/wallet/bill-split/:id - Get bill split details
 * POST /api/wallet/bill-split/:id/payment - Record payment
 * POST /api/wallet/bill-split/:id/settle - Mark as settled
 * POST /api/wallet/recurring-payment - Create recurring payment
 * GET  /api/wallet/recurring-payments - Get all recurring payments
 * GET  /api/wallet/recurring-payment/:id - Get details
 * POST /api/wallet/recurring-payment/:id/execute - Execute payment
 * POST /api/wallet/recurring-payment/:id/cancel - Cancel payment
 * POST /api/wallet/recurring-payment/:id/pause - Pause payment
 * POST /api/wallet/recurring-payment/:id/resume - Resume payment
 */

import express, { Router, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

import {
  createBillSplit,
  getUserBillSplits,
  getBillSplitDetails,
  recordBillSplitPayment,
  getBillSplitSettlement,
  cancelBillSplit,
  settleBillSplit,
} from "../services/billSplitService";

import {
  createMultiRecipientRecurringPayment,
  executeMultiRecipientPayment,
  getRecurringPaymentWithRecipients,
  cancelRecurringPaymentWithDAO,
  getCreatedRecurringPayments,
  getReceivedRecurringPayments,
  pauseRecurringPayment,
  resumeRecurringPayment,
  RecipientInput as RecurringRecipientInput,
} from "../services/recurringPaymentService";

import { Logger } from "../utils/logger";
import { AppError } from "../middleware/errorHandler";

const logger = Logger.getLogger();
const router = Router();

// ============================================================
// BILL SPLIT ENDPOINTS
// ============================================================

/**
 * POST /api/wallet/bill-split
 * Create new bill split
 */
const createBillSplitSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  totalAmount: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0),
  currency: z.string().default("cUSD"),
  splitMethod: z.enum(["equal", "custom", "percentage", "weighted"]),
  participants: z.array(
    z.object({
      userId: z.string().optional(),
      daoId: z.string().optional(),
      walletAddress: z.string().optional(),
      sharePercentage: z.number().optional(),
      customAmount: z.string().optional(),
    })
  ),
});

router.post("/bill-split", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const validated = createBillSplitSchema.parse(req.body);

    const billSplit = await createBillSplit({
      creatorId: req.user!.id,
      ...validated,
    });

    res.json({
      success: true,
      message: "Bill split created",
      billSplit,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    logger.error("Failed to create bill split:", error);
    res.status(500).json({ success: false, error: "Failed to create bill split" });
  }
});

/**
 * GET /api/wallet/bill-splits
 * Get all bill splits for user
 */
router.get("/bill-splits", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const billSplits = await getUserBillSplits(req.user!.id, status);

    res.json({
      success: true,
      billSplits,
      count: billSplits.length,
    });
  } catch (error) {
    logger.error("Failed to fetch bill splits:", error);
    res.status(500).json({ success: false, error: "Failed to fetch bill splits" });
  }
});

/**
 * GET /api/wallet/bill-split/:id
 * Get bill split details with participants
 */
router.get("/bill-split/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const billSplit = await getBillSplitDetails(req.params.id);
    const settlement = await getBillSplitSettlement(req.params.id);

    res.json({
      success: true,
      billSplit,
      settlement,
    });
  } catch (error) {
    logger.error("Failed to fetch bill split:", error);
    res.status(500).json({ success: false, error: "Bill split not found" });
  }
});

/**
 * POST /api/wallet/bill-split/:id/payment
 * Record payment for bill split participant
 */
const recordPaymentSchema = z.object({
  participantId: z.string(),
  transactionHash: z.string(),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0),
});

router.post("/bill-split/:id/payment", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const validated = recordPaymentSchema.parse(req.body);

    await recordBillSplitPayment(
      validated.participantId,
      validated.transactionHash,
      validated.amount
    );

    res.json({
      success: true,
      message: "Payment recorded successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    logger.error("Failed to record payment:", error);
    res.status(500).json({ success: false, error: "Failed to record payment" });
  }
});

/**
 * POST /api/wallet/bill-split/:id/settle
 * Mark bill split as settled
 */
router.post("/bill-split/:id/settle", isAuthenticated, async (req: Request, res: Response) => {
  try {
    await settleBillSplit(req.params.id);

    res.json({
      success: true,
      message: "Bill split settled",
    });
  } catch (error) {
    logger.error("Failed to settle bill split:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to settle bill split" });
  }
});

/**
 * POST /api/wallet/bill-split/:id/cancel
 * Cancel bill split
 */
router.post("/bill-split/:id/cancel", isAuthenticated, async (req: Request, res: Response) => {
  try {
    await cancelBillSplit(req.params.id);

    res.json({
      success: true,
      message: "Bill split cancelled",
    });
  } catch (error) {
    logger.error("Failed to cancel bill split:", error);
    res.status(500).json({ success: false, error: "Failed to cancel bill split" });
  }
});

// ============================================================
// RECURRING PAYMENT ENDPOINTS
// ============================================================

/**
 * POST /api/wallet/recurring-payment
 * Create recurring payment (single or multi-recipient)
 */
const createRecurringPaymentSchema = z.object({
  recipientId: z.string().optional(),
  recipientDaoId: z.string().optional(),
  recipientWalletAddress: z.string().optional(),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0),
  currency: z.string().default("cUSD"),
  description: z.string().optional(),
  paymentType: z.string().min(1),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "annual", "custom"]),
  interval: z.number().default(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  maxOccurrences: z.number().optional(),
  dayOfMonth: z.number().optional(),
  dayOfWeek: z.string().optional(),
  autoExecute: z.boolean().default(true),
  requireConfirmation: z.boolean().default(false),
  recipients: z
    .array(
      z.object({
        userId: z.string().optional(),
        daoId: z.string().optional(),
        walletAddress: z.string().optional(),
        receivePercentage: z.number().optional(),
        customAmount: z.string().optional(),
      })
    )
    .optional(),
});

router.post(
  "/recurring-payment",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const validated = createRecurringPaymentSchema.parse(req.body);

      const recurringPayment = await createMultiRecipientRecurringPayment(
        {
          creatorId: req.user!.id,
          startDate: new Date(validated.startDate),
          endDate: validated.endDate ? new Date(validated.endDate) : undefined,
          ...validated,
        },
        validated.recipients
      );

      res.json({
        success: true,
        message: "Recurring payment created",
        recurringPayment,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, errors: error.errors });
      }
      logger.error("Failed to create recurring payment:", error);
      res.status(500).json({ success: false, error: "Failed to create recurring payment" });
    }
  }
);

/**
 * GET /api/wallet/recurring-payments
 * Get all recurring payments
 */
router.get("/recurring-payments", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || "created"; // 'created' or 'received'
    const isActive = req.query.isActive !== "false";

    let payments;
    if (type === "received") {
      payments = await getReceivedRecurringPayments(req.user!.id);
    } else {
      payments = await getCreatedRecurringPayments(req.user!.id);
    }

    // Filter by active status if specified
    if (isActive) {
      payments = payments.filter((p: any) => p.isActive === true);
    }

    res.json({
      success: true,
      payments,
      count: payments.length,
      type,
    });
  } catch (error) {
    logger.error("Failed to fetch recurring payments:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch recurring payments" });
  }
});

/**
 * GET /api/wallet/recurring-payment/:id
 * Get recurring payment details with recipients and execution history
 */
router.get(
  "/recurring-payment/:id",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const paymentDetails = await getRecurringPaymentWithRecipients(req.params.id);

      res.json({
        success: true,
        ...paymentDetails,
      });
    } catch (error) {
      logger.error("Failed to fetch recurring payment:", error);
      res.status(500).json({ success: false, error: "Recurring payment not found" });
    }
  }
);

/**
 * POST /api/wallet/recurring-payment/:id/execute
 * Manually execute a recurring payment
 */
router.post(
  "/recurring-payment/:id/execute",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const executionId = await executeMultiRecipientPayment(req.params.id);

      res.json({
        success: true,
        message: "Payment execution initiated",
        executionId,
      });
    } catch (error) {
      logger.error("Failed to execute payment:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to execute payment",
      });
    }
  }
);

/**
 * POST /api/wallet/recurring-payment/:id/cancel
 * Cancel recurring payment
 */
router.post(
  "/recurring-payment/:id/cancel",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      await cancelRecurringPaymentWithDAO(req.params.id);

      res.json({
        success: true,
        message: "Recurring payment cancelled",
      });
    } catch (error) {
      logger.error("Failed to cancel recurring payment:", error);
      res.status(500).json({ success: false, error: "Failed to cancel payment" });
    }
  }
);

/**
 * POST /api/wallet/recurring-payment/:id/pause
 * Pause recurring payment temporarily
 */
router.post(
  "/recurring-payment/:id/pause",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      await pauseRecurringPayment(req.params.id);

      res.json({
        success: true,
        message: "Recurring payment paused",
      });
    } catch (error) {
      logger.error("Failed to pause recurring payment:", error);
      res.status(500).json({ success: false, error: "Failed to pause payment" });
    }
  }
);

/**
 * POST /api/wallet/recurring-payment/:id/resume
 * Resume recurring payment
 */
router.post(
  "/recurring-payment/:id/resume",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      await resumeRecurringPayment(req.params.id);

      res.json({
        success: true,
        message: "Recurring payment resumed",
      });
    } catch (error) {
      logger.error("Failed to resume recurring payment:", error);
      res.status(500).json({ success: false, error: "Failed to resume payment" });
    }
  }
);

export default router;
