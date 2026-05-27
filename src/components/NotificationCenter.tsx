import React, { useState } from "react";
import { NotificationLog } from "../types";
import { Mail, Clock, Send, Eye, RefreshCw, Zap } from "lucide-react";

interface NotificationCenterProps {
  logs: NotificationLog[];
  onRefreshLogs: () => Promise<void>;
}

export default function NotificationCenter({ logs, onRefreshLogs }: NotificationCenterProps) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs[0]?.id || null);
  const [refreshing, setRefreshing] = useState(false);

  const activeLog = logs.find((log) => log.id === selectedLogId) || logs[0] || null;

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await onRefreshLogs();
    setRefreshing(false);
  };

  const formattedTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur border border-white/[0.06] rounded-xl p-6 md:p-8">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b border-white/[0.06]">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
            <Mail className="w-4 h-4 text-indigo-400" />
            Symulowane logi powiadomień e-mail
          </h2>
          <p className="text-[10px] text-white/25 mt-1.5 tracking-wide">
            Rejestr audytowy śledzący symulowane wysyłki SMTP.
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] text-white/50 hover:text-white/70 hover:border-white/10 text-xs rounded-lg font-semibold transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Synchronizowanie..." : "Synchronizuj"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Email list */}
        <div className="md:col-span-5 space-y-2 max-h-[440px] overflow-y-auto pr-1">
          <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-white/20 mb-2">
            Kolejka poczty ({logs.length})
          </span>

          {logs.length === 0 ? (
            <div className="text-center py-14 border border-dashed border-white/10 rounded-xl">
              <Mail className="w-6 h-6 text-white/15 mx-auto mb-2" />
              <p className="text-[10px] text-white/20">Brak zarejestrowanych powiadomień</p>
            </div>
          ) : (
            logs.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelectedLogId(log.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  activeLog?.id === log.id
                    ? "bg-white/[0.06] border-indigo-500/30"
                    : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-[10px] font-semibold text-white/70 truncate flex-1">{log.subject}</h4>
                  <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold shrink-0">
                    {log.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-white/25">
                  <span>{log.recipientName}</span>
                  <span className="font-mono">{formattedTime(log.sentAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Email preview */}
        <div className="md:col-span-7">
          {activeLog ? (
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.04] space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-white/40">
                  <Send className="w-3 h-3 text-indigo-400" />
                  <span className="font-semibold">Do:</span>
                  <span className="text-white/60">{activeLog.recipientName}</span>
                  <span className="text-white/20 font-mono">&lt;{activeLog.recipientEmail}&gt;</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-white/40">
                  <Clock className="w-3 h-3" />
                  <span className="font-mono">{formattedTime(activeLog.sentAt)}</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-bold text-white/80 mb-3">{activeLog.subject}</h3>
                <div className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap font-mono bg-white/[0.02] p-4 rounded-lg border border-white/[0.04]">
                  {activeLog.body}
                </div>
              </div>
              <div className="px-4 pb-4 flex items-center gap-2 text-[9px] text-white/20">
                <span className="font-mono">ID: {activeLog.id}</span>
                <span>|</span>
                <span className="font-mono">Ticket: {activeLog.ticketId}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Mail className="w-8 h-8 text-white/10 mb-2" />
              <p className="text-[10px] text-white/20">Wybierz powiadomienie z listy</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
