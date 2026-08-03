import axios from 'axios';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const TELEGRAM_API_URL = TELEGRAM_BOT_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}` : '';

function ensureToken(): void {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }
}

function safeNumber(value: unknown): string {
  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'string' && value !== '') return value;
  return 'N/A';
}

async function doSendMessage(chatId: number | string, text: string, replyMarkup?: Record<string, unknown>) {
  ensureToken();

  try {
    const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: String(chatId),
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    });
    return response.data;
  } catch (error: unknown) {
    logger.error('[Telegram] Failed to send message', { error });
    throw error;
  }
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: Record<string, unknown>
) {
  return doSendMessage(chatId, text, replyMarkup);
}

export async function notifyBacktestComplete(
  chatId: number,
  strategyName: string,
  metrics: Record<string, unknown> | null,
  context?: string,
) {
  const header = `✅ Backtest complete for *${strategyName}*`;
  const lines = [header];
  if (context) lines.push(`Context: \`${context}\``);
  if (metrics) {
    lines.push(
      `*Profit:* ${safeNumber(metrics['totalProfitPercent'])}%`,
      `*Sharpe:* ${safeNumber(metrics['sharpeRatio'])}`,
      `*Win Rate:* ${safeNumber(metrics['winRatePercent'])}%`,
      `*Max Drawdown:* ${safeNumber(metrics['maxDrawdownPercent'])}%`,
    );
  } else {
    lines.push('*Metrics:* not available');
  }

  return doSendMessage(chatId, lines.join('\n'));
}

export async function notifyOptimizationComplete(
  chatId: number,
  strategyName: string,
  metrics: Record<string, unknown> | null,
  bestParameters: Record<string, unknown> | null,
) {
  const header = `🚀 Optimization complete for *${strategyName}*`;
  const lines = [header];
  if (metrics) {
    lines.push(
      `*Sharpe:* ${safeNumber(metrics['sharpeRatio'])}`,
      `*Profit:* ${safeNumber(metrics['totalProfitPercent'])}%`,
      `*Drawdown:* ${safeNumber(metrics['maxDrawdownPercent'])}%`,
    );
  } else {
    lines.push('*Metrics:* not available');
  }
  if (bestParameters && Object.keys(bestParameters).length > 0) {
    lines.push('\n*Best parameters:*');
    for (const [key, value] of Object.entries(bestParameters)) {
      lines.push(`• ${key}: ${String(value)}`);
    }
  }

  return doSendMessage(chatId, lines.join('\n'));
}

export async function notifyError(chatId: number, message: string) {
  return doSendMessage(chatId, `⚠️ *Error:* ${message}`);
}
