/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/server/db';
import { ExchangeRateService } from './src/server/exchangeRates';
import { RoutingEngine } from './src/server/routing';
import { MessagingService } from './src/server/messaging';
import { Currency, PaymentProvider, Transaction } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // --------------------------------------------------------------------------
  // API ROUTING
  // --------------------------------------------------------------------------

  // System Health
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      system: 'zim-pay-core',
      timestamp: new Date().toISOString(),
      activeRails: RoutingEngine.getAllRails().filter(r => r.status === 'OPERATIONAL').length,
      currentRate: ExchangeRateService.getRate().rate,
    });
  });

  // Rates & Slippage Guard
  app.get('/api/rates', (req: Request, res: Response) => {
    try {
      const rate = ExchangeRateService.getRate();
      res.json(rate);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/rates/update', (req: Request, res: Response) => {
    try {
      const { marketRate, spreadBps, slippageTolerance } = req.body;
      const updated = ExchangeRateService.updateMarketRate(
        Number(marketRate),
        spreadBps !== undefined ? Number(spreadBps) : undefined,
        slippageTolerance !== undefined ? Number(slippageTolerance) : undefined
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Rate Lock with 10-Minute TTL
  app.post('/api/checkout/create-rate-lock', (req: Request, res: Response) => {
    try {
      const { baseCurrency, targetCurrency, amountBase } = req.body;
      const lock = ExchangeRateService.createRateLock(
        baseCurrency as Currency,
        targetCurrency as Currency,
        Number(amountBase)
      );
      res.json(lock);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/checkout/rate-lock/:token', (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const validation = ExchangeRateService.validateRateLock(token);
      res.json(validation);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/checkout/refresh-rate-lock', (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      const newLock = ExchangeRateService.refreshRateLock(token);
      res.json(newLock);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Payment Rails
  app.get('/api/rails', (req: Request, res: Response) => {
    res.json(RoutingEngine.getAllRails());
  });

  app.post('/api/rails/status', (req: Request, res: Response) => {
    try {
      const { provider, status, notes } = req.body;
      const updated = RoutingEngine.updateRailStatus(provider as PaymentProvider, status, notes);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Checkout & Payment Processing
  app.post('/api/payments/initiate', (req: Request, res: Response) => {
    try {
      const {
        amount,
        currency,
        provider,
        customerPhone,
        customerEmail,
        customerName,
        rateLockToken,
        merchantId = 'mch_harare_prime_01',
      } = req.body;

      // Validate Rate-Slippage Lock
      const rateValidation = ExchangeRateService.validateRateLock(rateLockToken);
      if (!rateValidation.isValid) {
        return res.status(422).json({
          error: 'Rate-Slippage Guard Validation Failed',
          details: rateValidation.reason,
          lock: rateValidation.lock,
        });
      }

      const txId = 'tx_zim_' + Math.floor(100000 + Math.random() * 900000);
      const refCode = 'ZIM-PAY-' + Math.floor(10000 + Math.random() * 90000);
      const convertedCurrency: Currency = currency === 'USD' ? 'ZIG' : 'USD';
      const convertedAmount = currency === 'USD' 
        ? Number((amount * rateValidation.lock.lockedRate).toFixed(2))
        : Number((amount / rateValidation.lock.lockedRate).toFixed(2));

      const transaction: Transaction = {
        id: txId,
        checkoutSessionId: 'ses_' + Math.random().toString(36).substring(2, 10),
        merchantId,
        provider: provider as PaymentProvider,
        amount: Number(amount),
        currency: currency as Currency,
        convertedAmount,
        convertedCurrency,
        rateApplied: rateValidation.lock.lockedRate,
        rateLockId: rateValidation.lock.id,
        status: 'PROCESSING',
        customerPhone,
        customerEmail: customerEmail || 'customer@gmail.com',
        customerName: customerName || 'Valued Customer',
        referenceCode: refCode,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ussdRef: provider === 'ECOCASH' ? `*151*1*1*${refCode}#` : undefined,
      };

      db.transactions.set(transaction.id, transaction);
      res.json(transaction);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Dynamic Fallback Trigger (Preserves Active Checkout Session!)
  app.post('/api/payments/trigger-fallback', (req: Request, res: Response) => {
    try {
      const { transactionId, failureReason, preferredFallback } = req.body;
      const tx = db.transactions.get(transactionId);
      if (!tx) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const fallbackResult = RoutingEngine.triggerFallback(tx, failureReason, preferredFallback);
      
      // Update transaction without destroying active session
      tx.fallbackProvider = fallbackResult.fallbackProvider;
      tx.fallbackReason = fallbackResult.reason;
      tx.status = 'FALLBACK_TRIGGERED';
      tx.retryCount += 1;
      tx.updatedAt = new Date().toISOString();
      tx.qrPayload = fallbackResult.qrPayload;
      tx.zipitDetails = fallbackResult.zipitDetails;
      tx.ussdRef = fallbackResult.ussdRef;

      db.transactions.set(tx.id, { ...tx });

      res.json({
        transaction: tx,
        fallbackResult,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Complete Payment with ACID Ledger Commit & Messaging Dispatch
  app.post('/api/payments/complete', async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.body;
      const tx = db.transactions.get(transactionId);
      if (!tx) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const merchant = db.merchants.get(tx.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: 'Merchant not found' });
      }

      // ACID Transaction Execution
      db.executeTransaction(() => {
        tx.status = 'SUCCESS';
        tx.completedAt = new Date().toISOString();
        tx.updatedAt = tx.completedAt;

        // Double-entry ledger settlement
        db.commitLedgerEntry({
          id: 'ldg_' + tx.id + '_dr',
          transactionId: tx.id,
          timestamp: tx.completedAt,
          accountDebited: `CUSTOMER_ESCROW_${tx.currency}`,
          accountCredited: `MERCHANT_SETTLEMENT_${tx.currency}`,
          amount: tx.amount,
          currency: tx.currency,
          rateApplied: tx.rateApplied,
          description: `Settlement for ${tx.referenceCode} via ${tx.fallbackProvider || tx.provider}`,
          isolationLevel: 'SERIALIZABLE',
          state: 'COMMITTED',
        });

        // Credit Merchant Balance
        db.updateMerchantBalance(merchant.id, tx.amount, tx.currency);
        db.transactions.set(tx.id, { ...tx });
      }, `tx_lock_${tx.id}`);

      // Dual Messaging Engine Dispatch
      if (db.notificationSettings.whatsappEnabled && db.notificationSettings.sendOnSuccess) {
        await MessagingService.dispatchWhatsAppConfirmation(tx, merchant);
      }
      if (db.notificationSettings.emailEnabled && db.notificationSettings.sendOnSuccess) {
        await MessagingService.dispatchEmailReceipt(tx, merchant);
      }

      res.json({
        success: true,
        transaction: tx,
        merchantBalance: {
          usd: merchant.balanceUsd,
          zig: merchant.balanceZig,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Query Transactions
  app.get('/api/transactions', (req: Request, res: Response) => {
    const list = Array.from(db.transactions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json(list);
  });

  // Query ACID Ledger
  app.get('/api/ledger', (req: Request, res: Response) => {
    res.json(db.ledgerEntries);
  });

  // Messaging Logs & Dispatch Queue
  app.get('/api/messages', (req: Request, res: Response) => {
    res.json(db.messageLogs);
  });

  app.post('/api/messages/retry/:id', (req: Request, res: Response) => {
    const retried = MessagingService.retryMessage(req.params.id);
    if (!retried) return res.status(404).json({ error: 'Message not found' });
    res.json(retried);
  });

  // Merchant Profile & Notification Settings
  app.get('/api/merchant', (req: Request, res: Response) => {
    const merchant = db.merchants.get('mch_harare_prime_01');
    res.json({
      merchant,
      notificationSettings: db.notificationSettings,
    });
  });

  app.post('/api/merchant/settings', (req: Request, res: Response) => {
    const { notificationSettings, merchantData } = req.body;
    if (notificationSettings) {
      db.notificationSettings = { ...db.notificationSettings, ...notificationSettings };
    }
    if (merchantData) {
      const existing = db.merchants.get('mch_harare_prime_01');
      if (existing) {
        db.merchants.set('mch_harare_prime_01', { ...existing, ...merchantData });
      }
    }
    res.json({
      success: true,
      notificationSettings: db.notificationSettings,
      merchant: db.merchants.get('mch_harare_prime_01'),
    });
  });

  // End-of-Day Reconciliation Statement
  app.get('/api/reconciliation/eod', (req: Request, res: Response) => {
    const stmt = MessagingService.generateEodReconciliation('mch_harare_prime_01');
    res.json(stmt);
  });

  // --------------------------------------------------------------------------
  // VITE DEV SERVER OR STATIC ASSETS
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[zim-pay-core] Engine running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Error:', err);
});
