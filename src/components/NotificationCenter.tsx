import React, { useState } from 'react';
import { NotificationLog } from '../types';
import { Mail, Clock, Send, Eye, RefreshCw, Layers } from 'lucide-react';

interface NotificationCenterProps {
  logs: NotificationLog[];
  onRefreshLogs: () => Promise<void>;
}

export default function NotificationCenter({ logs, onRefreshLogs }: NotificationCenterProps) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs[0]?.id || null);
  const [refreshing, setRefreshing] = useState(false);

  const activeLog = logs.find(log => log.id === selectedLogId) || logs[0] || null;

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
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-2xs hover:shadow-xs transition-shadow duration-300">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 leading-none font-sans tracking-tight">
            <Mail className="w-5 h-5 text-indigo-600" />
            Symulowane logi powiadomień e-mail
          </h2>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Rejestr audytowy śledzący symulowane wysyłki SMTP wywoływane przez zmiany statusu zgłoszeń w czasie rzeczywistym.
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-250 hover:border-slate-350 text-slate-707 hover:bg-slate-100 text-xs rounded-lg font-bold transition-all cursor-pointer shadow-2xs select-none active:scale-95 disabled:opacity-50"
          title="Odśwież logi powiadomień"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Synchronizowanie...' : 'Synchronizuj logi'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Email Dispatch Registry (Left Column/List) */}
        <div className="md:col-span-5 space-y-3 max-h-[440px] overflow-y-auto pr-1">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Kolejka poczty wychodzącej (zarejestrowano: {logs.length})
          </span>

          {logs.length === 0 ? (
            <div className="text-center py-14 border border-slate-205 border-dashed rounded-2xl bg-slate-50/55">
              <Mail className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Brak zarejestrowanych transakcji e-mail.</p>
            </div>
          ) : (
            logs.map((log) => {
              const isActive = activeLog && activeLog.id === log.id;
              return (
                <button
                  key={log.id}
                  onClick={() => setSelectedLogId(log.id)}
                  className={`w-full text-left p-3.5 rounded-xl border text-xs flex flex-col gap-1.5 transition-all cursor-pointer select-none ${
                    isActive
                      ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500/10 shadow-xs'
                      : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50/65 bg-white shadow-2xs'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono text-[8px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-slate-500 rounded font-bold shrink-0">
                      {log.id}
                    </span>
                    <span className="text-[9px] text-slate-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      {formattedTime(log.sentAt).split(' ')[1]}
                    </span>
                  </div>

                  <p className="font-bold text-slate-800 truncate line-clamp-1 font-sans text-xs">
                    {log.subject}
                  </p>

                  <p className="text-[10px] text-slate-500 truncate">
                    Do: <span className="font-bold text-slate-600">{log.recipientEmail}</span>
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Styled Interactive Email Simulator Display (Right Column) */}
        <div className="md:col-span-7">
          {activeLog ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex flex-col justify-between shadow-xs">
              {/* Fake Email client header chrome */}
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center justify-between text-[11px] font-sans text-slate-500 select-none">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="ml-1 text-slate-500">Silnik emulacji powiadomień SMTP</span>
                </div>
                <div>
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    SUKCES SYMULACJI
                  </span>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="bg-white p-6 space-y-4 font-sans text-xs">
                {/* Headers */}
                <div className="space-y-2 pb-4 border-b border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-bold w-16 inline-block uppercase tracking-wider text-[9px]">Od:</span>
                    <span className="text-slate-700 font-semibold text-[11px]">Google IT Support Gatekeeper &lt;noreply@bagietka-it.com&gt;</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold w-16 inline-block uppercase tracking-wider text-[9px]">Do:</span>
                    <span className="text-slate-700 font-bold text-[11px]">{activeLog.recipientName} &lt;{activeLog.recipientEmail}&gt;</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold w-16 inline-block uppercase tracking-wider text-[9px]">Temat:</span>
                    <span className="text-slate-900 font-extrabold text-[11px]">{activeLog.subject}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold w-16 inline-block uppercase tracking-wider text-[9px]">Data:</span>
                    <span className="text-slate-500 font-semibold">{formattedTime(activeLog.sentAt)}</span>
                  </div>
                </div>

                {/* Email Body Markup */}
                <div className="text-slate-700 leading-relaxed font-sans bg-slate-50/75 rounded-xl p-4.5 border border-slate-200 whitespace-pre-wrap text-[11px]">
                  {activeLog.body}
                </div>

                {/* Simulated Email footer styling */}
                <div className="border-t border-slate-100 pt-4 text-[9px] text-slate-400 leading-normal text-center bg-slate-5px/50 p-3 rounded-lg font-medium">
                  Ta transakcja reprezentuje automatyczne powiadomienie systemowe wysłane w odniesieniu do sprawy #{activeLog.ticketId}.
                  <br />
                  Aby skonfigurować rzeczywistą obsługę poczty SMTP, dostosuj dane uwierzytelniające w pliku konfiguracyjnym <span className="font-mono text-[8px] bg-slate-100 p-0.5 rounded font-bold">.env</span>.
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 py-24 px-4 rounded-2xl text-center bg-slate-50/50">
              <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
              <h3 className="text-xs font-bold text-slate-707">Nie wybrano e-maila do podglądu</h3>
              <p className="text-[11px] text-slate-400 mt-1.5 max-w-sm mx-auto">
                Wybierz pozycję wychodzącą w kolejce dziennika wysyłek, aby sprawdzić formatowanie szablonu.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
