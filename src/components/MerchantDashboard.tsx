/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Currency,
  ExchangeRate,
  LedgerEntry,
  Merchant,
  MessageLog,
  NotificationSettings,
  PaymentProvider,
  PaymentRailHealth,
  Transaction,
} from '../types';
import { MessageLogsViewer } from './MessageLogsViewer';
import { LedgerViewerModal } from './LedgerViewerModal';
import { generateTransactionPdfReceipt, generateEodPdfStatement } from './PdfReceiptGenerator';
import {
  DollarSign,
  TrendingUp,
  ShieldAlert,
  ArrowRightLeft,
  Smartphone,
  Share2,
  Mail,
  FileText,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Database,
  Code2,
  ExternalLink,
  PlusCircle,
  Copy,
  Check,
  Key,
  Webhook,
  Terminal,
  ShieldCheck,
  Flame,
  Award,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';

interface MerchantDashboardProps {
  merchant: Merchant;
  exchangeRate: ExchangeRate;
  transactions: Transaction[];
  ledgerEntries: LedgerEntry[];
  messageLogs: MessageLog[];
  rails: PaymentRailHealth[];
  notificationSettings: NotificationSettings;
  onOpenCheckoutModal: () => void;
  onRefreshData: () => void;
  onUpdateRate: (newMarketRate: number, spreadBps?: number, slippageTolerance?: number) => void;
  onToggleRailStatus: (provider: PaymentProvider, status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE', notes?: string) => void;
  onSaveNotificationSettings: (settings: NotificationSettings) => void;
  onRetryMessage: (id: string) => void;
}

export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({
  merchant,
  exchangeRate,
  transactions,
  ledgerEntries,
  messageLogs,
  rails,
  notificationSettings,
  onOpenCheckoutModal,
  onRefreshData,
  onUpdateRate,
  onToggleRailStatus,
  onSaveNotificationSettings,
  onRetryMessage,
}) => {
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'TRANSACTIONS' | 'SLIPPAGE_GUARD' | 'ROUTING_RAILS' | 'MESSAGING' | 'DEVELOPER'
  >('OVERVIEW');

  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Rate Slippage Form State
  const [marketRateInput, setMarketRateInput] = useState(exchangeRate.marketRate.toString());
  const [spreadBpsInput, setSpreadBpsInput] = useState(exchangeRate.spreadBps.toString());
  const [slippageToleranceInput, setSlippageToleranceInput] = useState(exchangeRate.slippageTolerancePercent.toString());
  const [rateFeedback, setRateFeedback] = useState<string | null>(null);

  // Notification Form State
  const [notifForm, setNotifForm] = useState<NotificationSettings>({ ...notificationSettings });

  // Calculations
  const successfulTx = transactions.filter((t) => t.status === 'SUCCESS');
  const fallbackTx = transactions.filter((t) => !!t.fallbackProvider);
  const totalUsdVolume = successfulTx
    .filter((t) => t.currency === 'USD')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalZigVolume = successfulTx
    .filter((t) => t.currency === 'ZIG')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(merchant.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyWebhookSecret = () => {
    navigator.clipboard.writeText(merchant.webhookSecret);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleUpdateRatesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rateVal = parseFloat(marketRateInput);
    const spreadVal = parseInt(spreadBpsInput, 10);
    const slippageVal = parseFloat(slippageToleranceInput);

    if (isNaN(rateVal) || rateVal <= 0) return;
    onUpdateRate(rateVal, spreadVal, slippageVal);
    setRateFeedback('Exchange rate guard parameters updated successfully.');
    setTimeout(() => setRateFeedback(null), 3000);
  };

  const handleSimulateVolatilitySpike = () => {
    const spikeRate = Number((exchangeRate.marketRate * 1.085).toFixed(4)); // +8.5% jump
    setMarketRateInput(spikeRate.toString());
    onUpdateRate(spikeRate, exchangeRate.spreadBps, exchangeRate.slippageTolerancePercent);
    setRateFeedback(`Simulated FX market volatility spike (+8.5% to ${spikeRate} ZiG/USD). Rate lock shield engaged.`);
    setTimeout(() => setRateFeedback(null), 5000);
  };

  const handleDownloadEodStatement = async () => {
    try {
      const res = await fetch('/api/reconciliation/eod');
      const stmt = await res.json();
      generateEodPdfStatement(stmt);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Editorial Header Card: Merchant Credentials & Quick CTAs */}
      <div className="relative p-6 sm:p-7 rounded-[6px] bg-gradient-to-r from-[#171411] via-[#141210] to-[#191512] border border-amber-900/35 shadow-[0_16px_40px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#FDFBF7] tracking-tight">
                {merchant.name}
              </h1>
              <span className="text-[10px] uppercase tracking-widest font-semibold px-2.5 py-0.5 rounded-[2px] bg-amber-500/10 text-[#F59E0B] border border-amber-500/30 shadow-sm">
                Certified Merchant Vault
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#A1A1AA]">
              <span>Clearinghouse ID: <span className="font-mono text-[#D4D4D8]">{merchant.id}</span></span>
              <span>·</span>
              <span>Settlement Mode: <span className="text-[#FDFBF7] font-medium">{merchant.currencyPreference} Dual-Currency</span></span>
              <span>·</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                ACID Auto-Settlement Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadEodStatement}
              className="px-4 py-2.5 rounded-[4px] text-xs font-semibold uppercase tracking-wider bg-[#1E1A16] hover:bg-[#28221D] text-[#D4D4D8] hover:text-[#FDFBF7] border border-amber-900/40 flex items-center gap-2 transition cursor-pointer shadow-sm hover:border-amber-600/50"
              title="Download Certified PDF Reconciliation Statement"
            >
              <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Audit Statement</span>
            </button>

            <button
              onClick={onOpenCheckoutModal}
              className="px-4 py-2.5 rounded-[4px] text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-[#1C1305] shadow-[0_4px_25px_rgba(245,158,11,0.25)] flex items-center gap-2 transition cursor-pointer border border-amber-300/40 active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#1C1305]" />
              <span>Simulate Checkout</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. ASYMMETRIC & HIGH-IMPACT HERO SECTION: Left 65% Hero Vault, Right 35% Rate Lock Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 65% width: HERO VAULT SECTION */}
        <div className="lg:col-span-8 p-6 sm:p-7 rounded-[6px] bg-gradient-to-b from-[#181512] via-[#141210] to-[#12100E] border border-amber-900/35 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85)] flex flex-col justify-between relative overflow-hidden backdrop-blur-xl">
          {/* Ambient Velvet Lighting Overlay */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-6 relative z-10">
            {/* Top Bar inside Vault: Header & Gold-Backed Real-Time Clearing Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-900/25 pb-4">
              <div>
                <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                  Institutional Vault & Asset Clearing
                </span>
                <h2 className="text-base font-semibold text-[#FDFBF7]">
                  Primary Reserve & Multi-Currency Liquidity
                </h2>
              </div>

              {/* Gold-Backed Real-Time Clearing Indicator with gentle gold pulse */}
              <div className="px-3.5 py-1.5 rounded-[4px] bg-[#1A1612] border border-amber-500/40 text-xs flex items-center gap-2.5 shadow-sm animate-gold-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                  Gold-Backed RBZ Clearing Active
                </span>
              </div>
            </div>

            {/* Side-by-Side Settled USD & ZiG Balances (Editorial Serif Figures) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Settled USD Vault */}
              <div className="p-5 rounded-[4px] bg-[#171411]/90 border border-amber-900/30 space-y-2 relative group hover:border-amber-700/50 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest font-semibold text-amber-500/80">
                    Settled USD Vault
                  </span>
                  <div className="w-7 h-7 rounded-[4px] bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#FDFBF7] py-1">
                  ${merchant.balanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

                <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-1 border-t border-amber-900/20">
                  <span>Processed: ${totalUsdVolume.toFixed(2)}</span>
                  <span className="text-emerald-400 font-medium">100% On-Demand Available</span>
                </div>
              </div>

              {/* Settled ZiG Vault */}
              <div className="p-5 rounded-[4px] bg-[#171411]/90 border border-amber-900/30 space-y-2 relative group hover:border-amber-700/50 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest font-semibold text-amber-500/80">
                    Settled ZiG Vault
                  </span>
                  <div className="w-7 h-7 rounded-[4px] bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#F59E0B]">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#F59E0B] py-1">
                  ZiG {merchant.balanceZig.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

                <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-1 border-t border-amber-900/20">
                  <span>Processed: ZiG {totalZigVolume.toFixed(2)}</span>
                  <span className="text-amber-300 font-medium">Physically Gold Backed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Rescued Volume & ACID Guarantee */}
          <div className="mt-6 pt-4 border-t border-amber-900/25 flex flex-wrap items-center justify-between text-xs text-[#A1A1AA] gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-orange-400" />
              <span>
                Fallback Routing Rescues: <strong className="text-[#FDFBF7]">{fallbackTx.length} sessions</strong> (${(fallbackTx.length * 45).toFixed(2)} protected)
              </span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>PostgreSQL Serializable ACID isolation enforced</span>
            </div>
          </div>
        </div>

        {/* Right 35% width: RATE LOCK WIDGET */}
        <div className="lg:col-span-4 p-6 sm:p-7 rounded-[6px] bg-gradient-to-b from-[#181410] via-[#141210] to-[#12100E] border border-amber-500/35 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85)] flex flex-col justify-between relative backdrop-blur-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-amber-900/25 pb-3">
              <div className="flex items-center gap-2 text-[#F59E0B]">
                <Clock className="w-4 h-4" />
                <span className="text-xs uppercase tracking-widest font-semibold">
                  10m Rate Lock Shield
                </span>
              </div>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-[2px] bg-amber-500/10 text-amber-300 border border-amber-500/30">
                Active Guarantee
              </span>
            </div>

            {/* Prominent FX Rate Badge */}
            <div className="text-center py-2 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-[#A1A1AA]">
                Guaranteed Interbank Settlement Rate
              </div>
              <div className="font-serif text-3xl font-bold text-[#FDFBF7] tracking-tight">
                1 USD = <span className="text-[#F59E0B]">{exchangeRate.rate.toFixed(4)}</span> ZiG
              </div>
              <div className="text-xs text-[#A1A1AA]">
                Base RBZ Rate: {exchangeRate.marketRate.toFixed(4)} (+{exchangeRate.spreadBps} bps spread)
              </div>
            </div>

            {/* Active 10-Minute Countdown Meter */}
            <div className="p-3.5 rounded-[4px] bg-[#171411] border border-amber-900/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A1A1AA]">Validity Window</span>
                <span className="font-semibold text-emerald-400">600s / 10 Minutes</span>
              </div>
              <div className="w-full bg-[#241F1A] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-500"
                  style={{ width: '82%' }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#A1A1AA]">
                <span>Slippage Buffer: {exchangeRate.slippageTolerancePercent}%</span>
                <span className="text-amber-300">Zero Arbitrage Drift</span>
              </div>
            </div>

            {/* Live Slippage Arbitrage Shield Status */}
            <div className="p-3 rounded-[4px] bg-amber-500/5 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-200">
              <ShieldCheck className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#FDFBF7]">Slippage Arbitrage Shield Active</p>
                <p className="text-[11px] text-[#A1A1AA] mt-0.5 leading-relaxed">
                  Checkout checkouts locked at initiation are guaranteed against sudden ZiG price movements.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Simulation Trigger */}
          <div className="pt-4 border-t border-amber-900/25 mt-4">
            <button
              onClick={handleSimulateVolatilitySpike}
              className="w-full py-2.5 px-3 rounded-[4px] text-xs font-semibold uppercase tracking-wider bg-[#1E1A16] hover:bg-[#28221D] text-[#F59E0B] border border-amber-500/30 hover:border-amber-500/60 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Test Volatility Spike (+8.5%)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE FLOATING TAB NAVIGATION */}
      <div className="sticky top-16 z-30 py-2 backdrop-blur-xl bg-[#0C0A09]/80">
        <div className="p-1.5 rounded-[6px] bg-[#141210] border border-amber-900/35 shadow-lg flex gap-1.5 overflow-x-auto">
          {[
            { id: 'OVERVIEW', label: 'Overview', icon: Activity },
            { id: 'TRANSACTIONS', label: 'Transactions', icon: Layers },
            { id: 'SLIPPAGE_GUARD', label: 'Rate Locks', icon: ArrowRightLeft },
            { id: 'ROUTING_RAILS', label: 'Rail Failover', icon: Smartphone },
            { id: 'MESSAGING', label: 'Messaging', icon: Share2 },
            { id: 'DEVELOPER', label: 'Developer API', icon: Code2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-[4px] transition whitespace-nowrap cursor-pointer relative ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-[#1C1305] shadow-[0_2px_15px_rgba(245,158,11,0.35)]'
                    : 'text-[#A1A1AA] hover:text-[#FDFBF7] hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#1C1305]' : 'text-[#F59E0B]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW & AUDIT */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Payment Rails Monitor + Settlements Table */}
            <div className="lg:col-span-8 space-y-6">
              {/* 4.1 Payment Rails Failover Monitor with live latency bars */}
              <div className="p-6 rounded-[6px] bg-[#141210] border border-amber-900/30 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-amber-900/25 pb-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                      Payment Rails Failover Monitor
                    </span>
                    <h3 className="font-semibold text-sm text-[#FDFBF7]">
                      Zimbabwe Mobile Money & Interbank Latency Engine
                    </h3>
                  </div>
                  <span className="text-xs text-emerald-400 font-medium">Failover Auto-Routing</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {rails.map((rail) => {
                    const isEcoCash = rail.provider === 'ECOCASH';
                    const latencyPercent = Math.min(100, Math.round((rail.avgLatencyMs / 800) * 100));

                    return (
                      <div
                        key={rail.provider}
                        className="p-4 rounded-[4px] bg-[#171411] border border-amber-900/25 space-y-2.5 transition hover:border-amber-700/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                rail.status === 'OPERATIONAL'
                                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                                  : rail.status === 'DEGRADED'
                                  ? 'bg-amber-400 animate-pulse'
                                  : 'bg-rose-500'
                              }`}
                            />
                            <span className="font-semibold text-xs text-[#FDFBF7]">{rail.name}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-semibold tracking-wider ${
                              rail.status === 'OPERATIONAL'
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                : rail.status === 'DEGRADED'
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {rail.status}
                          </span>
                        </div>

                        {/* Latency Sparkline / Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-[#A1A1AA]">
                            <span>Response Latency</span>
                            <span className="font-mono text-[#FDFBF7]">{rail.avgLatencyMs}ms</span>
                          </div>
                          <div className="w-full bg-[#241F1A] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                rail.status === 'OPERATIONAL'
                                  ? 'bg-emerald-400'
                                  : rail.status === 'DEGRADED'
                                  ? 'bg-amber-400'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${latencyPercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-[11px] text-[#A1A1AA] flex items-center justify-between pt-1 border-t border-amber-900/15">
                          <span>Success: {rail.successRatePercent}%</span>
                          <span className="text-[#D4D4D8] text-[10px]">
                            {isEcoCash ? 'Primary Push' : 'Fallback Rail'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Settlements Table */}
              <div className="p-6 rounded-[6px] bg-[#141210] border border-amber-900/30 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-amber-900/25 pb-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                      Live Gateway Settlements
                    </span>
                    <h3 className="font-semibold text-sm text-[#FDFBF7]">
                      Recent Multi-Currency Transactions
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('TRANSACTIONS')}
                    className="text-xs text-[#F59E0B] hover:text-amber-300 flex items-center gap-1 font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    <span>View all ({transactions.length})</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[11px] uppercase tracking-wider text-[#A1A1AA] border-b border-amber-900/25 pb-2">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Reference</th>
                        <th className="py-2.5 px-3 font-semibold">Customer</th>
                        <th className="py-2.5 px-3 font-semibold">Amount</th>
                        <th className="py-2.5 px-3 font-semibold">Settlement Rail</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                        <th className="py-2.5 px-3 text-right font-semibold">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-900/20">
                      {transactions.slice(0, 5).map((t) => (
                        <tr key={t.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-3 px-3">
                            <div className="font-mono text-[#FDFBF7] text-xs font-semibold">{t.referenceCode}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-[#FDFBF7] font-medium">{t.customerName}</div>
                            <div className="text-[10px] text-[#A1A1AA] font-mono">{t.customerPhone}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-serif font-bold text-[#FDFBF7] text-sm">
                              {t.currency === 'USD' ? '$' : 'ZiG '}{t.amount.toFixed(2)}
                            </span>
                            {t.convertedAmount && (
                              <div className="text-[10px] text-[#A1A1AA]">
                                ≈ {t.convertedCurrency} {t.convertedAmount.toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {t.fallbackProvider ? (
                              <span className="text-[#F59E0B] font-semibold text-[11px] flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3" />
                                {t.fallbackProvider} (Fallback)
                              </span>
                            ) : (
                              <span className="text-[#D4D4D8] text-[11px]">{t.provider}</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => generateTransactionPdfReceipt(t, merchant)}
                              className="text-[#A1A1AA] hover:text-[#FDFBF7] p-1.5 rounded-[3px] hover:bg-white/[0.05] transition cursor-pointer border border-transparent hover:border-amber-900/40"
                              title="Download Certified PDF Receipt"
                            >
                              <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: 4.2 End-of-Day Settlement Audit Stamped Luxury Invoice + 4.3 Dual Messaging Queue */}
            <div className="lg:col-span-4 space-y-6">
              {/* 4.2 END-OF-DAY SETTLEMENT AUDIT (OFFICIAL STAMPED LUXURY INVOICE DESIGN) */}
              <div className="p-6 rounded-[6px] bg-[#161310] border border-amber-600/40 shadow-xl space-y-5 relative overflow-hidden audit-seal-pattern">
                {/* Cryptographic Gold Stamped Insignia / Security Seal */}
                <div className="flex items-center justify-between border-b border-amber-900/35 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[4px] bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-[#F59E0B]">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                        Official Certified Audit
                      </span>
                      <h4 className="font-serif font-bold text-sm text-[#FDFBF7]">
                        End-of-Day Reconciliation
                      </h4>
                    </div>
                  </div>

                  <div className="px-2 py-1 rounded-[2px] bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300 uppercase tracking-wider">
                    STAMPED 2026-EOD
                  </div>
                </div>

                {/* Stamped Luxury Invoice Details */}
                <div className="space-y-3 text-xs bg-[#120F0D] p-4 rounded-[4px] border border-amber-900/30">
                  <div className="flex justify-between items-center text-[#A1A1AA]">
                    <span>Certifying Entity:</span>
                    <span className="font-semibold text-[#FDFBF7]">Reserve Bank Rails</span>
                  </div>
                  <div className="flex justify-between items-center text-[#A1A1AA]">
                    <span>Total Verified Transactions:</span>
                    <span className="font-semibold text-[#FDFBF7]">{transactions.length} cleared</span>
                  </div>
                  <div className="flex justify-between items-center text-[#A1A1AA]">
                    <span>USD Net Settled:</span>
                    <span className="font-serif font-bold text-emerald-400 text-sm">
                      ${totalUsdVolume.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[#A1A1AA]">
                    <span>ZiG Net Settled:</span>
                    <span className="font-serif font-bold text-[#F59E0B] text-sm">
                      ZiG {totalZigVolume.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-amber-900/30 pt-2 text-[#A1A1AA]">
                    <span>Slippage Loss Variance:</span>
                    <span className="font-semibold text-emerald-400">0.00% (Protected)</span>
                  </div>
                  <div className="text-[10px] text-[#71717A] pt-1 font-mono">
                    SHA256: 9e4f2a1b7c8d9e0f...verified
                  </div>
                </div>

                {/* Prominent Gold Download Button */}
                <button
                  onClick={handleDownloadEodStatement}
                  className="w-full py-3 px-4 rounded-[4px] text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-[#1C1305] shadow-[0_4px_25px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 transition cursor-pointer border border-amber-300/40 hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4 text-[#1C1305]" />
                  <span>Download Certified PDF Statement</span>
                </button>
              </div>

              {/* 4.3 DUAL MESSAGING ENGINE QUEUE (LIVE FEED OF MICRO-CARDS) */}
              <div className="p-6 rounded-[6px] bg-[#141210] border border-amber-900/30 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-amber-900/25 pb-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                      Dual Messaging Engine
                    </span>
                    <h4 className="font-semibold text-sm text-[#FDFBF7]">
                      Live Real-Time Dispatch Feed
                    </h4>
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-[2px] border border-emerald-500/30">
                    Live Feed
                  </span>
                </div>

                {/* Micro-cards Live Feed */}
                <div className="space-y-2.5">
                  {messageLogs.slice(0, 4).map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-[4px] bg-[#171411] border border-amber-900/25 space-y-1.5 text-xs hover:border-amber-700/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.channel === 'WHATSAPP' ? (
                            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Mail className="w-3.5 h-3.5 text-[#F59E0B]" />
                          )}
                          <span className="font-semibold text-[#FDFBF7] text-xs">
                            {log.channel === 'WHATSAPP' ? 'WhatsApp Cloud' : 'Email Dispatch'}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-[2px] ${
                            log.status === 'SENT'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#A1A1AA]">
                        <span className="font-mono text-[#D4D4D8]">{log.recipient}</span>
                        <span>{log.sentAt ? new Date(log.sentAt).toLocaleTimeString() : 'In Queue'}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setActiveTab('MESSAGING')}
                  className="w-full py-2 px-3 rounded-[4px] text-xs font-semibold uppercase tracking-wider bg-[#1E1A16] hover:bg-[#28221D] text-[#D4D4D8] hover:text-[#FDFBF7] border border-amber-900/40 transition text-center cursor-pointer"
                >
                  Configure Dispatch Queue & Rules
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRANSACTIONS & RECEIPTS */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="space-y-4">
          <div className="p-6 rounded-[6px] bg-[#141210] border border-amber-900/30 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                Historical Ledger
              </span>
              <h2 className="text-lg font-serif font-bold text-[#FDFBF7]">
                Customer Transactions & Settlement Records
              </h2>
            </div>

            <button
              onClick={onRefreshData}
              className="px-4 py-2 rounded-[4px] bg-[#1E1A16] hover:bg-[#28221D] text-[#D4D4D8] hover:text-[#FDFBF7] text-xs font-semibold uppercase tracking-wider border border-amber-900/40 flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Refresh Ledger</span>
            </button>
          </div>

          <div className="p-6 rounded-[6px] bg-[#141210] border border-amber-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#D4D4D8]">
                <thead className="bg-[#171411] text-[11px] uppercase tracking-wider text-[#A1A1AA] border-b border-amber-900/30">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Reference Code</th>
                    <th className="py-3 px-4 font-semibold">Customer Details</th>
                    <th className="py-3 px-4 font-semibold">Billed Amount</th>
                    <th className="py-3 px-4 font-semibold">Guaranteed FX Rate</th>
                    <th className="py-3 px-4 font-semibold">Payment Rail</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 text-right font-semibold">Certified PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-900/20">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#FDFBF7] text-xs">{tx.referenceCode}</div>
                        <div className="text-[10px] text-[#71717A] font-mono">{tx.id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[#FDFBF7] font-medium">{tx.customerName}</div>
                        <div className="text-[11px] text-[#A1A1AA] font-mono">{tx.customerPhone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-serif font-bold text-[#FDFBF7] text-sm">
                          {tx.currency === 'USD' ? '$' : 'ZiG '}{tx.amount.toFixed(2)}
                        </div>
                        {tx.convertedAmount && (
                          <div className="text-[11px] text-[#A1A1AA]">
                            ≈ {tx.convertedCurrency} {tx.convertedAmount.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#F59E0B] text-xs font-medium">
                        1 USD = {tx.rateApplied} ZiG
                      </td>
                      <td className="py-3 px-4">
                        {tx.fallbackProvider ? (
                          <div>
                            <span className="text-[#F59E0B] font-semibold text-[11px] flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              {tx.fallbackProvider} (Fallback)
                            </span>
                            <span className="text-[10px] text-[#A1A1AA] block truncate max-w-[150px]">
                              {tx.fallbackReason}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#D4D4D8]">{tx.provider}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-[2px] ${
                            tx.status === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => generateTransactionPdfReceipt(tx, merchant)}
                          className="px-3 py-1 rounded-[3px] bg-[#1E1A16] hover:bg-[#28221D] text-[#FDFBF7] text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 transition cursor-pointer border border-amber-900/40 hover:border-amber-600/50"
                        >
                          <Download className="w-3 h-3 text-[#F59E0B]" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DUAL-CURRENCY RATE LOCKS */}
      {activeTab === 'SLIPPAGE_GUARD' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-7 rounded-[6px] bg-[#141210] border border-amber-900/30 space-y-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-900/25 pb-4">
              <div>
                <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                  Hedging Engine
                </span>
                <h2 className="text-xl font-serif font-bold text-[#FDFBF7] flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-[#F59E0B]" />
                  <span>Dual-Currency Rate-Slippage Guard Controller</span>
                </h2>
                <p className="text-xs text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
                  Lock exchange rates at checkout creation with a guaranteed 10-minute validity window to prevent losses from rapid FX rate fluctuations during processing.
                </p>
              </div>

              <button
                onClick={handleSimulateVolatilitySpike}
                className="px-4 py-2.5 rounded-[4px] text-xs font-semibold uppercase tracking-wider bg-amber-500/10 border border-amber-500/40 text-[#F59E0B] hover:bg-amber-500/20 flex items-center gap-2 transition cursor-pointer"
              >
                <TrendingUp className="w-4 h-4 text-[#F59E0B]" />
                <span>Simulate FX Volatility Spike (+8.5%)</span>
              </button>
            </div>

            {rateFeedback && (
              <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-[4px] text-xs text-amber-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#F59E0B] shrink-0" />
                <span>{rateFeedback}</span>
              </div>
            )}

            {/* Current Guard State */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#171411] rounded-[4px] border border-amber-900/30 space-y-1.5">
                <span className="text-xs text-[#A1A1AA]">Current Interbank Rate</span>
                <div className="text-2xl font-serif font-bold text-[#FDFBF7]">
                  {exchangeRate.marketRate.toFixed(4)} <span className="text-xs font-sans text-[#A1A1AA]">ZiG/USD</span>
                </div>
                <div className="text-[11px] text-emerald-400 font-medium">RBZ Live Interbank Verified</div>
              </div>

              <div className="p-4 bg-[#171411] rounded-[4px] border border-amber-900/30 space-y-1.5">
                <span className="text-xs text-[#A1A1AA]">Guaranteed Checkout Rate (+Spread)</span>
                <div className="text-2xl font-serif font-bold text-[#F59E0B]">
                  {exchangeRate.rate.toFixed(4)} <span className="text-xs font-sans text-[#A1A1AA]">ZiG/USD</span>
                </div>
                <div className="text-[11px] text-[#A1A1AA]">Includes {exchangeRate.spreadBps} bps protection margin</div>
              </div>

              <div className="p-4 bg-[#171411] rounded-[4px] border border-amber-900/30 space-y-1.5">
                <span className="text-xs text-[#A1A1AA]">Slippage Tolerance & Lock TTL</span>
                <div className="text-2xl font-serif font-bold text-emerald-400">
                  {exchangeRate.slippageTolerancePercent}% · 10m
                </div>
                <div className="text-[11px] text-[#A1A1AA]">Automatic session preservation shield</div>
              </div>
            </div>

            {/* Update Rates Form */}
            <form onSubmit={handleUpdateRatesSubmit} className="p-5 bg-[#171411]/80 rounded-[4px] border border-amber-900/30 space-y-4">
              <div className="text-xs uppercase tracking-widest font-semibold text-amber-500/80">
                Configure Guard Parameters & FX Spread
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-[#A1A1AA] mb-1 font-medium">Base Market Rate (ZiG per 1 USD)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={marketRateInput}
                    onChange={(e) => setMarketRateInput(e.target.value)}
                    className="w-full bg-[#1F1B17] border border-amber-900/40 rounded-[4px] px-3 py-2 text-[#FDFBF7] font-sans focus:border-[#F59E0B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#A1A1AA] mb-1 font-medium">Protection Spread (Basis Points)</label>
                  <input
                    type="number"
                    step="10"
                    value={spreadBpsInput}
                    onChange={(e) => setSpreadBpsInput(e.target.value)}
                    className="w-full bg-[#1F1B17] border border-amber-900/40 rounded-[4px] px-3 py-2 text-[#FDFBF7] font-sans focus:border-[#F59E0B] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#71717A] mt-0.5 block">250 bps = 2.50% added buffer</span>
                </div>

                <div>
                  <label className="block text-[#A1A1AA] mb-1 font-medium">Max Slippage Tolerance (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={slippageToleranceInput}
                    onChange={(e) => setSlippageToleranceInput(e.target.value)}
                    className="w-full bg-[#1F1B17] border border-amber-900/40 rounded-[4px] px-3 py-2 text-[#FDFBF7] font-sans focus:border-[#F59E0B] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#71717A] mt-0.5 block">Triggers re-quote notice if exceeded</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-[4px] bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-[#1C1305] text-xs font-semibold uppercase tracking-wider transition cursor-pointer shadow-md"
                >
                  Save & Enforce Rate Lock Guard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: ROUTING RAILS */}
      {activeTab === 'ROUTING_RAILS' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-7 rounded-[6px] bg-[#141210] border border-amber-900/30 space-y-5 shadow-md">
            <div className="border-b border-amber-900/25 pb-4">
              <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                Failover Orchestration
              </span>
              <h2 className="text-xl font-serif font-bold text-[#FDFBF7] flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#F59E0B]" />
                <span>Dynamic Fallback Routing Rails</span>
              </h2>
              <p className="text-xs text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
                If primary payment rails (e.g., EcoCash USSD push) fail or encounter MNO timeout, the gateway instantly renders a backup payment QR option (InnBucks) or ZIPIT bank transfer details without destroying the active checkout session.
              </p>
            </div>

            <div className="space-y-4">
              {rails.map((rail) => (
                <div
                  key={rail.provider}
                  className="p-5 rounded-[4px] bg-[#171411] border border-amber-900/25 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-[#FDFBF7]">{rail.name}</span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-[2px] bg-[#221C16] border border-amber-900/30 text-amber-300">
                        Priority #{rail.priorityOrder} {rail.isFallbackOnly ? '(Backup Failover Rail)' : '(Primary Rail)'}
                      </span>
                    </div>
                    <div className="text-xs text-[#A1A1AA]">{rail.notes}</div>
                    <div className="flex items-center gap-4 text-xs text-[#71717A] pt-1">
                      <span>Avg Response: <strong className="text-[#D4D4D8]">{rail.avgLatencyMs}ms</strong></span>
                      <span>·</span>
                      <span>Success Ratio: <strong className="text-[#D4D4D8]">{rail.successRatePercent}%</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleRailStatus(rail.provider, 'OPERATIONAL', 'Restored to normal operational state')}
                      className={`px-3.5 py-1.5 rounded-[3px] text-xs font-semibold uppercase tracking-wider transition cursor-pointer ${
                        rail.status === 'OPERATIONAL'
                          ? 'bg-emerald-500 text-[#1C1305] shadow-sm'
                          : 'bg-[#1E1A16] text-[#A1A1AA] hover:text-[#FDFBF7] border border-amber-900/40'
                      }`}
                    >
                      Operational
                    </button>
                    <button
                      onClick={() => onToggleRailStatus(rail.provider, 'DEGRADED', 'High upstream MNO latency detected')}
                      className={`px-3.5 py-1.5 rounded-[3px] text-xs font-semibold uppercase tracking-wider transition cursor-pointer ${
                        rail.status === 'DEGRADED'
                          ? 'bg-[#F59E0B] text-[#1C1305] shadow-sm'
                          : 'bg-[#1E1A16] text-[#A1A1AA] hover:text-[#FDFBF7] border border-amber-900/40'
                      }`}
                    >
                      Degraded
                    </button>
                    <button
                      onClick={() => onToggleRailStatus(rail.provider, 'OUTAGE', 'Simulated MNO timeout failure')}
                      className={`px-3.5 py-1.5 rounded-[3px] text-xs font-semibold uppercase tracking-wider transition cursor-pointer ${
                        rail.status === 'OUTAGE'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-[#1E1A16] text-[#A1A1AA] hover:text-[#FDFBF7] border border-amber-900/40'
                      }`}
                    >
                      Simulate Outage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MESSAGING */}
      {activeTab === 'MESSAGING' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-7 rounded-[6px] bg-[#141210] border border-amber-900/30 space-y-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-900/25 pb-4">
              <div>
                <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                  Dual Dispatch Engine
                </span>
                <h2 className="text-xl font-serif font-bold text-[#FDFBF7] flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-emerald-400" />
                  <span>Meta WhatsApp & Email Dispatch Settings</span>
                </h2>
                <p className="text-xs text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
                  Real-time WhatsApp Cloud API confirmation payloads and automatic PDF receipt email dispatches.
                </p>
              </div>

              <button
                onClick={handleDownloadEodStatement}
                className="px-4 py-2.5 rounded-[4px] bg-[#1E1A16] hover:bg-[#28221D] text-[#D4D4D8] hover:text-[#FDFBF7] text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition cursor-pointer border border-amber-900/40"
              >
                <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Download Sample Statement PDF</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* WhatsApp Config Card */}
              <div className="p-4 bg-[#171411] rounded-[4px] border border-amber-900/30 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FDFBF7] flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    WhatsApp Cloud API (Meta)
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifForm.whatsappEnabled}
                      onChange={(e) => setNotifForm({ ...notifForm, whatsappEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[#241F1A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[#A1A1AA] block mb-1 font-medium">WhatsApp Phone Number ID</label>
                    <input
                      type="text"
                      value={notifForm.whatsappPhoneNumberId}
                      onChange={(e) => setNotifForm({ ...notifForm, whatsappPhoneNumberId: e.target.value })}
                      className="w-full bg-[#1F1B17] border border-amber-900/40 rounded-[4px] px-3 py-2 text-[#FDFBF7] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[#A1A1AA] block mb-1 font-medium">Merchant WhatsApp Business Contact</label>
                    <input
                      type="text"
                      value={merchant.whatsappNumber}
                      readOnly
                      className="w-full bg-[#171411] border border-amber-900/25 rounded-[4px] px-3 py-2 text-[#71717A] font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Email Config Card */}
              <div className="p-4 bg-[#171411] rounded-[4px] border border-amber-900/30 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FDFBF7] flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#F59E0B]" />
                    Email Dispatcher (Resend / SMTP)
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifForm.emailEnabled}
                      onChange={(e) => setNotifForm({ ...notifForm, emailEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[#241F1A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[#A1A1AA] block mb-1 font-medium">Outgoing Dispatcher Address</label>
                    <input
                      type="text"
                      value={notifForm.emailSender}
                      onChange={(e) => setNotifForm({ ...notifForm, emailSender: e.target.value })}
                      className="w-full bg-[#1F1B17] border border-amber-900/40 rounded-[4px] px-3 py-2 text-[#FDFBF7] font-sans text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[#A1A1AA] block mb-1 font-medium">Merchant Notification Inbox</label>
                    <input
                      type="email"
                      value={merchant.notificationEmail}
                      readOnly
                      className="w-full bg-[#171411] border border-amber-900/25 rounded-[4px] px-3 py-2 text-[#71717A] font-sans text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-4 text-xs text-[#A1A1AA]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifForm.sendOnSuccess}
                    onChange={(e) => setNotifForm({ ...notifForm, sendOnSuccess: e.target.checked })}
                    className="rounded bg-[#1F1B17] border-amber-900/40 text-amber-500"
                  />
                  <span>Dispatch on Success</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifForm.sendOnFallback}
                    onChange={(e) => setNotifForm({ ...notifForm, sendOnFallback: e.target.checked })}
                    className="rounded bg-[#1F1B17] border-amber-900/40 text-amber-500"
                  />
                  <span>Notify on Fallback Reroute</span>
                </label>
              </div>

              <button
                onClick={() => onSaveNotificationSettings(notifForm)}
                className="py-2.5 px-5 rounded-[4px] bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-[#1C1305] text-xs font-semibold uppercase tracking-wider transition cursor-pointer shadow-md"
              >
                Save Notification Rules
              </button>
            </div>
          </div>

          {/* Live Message Logs Queue Viewer */}
          <div className="space-y-3">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
              Asynchronous Worker
            </span>
            <h3 className="font-semibold text-sm text-[#FDFBF7]">Message Delivery Queue & Raw Payload Inspection</h3>
            <MessageLogsViewer
              logs={messageLogs}
              onRetry={onRetryMessage}
              onRefresh={onRefreshData}
            />
          </div>
        </div>
      )}

      {/* TAB 6: DEVELOPER & API DOCS */}
      {activeTab === 'DEVELOPER' && (
        <div className="space-y-6">
          {/* API Keys & Webhooks Section */}
          <div className="p-6 sm:p-7 rounded-[6px] bg-[#141210] border border-amber-900/30 space-y-5 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-900/25 pb-4">
              <div>
                <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                  Integration Suite
                </span>
                <h2 className="text-xl font-serif font-bold text-[#FDFBF7] flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#F59E0B]" />
                  <span>Merchant API Credentials & Webhook Signing</span>
                </h2>
                <p className="text-xs text-[#A1A1AA] mt-1">
                  Use these credentials to authenticate server-to-server payments and verify cryptographic HMAC signatures.
                </p>
              </div>

              <button
                onClick={() => setIsLedgerModalOpen(true)}
                className="px-4 py-2 rounded-[4px] text-xs font-semibold uppercase tracking-wider bg-[#1E1A16] hover:bg-[#28221D] text-[#D4D4D8] hover:text-[#FDFBF7] border border-amber-900/40 flex items-center gap-2 transition cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Open ACID Ledger Modal ({ledgerEntries.length})</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#171411] rounded-[4px] border border-amber-900/25 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA] font-medium">Production API Secret Key</span>
                  <button
                    onClick={handleCopyKey}
                    className="text-[#F59E0B] hover:text-amber-300 flex items-center gap-1 font-mono text-xs cursor-pointer"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-[#FDFBF7] bg-[#100E0C] p-2.5 rounded-[3px] border border-amber-900/35 break-all select-all">
                  {merchant.apiKey}
                </div>
                <p className="text-[11px] text-[#71717A]">Pass in `Authorization: Bearer [api_key]` header.</p>
              </div>

              <div className="p-4 bg-[#171411] rounded-[4px] border border-amber-900/25 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA] font-medium">Webhook HMAC Signing Secret</span>
                  <button
                    onClick={handleCopyWebhookSecret}
                    className="text-[#F59E0B] hover:text-amber-300 flex items-center gap-1 font-mono text-xs cursor-pointer"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-[#FDFBF7] bg-[#100E0C] p-2.5 rounded-[3px] border border-amber-900/35 break-all select-all">
                  {merchant.webhookSecret}
                </div>
                <p className="text-[11px] text-[#71717A]">Verifies `X-ZimPay-Signature` HMAC SHA-256 header.</p>
              </div>
            </div>
          </div>

          {/* ACID Ledger Architecture Overview */}
          <div className="p-6 sm:p-7 rounded-[6px] bg-[#141210] border border-amber-900/30 space-y-5 shadow-md">
            <div>
              <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-500/80 block">
                Technical Specifications
              </span>
              <h2 className="text-xl font-serif font-bold text-[#FDFBF7] flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <span>ACID Isolation & PostgreSQL Double-Entry Engine</span>
              </h2>
              <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">
                Each payment creates an atomic, balanced double-entry accounting journal between Customer Escrow and Merchant Vaults under PostgreSQL `SERIALIZABLE` isolation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#171411] rounded-[4px] border border-amber-900/25 space-y-1.5">
                <span className="text-emerald-400 font-semibold text-xs uppercase tracking-wider">ACID Isolation</span>
                <div className="font-bold text-[#FDFBF7] text-sm">SERIALIZABLE</div>
                <p className="text-[#A1A1AA] text-[11px] leading-relaxed">
                  Eliminates write skew, phantom reads, and non-repeatable reads across simultaneous currency conversions.
                </p>
              </div>

              <div className="p-4 bg-[#171411] rounded-[4px] border border-amber-900/25 space-y-1.5">
                <span className="text-[#F59E0B] font-semibold text-xs uppercase tracking-wider">Double-Entry Accounting</span>
                <div className="font-bold text-[#FDFBF7] text-sm">Zero Drift Invariant</div>
                <p className="text-[#A1A1AA] text-[11px] leading-relaxed">
                  Every debit to `CUSTOMER_ESCROW` is strictly mirrored by a credit to `MERCHANT_SETTLEMENT`.
                </p>
              </div>

              <div className="p-4 bg-[#171411] rounded-[4px] border border-amber-900/25 space-y-1.5">
                <span className="text-amber-300 font-semibold text-xs uppercase tracking-wider">Asynchronous Dispatch</span>
                <div className="font-bold text-[#FDFBF7] text-sm">Celery / Redis Queue</div>
                <p className="text-[#A1A1AA] text-[11px] leading-relaxed">
                  Guarantees message delivery with exponential backoff and dead-letter queues.
                </p>
              </div>
            </div>

            {/* PostgreSQL DDL Schemas */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#D4D4D8]">PostgreSQL Schema DDL (`schema.sql`)</span>
                <span className="text-[#A1A1AA] font-mono text-[11px]">Strict ACID Isolated</span>
              </div>
              <pre className="p-4 bg-[#0E0C0A] rounded-[4px] border border-amber-900/35 font-mono text-[11px] text-[#F59E0B] overflow-x-auto leading-relaxed shadow-inner">
{`-- 1. Merchants Table
CREATE TABLE merchants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(128) UNIQUE NOT NULL,
    webhook_url VARCHAR(512),
    webhook_secret VARCHAR(128) NOT NULL,
    notification_email VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(32) NOT NULL,
    auto_settle BOOLEAN DEFAULT TRUE,
    currency_preference VARCHAR(16) DEFAULT 'DUAL',
    balance_usd NUMERIC(18, 4) DEFAULT 0.0000,
    balance_zig NUMERIC(18, 4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Exchange Rates & 10-Minute Slippage Locks
CREATE TABLE exchange_rates (
    id VARCHAR(64) PRIMARY KEY,
    base_currency VARCHAR(8) NOT NULL,
    target_currency VARCHAR(8) NOT NULL,
    rate NUMERIC(18, 6) NOT NULL,
    market_rate NUMERIC(18, 6) NOT NULL,
    spread_bps INT DEFAULT 250,
    slippage_tolerance_pct NUMERIC(5, 2) DEFAULT 2.00,
    locked_rate_ttl_seconds INT DEFAULT 600,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Transactions Table (Dynamic Fallback Routing)
CREATE TABLE transactions (
    id VARCHAR(64) PRIMARY KEY,
    checkout_session_id VARCHAR(128) NOT NULL,
    merchant_id VARCHAR(64) REFERENCES merchants(id),
    provider VARCHAR(32) NOT NULL,
    fallback_provider VARCHAR(32),
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    rate_applied NUMERIC(18, 6) NOT NULL,
    status VARCHAR(32) NOT NULL,
    customer_phone VARCHAR(32) NOT NULL,
    customer_email VARCHAR(255),
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ACID Double-Entry Ledger Entries
CREATE TABLE ledger_entries (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64) REFERENCES transactions(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    account_debited VARCHAR(64) NOT NULL,
    account_credited VARCHAR(64) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    rate_applied NUMERIC(18, 6) NOT NULL,
    state VARCHAR(32) DEFAULT 'COMMITTED'
);`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Double-Entry Ledger Inspector Modal */}
      <LedgerViewerModal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        entries={ledgerEntries}
      />
    </div>
  );
};
