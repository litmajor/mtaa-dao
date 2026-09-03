import axios from 'axios';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }
  return {
    token,
    apiUrl: `https://api.telegram.org/bot${token}`,
  };
}

/** Escapes special HTML characters for Telegram HTML parse_mode */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeNumber(value: unknown): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num.toFixed(2) : 'N/A';
}

async function doSendMessage(
  chatId: number | string,
  htmlText: string,
  replyMarkup?: Record<string, unknown>
) {
  const { apiUrl } = getTelegramConfig();

  try {
    const response = await axios.post(`${apiUrl}/sendMessage`, {
      chat_id: String(chatId),
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    });
    return response.data;
  } catch (error: any) {
    // Prevent token leakage by logging response data/message instead of raw Axios error
    logger.error('[Telegram] Failed to send message', {
      message: error?.message,
      responseData: error?.response?.data,
    });
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
  context?: string
) {
  const lines = [`✅ Backtest complete for <b>${escapeHtml(strategyName)}</b>`];
  
  if (context) {
    lines.push(`Context: <code>${escapeHtml(context)}</code>`);
  }
  
  if (metrics) {
    lines.push(
      `<b>Profit:</b> ${safeNumber(metrics['totalProfitPercent'])}%`,
      `<b>Sharpe:</b> ${safeNumber(metrics['sharpeRatio'])}`,
      `<b>Win Rate:</b> ${safeNumber(metrics['winRatePercent'])}%`,
      `<b>Max Drawdown:</b> ${safeNumber(metrics['maxDrawdownPercent'])}%`
    );
  } else {
    lines.push('<b>Metrics:</b> not available');
  }

  return doSendMessage(chatId, lines.join('\n'));
}

export async function notifyOptimizationComplete(
  chatId: number,
  strategyName: string,
  metrics: Record<string, unknown> | null,
  bestParameters: Record<string, unknown> | null
) {
  const lines = [`🚀 Optimization complete for <b>${escapeHtml(strategyName)}</b>`];
  
  if (metrics) {
    lines.push(
      `<b>Sharpe:</b> ${safeNumber(metrics['sharpeRatio'])}`,
      `<b>Profit:</b> ${safeNumber(metrics['totalProfitPercent'])}%`,
      `<b>Drawdown:</b> ${safeNumber(metrics['maxDrawdownPercent'])}%`
    );
  } else {
    lines.push('<b>Metrics:</b> not available');
  }

  if (bestParameters && Object.keys(bestParameters).length > 0) {
    lines.push('\n<b>Best parameters:</b>');
    for (const [key, value] of Object.entries(bestParameters)) {
      lines.push(`• ${escapeHtml(key)}: ${escapeHtml(String(value))}`);
    }
  }

  return doSendMessage(chatId, lines.join('\n'));
}

export async function notifyError(chatId: number, message: string) {
  return doSendMessage(chatId, `⚠️ <b>Error:</b> ${escapeHtml(message)}`);
}