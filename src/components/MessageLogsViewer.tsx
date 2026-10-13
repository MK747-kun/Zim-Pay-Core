/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MessageLog } from '../types';
import {
  Share2,
  Mail,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Code2,
  X,
  Send,
} from 'lucide-react';

interface MessageLogsViewerProps {
  logs: MessageLog[];
  onRetry: (id: string) => void;
  onRefresh: () => void;
}

export const MessageLogsViewer: React.FC<MessageLogsViewerProps> = ({
  logs,
  onRetry,
  onRefresh,
}) => {
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);
  const [filterChannel, setFilterChannel] = useState<'ALL' | 'WHATSAPP' | 'EMAIL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (filterChannel !== 'ALL' && log.channel !== filterChannel) return false;
    if (filterStatus !== 'ALL' && log.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#141210] p-3.5 rounded-[4px] border border-amber-900/30 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex bg-[#1F1B17] border border-amber-900/40 rounded-[4px] p-0.5 text-xs">
            <button
              onClick={() => setFilterChannel('ALL')}
              className={`px-3 py-1 rounded-[3px] transition cursor-pointer font-medium uppercase tracking-wider text-[11px] ${
                filterChannel === 'ALL' ? 'bg-[#F59E0B] text-[#1C1305] font-semibold shadow-sm' : 'text-[#A1A1AA] hover:text-[#FDFBF7]'
              }`}
            >
              All Channels ({logs.length})
            </button>
            <button
              onClick={() => setFilterChannel('WHATSAPP')}
              className={`px-3 py-1 rounded-[3px] transition flex items-center gap-1.5 cursor-pointer font-medium uppercase tracking-wider text-[11px] ${
                filterChannel === 'WHATSAPP' ? 'bg-[#F59E0B] text-[#1C1305] font-semibold shadow-sm' : 'text-[#A1A1AA] hover:text-[#FDFBF7]'
              }`}
            >
              <Share2 className="w-3 h-3" />
              WhatsApp
            </button>
            <button
              onClick={() => setFilterChannel('EMAIL')}
              className={`px-3 py-1 rounded-[3px] transition flex items-center gap-1.5 cursor-pointer font-medium uppercase tracking-wider text-[11px] ${
                filterChannel === 'EMAIL' ? 'bg-[#F59E0B] text-[#1C1305] font-semibold shadow-sm' : 'text-[#A1A1AA] hover:text-[#FDFBF7]'
              }`}
            >
              <Mail className="w-3 h-3" />
              Email
            </button>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1F1B17] border border-amber-900/40 rounded-[4px] px-2.5 py-1 text-xs text-[#FDFBF7] focus:border-[#F59E0B] focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="PROCESSING">Processing</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A1A1AA] hover:text-[#FDFBF7] px-3 py-1.5 rounded-[4px] border border-amber-900/40 hover:bg-[#1E1A16] transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Message Logs Table */}
      <div className="overflow-x-auto rounded-[4px] border border-amber-900/30 bg-[#141210] shadow-sm">
        <table className="w-full text-left text-xs text-[#D4D4D8]">
          <thead className="bg-[#171411] text-[11px] uppercase tracking-wider text-[#A1A1AA] border-b border-amber-900/30">
            <tr>
              <th className="py-3 px-4 font-semibold">Channel & Message ID</th>
              <th className="py-3 px-4 font-semibold">Recipient</th>
              <th className="py-3 px-4 font-semibold">Template</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Attempts</th>
              <th className="py-3 px-4 font-semibold">Timestamp</th>
              <th className="py-3 px-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-900/20">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#71717A] font-sans">
                  No messages logged in this queue view yet.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      {log.channel === 'WHATSAPP' ? (
                        <div className="p-1 rounded-[3px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <Share2 className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-[3px] bg-amber-500/10 text-[#F59E0B] border border-amber-500/30">
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-[#FDFBF7]">{log.channel}</div>
                        <div className="text-[10px] text-[#71717A] font-mono">{log.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#FDFBF7] font-mono text-[11px]">{log.recipient}</td>
                  <td className="py-3 px-4 text-[#A1A1AA] text-xs">{log.templateName}</td>
                  <td className="py-3 px-4">
                    {log.status === 'SENT' && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-2 py-0.5 rounded-[2px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                        <CheckCircle2 className="w-2.5 h-2.5" /> SENT
                      </span>
                    )}
                    {log.status === 'PROCESSING' && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-2 py-0.5 rounded-[2px] bg-amber-500/10 border border-amber-500/30 text-amber-300 animate-pulse">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> PROCESSING
                      </span>
                    )}
                    {log.status === 'QUEUED' && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-2 py-0.5 rounded-[2px] bg-amber-500/10 border border-amber-500/30 text-amber-300">
                        <Clock className="w-2.5 h-2.5" /> QUEUED
                      </span>
                    )}
                    {log.status === 'FAILED' && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-2 py-0.5 rounded-[2px] bg-rose-500/10 border border-rose-500/30 text-rose-300">
                        <AlertTriangle className="w-2.5 h-2.5" /> FAILED
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[#A1A1AA] font-mono text-[11px]">{log.attempts}</td>
                  <td className="py-3 px-4 text-[#A1A1AA] text-xs">
                    {log.sentAt ? new Date(log.sentAt).toLocaleTimeString() : 'In Queue'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded-[3px] bg-[#1E1A16] hover:bg-[#28221D] text-[#D4D4D8] hover:text-[#FDFBF7] text-xs font-semibold uppercase tracking-wider flex items-center gap-1 transition cursor-pointer border border-amber-900/40"
                        title="View payload"
                      >
                        <Code2 className="w-3 h-3 text-[#F59E0B]" />
                        <span>Payload</span>
                      </button>

                      {log.status === 'FAILED' && (
                        <button
                          onClick={() => onRetry(log.id)}
                          className="px-2.5 py-1 rounded-[3px] bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 text-xs font-semibold uppercase tracking-wider flex items-center gap-1 transition cursor-pointer border border-rose-500/30"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Payload Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-2xl bg-[#141210] border border-amber-900/40 rounded-[6px] shadow-2xl p-6 text-[#FDFBF7] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-amber-900/30 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-[4px] bg-amber-500/15 border border-amber-500/40 text-[#F59E0B]">
                  <Code2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#FDFBF7] tracking-tight">
                  Payload Inspection: <span className="font-mono text-[#F59E0B] text-xs">{selectedLog.id}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-[#A1A1AA] hover:text-[#FDFBF7] p-1 rounded-[3px] hover:bg-white/[0.05] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#171411] p-2.5 rounded-[4px] border border-amber-900/25">
                  <span className="text-[#A1A1AA]">Channel:</span>{' '}
                  <span className="text-[#FDFBF7] font-semibold">{selectedLog.channel}</span>
                </div>
                <div className="bg-[#171411] p-2.5 rounded-[4px] border border-amber-900/25">
                  <span className="text-[#A1A1AA]">Recipient:</span>{' '}
                  <span className="text-[#F59E0B] font-mono text-[11px]">{selectedLog.recipient}</span>
                </div>
                <div className="bg-[#171411] p-2.5 rounded-[4px] border border-amber-900/25">
                  <span className="text-[#A1A1AA]">Template:</span>{' '}
                  <span className="text-[#FDFBF7] font-mono text-[11px]">{selectedLog.templateName}</span>
                </div>
                <div className="bg-[#171411] p-2.5 rounded-[4px] border border-amber-900/25">
                  <span className="text-[#A1A1AA]">Provider Message ID:</span>{' '}
                  <span className="text-[#F59E0B] font-mono text-[11px]">{selectedLog.providerMessageId || 'Pending'}</span>
                </div>
              </div>

              {selectedLog.errorDetails && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-[4px] text-xs text-rose-200">
                  <span className="font-bold">Error Trace:</span> {selectedLog.errorDetails}
                </div>
              )}

              <div>
                <label className="text-xs text-[#A1A1AA] mb-1.5 block uppercase tracking-wider text-[11px] font-semibold">
                  Raw Outgoing JSON Payload:
                </label>
                <pre className="p-3.5 bg-[#0E0C0A] border border-amber-900/35 rounded-[4px] text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-64 shadow-inner">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-4 border-t border-amber-900/30 mt-4 flex justify-end gap-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-[#1E1A16] hover:bg-[#28221D] text-xs rounded-[4px] font-semibold uppercase tracking-wider text-[#FDFBF7] transition cursor-pointer border border-amber-900/40"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
