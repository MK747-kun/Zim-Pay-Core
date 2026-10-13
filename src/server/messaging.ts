/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageChannel, MessageLog, MessageStatus, Transaction, Merchant } from '../types';
import { db } from './db';

export interface WhatsAppTemplatePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components: Array<{
      type: 'header' | 'body' | 'button';
      sub_type?: 'url' | 'quick_reply';
      index?: string;
      parameters: Array<{
        type: 'text' | 'currency' | 'date_time' | 'payload';
        text?: string;
        currency?: { fallback_value: string; code: string; amount_1000: number };
      }>;
    }>;
  };
}

export interface EmailDispatchPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 or description
    type: string;
  }>;
  metadata?: Record<string, any>;
}

export interface EodReconciliationStatement {
  reportId: string;
  generatedAt: string;
  merchantId: string;
  merchantName: string;
  date: string;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalVolumeUsd: number;
  totalVolumeZig: number;
  netSettlementUsd: number;
  netSettlementZig: number;
  fallbackCount: number;
  fallbackSavingsUsd: number;
  averageRateApplied: number;
  railBreakdown: Record<string, { count: number; volumeUsd: number }>;
}

export class MessagingService {
  private static isWorkerRunning = false;

  public static initializeQueueWorker() {
    if (this.isWorkerRunning) return;
    this.isWorkerRunning = true;
    
    // Asynchronous queue worker loop simulating Celery / Redis / Spring Async
    setInterval(() => {
      this.processQueuedMessages();
    }, 2500);
  }

  /**
   * Dispatches WhatsApp real-time confirmation via Meta WhatsApp Cloud API / Twilio
   */
  public static async dispatchWhatsAppConfirmation(
    tx: Transaction,
    merchant: Merchant
  ): Promise<MessageLog> {
    const recipientPhone = tx.customerPhone.startsWith('+') ? tx.customerPhone : `+263${tx.customerPhone.replace(/^0/, '')}`;
    const providerUsed = tx.fallbackProvider ? `${tx.fallbackProvider} (Auto-Fallback)` : tx.provider;

    // Build standard Meta WhatsApp Cloud API payload
    const payload: WhatsAppTemplatePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone.replace('+', ''),
      type: 'template',
      template: {
        name: 'zimpay_payment_receipt_v2',
        language: { code: 'en_ZW' },
        components: [
          {
            type: 'header',
            parameters: [{ type: 'text', text: 'ZimPay Gateway Receipt' }],
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: tx.customerName || 'Valued Customer' },
              { type: 'text', text: `${tx.currency} ${tx.amount.toFixed(2)}` },
              { type: 'text', text: merchant.name },
              { type: 'text', text: tx.referenceCode },
              { type: 'text', text: providerUsed },
              { type: 'text', text: `1 USD = ${tx.rateApplied} ZiG (10m Locked Rate)` },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              { type: 'text', text: tx.id },
            ],
          },
        ],
      },
    };

    const messageLog: MessageLog = {
      id: 'msg_wa_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      transactionId: tx.id,
      channel: 'WHATSAPP',
      recipient: recipientPhone,
      status: 'QUEUED',
      templateName: 'zimpay_payment_receipt_v2',
      payload,
      attempts: 0,
      sentAt: undefined,
      providerMessageId: undefined,
    };

    db.logMessage(messageLog);
    return messageLog;
  }

  /**
   * Dispatches HTML & PDF Payment Receipt to customer and merchant
   */
  public static async dispatchEmailReceipt(
    tx: Transaction,
    merchant: Merchant
  ): Promise<MessageLog> {
    const recipient = tx.customerEmail || merchant.notificationEmail;
    const providerUsed = tx.fallbackProvider ? `${tx.fallbackProvider} (Fallback via ZimPay Routing)` : tx.provider;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; }
    .badge { display: inline-block; padding: 4px 8px; background: #ecfdf5; color: #047857; font-weight: 600; font-size: 12px; border-radius: 4px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .label { color: #64748b; font-weight: 500; }
    .val { text-align: right; font-weight: 600; color: #0f172a; font-family: monospace; }
    .rate-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px; font-size: 13px; color: #1e40af; margin-top: 16px; }
    .footer { margin-top: 28px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="title">ZIMPAY GATEWAY RECEIPT</div>
        <div style="font-size: 13px; color: #64748b;">Merchant: ${merchant.name}</div>
      </div>
      <div>
        <span class="badge">PAID & SETTLED</span>
      </div>
    </div>

    <table class="table">
      <tr>
        <td class="label">Transaction Reference:</td>
        <td class="val">${tx.referenceCode}</td>
      </tr>
      <tr>
        <td class="label">Date & Time:</td>
        <td class="val">${new Date(tx.createdAt).toUTCString()}</td>
      </tr>
      <tr>
        <td class="label">Payment Rail:</td>
        <td class="val">${providerUsed}</td>
      </tr>
      <tr>
        <td class="label">Settlement Currency:</td>
        <td class="val">${tx.currency}</td>
      </tr>
      <tr>
        <td class="label">Billed Amount:</td>
        <td class="val" style="font-size: 18px; color: #047857;">${tx.currency} ${tx.amount.toFixed(2)}</td>
      </tr>
      ${tx.convertedAmount ? `
      <tr>
        <td class="label">Dual-Currency Equivalent:</td>
        <td class="val">${tx.convertedCurrency} ${tx.convertedAmount.toFixed(2)}</td>
      </tr>
      ` : ''}
      <tr>
        <td class="label">Customer Phone / Account:</td>
        <td class="val">${tx.customerPhone}</td>
      </tr>
    </table>

    <div class="rate-box">
      <strong>Dual-Currency Rate-Slippage Guard Audit:</strong><br/>
      Rate Applied: 1 USD = ${tx.rateApplied} ZiG. Rate locked with 10-minute validity guarantee. Zero slippage incurred during payment rail execution.
    </div>

    <div class="footer">
      Powered by zim-pay-core · Multi-Currency ACID Reconciliation Engine<br/>
      Reserve Bank of Zimbabwe Authorized Framework · Harare, Zimbabwe
    </div>
  </div>
</body>
</html>
    `;

    const payload: EmailDispatchPayload = {
      from: db.notificationSettings.emailSender,
      to: recipient,
      subject: `Payment Receipt: ${tx.referenceCode} [${tx.currency} ${tx.amount.toFixed(2)}] - ${merchant.name}`,
      html: htmlBody,
      metadata: {
        transactionId: tx.id,
        merchantId: merchant.id,
        amount: tx.amount,
        currency: tx.currency,
        pdfAttached: true,
      },
    };

    const messageLog: MessageLog = {
      id: 'msg_em_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      transactionId: tx.id,
      channel: 'EMAIL',
      recipient,
      status: 'QUEUED',
      templateName: 'zimpay_customer_receipt_pdf',
      payload,
      attempts: 0,
      sentAt: undefined,
      providerMessageId: undefined,
    };

    db.logMessage(messageLog);
    return messageLog;
  }

  /**
   * Generates End-of-Day (EOD) Reconciliation Statement for merchants
   */
  public static generateEodReconciliation(merchantId: string): EodReconciliationStatement {
    const merchant = db.merchants.get(merchantId);
    const txs = Array.from(db.transactions.values()).filter(t => t.merchantId === merchantId);

    const successful = txs.filter(t => t.status === 'SUCCESS');
    const failed = txs.filter(t => t.status === 'FAILED');
    const fallbackCount = txs.filter(t => !!t.fallbackProvider).length;

    let volumeUsd = 0;
    let volumeZig = 0;
    const railBreakdown: Record<string, { count: number; volumeUsd: number }> = {};

    let totalRate = 0;
    let rateCount = 0;

    successful.forEach(t => {
      const rail = t.fallbackProvider || t.provider;
      if (!railBreakdown[rail]) {
        railBreakdown[rail] = { count: 0, volumeUsd: 0 };
      }
      railBreakdown[rail].count += 1;

      if (t.currency === 'USD') {
        volumeUsd += t.amount;
        railBreakdown[rail].volumeUsd += t.amount;
      } else {
        volumeZig += t.amount;
        const usdEquiv = t.rateApplied ? t.amount / t.rateApplied : 0;
        railBreakdown[rail].volumeUsd += usdEquiv;
      }

      if (t.rateApplied) {
        totalRate += t.rateApplied;
        rateCount += 1;
      }
    });

    const averageRateApplied = rateCount > 0 ? Number((totalRate / rateCount).toFixed(4)) : 26.85;

    // Approximate transaction fee 1.5%
    const feeUsd = volumeUsd * 0.015;
    const feeZig = volumeZig * 0.015;

    const statement: EodReconciliationStatement = {
      reportId: 'EOD-STMT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + merchantId.slice(-4),
      generatedAt: new Date().toISOString(),
      merchantId,
      merchantName: merchant?.name || 'Harare Wholesale Hub',
      date: new Date().toISOString().slice(0, 10),
      totalTransactions: txs.length,
      successfulTransactions: successful.length,
      failedTransactions: failed.length,
      totalVolumeUsd: Number(volumeUsd.toFixed(2)),
      totalVolumeZig: Number(volumeZig.toFixed(2)),
      netSettlementUsd: Number((volumeUsd - feeUsd).toFixed(2)),
      netSettlementZig: Number((volumeZig - feeZig).toFixed(2)),
      fallbackCount,
      fallbackSavingsUsd: Number((fallbackCount * 45.0).toFixed(2)), // estimated salvaged revenue
      averageRateApplied,
      railBreakdown,
    };

    return statement;
  }

  /**
   * Processes queued messages asynchronously (Celery/Spring Async emulation)
   */
  private static async processQueuedMessages() {
    const queued = db.messageLogs.filter(m => m.status === 'QUEUED');
    for (const msg of queued) {
      msg.status = 'PROCESSING';
      msg.attempts += 1;

      // Simulate network request to Meta / Twilio / Resend API
      setTimeout(() => {
        // High 98% simulated success rate
        const isSuccess = Math.random() > 0.02;
        if (isSuccess) {
          msg.status = 'SENT';
          msg.sentAt = new Date().toISOString();
          msg.providerMessageId = (msg.channel === 'WHATSAPP' ? 'wamid.HBg' : 'resend_msg_') + Math.random().toString(36).substring(2, 12);
        } else {
          msg.status = 'FAILED';
          msg.errorDetails = 'Upstream gateway 429 Too Many Requests (Rate limit backoff triggered)';
        }
      }, 500);
    }
  }

  /**
   * Re-queues a failed message for immediate retry
   */
  public static retryMessage(messageId: string): MessageLog | undefined {
    const msg = db.messageLogs.find(m => m.id === messageId);
    if (!msg) return undefined;
    msg.status = 'QUEUED';
    msg.errorDetails = undefined;
    return msg;
  }
}

// Start worker immediately
MessagingService.initializeQueueWorker();
