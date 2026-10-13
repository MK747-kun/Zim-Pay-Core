/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Currency,
  ExchangeRate,
  PaymentProvider,
  RateLock,
  Transaction,
  Merchant,
} from '../types';
import { generateTransactionPdfReceipt } from './PdfReceiptGenerator';
import {
  ShieldCheck,
  Clock,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  QrCode,
  Building2,
  Share2,
  Download,
  X,
  Zap,
  Lock,
  Sparkles,
} from 'lucide-react';

interface ZimPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchant: Merchant;
  onPaymentSuccess?: (tx: Transaction) => void;
}

export const ZimPayModal: React.FC<ZimPayModalProps> = ({
  isOpen,
  onClose,
  merchant,
  onPaymentSuccess,
}) => {
  // Checkout Input States
  const [amount, setAmount] = useState<number>(45.00);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [provider, setProvider] = useState<PaymentProvider>('ECOCASH');
  const [customerPhone, setCustomerPhone] = useState<string>('0772123456');
  const [customerEmail, setCustomerEmail] = useState<string>('customer@hararehub.co.zw');
  const [customerName, setCustomerName] = useState<string>('Farai Mutasa');

  // Rate Lock & Slippage Guard States
  const [rateLock, setRateLock] = useState<RateLock | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600); // 10 minutes
  const [isLockExpired, setIsLockExpired] = useState<boolean>(false);
  const [isLoadingLock, setIsLoadingLock] = useState<boolean>(false);
  const [slippageAlert, setSlippageAlert] = useState<string | null>(null);

  // Payment Execution & Fallback States
  const [checkoutStep, setCheckoutStep] = useState<'DETAILS' | 'PROCESSING_USSD' | 'FALLBACK_OFFERED' | 'SUCCESS'>('DETAILS');
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ussdCountdown, setUssdCountdown] = useState<number>(15);
  const [fallbackMethod, setFallbackMethod] = useState<'INNBUCKS' | 'ZIPIT'>('INNBUCKS');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ussdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Rate Lock when Modal Opens or Currency/Amount Changes
  useEffect(() => {
    if (isOpen) {
      fetchNewRateLock();
    } else {
      resetModalState();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (ussdTimerRef.current) clearInterval(ussdTimerRef.current);
    };
  }, [isOpen, currency, amount]);

  // Countdown Interval for 10-minute validity window
  useEffect(() => {
    if (!rateLock || checkoutStep === 'SUCCESS') return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsLockExpired(true);
          setSlippageAlert('10-Minute Rate Lock has expired. Exchange rate must be refreshed before processing.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [rateLock, checkoutStep]);

  const resetModalState = () => {
    setCheckoutStep('DETAILS');
    setActiveTransaction(null);
    setIsProcessing(false);
    setErrorMessage(null);
    setSlippageAlert(null);
    setIsLockExpired(false);
  };

  const fetchNewRateLock = async () => {
    try {
      setIsLoadingLock(true);
      setSlippageAlert(null);
      setIsLockExpired(false);

      const targetCurrency: Currency = currency === 'USD' ? 'ZIG' : 'USD';
      const res = await fetch('/api/checkout/create-rate-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseCurrency: currency,
          targetCurrency,
          amountBase: amount,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create rate lock');
      }

      const lock: RateLock = await res.json();
      setRateLock(lock);
      setSecondsRemaining(lock.ttlRemainingSeconds || 600);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not establish rate lock with gateway.');
    } finally {
      setIsLoadingLock(false);
    }
  };

  // Format MM:SS
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Step 1: Initiate Payment on Primary Rail (EcoCash)
  const handleInitiatePayment = async () => {
    if (!rateLock || isLockExpired) {
      setSlippageAlert('Rate lock expired. Please refresh rate before proceeding.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await fetch('/api/checkout/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rateLockId: rateLock.id,
          provider,
          amount,
          currency,
          customerPhone,
          customerEmail,
          customerName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate checkout');
      }

      setActiveTransaction(data.transaction);
      setCheckoutStep('PROCESSING_USSD');
      setUssdCountdown(15);

      // Start 15s USSD prompt timer
      if (ussdTimerRef.current) clearInterval(ussdTimerRef.current);
      ussdTimerRef.current = setInterval(() => {
        setUssdCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(ussdTimerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2a: Customer Enters USSD PIN -> Settle
  const handleCompletePayment = async () => {
    if (!activeTransaction) return;

    try {
      setIsProcessing(true);
      if (ussdTimerRef.current) clearInterval(ussdTimerRef.current);

      const res = await fetch(`/api/checkout/complete/${activeTransaction.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          status: 'SUCCESS',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Payment execution failed');
      }

      setActiveTransaction(data.transaction);
      setCheckoutStep('SUCCESS');
      if (onPaymentSuccess) {
        onPaymentSuccess(data.transaction);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2b: Simulate EcoCash Timeout/Failure -> Dynamic Fallback Triggered
  const handleSimulateRailFailure = async () => {
    if (!activeTransaction) return;

    try {
      setIsProcessing(true);
      if (ussdTimerRef.current) clearInterval(ussdTimerRef.current);

      const res = await fetch(`/api/checkout/trigger-fallback/${activeTransaction.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'EcoCash USSD MNO Timeout (15s elapsed without subscriber pin verification)',
          desiredFallback: fallbackMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Fallback routing failed');
      }

      setActiveTransaction(data.transaction);
      setCheckoutStep('FALLBACK_OFFERED');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const targetAmount = rateLock
    ? currency === 'USD'
      ? (amount * rateLock.lockedRate).toFixed(2)
      : (amount / rateLock.lockedRate).toFixed(2)
    : '0.00';

  const targetCurrency = currency === 'USD' ? 'ZIG' : 'USD';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-[#181512] via-[#141210] to-[#12100E] border border-amber-900/40 rounded-[6px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden text-[#FDFBF7] my-8">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/30 bg-[#191512]/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[4px] bg-gradient-to-br from-amber-500/25 to-amber-900/40 border border-amber-500/40 flex items-center justify-center text-[#F59E0B] shadow-sm">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-base tracking-tight text-[#FDFBF7]">zim-pay-core</span>
                <span className="text-[10px] font-sans uppercase tracking-widest font-semibold px-2 py-0.5 rounded-[2px] bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  Rate-Slippage Guard
                </span>
              </div>
              <div className="text-xs text-[#A1A1AA] font-sans">{merchant.name}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A1A1AA] hover:text-[#FDFBF7] rounded-[4px] hover:bg-white/[0.05] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual-Currency Rate-Slippage Lock Banner */}
        <div className="bg-[#12100E] px-6 py-3 border-b border-amber-900/25 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Lock className={`w-3.5 h-3.5 ${isLockExpired ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className="text-[#A1A1AA] font-sans text-xs">Locked Rate:</span>
            <span className="font-sans font-semibold text-[#FDFBF7]">
              1 USD = <span className="text-[#F59E0B] font-serif font-bold">{rateLock?.lockedRate || '26.8500'}</span> ZiG
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 font-sans font-medium ${isLockExpired ? 'text-rose-400' : secondsRemaining < 60 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{isLockExpired ? 'EXPIRED' : formatTimer(secondsRemaining)}</span>
            </div>

            <button
              onClick={fetchNewRateLock}
              disabled={isLoadingLock}
              className="flex items-center gap-1 text-xs font-sans text-[#F59E0B] hover:text-amber-300 transition cursor-pointer"
              title="Refresh locked exchange rate"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingLock ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Slippage Alert Notice */}
        {slippageAlert && (
          <div className="mx-6 mt-4 p-3.5 rounded-[4px] bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold font-sans">{slippageAlert}</p>
              <button
                onClick={fetchNewRateLock}
                className="mt-1 text-xs text-amber-300 underline font-medium hover:text-amber-200 cursor-pointer font-sans"
              >
                Click here to refresh 10-minute rate lock with current interbank rate
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-[4px] bg-rose-950/40 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="font-sans">{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: PAYMENT DETAILS */}
        {checkoutStep === 'DETAILS' && (
          <div className="p-6 space-y-5">
            {/* Amount & Currency Selection Card */}
            <div className="p-4 rounded-[4px] bg-[#171411] border border-amber-900/30 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-[#A1A1AA] font-sans font-medium">
                <span>Select Currency & Amount</span>
                <span className="text-[11px] text-emerald-400 font-sans font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  10m Rate Lock Guaranteed
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-serif font-bold text-sm text-[#F59E0B]">
                      {currency === 'USD' ? '$' : 'ZiG'}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={amount}
                      onChange={(e) => setAmount(Math.max(0.1, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#1F1B17] border border-amber-900/40 rounded-[4px] pl-10 pr-3 py-2 text-lg font-serif font-bold text-[#FDFBF7] focus:outline-none focus:border-[#F59E0B] transition"
                    />
                  </div>
                </div>

                <div className="flex bg-[#1F1B17] border border-amber-900/40 rounded-[4px] p-0.5">
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`px-3.5 py-1.5 text-xs font-sans font-semibold rounded-[3px] transition cursor-pointer ${
                      currency === 'USD' ? 'bg-[#F59E0B] text-[#1C1305] shadow-sm' : 'text-[#A1A1AA] hover:text-[#FDFBF7]'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('ZIG')}
                    className={`px-3.5 py-1.5 text-xs font-sans font-semibold rounded-[3px] transition cursor-pointer ${
                      currency === 'ZIG' ? 'bg-[#F59E0B] text-[#1C1305] shadow-sm' : 'text-[#A1A1AA] hover:text-[#FDFBF7]'
                    }`}
                  >
                    ZiG (Gold)
                  </button>
                </div>
              </div>

              {/* Live Counter-value Display */}
              <div className="pt-2.5 border-t border-amber-900/20 flex items-center justify-between text-xs font-sans">
                <span className="text-[#A1A1AA]">Guaranteed Countervalue:</span>
                <div className="flex items-center gap-1.5 text-[#F59E0B] font-serif font-bold text-base">
                  <span>
                    {targetCurrency} {targetAmount}
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Payment Provider Options */}
            <div>
              <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-[#A1A1AA] mb-2">
                Primary Payment Rail
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  {
                    id: 'ECOCASH' as PaymentProvider,
                    name: 'EcoCash Mobile Money',
                    sub: 'USSD Push Prompt (*151#)',
                    badge: 'Primary Rail',
                  },
                  {
                    id: 'INNBUCKS' as PaymentProvider,
                    name: 'InnBucks Express',
                    sub: 'Instant QR / USSD (*569#)',
                    badge: 'Backup QR',
                  },
                  {
                    id: 'ZIPIT' as PaymentProvider,
                    name: 'Zimswitch ZIPIT',
                    sub: 'Instant Bank Settlement',
                    badge: 'Interbank RTGS',
                  },
                  {
                    id: 'ONEMONEY' as PaymentProvider,
                    name: 'NetOne OneMoney',
                    sub: 'Mobile Wallet Push',
                    badge: 'MNO Rail',
                  },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`p-3 rounded-[4px] border text-left transition relative cursor-pointer ${
                      provider === p.id
                        ? 'bg-amber-500/15 border-amber-500/50 shadow-sm ring-1 ring-amber-500/30'
                        : 'bg-[#171411] border-amber-900/25 hover:border-amber-700/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-[#FDFBF7] font-sans">{p.name}</span>
                      <span className="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded-[2px] bg-[#221C16] text-[#D4D4D8] border border-amber-900/30">
                        {p.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#A1A1AA] font-sans">{p.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Contact Details */}
            <div className="grid grid-cols-2 gap-3 text-xs font-sans">
              <div>
                <label className="block text-[#A1A1AA] mb-1 text-[11px] font-medium">Subscriber Mobile Number</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0772123456"
                  className="w-full bg-[#1F1B17] border border-amber-900/40 rounded-[4px] px-3 py-2 text-[#FDFBF7] font-mono text-xs focus:border-[#F59E0B] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#A1A1AA] mb-1 text-[11px] font-medium">Receipt Email Address</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="w-full bg-[#1F1B17] border border-amber-900/40 rounded-[4px] px-3 py-2 text-[#FDFBF7] font-mono text-xs focus:border-[#F59E0B] focus:outline-none"
                />
              </div>
            </div>

            {/* Pay Button */}
            <button
              onClick={handleInitiatePayment}
              disabled={isProcessing || isLockExpired}
              className="w-full py-3 px-4 rounded-[4px] font-sans font-semibold text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-[#1C1305] shadow-[0_4px_25px_rgba(245,158,11,0.3)] transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border border-amber-300/40"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#1C1305]" />
                  <span>Initiating Rail Handshake...</span>
                </>
              ) : (
                <>
                  <span>Authorize & Pay {currency} {amount.toFixed(2)}</span>
                  <span className="text-[#1C1305]/80 font-normal">[{targetCurrency} {targetAmount}]</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: USSD PUSH IN PROGRESS (SIMULATED MOBILE PROMPT) */}
        {checkoutStep === 'PROCESSING_USSD' && activeTransaction && (
          <div className="p-6 space-y-6">
            <div className="text-center space-y-1">
              <div className="inline-flex p-3 rounded-[6px] bg-amber-400/10 text-amber-300 border border-amber-400/30 mb-2">
                <Smartphone className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="font-bold text-base text-white font-sans tracking-tight">USSD Push Sent to Subscriber</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto font-sans">
                Please check your phone (<span className="font-mono text-slate-300">{activeTransaction.customerPhone}</span>) for the EcoCash PIN prompt.
              </p>
            </div>

            {/* Simulated Phone Screen */}
            <div className="max-w-xs mx-auto p-4 rounded-[6px] bg-[#0c1017] border border-white/10 shadow-2xl text-center space-y-3">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-sans font-semibold">
                EcoCash SIM Application
              </div>
              <div className="p-3 bg-[#131924] rounded-[4px] text-xs text-slate-200 leading-relaxed border border-white/[0.08] font-sans">
                Pay Harare Wholesale Hub?<br />
                Amount: <span className="font-bold text-white font-sans">{activeTransaction.currency} {activeTransaction.amount.toFixed(2)}</span><br />
                Ref: <span className="text-amber-300 font-mono">{activeTransaction.referenceCode}</span><br />
                Enter 4-digit PIN: <span className="text-amber-400 tracking-widest">••••</span>
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                Prompt timeout in: <span className="text-amber-300 font-bold font-mono">{ussdCountdown}s</span>
              </div>
            </div>

            {/* Interactive Simulation Controls */}
            <div className="bg-[#10141e] p-4 rounded-[4px] border border-white/[0.08] space-y-3">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-sans">
                Gateway Simulation Controls:
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCompletePayment}
                  disabled={isProcessing}
                  className="py-2.5 px-3 rounded-[4px] text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>PIN Entered (Success)</span>
                </button>

                <button
                  onClick={handleSimulateRailFailure}
                  disabled={isProcessing}
                  className="py-2.5 px-3 rounded-[4px] text-xs font-semibold bg-rose-950/60 border border-rose-500/30 text-rose-200 hover:bg-rose-900/60 transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Timeout (Trigger Fallback)</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 text-center font-sans">
                Dynamic Fallback Routing preserves checkout session without re-quoting locked rates.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: DYNAMIC FALLBACK ROUTING TRIGGERED */}
        {checkoutStep === 'FALLBACK_OFFERED' && activeTransaction && (
          <div className="p-6 space-y-5">
            {/* Fallback Warning Banner */}
            <div className="p-3.5 rounded-[4px] bg-amber-950/30 border border-amber-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-bold text-amber-300 font-sans uppercase">
                  Primary Rail Timeout Safeguard Triggered
                </div>
                <div className="text-xs text-amber-200/90 leading-relaxed font-sans">
                  EcoCash did not respond within 15 seconds. Active checkout session <span className="font-mono font-bold text-white">#{activeTransaction.referenceCode}</span> and 10-minute rate lock are <strong className="text-emerald-400">preserved</strong>. Switched to backup rail!
                </div>
              </div>
            </div>

            {/* Fallback Option Tabs */}
            <div className="flex bg-[#10141e] border border-white/[0.08] rounded-[4px] p-1 font-sans">
              <button
                type="button"
                onClick={() => setFallbackMethod('INNBUCKS')}
                className={`flex-1 py-2 text-xs font-semibold rounded-[3px] transition flex items-center justify-center gap-2 cursor-pointer ${
                  fallbackMethod === 'INNBUCKS' ? 'bg-amber-400 text-stone-950 shadow-sm font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>InnBucks QR & *569#</span>
              </button>
              <button
                type="button"
                onClick={() => setFallbackMethod('ZIPIT')}
                className={`flex-1 py-2 text-xs font-semibold rounded-[3px] transition flex items-center justify-center gap-2 cursor-pointer ${
                  fallbackMethod === 'ZIPIT' ? 'bg-amber-400 text-stone-950 shadow-sm font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>ZIPIT Instant Transfer</span>
              </button>
            </div>

            {/* Render InnBucks Backup QR */}
            {fallbackMethod === 'INNBUCKS' && (
              <div className="p-4 rounded-[4px] bg-[#10141e] border border-white/[0.08] text-center space-y-4">
                <div className="text-xs text-slate-300 font-sans">
                  Scan in InnBucks App or Dial <span className="text-amber-300 font-mono font-bold">*569#</span>
                </div>

                {/* SVG QR Code Display */}
                <div className="inline-block p-3 bg-white rounded-[4px] shadow-lg">
                  <svg width="140" height="140" viewBox="0 0 100 100" className="shape-rendering-crispEdges">
                    <rect width="100" height="100" fill="#ffffff" />
                    <rect x="10" y="10" width="24" height="24" fill="#0f172a" />
                    <rect x="14" y="14" width="16" height="16" fill="#ffffff" />
                    <rect x="18" y="18" width="8" height="8" fill="#0f172a" />
                    <rect x="66" y="10" width="24" height="24" fill="#0f172a" />
                    <rect x="70" y="14" width="16" height="16" fill="#ffffff" />
                    <rect x="74" y="18" width="8" height="8" fill="#0f172a" />
                    <rect x="10" y="66" width="24" height="24" fill="#0f172a" />
                    <rect x="14" y="70" width="16" height="16" fill="#ffffff" />
                    <rect x="18" y="74" width="8" height="8" fill="#0f172a" />
                    <rect x="40" y="12" width="6" height="6" fill="#0f172a" />
                    <rect x="52" y="18" width="6" height="6" fill="#0f172a" />
                    <rect x="44" y="28" width="8" height="6" fill="#0f172a" />
                    <rect x="40" y="40" width="20" height="20" fill="#d97706" />
                    <rect x="12" y="44" width="8" height="8" fill="#0f172a" />
                    <rect x="70" y="44" width="12" height="6" fill="#0f172a" />
                    <rect x="66" y="66" width="8" height="8" fill="#0f172a" />
                    <rect x="80" y="74" width="8" height="12" fill="#0f172a" />
                    <rect x="44" y="70" width="12" height="16" fill="#0f172a" />
                  </svg>
                </div>

                <div className="bg-[#141924] p-3 rounded-[4px] border border-white/[0.08] text-xs">
                  <div className="text-slate-400 font-sans text-[11px]">InnBucks Express Voucher:</div>
                  <div className="font-mono text-base font-bold text-amber-300 tracking-wider">
                    {activeTransaction.qrPayload ? 'IB-892104' : 'IB-491022'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-sans">
                    Dial *569# &gt; Pay Voucher &gt; Enter Code above
                  </div>
                </div>
              </div>
            )}

            {/* Render ZIPIT Interbank Backup */}
            {fallbackMethod === 'ZIPIT' && (
              <div className="p-4 rounded-[4px] bg-[#10141e] border border-white/[0.08] space-y-3 text-xs">
                <div className="text-slate-300 font-sans text-xs uppercase font-medium">
                  Transfer via Zimbabwe Mobile Banking (Stanbic, CABS, CBZ, FBC):
                </div>

                <div className="space-y-2 bg-[#141924] p-3 rounded-[4px] border border-white/[0.08] font-sans">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destination Bank:</span>
                    <span className="text-white font-semibold">Stanbic Bank (3101)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account Number:</span>
                    <span className="text-amber-300 font-mono font-bold">9140003849120</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account Name:</span>
                    <span className="text-slate-200">ZimPay Escrow FBO Harare Hub</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.06] pt-2">
                    <span className="text-slate-400">ZIPIT Reference:</span>
                    <span className="text-amber-300 font-mono font-bold">
                      ZPT-{activeTransaction.referenceCode}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-sans">
                  Zimswitch ZIPIT interbank engine reconciles within 3 seconds of transfer.
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 font-sans">
              <button
                onClick={() => setCheckoutStep('PROCESSING_USSD')}
                className="flex-1 py-2.5 px-3 rounded-[4px] border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/[0.05] transition cursor-pointer"
              >
                Retry Primary Rail
              </button>

              <button
                onClick={handleCompletePayment}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 rounded-[4px] bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-xs font-semibold text-stone-950 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isProcessing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm Backup Payment</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS & DUAL MESSAGING NOTIFICATIONS */}
        {checkoutStep === 'SUCCESS' && activeTransaction && (
          <div className="p-6 space-y-6 text-center">
            <div className="inline-flex p-3 rounded-[6px] bg-emerald-400/10 text-emerald-300 border border-emerald-400/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white font-sans tracking-tight">Payment Confirmed & Settled</h3>
              <p className="text-xs text-slate-400 font-sans">
                Processed via {activeTransaction.fallbackProvider ? `${activeTransaction.fallbackProvider} (Fallback)` : activeTransaction.provider} · Reference: <span className="font-mono text-amber-300 font-bold">{activeTransaction.referenceCode}</span>
              </p>
            </div>

            {/* Transaction Summary Card */}
            <div className="p-4 rounded-[4px] bg-[#10141e] border border-white/[0.08] text-left space-y-2 text-xs font-sans">
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Paid:</span>
                <span className="font-sans font-bold text-white text-sm">
                  {activeTransaction.currency} {activeTransaction.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dual-Currency Equiv:</span>
                <span className="font-sans text-slate-300">
                  {activeTransaction.convertedCurrency} {activeTransaction.convertedAmount?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Exchange Rate Locked:</span>
                <span className="font-sans text-amber-300 font-semibold">
                  1 USD = {activeTransaction.rateApplied} ZiG
                </span>
              </div>
              <div className="flex justify-between border-t border-white/[0.06] pt-2">
                <span className="text-slate-400">ACID Ledger Status:</span>
                <span className="text-emerald-400 font-mono text-[11px] font-semibold">
                  SERIALIZABLE · COMMITTED
                </span>
              </div>
            </div>

            {/* Dual Messaging Dispatch Engine */}
            <div className="p-4 rounded-[4px] bg-[#10141e] border border-white/[0.08] space-y-3 text-left">
              <div className="text-xs font-sans font-semibold text-white flex items-center justify-between">
                <span>DUAL MESSAGING DISPATCH</span>
                <span className="text-[10px] font-sans font-medium text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Queued & Dispatched
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* WhatsApp Dispatch */}
                <div className="flex items-center justify-between p-2.5 rounded-[4px] bg-[#141924] border border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-slate-200 font-sans">WhatsApp Cloud API</div>
                      <div className="text-[10px] text-slate-400 font-mono">Sent to {activeTransaction.customerPhone}</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-[3px] bg-emerald-400/10 text-emerald-300 font-mono border border-emerald-400/20">
                    SENT
                  </span>
                </div>

                {/* Email Dispatch & PDF Download */}
                <div className="flex items-center justify-between p-2.5 rounded-[4px] bg-[#141924] border border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-amber-300" />
                    <div>
                      <div className="font-semibold text-slate-200 font-sans">PDF Payment Receipt</div>
                      <div className="text-[10px] text-slate-400 font-mono">Dispatched to {activeTransaction.customerEmail}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => generateTransactionPdfReceipt(activeTransaction, merchant)}
                    className="text-[11px] px-2.5 py-1 rounded-[3px] bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-sans font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-stone-950" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-[4px] font-sans font-semibold text-xs tracking-wide bg-white/10 hover:bg-white/15 text-white transition cursor-pointer border border-white/10"
            >
              Done / Return to Merchant Hub
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
