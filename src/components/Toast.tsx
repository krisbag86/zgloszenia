import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

const DISMISS_AFTER_MS = 4500;

function ToastEntry({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: {
      bar: 'bg-emerald-500',
      border: 'border-emerald-150',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
      text: 'text-emerald-900',
    },
    error: {
      bar: 'bg-rose-500',
      border: 'border-rose-150',
      icon: <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />,
      text: 'text-rose-900',
    },
    info: {
      bar: 'bg-indigo-500',
      border: 'border-indigo-150',
      icon: <Info className="w-4 h-4 text-indigo-600 shrink-0" />,
      text: 'text-slate-800',
    },
  }[toast.type];

  return (
    <div
      className={`flex items-stretch w-80 bg-white rounded-2xl border ${config.border} shadow-lg overflow-hidden`}
      role="alert"
    >
      {/* Left accent bar */}
      <div className={`w-1 shrink-0 ${config.bar}`} />

      {/* Content */}
      <div className="flex items-start gap-2.5 px-3.5 py-3 flex-1 min-w-0">
        {config.icon}
        <span className={`text-xs font-medium leading-relaxed flex-1 ${config.text}`}>
          {toast.message}
        </span>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 text-slate-350 hover:text-slate-600 transition-colors mt-0.5 cursor-pointer"
          aria-label="Zamknij powiadomienie"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastEntry toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
