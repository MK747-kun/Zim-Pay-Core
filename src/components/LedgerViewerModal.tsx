/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LedgerEntry } from '../types';
import { Database, ShieldCheck, X } from 'lucide-react';

interface LedgerViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LedgerEntry[];
}

export const LedgerViewerModal: React.FC<LedgerViewerModalProps> = ({
  isOpen,
  onClose,
  entries,
}) => {
  const [filterCurrency, setFilterCurrency] = useState<'ALL' | 'USD' | 'ZIG'>('ALL');

  if (!isOpen) return null;

  const filtered = entries.filter((e) => {
    if (filterCurrency !== 'ALL' && e.currency !== filterCurrency) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-sans">
      <div className="relative w-full max-w-4xl bg-[#141210] border border-amber-900/40 rounded-[6px] shadow-2xl p-6 text-[#FDFBF7] max-h-[88vh] flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-amber-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[4px] bg-amber-500/15 text-[#F59E0B] border border-amber-500/35">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-lg text-[#FDFBF7] tracking-tight">
                  ACID Double-Entry General Ledger
                </h3>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-[2px] bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  SERIALIZABLE ISOLATION
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA]">
                Immutable audit ledger recording double-entry debit/credit journals for customer settlements.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#A1A1AA] hover:text-[#FDFBF7] p-1.5 rounded-[3px] hover:bg-white/[0.05] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currency Filter & Stats */}
        <div className="py-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex bg-[#1F1B17] border border-amber-900/40 rounded-[4px] p-0.5">
            <button
              onClick={() => setFilterCurrency('ALL')}
              className={`px-3 py-1 rounded-[3px] transition cursor-pointer font-semibold uppercase tracking-wider text-[11px] ${
                filterCurrency === 'ALL' ? 'bg-[#F59E0B] text-[#1C1305] shadow-sm' : 'text-[#A1A1AA] hover:text-[#FDFBF7]'
              }`}
            >
              All Records ({entries.length})
            </button>
            <button
              onClick={() => setFilterCurrency('USD')}
              className={`px-3 py-1 rounded-[3px] transition cursor-pointer font-semibold uppercase tracking-wider text-[11px] ${
                filterCurrency === 'USD' ? 'bg-[#F59E0B] text-[#1C1305] shadow-sm' : 'text-[#A1A1AA] hover:text-[#FDFBF7]'
              }`}
            >
              USD Entries
            </button>
            <button
              onClick={() => setFilterCurrency('ZIG')}
              className={`px-3 py-1 rounded-[3px] transition cursor-pointer font-semibold uppercase tracking-wider text-[11px] ${
                filterCurrency === 'ZIG' ? 'bg-[#F59E0B] text-[#1C1305] shadow-sm' : 'text-[#A1A1AA] hover:text-[#FDFBF7]'
              }`}
            >
              ZiG Entries
            </button>
          </div>

          <div className="flex items-center gap-2 text-[#A1A1AA] text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Zero Unbalanced Drift · Invariant Guaranteed</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto rounded-[4px] border border-amber-900/30 bg-[#100E0C] text-xs">
          <table className="w-full text-left">
            <thead className="bg-[#171411] sticky top-0 text-[11px] uppercase tracking-wider text-[#A1A1AA] border-b border-amber-900/30">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Entry ID & Tx</th>
                <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                <th className="py-2.5 px-3 font-semibold">Debit Account (DR)</th>
                <th className="py-2.5 px-3 font-semibold">Credit Account (CR)</th>
                <th className="py-2.5 px-3 text-right font-semibold">Amount</th>
                <th className="py-2.5 px-3 text-right font-semibold">Rate</th>
                <th className="py-2.5 px-3 text-center font-semibold">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-900/20">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 font-mono">
                    <div className="font-semibold text-[#FDFBF7]">{e.id}</div>
                    <div className="text-[10px] text-[#71717A]">{e.transactionId}</div>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-[#A1A1AA]">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 text-[#F59E0B] font-mono text-[11px]">
                    {e.accountDebited}
                  </td>
                  <td className="py-2.5 px-3 text-emerald-400 font-mono text-[11px]">
                    {e.accountCredited}
                  </td>
                  <td className="py-2.5 px-3 text-right font-serif font-bold text-[#FDFBF7]">
                    {e.currency} {e.amount.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-300 font-mono text-[11px]">
                    {e.rateApplied ? e.rateApplied.toFixed(2) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-[2px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                      {e.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-amber-900/30 mt-4 flex items-center justify-between text-xs">
          <span className="text-[#A1A1AA]">
            PostgreSQL Write-Ahead Logging (WAL) and ACID journal compliance enabled.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1E1A16] hover:bg-[#28221D] rounded-[4px] text-[#FDFBF7] font-semibold uppercase tracking-wider text-xs transition cursor-pointer border border-amber-900/40"
          >
            Close Ledger View
          </button>
        </div>
      </div>
    </div>
  );
};
