/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
} from './types';
import { MerchantDashboard } from './components/MerchantDashboard';
import { ZimPayModal } from './components/ZimPayModal';
import {
  Zap,
  Activity,
  ArrowRightLeft,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Bell,
} from 'lucide-react';

export default function App() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [rails, setRails] = useState<PaymentRailHealth[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadData = async () => {
    try {
      const [
        ratesRes,
        railsRes,
        txsRes,
        ledgerRes,
        messagesRes,
        merchantRes,
      ] = await Promise.all([
        fetch('/api/rates'),
        fetch('/api/rails'),
        fetch('/api/transactions'),
        fetch('/api/ledger'),
        fetch('/api/messages'),
        fetch('/api/merchant'),
      ]);

      if (ratesRes.ok) setExchangeRate(await ratesRes.json());
      if (railsRes.ok) setRails(await railsRes.json());
      if (txsRes.ok) setTransactions(await txsRes.json());
      if (ledgerRes.ok) setLedgerEntries(await ledgerRes.json());
      if (messagesRes.ok) setMessageLogs(await messagesRes.json());
      if (merchantRes.ok) {
        const mData = await merchantRes.json();
        setMerchant(mData.merchant);
        setNotificationSettings(mData.notificationSettings);
      }
    } catch (err) {
      console.error('Error fetching zim-pay-core data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll updates every 6 seconds to show dynamic queue processing
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateRate = async (newMarketRate: number, spreadBps?: number, slippageTolerance?: number) => {
    try {
      const res = await fetch('/api/rates/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketRate: newMarketRate, spreadBps, slippageTolerance }),
      });
      if (res.ok) {
        const updated = await res.json();
        setExchangeRate(updated);
        showToast(`Rate-Slippage Guard updated: 1 USD = ${updated.rate} ZiG`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleRailStatus = async (
    provider: PaymentProvider,
    status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE',
    notes?: string
  ) => {
    try {
      const res = await fetch('/api/rails/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, status, notes }),
      });
      if (res.ok) {
        loadData();
        showToast(`Rail ${provider} status set to ${status}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNotificationSettings = async (settings: NotificationSettings) => {
    try {
      const res = await fetch('/api/merchant/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationSettings: settings }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotificationSettings(data.notificationSettings);
        showToast('Dual messaging dispatch rules saved.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRetryMessage = async (id: string) => {
    try {
      const res = await fetch(`/api/messages/retry/${id}`, { method: 'POST' });
      if (res.ok) {
        loadData();
        showToast('Message re-queued for asynchronous dispatch.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePaymentSuccess = (tx: Transaction) => {
    loadData();
    showToast(`Settled ${tx.referenceCode} via ${tx.fallbackProvider || tx.provider}. ACID ledger committed.`);
  };

  if (isLoading || !merchant || !exchangeRate || !notificationSettings) {
    return (
      <div className="min-h-screen bg-[#0C0A09] flex items-center justify-center text-[#FDFBF7]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#F59E0B] animate-spin" />
          <div className="font-sans text-xs tracking-widest uppercase font-semibold text-amber-500/80">
            Initializing zim-pay-core workstation...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen text-[#FDFBF7] flex flex-col selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden font-sans"
      style={{
        backgroundColor: '#0C0A09',
        backgroundImage: 'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(217, 119, 6, 0.14), transparent 70%)',
      }}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#1A1613]/95 border border-amber-500/40 shadow-[0_12px_35px_rgba(0,0,0,0.7)] rounded-[4px] p-3.5 flex items-center gap-3 text-xs text-amber-100 animate-in fade-in slide-in-from-top-2 backdrop-blur-xl">
          <ShieldCheck className="w-4 h-4 text-[#F59E0B] shrink-0" />
          <span className="font-sans font-medium tracking-wide">{toastMessage}</span>
        </div>
      )}

      {/* Global Top Architectural Header */}
      <header className="relative z-40 bg-[#141210]/85 backdrop-blur-xl border-b border-amber-900/30 px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-[4px] bg-gradient-to-br from-amber-500/25 via-amber-600/30 to-amber-950/80 flex items-center justify-center border border-amber-500/40 shadow-[0_2px_12px_rgba(245,158,11,0.2)]">
              <Zap className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-serif font-bold text-lg tracking-tight text-[#FDFBF7]">
                  zim-pay-core
                </span>
                <span className="text-[10px] font-sans uppercase tracking-widest font-semibold px-2 py-0.5 rounded-[2px] bg-amber-500/10 text-amber-400 border border-amber-500/25">
                  Multi-Currency Gateway
                </span>
              </div>
              <div className="text-[11px] text-[#A1A1AA] tracking-wide font-sans">
                Zimbabwe Multi-Currency & ACID Reconciliation Gateway
              </div>
            </div>
          </div>

          {/* Central Rate Ticker */}
          <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-[4px] bg-[#1A1613]/90 border border-amber-900/35 text-xs shadow-inner backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-amber-500/80 uppercase tracking-widest text-[10px] font-semibold">
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>RBZ Interbank:</span>
            </div>
            <div className="font-sans text-xs text-[#FDFBF7]">
              1 USD = <span className="text-[#F59E0B] font-bold font-serif text-sm">ZiG {exchangeRate.rate.toFixed(4)}</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5 pl-2 border-l border-amber-900/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              10m Shield Active
            </span>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3.5">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#D4D4D8] font-sans">
              <span className="w-2 h-2 rounded-full bg-emerald-400/90 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400/90">Rails Operational</span>
            </div>

            <button
              onClick={() => setIsCheckoutModalOpen(true)}
              className="px-4 py-2 rounded-[4px] text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-[#1C1305] shadow-[0_4px_25px_rgba(245,158,11,0.3)] flex items-center gap-2 transition cursor-pointer border border-amber-300/50 active:scale-95"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#1C1305]" />
              <span>Launch Checkout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        <MerchantDashboard
          merchant={merchant}
          exchangeRate={exchangeRate}
          transactions={transactions}
          ledgerEntries={ledgerEntries}
          messageLogs={messageLogs}
          rails={rails}
          notificationSettings={notificationSettings}
          onOpenCheckoutModal={() => setIsCheckoutModalOpen(true)}
          onRefreshData={loadData}
          onUpdateRate={handleUpdateRate}
          onToggleRailStatus={handleToggleRailStatus}
          onSaveNotificationSettings={handleSaveNotificationSettings}
          onRetryMessage={handleRetryMessage}
        />
      </main>

      {/* Global Checkout Modal */}
      <ZimPayModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        merchant={merchant}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Editorial Workstation Footer */}
      <footer className="relative z-10 border-t border-amber-900/30 bg-[#0C0A09]/95 backdrop-blur-md py-4 px-6 text-center text-xs text-[#71717A]">
        <div className="flex flex-wrap items-center justify-between max-w-7xl mx-auto gap-2">
          <div className="font-serif italic text-amber-500/80">
            zim-pay-core · Bespoke Multi-Currency Clearinghouse
          </div>
          <div className="text-[11px] font-mono text-[#A1A1AA]">
            SERIALIZABLE ACID ISOLATION · RESERVE BANK OF ZIMBABWE RAILS
          </div>
        </div>
      </footer>
    </div>
  );
}
