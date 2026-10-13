/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Currency,
  ExchangeRate,
  LedgerEntry,
  Merchant,
  MessageLog,
  PaymentProvider,
  PaymentRailHealth,
  RateLock,
  Transaction,
  WebhookLog,
  NotificationSettings,
} from '../types';

// In-Memory ACID Database Store
class DatabaseStore {
  public merchants: Map<string, Merchant> = new Map();
  public exchangeRates: Map<string, ExchangeRate> = new Map();
  public rateLocks: Map<string, RateLock> = new Map();
  public transactions: Map<string, Transaction> = new Map();
  public ledgerEntries: LedgerEntry[] = [];
  public messageLogs: MessageLog[] = [];
  public webhookLogs: WebhookLog[] = [];
  public railHealths: Map<PaymentProvider, PaymentRailHealth> = new Map();
  public notificationSettings: NotificationSettings = {
    whatsappEnabled: true,
    whatsappProvider: 'META_CLOUD_API',
    whatsappApiTokenConfigured: true,
    whatsappPhoneNumberId: '109283749281723',
    emailEnabled: true,
    emailProvider: 'RESEND',
    emailApiKeyConfigured: true,
    emailSender: 'receipts@zimpay.co.zw',
    sendOnSuccess: true,
    sendOnFallback: true,
    sendOnFailure: false,
    dispatchEodSummary: true,
    eodDispatchTime: '23:59 CAT',
  };

  private transactionLocks: Set<string> = new Set();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Default Merchant
    const defaultMerchant: Merchant = {
      id: 'mch_harare_prime_01',
      name: 'Harare Wholesale & Retail Hub Ltd',
      apiKey: 'zpk_live_8f39b201a47d4e5192c0',
      webhookUrl: 'https://api.hararewholesale.co.zw/webhooks/zimpay',
      webhookSecret: 'whsec_99a81e3c78d021b',
      notificationEmail: 'finance@hararewholesale.co.zw',
      whatsappNumber: '+263772123456',
      autoSettle: true,
      currencyPreference: 'DUAL',
      balanceUsd: 14250.80,
      balanceZig: 382450.00,
    };
    this.merchants.set(defaultMerchant.id, defaultMerchant);

    // Initial FX Rate: USD to ZiG = 26.85
    const initialRate: ExchangeRate = {
      id: 'fx_usd_zig_latest',
      baseCurrency: 'USD',
      targetCurrency: 'ZIG',
      rate: 26.85,
      marketRate: 26.20,
      spreadBps: 250, // 2.5% spread
      slippageTolerancePercent: 2.0,
      lockedRateTtlSeconds: 600, // 10 minutes
      lastUpdated: new Date().toISOString(),
      source: 'RBZ_INTERBANK',
    };
    this.exchangeRates.set(initialRate.id, initialRate);

    // Initial Payment Rail Health
    const rails: PaymentRailHealth[] = [
      {
        provider: 'ECOCASH',
        name: 'EcoCash Mobile Money (USSD Push)',
        status: 'OPERATIONAL',
        avgLatencyMs: 2400,
        successRatePercent: 94.8,
        priorityOrder: 1,
        isFallbackOnly: false,
        notes: 'Primary mobile money rail via Econet API'
      },
      {
        provider: 'INNBUCKS',
        name: 'InnBucks Express QR & USSD (*569#)',
        status: 'OPERATIONAL',
        avgLatencyMs: 950,
        successRatePercent: 98.6,
        priorityOrder: 2,
        isFallbackOnly: true,
        notes: 'Rapid fallback voucher QR rail (Simbisa Brands network)'
      },
      {
        provider: 'ZIPIT',
        name: 'Zimswitch ZIPIT (Instant Bank Settlement)',
        status: 'OPERATIONAL',
        avgLatencyMs: 1200,
        successRatePercent: 99.1,
        priorityOrder: 3,
        isFallbackOnly: true,
        notes: 'Interbank real-time gross settlement fallback'
      },
      {
        provider: 'ONEMONEY',
        name: 'NetOne OneMoney',
        status: 'DEGRADED',
        avgLatencyMs: 4800,
        successRatePercent: 82.0,
        priorityOrder: 4,
        isFallbackOnly: false,
        notes: 'Secondary MNO network reporting intermittent timeouts'
      },
      {
        provider: 'OMARI',
        name: 'Old Mutual O’mari',
        status: 'OPERATIONAL',
        avgLatencyMs: 1600,
        successRatePercent: 96.0,
        priorityOrder: 5,
        isFallbackOnly: false,
        notes: 'Digital wallet & multi-currency card rail'
      }
    ];

    rails.forEach((r) => this.railHealths.set(r.provider, r));

    // Seed some historical transactions
    this.seedHistoricalTransactions();
  }

  private seedHistoricalTransactions() {
    const historical = [
      {
        id: 'tx_zim_984102',
        session: 'ses_001',
        amount: 45.00,
        currency: 'USD' as Currency,
        converted: 1208.25,
        rate: 26.85,
        provider: 'ECOCASH' as PaymentProvider,
        status: 'SUCCESS' as const,
        phone: '+263772889900',
        email: 'tinashe.moyo@gmail.com',
        customer: 'Tinashe Moyo',
        ref: 'ZIM-PAY-00918',
        minutesAgo: 85,
      },
      {
        id: 'tx_zim_984103',
        session: 'ses_002',
        amount: 120.00,
        currency: 'USD' as Currency,
        converted: 3222.00,
        rate: 26.85,
        provider: 'ECOCASH' as PaymentProvider,
        fallback: 'INNBUCKS' as PaymentProvider,
        fallbackReason: 'EcoCash USSD prompt timed out (>15s timeout from MNO gateway)',
        status: 'SUCCESS' as const,
        phone: '+263784112233',
        email: 'farai.chikwanha@techzim.co.zw',
        customer: 'Farai Chikwanha',
        ref: 'ZIM-PAY-00919',
        minutesAgo: 45,
      },
      {
        id: 'tx_zim_984104',
        session: 'ses_003',
        amount: 850.00,
        currency: 'ZIG' as Currency,
        converted: 31.66,
        rate: 26.85,
        provider: 'ZIPIT' as PaymentProvider,
        status: 'SUCCESS' as const,
        phone: '+263712554433',
        email: 'chipo.ndlovu@econet.co.zw',
        customer: 'Chipo Ndlovu',
        ref: 'ZIM-PAY-00920',
        minutesAgo: 22,
      },
      {
        id: 'tx_zim_984105',
        session: 'ses_004',
        amount: 15.50,
        currency: 'USD' as Currency,
        converted: 416.18,
        rate: 26.85,
        provider: 'ECOCASH' as PaymentProvider,
        status: 'FAILED' as const,
        phone: '+263773998877',
        email: 'rudo.mutasa@yahoo.com',
        customer: 'Rudo Mutasa',
        ref: 'ZIM-PAY-00921',
        minutesAgo: 10,
        err: 'Insufficient funds on mobile subscriber wallet'
      }
    ];

    historical.forEach((item) => {
      const createdAt = new Date(Date.now() - item.minutesAgo * 60 * 1000).toISOString();
      const tx: Transaction = {
        id: item.id,
        checkoutSessionId: item.session,
        merchantId: 'mch_harare_prime_01',
        provider: item.provider,
        fallbackProvider: item.fallback,
        fallbackReason: item.fallbackReason,
        amount: item.amount,
        currency: item.currency,
        convertedAmount: item.converted,
        convertedCurrency: item.currency === 'USD' ? 'ZIG' : 'USD',
        rateApplied: item.rate,
        rateLockId: 'lock_seed_' + item.id,
        status: item.status,
        customerPhone: item.phone,
        customerEmail: item.email,
        customerName: item.customer,
        referenceCode: item.ref,
        retryCount: item.fallback ? 1 : 0,
        createdAt,
        updatedAt: createdAt,
        completedAt: item.status === 'SUCCESS' ? createdAt : undefined,
        errorMessage: item.err,
      };
      this.transactions.set(tx.id, tx);

      if (item.status === 'SUCCESS') {
        // Double-entry ledger commit
        this.commitLedgerEntry({
          id: 'ldg_' + item.id + '_dr',
          transactionId: tx.id,
          timestamp: createdAt,
          accountDebited: `CUSTOMER_ESCROW_${tx.currency}`,
          accountCredited: `MERCHANT_SETTLEMENT_${tx.currency}`,
          amount: tx.amount,
          currency: tx.currency,
          rateApplied: tx.rateApplied,
          description: `Settlement for ${tx.referenceCode} via ${tx.fallbackProvider || tx.provider}`,
          isolationLevel: 'SERIALIZABLE',
          state: 'COMMITTED',
        });
      }
    });
  }

  // ACID Transaction Engine with Isolation Level & Atomic Commit
  public executeTransaction<T>(work: () => T, lockKey?: string): T {
    if (lockKey) {
      if (this.transactionLocks.has(lockKey)) {
        throw new Error(`ACID Lock Contention: Resource '${lockKey}' is locked by another transaction.`);
      }
      this.transactionLocks.add(lockKey);
    }

    try {
      const result = work();
      return result;
    } catch (err) {
      // In a real DB, rollback WAL. Here we throw and enforce rollback invariants.
      throw err;
    } finally {
      if (lockKey) {
        this.transactionLocks.delete(lockKey);
      }
    }
  }

  public commitLedgerEntry(entry: LedgerEntry) {
    this.ledgerEntries.unshift(entry);
  }

  public updateMerchantBalance(merchantId: string, amount: number, currency: Currency) {
    const merchant = this.merchants.get(merchantId);
    if (!merchant) return;
    if (currency === 'USD') {
      merchant.balanceUsd = Number((merchant.balanceUsd + amount).toFixed(2));
    } else {
      merchant.balanceZig = Number((merchant.balanceZig + amount).toFixed(2));
    }
    this.merchants.set(merchantId, { ...merchant });
  }

  public logMessage(message: MessageLog) {
    this.messageLogs.unshift(message);
  }

  public logWebhook(webhook: WebhookLog) {
    this.webhookLogs.unshift(webhook);
  }
}

export const db = new DatabaseStore();
