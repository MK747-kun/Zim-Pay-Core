/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Currency = 'USD' | 'ZIG';

export type PaymentProvider = 'ECOCASH' | 'INNBUCKS' | 'ZIPIT' | 'ONEMONEY' | 'OMARI';

export type TransactionStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'FALLBACK_TRIGGERED'
  | 'EXPIRED';

export type MessageChannel = 'WHATSAPP' | 'EMAIL';

export type MessageStatus = 'QUEUED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface Merchant {
  id: string;
  name: string;
  apiKey: string;
  webhookUrl: string;
  webhookSecret: string;
  notificationEmail: string;
  whatsappNumber: string;
  autoSettle: boolean;
  currencyPreference: 'USD' | 'ZIG' | 'DUAL';
  balanceUsd: number;
  balanceZig: number;
}

export interface ExchangeRate {
  id: string;
  baseCurrency: Currency;
  targetCurrency: Currency;
  rate: number; // e.g. 26.85 ZiG per USD
  marketRate: number; // raw interbank rate
  spreadBps: number; // 250 bps = 2.5%
  slippageTolerancePercent: number; // e.g. 2.0%
  lockedRateTtlSeconds: number; // default 600 (10 minutes)
  lastUpdated: string;
  source: 'RBZ_INTERBANK' | 'MARKET_WEIGHTED' | 'PARALLEL_GUARD';
}

export interface RateLock {
  id: string;
  token: string;
  baseCurrency: Currency;
  targetCurrency: Currency;
  lockedRate: number;
  amountBase: number;
  amountTarget: number;
  createdAt: string;
  expiresAt: string;
  ttlRemainingSeconds: number;
  isExpired: boolean;
  slippageDetected: boolean;
  currentMarketRate: number;
  slippageDeltaPercent: number;
}

export interface Transaction {
  id: string;
  checkoutSessionId: string;
  merchantId: string;
  provider: PaymentProvider;
  fallbackProvider?: PaymentProvider;
  fallbackReason?: string;
  amount: number;
  currency: Currency;
  convertedAmount: number;
  convertedCurrency: Currency;
  rateApplied: number;
  rateLockId: string;
  status: TransactionStatus;
  customerPhone: string;
  customerEmail: string;
  customerName: string;
  referenceCode: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  // Dynamic rail data:
  ussdRef?: string;
  qrPayload?: string;
  zipitDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    reference: string;
  };
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  timestamp: string;
  accountDebited: string;
  accountCredited: string;
  amount: number;
  currency: Currency;
  rateApplied: number;
  description: string;
  isolationLevel: 'SERIALIZABLE';
  state: 'COMMITTED' | 'ROLLEDBACK';
}

export interface MessageLog {
  id: string;
  transactionId: string;
  channel: MessageChannel;
  recipient: string;
  status: MessageStatus;
  templateName: string;
  payload: Record<string, any>;
  sentAt?: string;
  errorDetails?: string;
  attempts: number;
  providerMessageId?: string;
}

export interface PaymentRailHealth {
  provider: PaymentProvider;
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
  avgLatencyMs: number;
  successRatePercent: number;
  priorityOrder: number;
  isFallbackOnly: boolean;
  notes: string;
}

export interface NotificationSettings {
  whatsappEnabled: boolean;
  whatsappProvider: 'META_CLOUD_API' | 'TWILIO';
  whatsappApiTokenConfigured: boolean;
  whatsappPhoneNumberId: string;
  emailEnabled: boolean;
  emailProvider: 'RESEND' | 'SMTP';
  emailApiKeyConfigured: boolean;
  emailSender: string;
  sendOnSuccess: boolean;
  sendOnFallback: boolean;
  sendOnFailure: boolean;
  dispatchEodSummary: boolean;
  eodDispatchTime: string; // e.g. "23:59 CAT"
}

export interface WebhookLog {
  id: string;
  transactionId: string;
  url: string;
  event: string;
  payload: Record<string, any>;
  signature: string;
  httpStatus?: number;
  status: 'DELIVERED' | 'FAILED' | 'PENDING';
  attempts: number;
  lastAttemptAt: string;
}
